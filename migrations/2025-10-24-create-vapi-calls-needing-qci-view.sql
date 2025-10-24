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
    AND q.framework_id = (SELECT id FROM analysis_frameworks WHERE name = 'QCI Standard' AND is_active = true LIMIT 1)
WHERE v.transcript IS NOT NULL
  AND LENGTH(v.transcript) >= 100
  AND q.id IS NULL;

COMMENT ON VIEW vapi_calls_needing_qci IS
'VIEW: Звонки из raw таблицы, нуждающиеся в QCI анализе

НАЗНАЧЕНИЕ:
Автоматическая фильтрация звонков для предотвращения дублирования QCI анализов.
Используется в qci_analyzer.js для выбора только необработанных звонков.

КРИТЕРИИ ВКЛЮЧЕНИЯ:
1. Звонок имеет транскрипт (transcript IS NOT NULL)
2. Длина транскрипта >= 100 символов
3. НЕТ QCI анализа для framework_id = 1

ЛОГИКА РАБОТЫ:
- LEFT JOIN с qci_analyses по call_id и framework_id = 1
- Если q.id IS NULL → звонок НЕ проанализирован
- Если q.id IS NOT NULL → звонок УЖЕ проанализирован (не включается)

АРХИТЕКТУРНЫЙ ПАТТЕРН:
- Raw данные (vapi_calls_raw) остаются immutable
- Analytics данные (qci_analyses) в отдельной таблице
- VIEW = виртуальный слой для фильтрации

ИСПОЛЬЗОВАНИЕ:
SELECT * FROM vapi_calls_needing_qci ORDER BY created_at DESC;

ОБНОВЛЕНИЕ:
VIEW автоматически пересчитывается при каждом запросе.
Данные всегда актуальные.

CREATED: 2025-10-24
MIGRATION: migrations/2025-10-24-create-vapi-calls-needing-qci-view.sql';

COMMENT ON COLUMN vapi_calls_needing_qci.id IS
'Уникальный ID звонка (PRIMARY KEY в vapi_calls_raw)';

COMMENT ON COLUMN vapi_calls_needing_qci.transcript IS
'Полный текст транскрипта звонка. Используется для QCI анализа через OpenAI API';

COMMENT ON COLUMN vapi_calls_needing_qci.transcript_length IS
'Длина транскрипта в символах. Минимум 100 символов для включения в анализ';

COMMENT ON COLUMN vapi_calls_needing_qci.assistant_id IS
'ID AI ассистента VAPI, который вел звонок';

COMMENT ON COLUMN vapi_calls_needing_qci.customer_id IS
'ID клиента в системе VAPI';

COMMENT ON COLUMN vapi_calls_needing_qci.created_at IS
'Дата и время начала звонка';

COMMENT ON COLUMN vapi_calls_needing_qci.ended_at IS
'Дата и время окончания звонка';

COMMENT ON COLUMN vapi_calls_needing_qci.duration_seconds IS
'Длительность звонка в секундах';
