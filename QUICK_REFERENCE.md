# 🚀 БЫСТРАЯ ШПАРГАЛКА

## Основные команды (то что используешь каждый день)

```bash
# Собрать данные за последние 7 дней
node scripts/collect_vapi_data.js 2025-09-04 2025-09-11

# Загрузить в Airtable
node scripts/sync_airtable.js upload

# Создать связи
node scripts/sync_airtable.js link

# Проверить статус
node scripts/debug/quick_status.js
```

## Структура файлов (где что лежит)

```
📁 data/raw/          - Исходные данные из VAPI
📁 data/processed/    - Обработанные данные и CSV
📁 scripts/api/       - API клиенты (основа)
📁 scripts/archive/   - Старые скрипты (не трогать)
📁 logs/              - Логи всех операций
```

## Проблемы и решения

**❌ "No data found"** → Проверь даты в команде  
**❌ "API Error 401"** → Проверь VAPI_API_KEY в .env  
**❌ "Airtable Error"** → Проверь AIRTABLE_* ключи в .env  
**❌ Дубликаты** → `node scripts/sync_airtable.js dedupe`  

## Важные файлы

- **`.env`** - Все API ключи
- **`SCRIPTS_GUIDE.md`** - Полное описание всех скриптов
- **`logs/`** - Если что-то не работает, смотри сюда
- **`data/migration_backups/`** - Бэкапы важных данных

## Числа проекта (актуально)

- 2,612 звонков собрано
- 88.7% связано с клиентами  
- 1,465 уникальных клиентов
- $104.23 общая стоимость звонков