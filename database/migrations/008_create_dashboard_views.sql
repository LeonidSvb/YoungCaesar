/**
 * =====================================================================
 * Migration 008: Dashboard Views
 * =====================================================================
 *
 * ПРОБЛЕМА:
 *   RPC функции ожидают таблицы calls и assistants, но в базе есть
 *   vapi_calls_raw и vapi_assistants
 *
 * РЕШЕНИЕ:
 *   Создание views для маппинга таблиц на ожидаемые имена
 *
 * Created: 2025-10-17
 * =====================================================================
 */

-- Create view 'calls' on top of vapi_calls_raw
CREATE OR REPLACE VIEW calls AS
SELECT
  id::uuid as id,
  assistant_id::uuid as assistant_id,
  status,
  started_at,
  ended_at,
  created_at,
  duration_seconds,
  transcript,
  cost,
  customer_phone_number as customer_number,
  recording_url
FROM vapi_calls_raw;

-- Create view 'assistants' on top of vapi_assistants
CREATE OR REPLACE VIEW assistants AS
SELECT
  assistant_id::uuid as id,
  name,
  model,
  voice,
  prompt,
  synced_at,
  updated_at,
  true as is_active
FROM vapi_assistants;

COMMENT ON VIEW calls IS 'View mapping vapi_calls_raw to expected dashboard schema';
COMMENT ON VIEW assistants IS 'View mapping vapi_assistants to expected dashboard schema';
