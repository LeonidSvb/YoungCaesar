# Инструкции по настройке N8N QCI Workflow

## Статус развертывания
✅ **Workflow успешно создан в n8n**
- **Workflow ID**: `6hpElxvumVmUzomY`
- **Webhook URL**: `https://eliteautomations.youngcaesar.digital/webhook/vapi-qci-enhanced`
- **Dashboard**: `https://eliteautomations.youngcaesar.digital/workflows/6hpElxvumVmUzomY`

## Необходимые действия для завершения настройки

### 1. Настройка Credentials в N8N UI

Перейдите в n8n Dashboard и создайте следующие credentials:

#### VAPI API Key
- **Тип**: HTTP Header Auth
- **Название**: `VAPI API Key` или `vapiApiKey`
- **Header Name**: `Authorization`
- **Header Value**: `Bearer your_vapi_api_key_here`

#### OpenAI API Key  
- **Тип**: OpenAI
- **Название**: `OpenAI API`
- **API Key**: `your_openai_api_key_here`

#### Airtable API
- **Тип**: Airtable API  
- **Название**: `Airtable API`
- **API Key**: `your_airtable_api_key_here`

#### Slack API (для уведомлений)
- **Тип**: Slack API
- **Название**: `Slack API`
- **Access Token**: `[Необходимо получить Slack Bot Token]`

#### Webhook Basic Auth
- **Тип**: HTTP Basic Auth
- **Название**: `Webhook Auth` или `vapiWebhookAuth`  
- **Username**: `vapi_user`
- **Password**: `vapi_webhook_2025`

### 2. Привязка Credentials к Nodes

После создания credentials, откройте workflow и привяжите их к соответствующим узлам:

1. **VAPI Call Ended Webhook** → `vapiWebhookAuth` (Webhook Basic Auth)
2. **Get VAPI Call Data** → `vapiApiKey` (VAPI API Key)
3. **Diarize Transcript** → OpenAI API credential
4. **Enhanced QCI Analysis** → OpenAI API credential  
5. **Update Airtable QCI Data** → Airtable API credential
6. **Send Slack QCI Report** → Slack API credential

### 3. Активация Workflow

1. Откройте workflow в n8n Dashboard
2. Проверьте, что все credentials настроены
3. Нажмите кнопку **"Active"** для активации workflow

### 4. Настройка VAPI Webhook

Настройте в VAPI Dashboard webhook URL для события окончания звонков:
```
https://eliteautomations.youngcaesar.digital/webhook/vapi-qci-enhanced
```

### 5. Тестирование

После настройки всех credentials и активации workflow:

1. Выполните тестовый звонок через VAPI
2. Проверьте выполнение workflow в n8n Dashboard
3. Убедитесь, что данные сохраняются в Airtable
4. Проверьте получение уведомлений в Slack

## Структура QCI Workflow

### Узлы и их функции:

1. **VAPI Call Ended Webhook** - Триггер от VAPI при завершении звонка
2. **Get VAPI Call Data** - Получение полных данных звонка через API
3. **Check Transcript Quality** - Проверка наличия и качества транскрипта
4. **Diarize Transcript** - Структурирование транскрипта с разделением говорящих  
5. **Enhanced QCI Analysis** - Глубокий анализ качества звонка (4 критерия)
6. **Update Airtable QCI Data** - Сохранение всех QCI метрик в Airtable
7. **Send Slack QCI Report** - Отправка детального отчета в Slack
8. **Success Response** - Ответ об успешном завершении анализа

### QCI Критерии анализа:

1. **Approach Quality (25 pts)** - Качество подхода
   - Профессиональное представление  
   - Четкая ценностная позиция
   - Подходящий тон и темп
   - Позиционирование бренда

2. **Engagement Level (25 pts)** - Уровень вовлеченности
   - Участие клиента
   - Качество заданных вопросов
   - Работа с возражениями
   - Поток беседы

3. **Information Gathering (25 pts)** - Сбор информации
   - Исследовательские вопросы
   - Эффективность квалификации
   - Выявление болевых точек
   - Валидация лица принятия решений

4. **Call Outcome (25 pts)** - Результат звонка
   - Закрепленные следующие шаги
   - Достигнутый уровень обязательств
   - Запланированное продолжение

### Классификация лидов:

- `hot_lead` - Готов к покупке, встреча назначена
- `warm_lead` - Заинтересован, нужен фолlow-up  
- `cold_lead` - Низкий интерес, серьезные возражения
- `callback_requested` - Запросил обратный звонок
- `not_decision_maker` - Не лицо принятия решений
- `invalid` - Неверный номер, голосовая почта и тд

## Мониторинг и поддержка

- **Логи workflow**: n8n Dashboard → Executions
- **Webhook тестирование**: Используйте Postman или curl для отправки тестовых данных
- **Slack канал**: Все уведомления приходят в канал C06VAPI001
- **Airtable**: Результаты сохраняются в базе `appKny1PQSInwEMDe`, таблица `tblvXZt2zkkanjGdE`

## Решение проблем

### Workflow не активируется
- Проверьте настройку всех credentials
- Убедитесь, что все обязательные поля заполнены

### Нет данных в Airtable  
- Проверьте Airtable API key и доступы
- Убедитесь, что поля в Airtable соответствуют названиям в workflow

### Не приходят Slack уведомления
- Настройте Slack Bot Token с правильными разрешениями
- Проверьте ID канала в настройках узла

### Ошибки OpenAI анализа
- Проверьте API key OpenAI и лимиты
- Убедитесь, что модель gpt-4 доступна для вашего аккаунта