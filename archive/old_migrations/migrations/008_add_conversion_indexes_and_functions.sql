-- Индексы для оптимизации запросов к call_conversions
CREATE INDEX IF NOT EXISTS idx_call_conversions_outcome
ON call_conversions(meeting_outcome);

CREATE INDEX IF NOT EXISTS idx_call_conversions_booked
ON call_conversions(meeting_booked)
WHERE meeting_booked = true;

CREATE INDEX IF NOT EXISTS idx_call_conversions_created
ON call_conversions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_conversions_assistant
ON call_conversions(assistant_id);

CREATE INDEX IF NOT EXISTS idx_call_conversions_has_analysis
ON call_conversions(has_analysis)
WHERE has_analysis = true;

-- Функция для обновления view после синхронизации новых звонков
CREATE OR REPLACE FUNCTION refresh_call_conversions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW call_conversions;
END;
$$;

-- Функция для получения агрегированной статистики конверсий
CREATE OR REPLACE FUNCTION get_conversion_stats()
RETURNS TABLE (
  total_calls BIGINT,
  calls_with_analysis BIGINT,
  meetings_booked BIGINT,
  attempts_failed BIGINT,
  mentioned_unclear BIGINT,
  no_discussion BIGINT,
  conversion_rate NUMERIC,
  attempt_rate NUMERIC,
  success_rate_among_attempts NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total BIGINT;
  v_with_analysis BIGINT;
  v_booked BIGINT;
  v_failed BIGINT;
  v_mentioned BIGINT;
  v_no_discussion BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_total FROM call_conversions;
  SELECT COUNT(*) INTO v_with_analysis FROM call_conversions WHERE has_analysis = true;
  SELECT COUNT(*) INTO v_booked FROM call_conversions WHERE meeting_outcome = 'booked';
  SELECT COUNT(*) INTO v_failed FROM call_conversions WHERE meeting_outcome = 'failed';
  SELECT COUNT(*) INTO v_mentioned FROM call_conversions WHERE meeting_outcome = 'mentioned';
  SELECT COUNT(*) INTO v_no_discussion FROM call_conversions WHERE meeting_outcome = 'no_discussion';

  RETURN QUERY SELECT
    v_total,
    v_with_analysis,
    v_booked,
    v_failed,
    v_mentioned,
    v_no_discussion,
    ROUND((v_booked::NUMERIC / NULLIF(v_with_analysis, 0) * 100), 2) as conversion_rate,
    ROUND(((v_booked + v_failed)::NUMERIC / NULLIF(v_with_analysis, 0) * 100), 2) as attempt_rate,
    ROUND((v_booked::NUMERIC / NULLIF(v_booked + v_failed, 0) * 100), 2) as success_rate_among_attempts;
END;
$$;

-- Комментарии для документации
COMMENT ON FUNCTION refresh_call_conversions() IS 'Refresh call_conversions materialized view with latest data - call after VAPI sync';
COMMENT ON FUNCTION get_conversion_stats() IS 'Get aggregated conversion statistics for dashboard display';
