# Quick N8n Script-to-Workflow Conversion Guide

Этот справочник поможет быстро конвертировать любой JavaScript скрипт в N8n workflow.

## 🚀 Быстрый старт для VAPI скриптов

### 1. Анализ оригинального скрипта

**Что искать в скрипте:**
```javascript
// ✅ API вызовы → HTTP Request ноды
const response = await fetch('https://api.vapi.ai/call', {...});

// ✅ Фильтрация данных → Code ноды
const filtered = calls.filter(call => call.cost >= 0.03);

// ✅ Конфигурация → Set ноды
const CONFIG = { START_DATE: '2025-01-01', ... };

// ✅ Сохранение файлов → Write Binary File ноды
await DataUtils.saveJsonData(data, filename, directory);

// ✅ Внешние интеграции → специализированные ноды
// Airtable, Slack, Google Sheets, etc.
```

### 2. Шаблон базового N8n workflow

```json
{
  "name": "Your Script Name",
  "nodes": [
    {
      "parameters": {},
      "name": "Manual Trigger",
      "type": "n8n-nodes-base.manualTrigger",
      "position": [250, 300]
    },
    {
      "parameters": {
        "values": {
          "string": [{"name": "CONFIG_VAR", "value": "value"}]
        }
      },
      "name": "Set Configuration",
      "type": "n8n-nodes-base.set",
      "position": [450, 300]
    },
    {
      "parameters": {
        "jsCode": "// Ваш JavaScript код здесь"
      },
      "name": "Main Logic",
      "type": "n8n-nodes-base.code",
      "position": [650, 300]
    }
  ],
  "connections": {
    "Manual Trigger": {
      "main": [[{"node": "Set Configuration", "type": "main", "index": 0}]]
    },
    "Set Configuration": {
      "main": [[{"node": "Main Logic", "type": "main", "index": 0}]]
    }
  }
}
```

## 📋 Conversion Checklist (5 минут)

### Шаг 1: Идентификация компонентов (1 мин)
- [ ] **Trigger:** Manual или Schedule?
- [ ] **Configuration:** Какие переменные нужны?
- [ ] **API Calls:** HTTP Request или Code node?
- [ ] **Data Processing:** Простые фильтры или сложная логика?
- [ ] **Output:** Файлы, интеграции, уведомления?

### Шаг 2: Mapping на N8n ноды (2 мин)
```
JavaScript Function       →  N8n Node Type
──────────────────────────────────────────
fetch() / HTTP requests    →  HTTP Request Node
require('dotenv').config() →  Environment Variables
const CONFIG = {...}       →  Set Node
Array.filter/map/reduce    →  Code Node
fs.writeFile()            →  Write Binary File Node
console.log()             →  Code Node (для логирования)
Database operations       →  Database Nodes (MySQL, Postgres, etc.)
Airtable API              →  Airtable Node
Slack API                 →  Slack Node
```

### Шаг 3: Создание workflow (2 мин)
1. **Копируйте базовый шаблон** из этого файла
2. **Замените значения:**
   - `name`: название вашего скрипта
   - `parameters.values`: ваши CONFIG переменные
   - `jsCode`: основную логику скрипта
3. **Добавьте специализированные ноды** при необходимости

## ⚡ Quick Patterns для VAPI скриптов

### Pattern 1: API Collection с пагинацией
```javascript
// В Code Node:
const allData = [];
let offset = 0;
let hasMore = true;

while (hasMore) {
  const batch = await $http.request({
    method: 'GET',
    url: 'https://api.vapi.ai/call',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    qs: { limit: 100, offset: offset }
  });

  allData.push(...batch);
  hasMore = batch.length === 100;
  offset += 100;
}

return allData.map(item => ({ json: item }));
```

### Pattern 2: Фильтрация и статистика
```javascript
// В Code Node:
const calls = $input.all().map(item => item.json);
const config = $node["Set Configuration"].json;

// Применяем фильтры
const filtered = calls.filter(call => {
  return call.cost >= config.MIN_COST &&
         call.duration >= config.MIN_DURATION;
});

// Генерируем статистику
const stats = {
  total: filtered.length,
  avgCost: filtered.reduce((sum, call) => sum + call.cost, 0) / filtered.length,
  totalDuration: filtered.reduce((sum, call) => sum + call.duration, 0)
};

return { filtered: filtered, stats: stats };
```

### Pattern 3: Batch обработка для интеграций
```javascript
// Split in Batches Node настройки:
{
  "batchSize": 10,
  "options": {}
}

// В следующем Code Node подготовка для Airtable:
const records = $input.all().map(item => ({
  fields: {
    'Call ID': item.json.id,
    'Cost': item.json.cost,
    'Duration': item.json.duration,
    'Created At': item.json.createdAt
  }
}));

return records.map(record => ({ json: record }));
```

## 🔧 Environment Variables Setup

В N8n добавьте в Settings > Environment Variables:
```bash
VAPI_API_KEY=your_vapi_key
AIRTABLE_API_KEY=your_airtable_key
AIRTABLE_BASE_ID=your_base_id
OPENAI_API_KEY=your_openai_key
WEBHOOK_URL=your_webhook_url
```

Использование в workflow:
```javascript
const apiKey = $env.VAPI_API_KEY;
const baseId = $env.AIRTABLE_BASE_ID;
```

## 🎯 Специфичные N8n фичи

### Error Handling в Code Node
```javascript
try {
  // Ваш код
  const result = await someOperation();
  return result;
} catch (error) {
  // Логирование ошибки
  console.error('Error:', error.message);

  // Возврат ошибки для IF Node
  return { error: true, message: error.message };
}
```

### Retry Logic
```javascript
async function withRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
}

const result = await withRetry(() => $http.request({...}));
```

### Dynamic Configuration
```javascript
// В Set Node можно использовать выражения:
{
  "values": {
    "string": [
      {
        "name": "START_DATE",
        "value": "={{ $now.minus({days: 1}).format('yyyy-MM-dd') }}"
      },
      {
        "name": "END_DATE",
        "value": "={{ $now.format('yyyy-MM-dd') }}"
      }
    ]
  }
}
```

## 🚀 Production Ready Additions

### 1. Schedule Trigger вместо Manual
```json
{
  "parameters": {
    "rule": {
      "interval": [{"field": "hours", "hoursInterval": 6}]
    }
  },
  "name": "Schedule Trigger",
  "type": "n8n-nodes-base.scheduleTrigger"
}
```

### 2. Slack Notifications
```json
{
  "parameters": {
    "channel": "#notifications",
    "text": "Process completed",
    "otherOptions": {
      "attachments": {
        "attachmentsValues": [{
          "color": "#00AA00",
          "title": "Success",
          "fields": {
            "fieldsValues": [{
              "title": "Records Processed",
              "value": "={{ $json.totalRecords }}",
              "short": true
            }]
          }
        }]
      }
    }
  },
  "name": "Success Notification",
  "type": "n8n-nodes-base.slack"
}
```

### 3. Conditional Logic
```json
{
  "parameters": {
    "conditions": {
      "number": [{
        "value1": "={{ $json.recordCount }}",
        "operation": "larger",
        "value2": 0
      }]
    }
  },
  "name": "Check Results",
  "type": "n8n-nodes-base.if"
}
```

## 📊 Performance Tips

1. **Batch Processing:** Используйте Split in Batches для больших данных
2. **Rate Limiting:** Добавляйте задержки в Code nodes: `await new Promise(resolve => setTimeout(resolve, 1000))`
3. **Memory Management:** Для очень больших datasets обрабатывайте по частям
4. **Error Recovery:** Всегда добавляйте retry logic для API вызовов
5. **Monitoring:** Используйте IF nodes для проверки результатов

## ⏱️ Типичное время конвертации

- **Простой скрипт (API + фильтр):** 5-10 минут
- **Средний скрипт (с интеграциями):** 15-20 минут
- **Сложный скрипт (много логики):** 30-45 минут

## 🎁 Готовые шаблоны в проекте

1. **`vapi_collection_workflow.json`** - Базовый сбор данных
2. **`vapi_collection_advanced.json`** - С Airtable интеграцией
3. **Этот файл** - Quick reference для новых скриптов

**Следующий раз:** Просто скопируйте подходящий шаблон и адаптируйте под вашу задачу!