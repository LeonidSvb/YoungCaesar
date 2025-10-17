/**
 * =====================================================================
 * Migration 009: Fix RPC Functions Column Names
 * =====================================================================
 *
 * ПРОБЛЕМА:
 *   RPC функции использовали неправильные имена колонок:
 *   - qci_total_score (должно быть total_score)
 *   - granularity 'daily' (должно быть 'day')
 *
 * РЕШЕНИЕ:
 *   Пересоздание всех 4 RPC функций с правильными именами и JOIN'ами
 *
 * Created: 2025-10-17
 * =====================================================================
 */

-- =====================================================================
-- 1. GET DASHBOARD METRICS (FIXED)
-- =====================================================================

CREATE OR REPLACE FUNCTION get_dashboard_metrics(
  p_assistant_id UUID DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_calls INTEGER;
  v_quality_calls INTEGER;
  v_excellent_calls INTEGER;
  v_avg_duration NUMERIC;
  v_avg_qci NUMERIC;
  v_total_assistants INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_calls
  FROM calls
  WHERE started_at >= COALESCE(p_date_from, NOW() - INTERVAL '30 days')
    AND started_at <= COALESCE(p_date_to, NOW())
    AND (p_assistant_id IS NULL OR assistant_id = p_assistant_id);

  SELECT COUNT(*) INTO v_quality_calls
  FROM calls
  WHERE started_at >= COALESCE(p_date_from, NOW() - INTERVAL '30 days')
    AND started_at <= COALESCE(p_date_to, NOW())
    AND duration_seconds > 30
    AND (p_assistant_id IS NULL OR assistant_id = p_assistant_id);

  SELECT COUNT(*) INTO v_excellent_calls
  FROM calls c
  LEFT JOIN qci_analyses q ON c.id::text = q.call_id
  WHERE c.started_at >= COALESCE(p_date_from, NOW() - INTERVAL '30 days')
    AND c.started_at <= COALESCE(p_date_to, NOW())
    AND c.duration_seconds > 60
    AND q.total_score > 70
    AND (p_assistant_id IS NULL OR c.assistant_id = p_assistant_id);

  SELECT AVG(duration_seconds) INTO v_avg_duration
  FROM calls
  WHERE started_at >= COALESCE(p_date_from, NOW() - INTERVAL '30 days')
    AND started_at <= COALESCE(p_date_to, NOW())
    AND duration_seconds > 0
    AND (p_assistant_id IS NULL OR assistant_id = p_assistant_id);

  SELECT AVG(q.total_score) INTO v_avg_qci
  FROM calls c
  JOIN qci_analyses q ON c.id::text = q.call_id
  WHERE c.started_at >= COALESCE(p_date_from, NOW() - INTERVAL '30 days')
    AND c.started_at <= COALESCE(p_date_to, NOW())
    AND (p_assistant_id IS NULL OR c.assistant_id = p_assistant_id);

  SELECT COUNT(DISTINCT assistant_id) INTO v_total_assistants
  FROM calls
  WHERE started_at >= COALESCE(p_date_from, NOW() - INTERVAL '30 days')
    AND started_at <= COALESCE(p_date_to, NOW());

  RETURN json_build_object(
    'totalCalls', COALESCE(v_total_calls, 0),
    'qualityCalls', COALESCE(v_quality_calls, 0),
    'excellentCalls', COALESCE(v_excellent_calls, 0),
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

-- =====================================================================
-- 2. GET TIMELINE DATA (FIXED)
-- =====================================================================

CREATE OR REPLACE FUNCTION get_timeline_data(
  p_assistant_id UUID DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL,
  p_granularity TEXT DEFAULT 'day'
)
RETURNS TABLE(
  date TEXT,
  total_calls BIGINT,
  quality_calls BIGINT,
  excellent_calls BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    TO_CHAR(DATE_TRUNC(p_granularity, c.started_at), 'YYYY-MM-DD') as date,
    COUNT(*) as total_calls,
    COUNT(*) FILTER (WHERE c.duration_seconds > 30) as quality_calls,
    COUNT(*) FILTER (WHERE c.duration_seconds > 60 AND q.total_score > 70) as excellent_calls
  FROM calls c
  LEFT JOIN qci_analyses q ON c.id::text = q.call_id
  WHERE c.started_at >= COALESCE(p_date_from, NOW() - INTERVAL '30 days')
    AND c.started_at <= COALESCE(p_date_to, NOW())
    AND (p_assistant_id IS NULL OR c.assistant_id = p_assistant_id)
  GROUP BY DATE_TRUNC(p_granularity, c.started_at)
  ORDER BY DATE_TRUNC(p_granularity, c.started_at);
END;
$$;

COMMENT ON FUNCTION get_timeline_data IS 'Timeline data for multi-line chart: totalCalls, qualityCalls (>30s), excellentCalls (>60s + QCI>70). Granularity: day, week, month';

-- =====================================================================
-- 3. GET CALLS LIST (FIXED)
-- =====================================================================

CREATE OR REPLACE FUNCTION get_calls_list(
  p_assistant_id UUID DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL,
  p_quality_filter TEXT DEFAULT 'all',
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  started_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  assistant_id UUID,
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
    c.customer_number,
    q.total_score as qci_score,
    (c.transcript IS NOT NULL AND c.transcript != '') as has_transcript,
    (q.id IS NOT NULL) as has_qci,
    c.status,
    CASE
      WHEN c.duration_seconds > 60 AND q.total_score > 70 THEN 'excellent'
      WHEN c.duration_seconds > 30 AND q.total_score > 50 THEN 'good'
      WHEN c.duration_seconds > 15 THEN 'average'
      ELSE 'poor'
    END as quality,
    c.cost
  FROM calls c
  LEFT JOIN assistants a ON c.assistant_id = a.id
  LEFT JOIN qci_analyses q ON c.id::text = q.call_id
  WHERE c.started_at >= COALESCE(p_date_from, NOW() - INTERVAL '7 days')
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

-- =====================================================================
-- 4. GET ASSISTANT BREAKDOWN (FIXED)
-- =====================================================================

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
    a.id as assistant_id,
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
  FROM assistants a
  LEFT JOIN calls c ON a.id = c.assistant_id
    AND c.started_at >= COALESCE(p_date_from, NOW() - INTERVAL '30 days')
    AND c.started_at <= COALESCE(p_date_to, NOW())
  LEFT JOIN qci_analyses q ON c.id::text = q.call_id
  WHERE a.is_active = TRUE
  GROUP BY a.id, a.name
  HAVING COUNT(c.id) > 0
  ORDER BY total_calls DESC;
END;
$$;
