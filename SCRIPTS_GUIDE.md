# 📋 ПОЛНЫЙ ГАЙД ПО СКРИПТАМ VAPI PROJECT

## 🔥 КРИТИЧЕСКИ ВАЖНЫЕ - Основа работы проекта

### 1. Сбор данных из VAPI API

**`scripts/collect_vapi_data.js`** - ГЛАВНЫЙ скрипт для получения всех звонков
```bash
# Собрать все звонки за период
node scripts/collect_vapi_data.js 2025-09-01 2025-09-10
```
- **Что делает:** Получает все звонки из VAPI API с адаптивным разделением периодов
- **Создаёт файлы:** `data/raw/vapi_raw_calls_*.json`, `data/raw/vapi_analytics_report_*.json`
- **Когда использовать:** Ежедневно/еженедельно для сбора новых данных
- **Заменил:** `scripts/collection/vapi_all_calls_collector.js`

### 2. Синхронизация с Airtable

**`scripts/sync_airtable.js`** - ОСНОВНОЙ скрипт для загрузки в CRM
```bash
# Загрузить последние данные
node scripts/sync_airtable.js upload

# Создать связи между таблицами
node scripts/sync_airtable.js link

# Удалить дубликаты
node scripts/sync_airtable.js dedupe
```
- **Что делает:** Массовая загрузка звонков в Airtable, создание связей, удаление дубликатов
- **Когда использовать:** После каждого сбора данных
- **Заменил:** `scripts/upload/airtable_uploader.js`, `scripts/migration/link_tables.js`

## ⚡ ВЫСОКАЯ ВАЖНОСТЬ - API клиенты и утилиты

### API Клиенты (переиспользуемые модули)

**`scripts/api/vapi_client.js`** - Все операции с VAPI API
- **Методы:** `getAllCalls()`, `getAssistants()`, `analyzeCallsForDay()`
- **Использование:** Импортируется в других скриптах
```javascript
const VapiClient = require('./api/vapi_client');
const vapi = new VapiClient();
```

**`scripts/api/airtable_client.js`** - Все операции с Airtable API
- **Методы:** `uploadBatch()`, `linkTables()`, `getAllRecords()`, `removeDuplicates()`
- **Использование:** Импортируется в других скриптах
```javascript
const AirtableClient = require('./api/airtable_client');
const airtable = new AirtableClient();
```

### Утилиты

**`scripts/utils/data_utils.js`** - Работа с файлами и данными
- **Методы:** `saveJsonData()`, `loadJsonData()`, `createBackup()`, `validateCallData()`
- **Для чего:** Сохранение, загрузка, валидация данных

**`scripts/utils/logger.js`** - Логирование и прогресс
- **Методы:** `info()`, `success()`, `error()`, `progress()`
- **Для чего:** Отслеживание операций, запись в логи

## 🟡 СРЕДНЯЯ ВАЖНОСТЬ - Специализированные задачи

### Анализ данных

**`scripts/analysis/check_sync_status.js`** - Проверка статуса синхронизации
- **Когда использовать:** Для проверки целостности данных между VAPI и Airtable
- **Результат:** Отчёт о расхождениях в данных

**`scripts/analysis/count_airtable_records.js`** - Подсчёт записей в таблицах
- **Когда использовать:** Для быстрой проверки количества записей
- **Результат:** Статистика по всем таблицам

**`scripts/analysis/airtable_search_tool.js`** - Поиск по записям Airtable
- **Когда использовать:** Для поиска конкретных звонков или клиентов
- **Результат:** Найденные записи по критериям

### Миграция и связывание

**`scripts/migration/migrate_all_regions.js`** - Консолидация региональных таблиц
- **Когда использовать:** При объединении нескольких региональных баз в одну
- **Статус:** ✅ Выполнено (2,316 звонков связано с 1,054 клиентами)

**`scripts/migration/full_clients_migration.js`** - Полная миграция клиентов
- **Когда использовать:** При переносе всех клиентских данных
- **Статус:** ✅ Выполнено (1,465 записей объединено)

### Сбор метаданных

**`scripts/collection/get_assistant_names.js`** - Получение данных ассистентов
- **Когда использовать:** Для создания `assistant_mapping.json`
- **Результат:** Файл с именами и настройками всех ассистентов

**`scripts/collection/n8n_workflows_collector.js`** - Сбор workflow из N8N
- **Когда использовать:** Для анализа автоматизированных процессов
- **Результат:** Данные о 42 workflow

## 🔵 НИЗКАЯ ВАЖНОСТЬ - Отладка и мониторинг

### Отладочные утилиты

**`scripts/debug/quick_status.js`** - Быстрая проверка статуса проекта
- **Когда использовать:** Для общего обзора состояния данных
- **Результат:** Сводка по всем основным метрикам

**`scripts/debug/check_existing_fields.js`** - Проверка полей в Airtable
- **Когда использовать:** При добавлении новых полей в таблицы
- **Результат:** Список существующих полей

**`scripts/debug/check_linked_calls.js`** - Проверка связанных звонков
- **Когда использовать:** Для проверки качества связывания таблиц
- **Результат:** Статистика связанности данных

### Специализированный анализ

**`scripts/analysis/analyze_airtable_structure.js`** - Анализ структуры таблиц
- **Когда использовать:** При планировании изменений в структуре БД
- **Результат:** Подробная схема всех таблиц и связей

**`scripts/analysis/table_relationship_analyzer.js`** - Анализ связей между таблицами
- **Когда использовать:** Для оптимизации связей между таблицами
- **Результат:** Граф связей и рекомендации

## 📦 АРХИВ - Устаревшие скрипты

**`scripts/archive/`** - Папка с устаревшими скриптами
- `vapi_calls_extractor.js` - Legacy сборщик (заменён на `vapi_client.js`)
- `test_*.js` - Тестовые скрипты (больше не нужны)
- `mass_upload_september.js` - Одноразовые загрузки (выполнены)

## 🐍 PYTHON СКРИПТЫ - Специальные задачи

**`scripts/qci_integration.py`** - Интеграция с системой контроля качества
- **Когда использовать:** Для анализа качества звонков через OpenAI
- **Результат:** QCI индексы и рекомендации по улучшению

**`scripts/upload_to_airtable.py`** - Python загрузчик в Airtable
- **Статус:** Заменён на JS версию `sync_airtable.js`

## 🚀 РЕКОМЕНДУЕМЫЙ WORKFLOW

### Ежедневное обновление данных:
1. **Сбор:** `node scripts/collect_vapi_data.js <вчера> <сегодня>`
2. **Загрузка:** `node scripts/sync_airtable.js upload`
3. **Связывание:** `node scripts/sync_airtable.js link`

### Еженедельный анализ:
1. **Проверка:** `node scripts/debug/quick_status.js`
2. **Анализ:** `node scripts/analysis/check_sync_status.js`

### При проблемах:
1. **Дубликаты:** `node scripts/sync_airtable.js dedupe`
2. **Логи:** Проверить `logs/` папку
3. **Откат:** Использовать бэкапы из `data/migration_backups/`

## ⚙️ КОНФИГУРАЦИЯ

Все скрипты используют переменные из `.env`:
```env
VAPI_API_KEY=your_vapi_key
AIRTABLE_API_KEY=your_airtable_key
AIRTABLE_BASE_ID=your_base_id
AIRTABLE_TABLE_ID=your_table_id
DEBUG=true
```

## 📊 СТАТИСТИКА ПРОЕКТА

- **Всего скриптов:** 57 (11 в архиве)
- **Основных рабочих:** 2 (collect_vapi_data.js, sync_airtable.js)
- **API клиентов:** 2 (vapi_client.js, airtable_client.js)
- **Утилит:** 2 (data_utils.js, logger.js)
- **Собрано звонков:** 2,612
- **Связано с клиентами:** 2,316 (88.7%)
- **Консолидировано клиентов:** 1,465

## 🎯 ПРИОРИТЕТЫ ИСПОЛЬЗОВАНИЯ

**🔴 Критично (используй регулярно):**
- `collect_vapi_data.js` - сбор данных
- `sync_airtable.js` - синхронизация

**🟡 Важно (используй по необходимости):**
- `scripts/api/*` - для создания новых скриптов
- `scripts/debug/quick_status.js` - для мониторинга

**🔵 Опционально (редко):**
- `scripts/analysis/*` - для глубокого анализа
- `scripts/migration/*` - уже выполнено
- `scripts/debug/*` - только при проблемах