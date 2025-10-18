# Logging Best Practices - VAPI Analytics

## Industry Standards для проверки логирования

### 1. Dry-Run Testing ✅

**Что это:**
Запуск скриптов в режиме симуляции без реальных изменений в БД/API.

**Почему важно:**
- Безопасная проверка логики
- Проверка логирования без side effects
- Быстрое тестирование

**Как использовать:**
```bash
# Dry-run режим
npm run test:logging

# Или напрямую
DRY_RUN=true node scripts/test_logging_dryrun.js
node scripts/test_logging_dryrun.js --dry-run

# Реальный режим
npm run test:logging:real
node scripts/test_logging_dryrun.js
```

### 2. Log Level Validation

**Best Practice:** Проверка всех уровней логирования

```bash
# Подсчет логов по уровням
grep -c '"level":"INFO"' logs/2025-10-18.log
grep -c '"level":"ERROR"' logs/2025-10-18.log
grep -c '"level":"WARN"' logs/2025-10-18.log
grep -c '"level":"DEBUG"' logs/2025-10-18.log

# Быстрый анализ
grep -o '"level":"[^"]*"' logs/2025-10-18.log | sort | uniq -c
```

### 3. Structured Logging

**JSON формат:**
```json
{
  "timestamp": "2025-10-18T09:31:38.035Z",
  "module": "logging-test",
  "level": "INFO",
  "message": "Тест завершен",
  "totalSteps": 5,
  "completedSteps": 5,
  "dryRun": false
}
```

**Преимущества:**
- Легко парсится (jq, grep, awk)
- Структурированные данные
- Машиночитаемый формат
- Интеграция с ELK, Grafana, etc.

### 4. Error Isolation

**Отдельный файл для ошибок:**
```
logs/
├── 2025-10-18.log          # Все логи
└── errors/
    └── 2025-10-18.log      # Только ошибки
```

**Проверка:**
```bash
# Должны быть только ERROR логи
cat logs/errors/2025-10-18.log | grep '"level":"ERROR"' | wc -l
cat logs/errors/2025-10-18.log | wc -l
# Числа должны совпадать
```

### 5. Log Rotation

**Date-based rotation:**
- Автоматическое создание файлов по датам
- `2025-10-18.log`, `2025-10-19.log`, etc.
- Не нужны внешние инструменты (logrotate)

**Cleanup старых логов:**
```bash
# Найти логи старше 30 дней
find logs/ -name "*.log" -mtime +30

# Удалить старые логи
find logs/ -name "*.log" -mtime +30 -delete

# Или архивировать
find logs/ -name "*.log" -mtime +30 -exec gzip {} \;
```

### 6. Performance Monitoring

**Лог производительности:**
```javascript
const startTime = Date.now();
// ... операции ...
logger.info('Операция завершена', {
  duration_ms: Date.now() - startTime,
  recordsProcessed: 1000
});
```

**Анализ медленных операций:**
```bash
# Операции дольше 1 секунды
grep '"duration_ms"' logs/2025-10-18.log | \
  jq 'select(.duration_ms > 1000)'
```

### 7. Context Information

**Всегда логируйте контекст:**
```javascript
// Плохо ❌
logger.error('Ошибка');

// Хорошо ✅
logger.error('Ошибка синхронизации с Supabase', {
  operation: 'insert',
  table: 'vapi_calls_raw',
  recordId: 'abc123',
  error: error.message
});
```

## Текущая статистика (2025-10-18)

```
Всего логов:     37 строк
INFO логов:      32 (86.5%)
ERROR логов:     2  (5.4%)
WARN логов:      3  (8.1%)
```

## Проверочный чек-лист

### Перед production запуском:

- [ ] Запустить `npm run test:logging` (dry-run)
- [ ] Проверить что логи создаются в `logs/`
- [ ] Проверить что ошибки попадают в `logs/errors/`
- [ ] Проверить JSON формат всех логов
- [ ] Убедиться что все уровни работают (INFO, WARN, ERROR)
- [ ] Проверить что контекстные данные логируются
- [ ] Проверить production режим `npm run test:logging:real`

### После production запуска:

- [ ] Проверить логи на наличие ошибок
- [ ] Проанализировать производительность
- [ ] Проверить что не потеряны важные события
- [ ] Архивировать старые логи (>30 дней)

## Интеграция в CI/CD

```yaml
# .github/workflows/test.yml
- name: Test logging system
  run: |
    npm run test:logging
    # Проверка что логи созданы
    test -f logs/$(date +%Y-%m-%d).log
    # Проверка что нет критических ошибок в dry-run
    ! grep -q '"level":"ERROR"' logs/$(date +%Y-%m-%d).log || exit 1
```

## Мониторинг в реальном времени

```bash
# Следить за логами
tail -f logs/$(date +%Y-%m-%d).log

# Только ошибки
tail -f logs/errors/$(date +%Y-%m-%d).log

# С фильтрацией (только module: vapi-sync)
tail -f logs/$(date +%Y-%m-%d).log | grep '"module":"vapi-sync"'

# С jq для красивого вывода
tail -f logs/$(date +%Y-%m-%d).log | jq -r '"\(.timestamp) [\(.level)] \(.message)"'
```

## Debug Mode

```bash
# Включить debug логи (все логи в консоли)
DEBUG=true node production_scripts/vapi_collection/src/sync_to_supabase.js

# Без debug (только ERROR в консоли)
node production_scripts/vapi_collection/src/sync_to_supabase.js
```

## Сравнение подходов

| Подход | Vapi (CLI scripts) | Shadi (Next.js) | Что выбрать |
|--------|-------------------|-----------------|-------------|
| **Когда логи создаются** | При запуске скриптов | Автоматически при HTTP запросах | Зависит от архитектуры |
| **Формат** | JSON | JSON | JSON для обоих ✅ |
| **Ротация** | По датам | По датам | По датам ✅ |
| **Тестирование** | Dry-run режим | Request mocking | Dry-run для CLI ✅ |

## Полезные команды

```bash
# Статистика по модулям
jq -r '.module' logs/2025-10-18.log | sort | uniq -c

# Топ-10 самых частых сообщений
jq -r '.message' logs/2025-10-18.log | sort | uniq -c | sort -rn | head -10

# Средняя длительность операций
jq -r 'select(.duration_ms != null) | .duration_ms' logs/2025-10-18.log | \
  awk '{sum+=$1; count++} END {print "Avg:", sum/count, "ms"}'

# Экспорт в CSV для анализа
jq -r '[.timestamp, .level, .module, .message] | @csv' logs/2025-10-18.log > logs.csv
```

## Best Practice Checklist

✅ **Используется в проекте:**
- [x] JSON формат логов
- [x] Разделение по датам
- [x] Отдельный файл для ошибок
- [x] Структурированные данные
- [x] Dry-run тестирование
- [x] Контекстная информация
- [x] Уровни логирования (INFO, WARN, ERROR, DEBUG)

📝 **Рекомендации для улучшения:**
- [ ] Добавить log aggregation (ELK stack)
- [ ] Настроить alerts для критических ошибок
- [ ] Добавить метрики в Prometheus/Grafana
- [ ] Автоматическая архивация старых логов
