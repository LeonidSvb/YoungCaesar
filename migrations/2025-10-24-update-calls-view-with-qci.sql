-- Migration: Update calls VIEW to include QCI analytics
-- Date: 2025-10-24
-- Purpose: Add QCI scores and classification to calls VIEW for easy access

CREATE OR REPLACE VIEW calls AS
SELECT
    v.id,
    v.assistant_id,
    v.status,
    v.started_at,
    v.ended_at,
    v.created_at,
    v.duration_seconds,
    v.transcript,
    v.cost,
    v.customer_phone_number,
    v.recording_url,

    -- QCI Analytics (LEFT JOIN so all calls are shown)
    q.total_score AS qci_score,
    q.dynamics_score AS qci_dynamics,
    q.objections_score AS qci_objections,
    q.brand_score AS qci_brand,
    q.outcome_score AS qci_outcome,
    q.call_classification AS qci_classification,
    q.coaching_tips,
    q.key_issues AS qci_evidence,
    q.analyzed_at AS qci_analyzed_at

FROM vapi_calls_raw v
LEFT JOIN qci_analyses q
    ON v.id = q.call_id
    AND q.framework_id = (SELECT id FROM analysis_frameworks WHERE name = 'QCI Standard' AND is_active = true LIMIT 1);

COMMENT ON VIEW calls IS
'VIEW: Complete call data with QCI analytics

PURPOSE:
Unified view combining raw call data from VAPI with QCI quality scores.
Provides easy access to call quality metrics for dashboards and reporting.

COLUMNS:
- Basic call data: id, assistant_id, status, timestamps, transcript, cost
- QCI metrics: qci_score (0-100), component scores, classification
- QCI evidence: coaching_tips, key_issues (brand mentions, outcomes, key moments)

USAGE:
SELECT * FROM calls WHERE qci_score > 50 ORDER BY created_at DESC;
SELECT * FROM calls WHERE qci_classification = ''poor'' AND created_at > NOW() - INTERVAL ''7 days'';

CREATED: 2025-10-24
MIGRATION: migrations/2025-10-24-update-calls-view-with-qci.sql';
