-- Migration: Create business logic views for frontend
-- Date: 2025-10-24
-- Purpose: Create optimized views with business logic (call categorization, quality assessment)
--
-- Strategy: Create NEW views without touching existing RPC functions
-- - calls_enriched: Main view with all business logic (replaces simple 'calls' view)
-- - quality_calls: Specialized view for quality calls (client's main use case)
-- - error_calls: Specialized view for error debugging
--
-- Risk: LOW - does not modify existing RPC functions or tables

-- ============================================================================
-- STEP 1: Drop old simple views (will be replaced)
-- ============================================================================

DROP VIEW IF EXISTS calls;

-- ============================================================================
-- STEP 2: Create main enriched view with business logic
-- ============================================================================

CREATE VIEW calls_enriched AS
SELECT
  -- All fields from vapi_calls_raw
  c.id,
  c.assistant_id,
  c.customer_id,
  c.status,
  c.ended_reason,
  c.started_at,
  c.ended_at,
  c.created_at,
  c.transcript,
  c.cost,
  c.customer_phone_number,
  c.recording_url,
  c.duration_seconds,
  c.vapi_success_evaluation,
  c.has_calendar_booking,
  c.has_tool_calls,
  c.tool_names,

  -- QCI analysis data
  q.id as qci_id,
  q.total_score as qci_score,
  q.dynamics_score,
  q.objections_score,
  q.brand_score,
  q.outcome_score,
  q.coaching_tips,
  q.key_issues,
  q.call_classification,
  q.analyzed_at as qci_analyzed_at,

  -- Assistant data
  a.name as assistant_name,
  a.model as assistant_model,
  a.voice as assistant_voice,

  -- BUSINESS LOGIC: Call category based on ended_reason and duration
  CASE
    -- Errors: connection failures, busy, no answer, timeouts
    WHEN c.ended_reason IN (
      'twilio-failed-to-connect-call',
      'customer-busy',
      'customer-did-not-answer',
      'silence-timed-out',
      'call.start.error-get-transport',
      'call.start.error-get-customer'
    ) OR c.ended_reason LIKE '%error%'
      THEN 'error'

    -- Voicemail: separate category for analysis
    WHEN c.ended_reason = 'voicemail'
      THEN 'voicemail'

    -- Quality: 60+ seconds, not error/voicemail
    WHEN c.duration_seconds >= 60
      THEN 'quality'

    -- Short: 1-59 seconds
    WHEN c.duration_seconds >= 1 AND c.duration_seconds < 60
      THEN 'short'

    -- Failed: no duration or 0 seconds
    ELSE 'failed'
  END as call_category,

  -- BUSINESS LOGIC: Quality level (for compatibility with existing RPC functions)
  CASE
    WHEN q.id IS NULL THEN NULL
    WHEN c.duration_seconds > 60 AND q.total_score > 70 THEN 'excellent'
    WHEN c.duration_seconds > 30 AND q.total_score > 50 THEN 'good'
    WHEN c.duration_seconds > 15 THEN 'average'
    ELSE 'poor'
  END as quality_level,

  -- Computed flags
  (c.transcript IS NOT NULL AND c.transcript != '') as has_transcript,
  (q.id IS NOT NULL) as has_qci,

  -- Effective date for filtering (handles NULL started_at)
  COALESCE(c.started_at, c.created_at) as effective_date

FROM vapi_calls_raw c
LEFT JOIN qci_analyses q ON c.id = q.call_id AND q.framework_id = 1
LEFT JOIN vapi_assistants a ON c.assistant_id = a.assistant_id;

-- Add comment
COMMENT ON VIEW calls_enriched IS
  'Main enriched view with business logic: call categorization, quality assessment, QCI data. Single source of truth for call analysis.';

-- ============================================================================
-- STEP 3: Create specialized view for quality calls (client main use case)
-- ============================================================================

CREATE VIEW quality_calls AS
SELECT *
FROM calls_enriched
WHERE call_category = 'quality';

COMMENT ON VIEW quality_calls IS
  'Quality calls only (>=60s, no errors/voicemail). Main view for daily operations and call analysis.';

-- ============================================================================
-- STEP 4: Create specialized view for error calls (debugging)
-- ============================================================================

CREATE VIEW error_calls AS
SELECT *
FROM calls_enriched
WHERE call_category = 'error';

COMMENT ON VIEW error_calls IS
  'Error calls only (connection failures, busy, no answer). For debugging and system health monitoring.';

-- ============================================================================
-- STEP 5: Create view for voicemail calls
-- ============================================================================

CREATE VIEW voicemail_calls AS
SELECT *
FROM calls_enriched
WHERE call_category = 'voicemail';

COMMENT ON VIEW voicemail_calls IS
  'Voicemail calls only. For analyzing voicemail message quality.';

-- ============================================================================
-- STEP 6: Create view for calls with tools (successful actions)
-- ============================================================================

CREATE VIEW calls_with_tools AS
SELECT *
FROM calls_enriched
WHERE has_tool_calls = true
  AND call_category = 'quality';

COMMENT ON VIEW calls_with_tools IS
  'Quality calls with tool usage (calendar booking, time calculation, etc). Indicates successful actions.';

-- ============================================================================
-- VERIFICATION QUERIES (commented out - for manual testing)
-- ============================================================================

-- Test call categorization distribution:
-- SELECT call_category, COUNT(*) as count
-- FROM calls_enriched
-- GROUP BY call_category
-- ORDER BY count DESC;

-- Test quality calls count:
-- SELECT COUNT(*) FROM quality_calls;

-- Test error calls count:
-- SELECT COUNT(*) FROM error_calls;

-- Test calls with tools:
-- SELECT COUNT(*) FROM calls_with_tools;

-- Verify ended_reason mapping:
-- SELECT ended_reason, call_category, COUNT(*)
-- FROM calls_enriched
-- GROUP BY ended_reason, call_category
-- ORDER BY COUNT(*) DESC;
