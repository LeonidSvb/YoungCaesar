# Cron Job Logging System

Универсальная система логирования для всех автоматизированных задач (cron jobs) в проекте VAPI Analytics.

## Архитектура

### Две таблицы в Supabase:

**1. `runs` - Execution Tracking**
Хранит метаданные о запусках скриптов:
- ID (UUID), статус, длительность
- Количество обработанных записей
- Стоимость API вызовов
- Метрики для каждого типа операции

**2. `logs` - Detailed Step Logs**
Хранит детальные логи для каждого запуска:
- Timestamp (индексирован)
- Уровень (INFO, ERROR, WARNING, DEBUG)
- Шаг (START, FETCH, SAVE, END)
- Сообщение и метаданные (JSONB)

### Почему две таблицы, а не одна?

✅ **Правильно (2 таблицы):**
```sql
-- Быстрый поиск по timestamp
SELECT * FROM logs
WHERE timestamp > NOW() - INTERVAL '1 hour'
AND level = 'ERROR'
ORDER BY timestamp DESC;

-- Эффективная фильтрация
CREATE INDEX logs_timestamp_idx ON logs(timestamp DESC);
```

❌ **Неправильно (JSONB массив):**
```sql
-- Невозможно индексировать timestamp внутри JSONB
-- Медленные запросы, нет сортировки
SELECT * FROM runs WHERE logs_array @> '{"level": "ERROR"}'; -- SLOW!
```

---

## Типы script_name (стандартизированные)

Используйте эти значения для `script_name`:

| script_name        | Описание                                | Метрики                                      |
|--------------------|-----------------------------------------|----------------------------------------------|
| `vapi-sync`        | Синхронизация звонков из VAPI API      | records_fetched, records_inserted            |
| `qci-analysis`     | QCI анализ новых звонков                | calls_analyzed, api_cost                     |
| `prompt-optimizer` | Оптимизация промптов ассистентов        | calls_analyzed, api_cost                     |
| `assistant-sync`   | Синхронизация ассистентов из VAPI       | records_fetched, records_inserted            |
| `manual-sync`      | Ручная синхронизация данных             | records_fetched, records_inserted            |

---

## Использование

### Базовый пример

```javascript
require('dotenv').config();
const { Logger, createRun, updateRun } = require('../lib/logger');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  const scriptName = 'vapi-sync'; // Стандартное имя
  const start = Date.now();

  // 1. Создать run
  const run = await createRun(scriptName, SUPABASE_URL, SUPABASE_KEY, 'cron');
  const logger = new Logger(run.id, SUPABASE_URL, SUPABASE_KEY);

  try {
    // 2. Логировать шаги
    await logger.info('START', 'Starting VAPI synchronization');

    await logger.info('FETCH', 'Fetching calls from VAPI API...');
    const calls = await fetchCallsFromVAPI(); // Ваша логика
    await logger.info('FETCH', `Fetched ${calls.length} calls`, { count: calls.length });

    await logger.info('SAVE', 'Saving to Supabase...');
    await saveToSupabase(calls); // Ваша логика
    await logger.info('SAVE', `Saved ${calls.length} calls successfully`);

    // 3. Обновить run со статусом успеха
    await updateRun(run.id, {
      status: 'success',
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - start,
      records_fetched: calls.length,
      records_inserted: calls.length,
      records_updated: 0,
      records_failed: 0
    }, SUPABASE_URL, SUPABASE_KEY);

    await logger.info('END', `Sync completed in ${Date.now() - start}ms`);

  } catch (error) {
    // 4. Логировать ошибку
    await logger.error('ERROR', error.message, { stack: error.stack });

    // 5. Обновить run со статусом ошибки
    await updateRun(run.id, {
      status: 'error',
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - start,
      error_message: error.message
    }, SUPABASE_URL, SUPABASE_KEY);

    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = main;
```

### QCI Analysis пример

```javascript
const scriptName = 'qci-analysis';
const run = await createRun(scriptName, SUPABASE_URL, SUPABASE_KEY);
const logger = new Logger(run.id, SUPABASE_URL, SUPABASE_KEY);

try {
  await logger.info('START', 'Starting QCI analysis');

  const callsToAnalyze = await fetchUnanalyzedCalls();
  await logger.info('FETCH', `Found ${callsToAnalyze.length} calls to analyze`);

  let totalCost = 0;
  for (const call of callsToAnalyze) {
    const analysis = await analyzeCallQCI(call); // OpenAI API
    totalCost += analysis.cost;
    await logger.info('ANALYZE', `Analyzed call ${call.id}`, {
      qci_score: analysis.score,
      cost: analysis.cost
    });
  }

  await updateRun(run.id, {
    status: 'success',
    finished_at: new Date().toISOString(),
    duration_ms: Date.now() - start,
    calls_analyzed: callsToAnalyze.length,
    api_cost: totalCost
  }, SUPABASE_URL, SUPABASE_KEY);

} catch (error) {
  await logger.error('ERROR', error.message);
  await updateRun(run.id, { status: 'error', error_message: error.message }, SUPABASE_URL, SUPABASE_KEY);
}
```

---

## Методы Logger

### `logger.info(step, message, meta = {})`
Информационное сообщение
```javascript
await logger.info('FETCH', 'Fetching data from API');
await logger.info('FETCH', 'Fetched 100 records', { count: 100, time: 1234 });
```

### `logger.error(step, message, meta = {})`
Ошибка
```javascript
await logger.error('SAVE', 'Failed to save record', { error: err.message });
```

### `logger.warning(step, message, meta = {})`
Предупреждение
```javascript
await logger.warning('VALIDATE', 'Invalid record skipped', { record_id: '123' });
```

### `logger.debug(step, message, meta = {})`
Отладка (только если DEBUG=true)
```javascript
await logger.debug('PROCESS', 'Processing record', { data: record });
```

---

## Стандартные шаги (step)

Используйте эти значения для поля `step`:

| Step       | Описание                          | Когда использовать                    |
|------------|-----------------------------------|---------------------------------------|
| `START`    | Начало выполнения                 | Первая строка в try блоке             |
| `FETCH`    | Получение данных из API           | Перед/после API запросов              |
| `VALIDATE` | Валидация данных                  | Проверка данных перед обработкой      |
| `PROCESS`  | Обработка данных                  | Трансформация, вычисления             |
| `ANALYZE`  | AI анализ                         | OpenAI, GPT вызовы                    |
| `SAVE`     | Сохранение в базу данных          | Перед/после INSERT/UPDATE             |
| `END`      | Успешное завершение               | Последняя строка перед return         |
| `ERROR`    | Ошибка                            | В catch блоке                         |

---

## GitHub Actions интеграция

```yaml
name: Sync VAPI Calls

on:
  schedule:
    - cron: '0 */6 * * *'  # Каждые 6 часов
  workflow_dispatch:        # Ручной запуск

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'

      - run: npm install

      - name: Run sync with logging
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          VAPI_API_KEY: ${{ secrets.VAPI_API_KEY }}
        run: node scripts/sync-vapi-calls.js

      # Логи автоматически сохраняются в Supabase
      # Можно посмотреть через SQL:
      # SELECT * FROM runs WHERE script_name = 'vapi-sync' ORDER BY started_at DESC LIMIT 1;
```

---

## Просмотр логов

### SQL запросы для анализа

**Последние 10 запусков:**
```sql
SELECT id, script_name, status, duration_ms,
       records_fetched, records_inserted,
       started_at, finished_at
FROM runs
ORDER BY started_at DESC
LIMIT 10;
```

**Логи для конкретного run:**
```sql
SELECT timestamp, level, step, message, meta
FROM logs
WHERE run_id = 'your-run-uuid'
ORDER BY timestamp ASC;
```

**Все ошибки за последние 24 часа:**
```sql
SELECT r.script_name, r.started_at, l.message, l.meta
FROM logs l
JOIN runs r ON r.id = l.run_id
WHERE l.level = 'ERROR'
  AND l.timestamp > NOW() - INTERVAL '24 hours'
ORDER BY l.timestamp DESC;
```

**Статистика по типам скриптов:**
```sql
SELECT
  script_name,
  COUNT(*) as total_runs,
  COUNT(*) FILTER (WHERE status = 'success') as successful,
  COUNT(*) FILTER (WHERE status = 'error') as failed,
  AVG(duration_ms) as avg_duration_ms,
  SUM(records_inserted) as total_records
FROM runs
WHERE started_at > NOW() - INTERVAL '7 days'
GROUP BY script_name
ORDER BY total_runs DESC;
```

---

## Best Practices

### ✅ DO

- Используйте стандартные `script_name` из таблицы выше
- Используйте стандартные `step` значения
- Всегда оборачивайте в try/catch
- Обновляйте run статус в конце (success/error)
- Логируйте важные метрики в `meta`
- Используйте `info()` для обычных операций
- Используйте `error()` только для реальных ошибок

### ❌ DON'T

- Не создавайте новые script_name без документации
- Не логируйте sensitive data (API keys, tokens)
- Не логируйте в цикле каждую итерацию (используйте батчи)
- Не используйте произвольные значения для `step`
- Не забывайте обновлять run статус

### Пример батчинга логов

```javascript
// ❌ Плохо: 1000 logs для 1000 записей
for (const call of calls) {
  await logger.info('PROCESS', `Processing call ${call.id}`);
  await processCall(call);
}

// ✅ Хорошо: Логи для батчей
const batchSize = 100;
for (let i = 0; i < calls.length; i += batchSize) {
  const batch = calls.slice(i, i + batchSize);
  await logger.info('PROCESS', `Processing batch ${i / batchSize + 1}`, {
    processed: i + batch.length,
    total: calls.length
  });
  await Promise.all(batch.map(processCall));
}
```

---

## Troubleshooting

### Проблема: Logs не создаются

**Проверьте:**
1. `run.id` существует и не null
2. SUPABASE_SERVICE_ROLE_KEY правильный (не anon key!)
3. Foreign key constraint: logs.run_id → runs.id

**Тест:**
```javascript
const run = await createRun('test', SUPABASE_URL, SUPABASE_KEY);
console.log('Created run:', run.id);

const logger = new Logger(run.id, SUPABASE_URL, SUPABASE_KEY);
await logger.info('TEST', 'Test log entry');

// Проверить в базе:
// SELECT * FROM logs WHERE run_id = 'your-run-id';
```

### Проблема: Performance медленный

**Оптимизации:**
- Используйте батчинг для логов (не каждую итерацию)
- Не ждите await для каждого log в критическом пути
- Используйте `debug()` только при DEBUG=true

### Проблема: Foreign key error

```
Error: insert or update on table "logs" violates foreign key constraint
```

**Решение:** Убедитесь что run создан ДО создания logs:
```javascript
const run = await createRun(...); // СНАЧАЛА
const logger = new Logger(run.id, ...); // ПОТОМ
await logger.info(...); // И ТОЛЬКО ПОТОМ логи
```

---

## Миграции

**Созданные таблицы:**
- `migrations/20251020_transform_sync_logs_to_runs.sql` - Таблица runs
- `migrations/20251020_create_logs_table.sql` - Таблица logs
- `migrations/20251020_013_fix_rpc_correct_types.sql` - RPC функции (не связано)

**Применение:**
```bash
# Через MCP Supabase (рекомендуется)
# Применяются через Claude Code с mcp__supabase__apply_migration

# Или через Supabase Dashboard
# SQL Editor → Copy/Paste → Run
```

---

## Дальнейшие улучшения

**Запланировано:**
- Frontend UI для просмотра runs/logs (`/admin/execution-logs`)
- Slack/email уведомления при ошибках
- Retention policy (автоудаление старых logs > 90 дней)
- Performance dashboard (success rate, avg duration)

---

## Связанные документы

- **ADR-0009:** Architectural Decision Record
- **NEXT_SESSION_TODO.md:** Текущие задачи
- **CHANGELOG.md:** История изменений
