-- =====================================================================
-- Migration: 010_fix_assistant_breakdown
-- Description: Fix get_assistant_breakdown function
-- Issues fixed:
--   1. Remove default 30-day filter (was causing NULL avg_qci)
--   2. Fix table/column names (use vapi_assistants.assistant_id)
--   3. Remove is_active filter (column doesn't exist)
-- =====================================================================

DROP FUNCTION IF EXISTS get_assistant_breakdown(timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION get_assistant_breakdown(
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  assistant_id UUID,
  assistant_name TEXT,
  total_calls BIGINT,
  quality_calls BIGINT,
  quality_rate NUMERIC,
  avg_qci NUMERIC,
  avg_duration NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.assistant_id::uuid as assistant_id,
    a.name as assistant_name,
    COUNT(c.id) as total_calls,
    COUNT(c.id) FILTER (WHERE c.duration_seconds > 30) as quality_calls,
    ROUND(
      COUNT(c.id) FILTER (WHERE c.duration_seconds > 30)::numeric /
      NULLIF(COUNT(c.id), 0) * 100,
      1
    ) as quality_rate,
    ROUND(AVG(q.total_score), 1) as avg_qci,
    ROUND(AVG(c.duration_seconds), 1) as avg_duration
  FROM vapi_assistants a
  LEFT JOIN vapi_calls_raw c ON a.assistant_id = c.assistant_id
    AND (p_date_from IS NULL OR c.started_at >= p_date_from)
    AND (p_date_to IS NULL OR c.started_at <= p_date_to)
  LEFT JOIN qci_analyses q ON c.id = q.call_id
  GROUP BY a.assistant_id, a.name
  HAVING COUNT(c.id) > 0
  ORDER BY total_calls DESC;
END;
$$;

COMMENT ON FUNCTION get_assistant_breakdown IS 'Assistant breakdown with stats. Returns all-time data by default. Use p_date_from/p_date_to to filter.';
