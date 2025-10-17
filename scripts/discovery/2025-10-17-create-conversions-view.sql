-- Materialized view для быстрого доступа к метрикам конверсий
CREATE MATERIALIZED VIEW IF NOT EXISTS call_conversions AS
SELECT
  id,
  assistant_id,
  customer_id,
  created_at,
  started_at,
  ended_at,
  duration_seconds,
  cost,
  customer_phone_number,

  -- Извлекаем meeting outcome из AI summary
  CASE
    WHEN raw_json->'analysis'->>'summary' ~* 'successfully\s+scheduled' THEN 'booked'
    WHEN raw_json->'analysis'->>'summary' ~* 'meeting\s+(was\s+)?booked' THEN 'booked'
    WHEN raw_json->'analysis'->>'summary' ~* 'appointment\s+(was\s+)?(set|scheduled|booked|confirmed)' THEN 'booked'
    WHEN raw_json->'analysis'->>'summary' ~* 'demo\s+(was\s+)?(set|scheduled|booked)' THEN 'booked'
    WHEN raw_json->'analysis'->>'summary' ~* 'confirmed.*(meeting|appointment|demo)' THEN 'booked'
    WHEN raw_json->'analysis'->>'summary' ~* 'scheduled.*(meeting|appointment|demo).*for' THEN 'booked'
    WHEN raw_json->'analysis'->>'summary' ~* 'calendar\s+invite.*(sent|will\s+be\s+sent)' THEN 'booked'

    WHEN raw_json->'analysis'->>'summary' ~* 'without.*(scheduling|scheduled|appointment)' THEN 'failed'
    WHEN raw_json->'analysis'->>'summary' ~* 'could\s+not\s+(schedule|book)' THEN 'failed'
    WHEN raw_json->'analysis'->>'summary' ~* 'ended\s+without.*appointment' THEN 'failed'
    WHEN raw_json->'analysis'->>'summary' ~* 'declined.*(meeting|appointment)' THEN 'failed'
    WHEN raw_json->'analysis'->>'summary' ~* 'not\s+interested' THEN 'failed'

    WHEN raw_json->'analysis'->>'summary' ~* 'meeting|appointment|demo|call back|follow up' THEN 'mentioned'

    ELSE 'no_discussion'
  END as meeting_outcome,

  -- Boolean флаг для быстрой фильтрации
  (raw_json->'analysis'->>'summary' ~* 'successfully\s+scheduled|meeting\s+(was\s+)?booked|appointment\s+(was\s+)?(set|scheduled|booked)|demo\s+(was\s+)?(set|scheduled)|confirmed.*(meeting|appointment)|scheduled.*(meeting|appointment|demo).*for|calendar\s+invite.*(sent|will\s+be\s+sent)') as meeting_booked,

  -- Summary для отображения
  raw_json->'analysis'->>'summary' as summary,

  -- VAPI success flag
  COALESCE((raw_json->'analysis'->>'successEvaluation')::boolean, false) as vapi_success_flag,

  -- Флаг наличия анализа
  (raw_json->'analysis' IS NOT NULL AND raw_json->'analysis'->>'summary' IS NOT NULL) as has_analysis

FROM vapi_calls_raw
WHERE raw_json IS NOT NULL;

-- Индексы для быстрых запросов
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

-- Функция для обновления view
CREATE OR REPLACE FUNCTION refresh_call_conversions()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW call_conversions;
END;
$$;

-- Функция для получения статистики конверсий
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
COMMENT ON MATERIALIZED VIEW call_conversions IS 'Pre-computed meeting conversion metrics from VAPI call analysis summaries';
COMMENT ON FUNCTION refresh_call_conversions() IS 'Refresh call_conversions materialized view with latest data';
COMMENT ON FUNCTION get_conversion_stats() IS 'Get aggregated conversion statistics';
