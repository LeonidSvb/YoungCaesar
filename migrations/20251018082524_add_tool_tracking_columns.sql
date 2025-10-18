-- Migration: Add tool tracking columns to vapi_calls_raw
-- Date: 2025-10-18
-- Description: Добавляем колонки для быстрой фильтрации звонков по использованным инструментам

-- Добавляем колонки для отслеживания tool calls
ALTER TABLE vapi_calls_raw
ADD COLUMN IF NOT EXISTS has_calendar_booking BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_tool_calls BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS tool_names TEXT[] DEFAULT '{}';

-- Добавляем комментарии для документации
COMMENT ON COLUMN vapi_calls_raw.has_calendar_booking IS 'Быстрый флаг: был ли вызван google_calendar_tool (успешная запись встречи)';
COMMENT ON COLUMN vapi_calls_raw.has_tool_calls IS 'Быстрый флаг: есть ли хоть один tool call в звонке';
COMMENT ON COLUMN vapi_calls_raw.tool_names IS 'Массив всех использованных инструментов в звонке';

-- Обновляем has_calendar_booking для существующих записей
UPDATE vapi_calls_raw
SET has_calendar_booking = EXISTS (
  SELECT 1
  FROM jsonb_array_elements(raw_json->'messages') msg
  WHERE msg->'toolCalls'->0->'function'->>'name' = 'google_calendar_tool'
)
WHERE raw_json ? 'messages';

-- Обновляем has_tool_calls и tool_names для существующих записей
UPDATE vapi_calls_raw
SET
  has_tool_calls = (
    SELECT COUNT(*) > 0
    FROM jsonb_array_elements(raw_json->'messages') msg
    WHERE msg ? 'toolCalls'
  ),
  tool_names = (
    SELECT array_agg(DISTINCT msg->'toolCalls'->0->'function'->>'name')
    FROM jsonb_array_elements(raw_json->'messages') msg
    WHERE msg ? 'toolCalls'
      AND msg->'toolCalls'->0->'function'->>'name' IS NOT NULL
  )
WHERE raw_json ? 'messages';
