-- Migration: Fix calls_enriched view with boolean flags instead of categories
-- Date: 2025-10-24
-- Purpose: Replace abstract categorization with concrete boolean flags for frontend tabs
--
-- Changes from previous version:
-- - Remove call_category and quality_level (abstract entities)
-- - Add boolean flags: is_quality_call, is_short_call, is_voicemail, is_with_tools, is_not_started
-- - Add not_started_reason for error categorization (customer_unavailable, technical_error, other)
-- - Keep all QCI fields directly in main view (no separate QCI view)
--
-- Frontend will filter using:
-- - .eq('is_quality_call', true) for Quality tab
-- - .eq('is_short_call', true) for Short calls tab
-- - .eq('has_qci', true) for QCI filter
-- - .order('qci_score', { ascending: false }) for QCI sorting

-- ============================================================================
-- STEP 1: Drop old incorrect views
-- ============================================================================

DROP VIEW IF EXISTS quality_calls;
DROP VIEW IF EXISTS error_calls;
DROP VIEW IF EXISTS voicemail_calls;
DROP VIEW IF EXISTS calls_with_tools;
DROP VIEW IF EXISTS calls_enriched;

-- ============================================================================
-- STEP 2: Create new calls_enriched view with boolean flags
-- ============================================================================

CREATE VIEW calls_enriched AS
SELECT
  -- Core fields (always present)
  c.id,
  c.assistant_id,
  c.customer_id,
  c.customer_phone_number,
  c.started_at,
  c.ended_at,
  c.created_at,
  c.duration_seconds,
  c.cost,
  c.status,
  c.ended_reason,

  -- Content (may be null)
  c.transcript,
  c.recording_url,

  -- Tool tracking
  c.has_tool_calls,
  c.has_calendar_booking,
  c.tool_names,
  c.vapi_success_evaluation,

  -- QCI analysis (LEFT JOIN from qci_analyses, may be null)
  q.id as qci_id,
  q.total_score as qci_score,
  q.dynamics_score,
  q.objections_score,
  q.brand_score,
  q.outcome_score,
  q.coaching_tips,
  q.key_issues,
  q.recommendations,
  q.call_classification,
  q.analyzed_at as qci_analyzed_at,

  -- Assistant info (LEFT JOIN from vapi_assistants)
  a.name as assistant_name,
  a.model as assistant_model,
  a.voice as assistant_voice,

  -- ========================================================================
  -- BOOLEAN FLAGS for frontend tabs (BUSINESS LOGIC)
  -- ========================================================================

  -- Tab: Quality calls (≥60s, not voicemail)
  (c.started_at IS NOT NULL
   AND c.duration_seconds >= 60
   AND (c.ended_reason IS NULL OR c.ended_reason != 'voicemail')) as is_quality_call,

  -- Tab: Short calls (1-59s, not voicemail)
  (c.started_at IS NOT NULL
   AND c.duration_seconds >= 1
   AND c.duration_seconds < 60
   AND (c.ended_reason IS NULL OR c.ended_reason != 'voicemail')) as is_short_call,

  -- Tab: Voicemail
  (c.ended_reason = 'voicemail') as is_voicemail,

  -- Tab: Calls with tools (any tool usage)
  (c.has_tool_calls = true) as is_with_tools,

  -- Tab: Not started calls (started_at IS NULL)
  (c.started_at IS NULL) as is_not_started,

  -- ========================================================================
  -- ERROR CATEGORIZATION (for calls that didn't start)
  -- ========================================================================

  CASE
    -- Customer unavailable (didn't answer, busy)
    WHEN c.started_at IS NULL AND c.ended_reason IN (
      'customer-did-not-answer',
      'customer-busy'
    ) THEN 'customer_unavailable'

    -- Technical errors (Twilio, timeouts, connection issues)
    WHEN c.started_at IS NULL AND c.ended_reason IN (
      'twilio-failed-to-connect-call',
      'silence-timed-out',
      'call.start.error-get-transport',
      'call.start.error-get-customer'
    ) THEN 'technical_error'

    -- Other errors (any ended_reason with 'error')
    WHEN c.started_at IS NULL AND c.ended_reason LIKE '%error%'
      THEN 'technical_error'

    -- Other unknown reasons
    WHEN c.started_at IS NULL THEN 'other'

    -- Call started successfully (no error)
    ELSE NULL
  END as not_started_reason,

  -- ========================================================================
  -- SIMPLE FLAGS (computed fields)
  -- ========================================================================

  (c.transcript IS NOT NULL AND c.transcript != '') as has_transcript,
  (c.recording_url IS NOT NULL AND c.recording_url != '') as has_recording,
  (q.id IS NOT NULL) as has_qci,

  -- Effective date for sorting (handles NULL started_at)
  COALESCE(c.started_at, c.created_at) as effective_date

FROM vapi_calls_raw c
LEFT JOIN qci_analyses q ON c.id = q.call_id AND q.framework_id = 1
LEFT JOIN vapi_assistants a ON c.assistant_id = a.assistant_id;

-- Add comment
COMMENT ON VIEW calls_enriched IS
  'Main enriched view with boolean flags for frontend filtering. All QCI data included. Single source of truth for call analysis.';

-- ============================================================================
-- VERIFICATION QUERIES (commented out - for manual testing)
-- ============================================================================

-- Test boolean flags distribution:
-- SELECT
--   COUNT(*) as total,
--   COUNT(*) FILTER (WHERE is_quality_call) as quality_calls,
--   COUNT(*) FILTER (WHERE is_short_call) as short_calls,
--   COUNT(*) FILTER (WHERE is_voicemail) as voicemail,
--   COUNT(*) FILTER (WHERE is_with_tools) as with_tools,
--   COUNT(*) FILTER (WHERE is_not_started) as not_started,
--   COUNT(*) FILTER (WHERE has_qci) as with_qci
-- FROM calls_enriched;

-- Test error categorization:
-- SELECT
--   not_started_reason,
--   COUNT(*) as count,
--   ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
-- FROM calls_enriched
-- WHERE is_not_started = true
-- GROUP BY not_started_reason
-- ORDER BY count DESC;

-- Test quality calls:
-- SELECT COUNT(*) FROM calls_enriched WHERE is_quality_call = true;

-- Test QCI analysis:
-- SELECT
--   has_qci,
--   AVG(qci_score) as avg_score,
--   COUNT(*) as count
-- FROM calls_enriched
-- WHERE is_quality_call = true
-- GROUP BY has_qci;
