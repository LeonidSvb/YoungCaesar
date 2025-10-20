/**
 * =====================================================================
 * Migration 011: Fix Quality Badge Logic
 * =====================================================================
 *
 * ПРОБЛЕМА:
 *   get_calls_list показывает quality badge (average/poor) даже для
 *   звонков БЕЗ QCI анализа, основываясь только на duration.
 *   Это вводит в заблуждение - выглядит как будто звонки проанализированы.
 *
 * РЕШЕНИЕ:
 *   Quality badge должен быть NULL для звонков без QCI анализа.
 *   Показываем quality ТОЛЬКО если есть реальный QCI score.
 *
 * Created: 2025-10-18
 * =====================================================================
 */

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
    q.qci_total_score as qci_score,
    (c.transcript IS NOT NULL AND c.transcript != '') as has_transcript,
    (q.id IS NOT NULL) as has_qci,
    c.status,
    -- Quality badge ТОЛЬКО для звонков с QCI анализом
    CASE
      WHEN q.id IS NULL THEN NULL  -- Нет QCI анализа = нет badge
      WHEN c.duration_seconds > 60 AND q.qci_total_score > 70 THEN 'excellent'
      WHEN c.duration_seconds > 30 AND q.qci_total_score > 50 THEN 'good'
      WHEN c.duration_seconds > 15 THEN 'average'
      ELSE 'poor'
    END as quality,
    c.cost
  FROM calls c
  LEFT JOIN assistants a ON c.assistant_id = a.id
  LEFT JOIN qci_analyses q ON c.id = q.call_id
  WHERE c.started_at >= COALESCE(p_date_from, NOW() - INTERVAL '7 days')
    AND c.started_at <= COALESCE(p_date_to, NOW())
    AND (p_assistant_id IS NULL OR c.assistant_id = p_assistant_id)
    AND (
      p_quality_filter = 'all' OR
      (p_quality_filter = 'quality' AND c.duration_seconds > 30) OR
      (p_quality_filter = 'excellent' AND c.duration_seconds > 60 AND q.qci_total_score > 70) OR
      (p_quality_filter = 'with_qci' AND q.id IS NOT NULL) OR
      (p_quality_filter = 'with_transcript' AND c.transcript IS NOT NULL AND c.transcript != '')
    )
  ORDER BY c.started_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION get_calls_list IS 'Calls list with filtering - FIXED: quality badge only for calls with QCI analysis';
