# N8n Workflows для сбора данных VAPI

Этот каталог содержит два N8n workflow для автоматизации сбора и анализа данных из VAPI API.

## Файлы

1. **`vapi_collection_workflow.json`** - Базовый workflow для сбора данных
2. **`vapi_collection_advanced.json`** - Продвинутый workflow с интеграцией Airtable
3. **`README.md`** - Данный файл с инструкциями

## Настройка окружения

### Переменные окружения (.env)

Необходимо настроить следующие переменные в N8n:

```bash
# VAPI API
VAPI_API_KEY=your_vapi_api_key

# Airtable (только для продвинутого workflow)
AIRTABLE_API_KEY=your_airtable_token
AIRTABLE_BASE_ID=your_base_id

# Уведомления (опционально)
WEBHOOK_URL=your_webhook_url_for_notifications
```

### Настройка Credentials в N8n

1. **Airtable API Token**:
   - Перейдите в Settings → Credentials
   - Создайте новый credential типа "Airtable Token API"
   - Вставьте ваш Airtable Personal Access Token

2. **Slack API** (опционально):
   - Создайте credential типа "Slack API"
   - Настройте Bot Token для уведомлений

## Импорт workflows

### Шаг 1: Импорт JSON файлов

1. Откройте N8n interface
2. Нажмите "Import from File"
3. Выберите один из JSON файлов
4. Нажмите "Import"

### Шаг 2: Настройка Credentials

После импорта необходимо настроить credentials:

1. Откройте импортированный workflow
2. Найдите ноды с красными индикаторами (требуют credentials)
3. Нажмите на каждый нод и выберите соответствующий credential

## Базовый Workflow (vapi_collection_workflow.json)

### Возможности:
- ✅ Ручной запуск
- ✅ Сбор всех звонков за период
- ✅ Фильтрация по стоимости и длительности
- ✅ Генерация статистики
- ✅ Сохранение в JSON файлы
- ✅ Обработка ошибок с повторными попытками

### Используемые ноды:
- Manual Trigger
- Set (Configuration)
- Code (Fetch + Filter + Stats)
- If (Conditional logic)
- Write Binary File (Save results)

### Настройка:

1. **Set Configuration node**: измените даты и фильтры:
   ```json
   {
     "START_DATE": "2025-01-01",
     "END_DATE": "2025-09-17",
     "MIN_COST": 0,
     "MIN_DURATION": 30
   }
   ```

2. **Активируйте workflow** и нажмите "Test workflow"

## Продвинутый Workflow (vapi_collection_advanced.json)

### Возможности:
- ✅ Автоматический запуск по расписанию (каждые 6 часов)
- ✅ Динамические даты (вчера → сегодня)
- ✅ Обогащение данных (категории, качество звонков)
- ✅ Batch upload в Airtable
- ✅ Расширенная аналитика
- ✅ Slack уведомления
- ✅ Markdown отчеты

### Используемые ноды:
- Schedule Trigger (автозапуск)
- Set (Dynamic configuration)
- Code (Advanced processing)
- Split in Batches (Batch processing)
- Airtable (Create records)
- If (Error checking)
- Slack (Notifications)
- Markdown (Report generation)

### Настройка Airtable:

1. **Создайте таблицу в Airtable** с полями:
   ```
   Call ID (Single line text)
   Created At (Date)
   Status (Single select)
   Duration (seconds) (Number)
   Duration (minutes) (Number)
   Cost (USD) (Currency)
   Phone Number (Phone number)
   Assistant ID (Single line text)
   Has Transcript (Checkbox)
   Transcript (Long text)
   Day of Week (Single line text)
   Hour of Day (Number)
   Categories (Multiple select)
   Quality Score (Number)
   ```

2. **Настройте Schedule Trigger**:
   - Измените interval по необходимости
   - Можете отключить и использовать Manual trigger для тестирования

## Мониторинг и отладка

### Логи выполнения:
- В N8n перейдите в Executions
- Просмотрите детали выполнения каждого нода
- Console logs отображаются в деталях Code нодов

### Типичные проблемы:

1. **"API Rate Limit"**:
   - Добавьте задержки в Code ноды
   - Уменьшите размер batch в Split In Batches

2. **"Credential not found"**:
   - Проверьте настройку credentials в Settings
   - Убедитесь что credential назначен правильному ноду

3. **"Airtable field not found"**:
   - Проверьте соответствие полей в Airtable
   - Обновите mapping в "Prepare Airtable Records" ноде

## Кастомизация

### Добавление новых фильтров:

В Code ноде "Apply Filters" добавьте:

```javascript
// Фильтр по статусу
if (config.STATUS_FILTER) {
  filtered = filtered.filter(call => call.status === config.STATUS_FILTER);
}

// Фильтр по ID ассистента
if (config.ASSISTANT_ID) {
  filtered = filtered.filter(call => call.assistantId === config.ASSISTANT_ID);
}
```

### Изменение расписания:

В Schedule Trigger ноде измените:
```json
{
  "rule": {
    "interval": [
      {
        "field": "hours",
        "hoursInterval": 6
      }
    ]
  }
}
```

## Производительность

### Рекомендации:
- Для больших объемов данных (>1000 звонков) используйте batch processing
- Увеличьте timeout в HTTP Request нодах до 60 секунд
- Настройте retry logic в Code нодах
- Мониторьте memory usage в N8n

### Оптимизация:
```javascript
// В Code ноде добавьте контроль памяти
if (allCalls.length > 5000) {
  console.warn('Large dataset detected, consider splitting execution');
}
```

## Безопасность

- ❌ Никогда не храните API ключи в workflow JSON
- ✅ Используйте Environment Variables
- ✅ Настройте proper credentials в N8n
- ✅ Ограничьте access к workflow в N8n settings

## Поддержка

При возникновении проблем:
1. Проверьте logs в Executions
2. Убедитесь в правильности API ключей
3. Проверьте rate limits VAPI API
4. Проверьте структуру данных Airtable