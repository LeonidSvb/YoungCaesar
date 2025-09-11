# QCI Анализ в N8N - Полная система

## Обзор системы

Создана полная система реального времени для анализа качества звонков VAPI с использованием n8n workflow и OpenAI GPT-4.

### Что реализовано:

✅ **N8N Workflow развернут** (ID: `6hpElxvumVmUzomY`)  
✅ **Webhook URL настроен**: `https://eliteautomations.youngcaesar.digital/webhook/vapi-qci-enhanced`  
✅ **4-критериальный QCI анализ** (Approach, Engagement, Info Gathering, Call Outcome)  
✅ **Классификация лидов** (hot_lead, warm_lead, cold_lead, etc.)  
✅ **Интеграция с Airtable** для сохранения данных  
✅ **Slack уведомления** с детальными отчетами  
✅ **Обработка ошибок** и валидация данных  
✅ **Скрипты тестирования** и настройки  

## Быстрый старт

### 1. Настройка Credentials в N8N

Перейдите в n8n Dashboard и создайте credentials согласно инструкциям в `C:\Users\79818\Desktop\Vapi\docs\N8N_QCI_Setup_Instructions.md`

### 2. Активация Workflow

После настройки credentials активируйте workflow в n8n Dashboard.

### 3. Настройка VAPI Webhook

```bash
# Автоматическая настройка для всех assistants
node scripts/setup_vapi_webhook.js setup

# Проверка статуса
node scripts/setup_vapi_webhook.js check

# Список assistants  
node scripts/setup_vapi_webhook.js list
```

### 4. Тестирование системы

```bash
# Одиночный тест
node scripts/test_qci_webhook.js single

# Множественное тестирование
node scripts/test_qci_webhook.js multiple 5
```

## Архитектура системы

### Workflow узлы:

1. **VAPI Call Ended Webhook** → Получение данных о завершенном звонке
2. **Get VAPI Call Data** → Загрузка полной информации через API  
3. **Check Transcript Quality** → Валидация транскрипта
4. **Diarize Transcript** → Структурирование с разделением говорящих
5. **Enhanced QCI Analysis** → Глубокий анализ по 4 критериям
6. **Update Airtable QCI Data** → Сохранение всех метрик  
7. **Send Slack QCI Report** → Детальный отчет в Slack
8. **Success Response** → Подтверждение выполнения

### QCI Критерии (0-100 баллов):

**A. Approach Quality (25 pts)**
- Профессиональное представление (0-5)
- Четкая ценностная позиция (0-8) 
- Подходящий тон и темп (0-7)
- Позиционирование бренда (0-5)

**B. Engagement Level (25 pts)**  
- Участие клиента (0-8)
- Качество заданных вопросов (0-7)
- Работа с возражениями (0-5)
- Поток беседы (0-5)

**C. Information Gathering (25 pts)**
- Исследовательские вопросы (0-8)
- Эффективность квалификации (0-7) 
- Выявление болевых точек (0-5)
- Валидация лица принятия решений (0-5)

**D. Call Outcome (25 pts)**
- Закрепленные следующие шаги (0-10)
- Достигнутый уровень обязательств (0-8)
- Запланированное продолжение (0-7)

### Классификация лидов:

- `hot_lead` - Готов к покупке, встреча назначена, высокий интерес
- `warm_lead` - Заинтересован, нужен follow-up, некоторые возражения  
- `cold_lead` - Низкий интерес, серьезные возражения, вряд ли конвертируется
- `callback_requested` - Запросил обратный звонок или дополнительную информацию
- `not_decision_maker` - Не лицо принятия решений, нужно перенаправление
- `invalid` - Неверный номер, голосовая почта, языковой барьер

## Созданные файлы и скрипты

### N8N Workflow
- `C:\Users\79818\Desktop\Vapi\n8n_workflows\Enhanced_QCI_Workflow.json` - JSON workflow для n8n
- `C:\Users\79818\Desktop\Vapi\scripts\deploy_qci_workflow.js` - Скрипт автоматического развертывания

### Тестирование
- `C:\Users\79818\Desktop\Vapi\scripts\test_qci_webhook.js` - Полное тестирование webhook
- Поддерживает одиночные и множественные тесты
- Детальное логирование и отчетность

### Настройка VAPI
- `C:\Users\79818\Desktop\Vapi\scripts\setup_vapi_webhook.js` - Автонастройка webhook URL в VAPI
- Поддержка всех assistants
- Проверка статуса настройки

### Документация  
- `C:\Users\79818\Desktop\Vapi\docs\N8N_QCI_Setup_Instructions.md` - Подробные инструкции настройки
- `C:\Users\79818\Desktop\Vapi\README_QCI_N8N_SYSTEM.md` - Этот файл

### Существующие компоненты
- `C:\Users\79818\Desktop\Vapi\scripts\qci_analyzer.js` - Автономный QCI анализатор (улучшен)
- `C:\Users\79818\Desktop\Vapi\scripts\setup_airtable_qci_fields.js` - Настройка полей Airtable

## Использование в реальном времени

### После полной настройки:

1. **VAPI совершает звонок** → Автоматически отправляется webhook при завершении
2. **N8N получает данные** → Workflow запускается автоматически  
3. **Анализ в реальном времени** → GPT-4 анализирует по 4 критериям
4. **Сохранение в Airtable** → Все QCI метрики сохраняются в CRM
5. **Slack уведомление** → Детальный отчет с coaching tips
6. **Ответ VAPI** → Подтверждение успешного анализа

### Мониторинг и отладка:

- **N8N Dashboard**: `https://eliteautomations.youngcaesar.digital/workflows/6hpElxvumVmUzomY`
- **Executions Log**: Все выполнения workflow в реальном времени  
- **Slack канал**: C06VAPI001 - все уведомления QCI
- **Airtable база**: appKny1PQSInwEMDe / tblvXZt2zkkanjGdE

## API Endpoints и URLs

### Основной webhook:
```
POST https://eliteautomations.youngcaesar.digital/webhook/vapi-qci-enhanced
Authorization: Basic (vapi_user:vapi_webhook_2025)
Content-Type: application/json
```

### VAPI API:
```
GET https://api.vapi.ai/call/{callId}
Authorization: Bearer 186d494d-210e-4dcc-94cc-0620e1da56e0
```

### Airtable API:
```  
PATCH https://api.airtable.com/v0/appKny1PQSInwEMDe/tblvXZt2zkkanjGdE/{recordId}
Authorization: Bearer patOqTHdlhpX2Rm5X...
```

## Расширение и настройка

### Добавление новых критериев QCI:
1. Обновите prompt в узле "Enhanced QCI Analysis"
2. Добавьте новые поля в Airtable  
3. Обновите узел "Update Airtable QCI Data"

### Изменение классификации лидов:
1. Модифицируйте список в QCI Analysis prompt
2. Обновите логику в Airtable mapping

### Добавление новых интеграций:
1. Добавьте новые узлы после "Enhanced QCI Analysis"  
2. Настройте соответствующие credentials

## Решение проблем

### Workflow не активируется:
- Проверьте настройку всех credentials в n8n
- Убедитесь, что OpenAI API key валиден
- Проверьте доступ к Airtable

### Нет данных в Airtable:
- Запустите `node scripts/setup_airtable_qci_fields.js`
- Проверьте поля и их названия в Airtable  
- Убедитесь в правильности Base ID и Table ID

### Не работает webhook:  
- Проверьте URL: `https://eliteautomations.youngcaesar.digital/webhook/vapi-qci-enhanced`
- Убедитесь в активном workflow в n8n
- Проверьте Basic Auth credentials

### Ошибки OpenAI:
- Проверьте API key и лимиты
- Убедитесь, что gpt-4 доступен для аккаунта
- Проверьте длину транскрипта (не более 4000 токенов)

## Поддержка

Для вопросов и поддержки:
- Логи workflow: N8N Dashboard → Executions
- Тестирование: `node scripts/test_qci_webhook.js`
- Проверка VAPI: `node scripts/setup_vapi_webhook.js check`

---

**Система готова к использованию в продакшене!** 🚀