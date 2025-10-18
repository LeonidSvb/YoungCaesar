# Database Migrations

Supabase миграции для проекта VAPI Analytics.

## Структура

Миграции применяются через Supabase MCP или напрямую в Supabase Studio.

## Последние миграции

### 2025-10-18: Tool Tracking Optimization

**Файлы:**
- `20251018082524_add_tool_tracking_columns.sql` - добавление колонок
- `20251018082631_add_tool_tracking_indexes.sql` - индексы

**Изменения:**
- Добавлены колонки для быстрой фильтрации звонков с tool calls
- `has_calendar_booking` - флаг успешной записи в календарь (38 звонков)
- `has_tool_calls` - флаг наличия tool calls (540 звонков)
- `tool_names` - массив всех использованных инструментов

**Производительность:**
- Старый способ (JSONB парсинг): 101ms
- Новый способ (индекс): 0.16ms
- **Ускорение: в 608 раз**

**Примеры запросов:**
```sql
-- Все успешные звонки
SELECT * FROM vapi_calls_raw WHERE has_calendar_booking = true;

-- Звонки с конкретным инструментом
SELECT * FROM vapi_calls_raw WHERE tool_names @> ARRAY['google_calendar_tool'];
```

## Применение миграций

Миграции применяются автоматически через Supabase MCP:
```javascript
mcp__supabase__apply_migration(project_id, name, query)
```

## Rollback

Для отката используйте соответствующие down-миграции или SQL команды ALTER TABLE DROP COLUMN.
