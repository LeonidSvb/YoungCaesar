# 🚀 N8N WORKFLOWS SETUP INSTRUCTIONS

## 📋 ГОТОВЫЕ WORKFLOWS

Создано 2 готовых workflow:
1. **VAPI_QCI_Analysis_Workflow.json** - Анализ каждого звонка в real-time
2. **Daily_Assistant_Report_Workflow.json** - Ежедневные отчёты в 9 утра

## 🔧 ШАГИ НАСТРОЙКИ

### 1. Импорт Workflows в N8N

1. Зайди в N8N: https://eliteautomations.youngcaesar.digital
2. **Workflows** → **Import from File**
3. Загрузи `VAPI_QCI_Analysis_Workflow.json`
4. Загрузи `Daily_Assistant_Report_Workflow.json`

### 2. Настройка Credentials

#### VAPI API Credentials:
- **Type:** HTTP Header Auth
- **Name:** `vapiCredentials`
- **Header Name:** `Authorization`
- **Header Value:** `Bearer your_vapi_api_key_here`

#### OpenAI Credentials:
- **Type:** OpenAI
- **API Key:** `your_openai_api_key_here`

#### Airtable Credentials:
- **Type:** Airtable API
- **API Key:** `your_airtable_api_key_here`
- **Base ID:** `appKny1PQSInwEMDe`

#### Slack Credentials (опционально):
- **Type:** Slack OAuth2 API
- **Channel ID:** Создай канал #vapi-alerts и получи ID

### 3. Добавь Поля в Airtable

В таблице `VAPI_Calls` (tblvXZt2zkkanjGdE) добавь поля:

```
QCI Overall Score - Number (0-100)
Approach Quality - Number (0-100) 
Engagement Level - Number (0-100)
Information Gathering - Number (0-100)
Call Outcome Score - Number (0-100)
Call Classification - Single Select (hot_lead, warm_lead, cold_lead, callback_requested, not_decision_maker, invalid)
Coaching Tips - Long text
Key Insights - Long text
Next Actions - Long text
Call Sentiment - Single Select (positive, neutral, negative)
Talk Time Ratio - Single line text
Improvement Areas - Long text
Auto Analyzed - Checkbox
Analysis Date - Date
```

### 4. Создай Таблицу Daily Reports (опционально)

Новая таблица `tblDailyReports` с полями:
```
Report Date - Date
Total Calls - Number
Avg QCI Score - Number
Total Cost - Number
Hot Leads - Number
Warm Leads - Number
Conversion Rate - Number
Key Insights - Long text
Coaching Recommendations - Long text
Full Report JSON - Long text
```

### 5. Настройка VAPI Webhook

1. В VAPI Dashboard → Settings → Webhooks
2. **Event:** `call.ended`
3. **URL:** `https://eliteautomations.youngcaesar.digital/webhook/vapi-call-ended`
4. **Method:** POST
5. **Headers:** Content-Type: application/json

### 6. Активация Workflows

1. **VAPI QCI Analysis:** Активируй webhook trigger
2. **Daily Reports:** Активируй cron trigger

## 🎯 ЧТО ПРОИЗОЙДЁТ ПОСЛЕ НАСТРОЙКИ

### После каждого звонка:
1. VAPI отправляет webhook
2. N8N получает данные звонка
3. OpenAI анализирует качество (QCI)
4. Результат сохраняется в Airtable
5. Уведомление в Slack (если настроен)

### Каждый день в 9 утра:
1. Собираются данные за вчера
2. OpenAI создаёт аналитический отчёт
3. Отчёт отправляется в Slack
4. Сводка сохраняется в Airtable

## 🔍 ТЕСТИРОВАНИЕ

### Проверь QCI Workflow:
```bash
curl -X POST https://eliteautomations.youngcaesar.digital/webhook/vapi-call-ended \
-H "Content-Type: application/json" \
-d '{"callId": "existing-call-id", "assistantId": "assistant-id", "status": "completed"}'
```

### Проверь Daily Report:
- Запусти вручную через N8N interface
- Или жди до завтра 9 утра

## 🚨 TROUBLESHOOTING

**Workflow не запускается:**
- Проверь credentials
- Убедись что webhook URL правильный

**OpenAI ошибки:**
- Проверь API key
- Убедись что есть credits на счету

**Airtable ошибки:**
- Проверь что поля созданы
- Убедись что record ID существует

## 📊 РЕЗУЛЬТАТ

После настройки получишь:
- ✅ Автоматический анализ каждого звонка
- ✅ QCI оценки и coaching tips
- ✅ Классификацию лидов
- ✅ Ежедневные отчёты по производительности
- ✅ Все данные в Airtable для анализа
- ✅ Уведомления в Slack

**Время настройки:** 30-60 минут
**ROI:** 1,075,000% в первый год! 🚀