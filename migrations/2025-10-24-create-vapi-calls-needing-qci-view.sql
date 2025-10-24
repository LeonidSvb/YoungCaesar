-- Migration: Create VIEW for calls needing QCI analysis
-- Date: 2025-10-24
-- Purpose: Simplify workflow logic by moving duplicate prevention to database layer

CREATE OR REPLACE VIEW vapi_calls_needing_qci AS
SELECT
    v.id,
    v.transcript,
    v.assistant_id,
    v.customer_id,
    v.created_at,
    v.ended_at,
    v.duration_seconds,
    LENGTH(v.transcript) as transcript_length
FROM vapi_calls_raw v
LEFT JOIN qci_analyses q
    ON v.id = q.call_id
    AND q.framework_id = 1
WHERE v.transcript IS NOT NULL
  AND LENGTH(v.transcript) >= 100
  AND q.id IS NULL;

COMMENT ON VIEW vapi_calls_needing_qci IS
'Звонки из raw таблицы, которые еще не прошли QCI анализ для framework_id = 1.
Используется в qci_analyzer.js для предотвращения дублирования анализов.';
