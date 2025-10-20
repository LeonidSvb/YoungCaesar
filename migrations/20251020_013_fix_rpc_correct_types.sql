/**
 * =====================================================================
 * Migration 013: Fix RPC Functions - Correct Data Types
 * =====================================================================
 *
 * ПРОБЛЕМА:
 *   Migration 012 использовала UUID типы, но реальные колонки TEXT
 *   vapi_calls_raw.id = TEXT (не UUID)
 *   vapi_calls_raw.assistant_id = TEXT (не UUID)
 *   Нет колонки qci_analysis_id в vapi_calls_raw
 *
 * РЕШЕНИЕ:
 *   - Использовать правильные типы: TEXT вместо UUID
 *   - JOIN с qci_analyses через call_id
 *   - Использовать customer_phone_number (не customer_number)
 *
 * Created: 2025-10-20
 * =====================================================================
 */

-- =====================================================================
-- STEP 1: Drop existing functions
-- =====================================================================

DROP FUNCTION IF EXISTS get_dashboard_metrics(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS get_dashboard_metrics(TEXT, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS get_calls_list(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_calls_list(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_timeline_data(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT);
DROP FUNCTION IF EXISTS get_timeline_data(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT);

-- =====================================================================
-- 1. GET DASHBOARD METRICS
-- =====================================================================

CREATE OR REPLACE FUNCTION get_dashboard_metrics(
  p_assistant_id TEXT DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_calls INTEGER;
  v_quality_calls INTEGER;
  v_engaged_calls INTEGER;
  v_analyzed_calls INTEGER;
  v_avg_duration NUMERIC;
  v_avg_qci NUMERIC;
  v_total_assistants INTEGER;
BEGIN
  -- Total calls
  SELECT COUNT(*) INTO v_total_calls
  FROM vapi_calls_raw
  WHERE started_at >= COALESCE(p_date_from, NOW() - INTERVAL '30 days')
    AND started_at <= COALESCE(p_date_to, NOW())
    AND (p_assistant_id IS NULL OR assistant_id = p_assistant_id);

  -- Quality calls (>30s)
  SELECT COUNT(*) INTO v_quality_calls
  FROM vapi_calls_raw
  WHERE started_at >= COALESCE(p_date_from, NOW() - INTERVAL '30 days')
    AND started_at <= COALESCE(p_date_to, NOW())
    AND duration_seconds > 30
    AND (p_assistant_id IS NULL OR assistant_id = p_assistant_id);

  -- Engaged calls (>60s)
  SELECT COUNT(*) INTO v_engaged_calls
  FROM vapi_calls_raw
  WHERE started_at >= COALESCE(p_date_from, NOW() - INTERVAL '30 days')
    AND started_at <= COALESCE(p_date_to, NOW())
    AND duration_seconds > 60
    AND (p_assistant_id IS NULL OR assistant_id = p_assistant_id);

  -- Analyzed calls (with QCI) - через JOIN с qci_analyses
  SELECT COUNT(DISTINCT c.id) INTO v_analyzed_calls
  FROM vapi_calls_raw c
  INNER JOIN qci_analyses q ON q.call_id = c.id
  WHERE c.started_at >= COALESCE(p_date_from, NOW() - INTERVAL '30 days')
    AND c.started_at <= COALESCE(p_date_to, NOW())
    AND (p_assistant_id IS NULL OR c.assistant_id = p_assistant_id);

  -- Average duration
  SELECT AVG(duration_seconds) INTO v_avg_duration
  FROM vapi_calls_raw
  WHERE started_at >= COALESCE(p_date_from, NOW() - INTERVAL '30 days')
    AND started_at <= COALESCE(p_date_to, NOW())
    AND duration_seconds > 0
    AND (p_assistant_id IS NULL OR assistant_id = p_assistant_id);

  -- Average QCI - через JOIN
  SELECT AVG(q.total_score) INTO v_avg_qci
  FROM vapi_calls_raw c
  INNER JOIN qci_analyses q ON q.call_id = c.id
  WHERE c.started_at >= COALESCE(p_date_from, NOW() - INTERVAL '30 days')
    AND c.started_at <= COALESCE(p_date_to, NOW())
    AND (p_assistant_id IS NULL OR c.assistant_id = p_assistant_id);

  -- Total assistants
  SELECT COUNT(DISTINCT assistant_id) INTO v_total_assistants
  FROM vapi_calls_raw
  WHERE started_at >= COALESCE(p_date_from, NOW() - INTERVAL '30 days')
    AND started_at <= COALESCE(p_date_to, NOW());

  RETURN json_build_object(
    'totalCalls', COALESCE(v_total_calls, 0),
    'qualityCalls', COALESCE(v_quality_calls, 0),
    'engagedCalls', COALESCE(v_engaged_calls, 0),
    'analyzedCalls', COALESCE(v_analyzed_calls, 0),
    'avgDuration', COALESCE(ROUND(v_avg_duration, 1), 0),
    'avgQCI', COALESCE(ROUND(v_avg_qci, 1), 0),
    'qualityRate', CASE
      WHEN v_total_calls > 0 THEN ROUND(v_quality_calls::numeric / v_total_calls * 100, 1)
      ELSE 0
    END,
    'totalAssistants', COALESCE(v_total_assistants, 0)
  );
END;
$$;

COMMENT ON FUNCTION get_dashboard_metrics IS 'Dashboard metrics - correct TEXT types for IDs';

-- =====================================================================
-- 2. GET CALLS LIST
-- =====================================================================

CREATE OR REPLACE FUNCTION get_calls_list(
  p_assistant_id TEXT DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL,
  p_quality_filter TEXT DEFAULT 'all',
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  id TEXT,
  started_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  assistant_id TEXT,
  assistant_name TEXT,
  customer_number TEXT,
  qci_score NUMERIC,
  has_transcript BOOLEAN,
  has_qci BOOLEAN,
  status TEXT,
  quality TEXT,
  cost NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.started_at,
    c.duration_seconds,
    c.assistant_id,
    a.name as assistant_name,
    c.customer_phone_number as customer_number,
    q.total_score as qci_score,
    (c.transcript IS NOT NULL AND c.transcript != '') as has_transcript,
    (q.id IS NOT NULL) as has_qci,
    c.status,
    -- Quality badge ТОЛЬКО для звонков с QCI анализом
    CASE
      WHEN q.id IS NULL THEN NULL
      WHEN c.duration_seconds > 60 AND q.total_score > 70 THEN 'excellent'
      WHEN c.duration_seconds > 30 AND q.total_score > 50 THEN 'good'
      WHEN c.duration_seconds > 15 THEN 'average'
      ELSE 'poor'
    END as quality,
    c.cost
  FROM vapi_calls_raw c
  LEFT JOIN vapi_assistants a ON c.assistant_id = a.assistant_id
  LEFT JOIN qci_analyses q ON q.call_id = c.id
  WHERE c.started_at >= COALESCE(p_date_from, NOW() - INTERVAL '90 days')
    AND c.started_at <= COALESCE(p_date_to, NOW())
    AND (p_assistant_id IS NULL OR c.assistant_id = p_assistant_id)
    AND (
      p_quality_filter = 'all' OR
      (p_quality_filter = 'quality' AND c.duration_seconds > 30) OR
      (p_quality_filter = 'excellent' AND c.duration_seconds > 60 AND q.total_score > 70) OR
      (p_quality_filter = 'with_qci' AND q.id IS NOT NULL) OR
      (p_quality_filter = 'with_transcript' AND c.transcript IS NOT NULL AND c.transcript != '')
    )
  ORDER BY c.started_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION get_calls_list IS 'Calls list - correct TEXT types and proper QCI JOIN';

-- =====================================================================
-- 3. GET TIMELINE DATA
-- =====================================================================

CREATE OR REPLACE FUNCTION get_timeline_data(
  p_assistant_id TEXT DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL,
  p_granularity TEXT DEFAULT 'day'
)
RETURNS TABLE(
  date TEXT,
  total_calls BIGINT,
  quality_calls BIGINT,
  analyzed_calls BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    TO_CHAR(DATE_TRUNC(p_granularity, c.started_at), 'YYYY-MM-DD') as date,
    COUNT(*) as total_calls,
    COUNT(*) FILTER (WHERE c.duration_seconds > 30) as quality_calls,
    COUNT(DISTINCT q.id) as analyzed_calls
  FROM vapi_calls_raw c
  LEFT JOIN qci_analyses q ON q.call_id = c.id
  WHERE c.started_at >= COALESCE(p_date_from, NOW() - INTERVAL '90 days')
    AND c.started_at <= COALESCE(p_date_to, NOW())
    AND (p_assistant_id IS NULL OR c.assistant_id = p_assistant_id)
  GROUP BY DATE_TRUNC(p_granularity, c.started_at)
  ORDER BY DATE_TRUNC(p_granularity, c.started_at);
END;
$$;

COMMENT ON FUNCTION get_timeline_data IS 'Timeline data - correct QCI JOIN through call_id';
