# Как применить миграцию 012 - Fix RPC Table Names

## Проблема
RPC функции используют таблицу `calls`, но реальные данные в таблице `vapi_calls_raw` (8,559 звонков).
Сейчас показывает только 2,377 звонков вместо 8,559+.

## Решение
Применить миграцию 012 которая обновит RPC функции для работы с правильными таблицами.

---

## Шаг 1: Открыть Supabase SQL Editor

1. Перейти на https://supabase.com/dashboard
2. Выбрать проект `wbrzbqqpbshjfajfywrz`
3. В левом меню → **SQL Editor**

---

## Шаг 2: Скопировать SQL из миграции

Открыть файл:
```
C:\Users\79818\Desktop\Vapi\data\migrations\012_fix_rpc_table_names.sql
```

Скопировать **весь** SQL код из файла.

---

## Шаг 3: Выполнить миграцию

1. В SQL Editor вставить скопированный код
2. Нажать **Run** (или Ctrl+Enter)
3. Дождаться выполнения (~2-5 секунд)

---

## Шаг 4: Проверить результат

После выполнения миграции перезагрузить dashboard:

1. Открыть http://localhost:3008/dashboard
2. Выбрать период "Все"
3. **Должно показать ~8,559 звонков** вместо 2,377

---

## Что изменится?

### До миграции:
- `get_dashboard_metrics()` → таблица `calls` (~700 звонков)
- `get_calls_list()` → таблица `calls`
- `get_timeline_data()` → таблица `calls`

### После миграции:
- `get_dashboard_metrics()` → таблица `vapi_calls_raw` (8,559 звонков) ✅
- `get_calls_list()` → таблица `vapi_calls_raw` ✅
- `get_timeline_data()` → таблица `vapi_calls_raw` ✅

---

## Troubleshooting

### Ошибка: "relation vapi_calls_raw does not exist"

**Решение:** Таблица может называться по-другому. Проверить:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%call%';
```

Если таблица называется `calls`, а не `vapi_calls_raw` - ничего делать не нужно, данные уже правильные.

### Ошибка: "column qci_analysis_id does not exist"

**Решение:** Использовать JOIN вместо прямой ссылки:

```sql
-- Заменить:
WHERE c.qci_analysis_id IS NOT NULL

-- На:
LEFT JOIN qci_analyses q ON c.id = q.call_id
WHERE q.id IS NOT NULL
```

---

## Файлы для справки

- **Миграция:** `data/migrations/012_fix_rpc_table_names.sql`
- **Эта инструкция:** `APPLY_MIGRATION_012.md`
