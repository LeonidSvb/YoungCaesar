# QCI Analysis System

Система анализа качества звонков (Quality of Call Index) для VAPI данных с использованием OpenAI API.

## 📋 Возможности

- **Автоматический анализ** транскриптов звонков по 4 категориям (100 баллов)
- **Параллельная обработка** до 1000+ звонков с настраиваемой производительностью
- **Детальная отчетность** с evidence и breakdown по каждому критерию
- **Гибкая конфигурация** для разных объемов данных
- **Стоимость ~$1 на 1000 звонков** с моделью gpt-4o-mini

## 🎯 QCI Scoring System

| Категория | Макс. баллы | Описание |
|-----------|------------|----------|
| **Dynamics** | 30 | Agent Talk Ratio, Time-To-Value, First CTA, Dead Air |
| **Objections** | 20 | Resistance Recognition, Compliance, Alternatives |
| **Brand** | 20 | Brand Mention, Consistency, Language Match |
| **Outcome** | 30 | Final Outcome, Wrap-up, Tool Hygiene |

**Статусы:**
- 🟢 **Pass** (80-100): Отличное качество
- 🟡 **Review** (60-79): Требует проверки
- 🔴 **Fail** (<60): Неудовлетворительно

## 🚀 Быстрый старт

### 1. Установка зависимостей

```bash
npm install openai dotenv
```

### 2. Настройка окружения

Создайте `.env` файл:
```bash
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Запуск анализа

```bash
# Тест на небольшом объеме (preset: test)
node qci_analyzer.js data/raw/vapi_calls.json test

# Средний объем (preset: medium - по умолчанию)
node qci_analyzer.js data/raw/vapi_calls.json

# Большой объем (preset: large)
node qci_analyzer.js data/raw/vapi_calls.json large
```

## ⚙️ Конфигурационные пресеты

### TEST (10-50 звонков)
```javascript
{
  batchSize: 5,
  maxConcurrent: 2,
  retryAttempts: 2
}
```

### MEDIUM (100-500 звонков) - По умолчанию
```javascript
{
  batchSize: 20,
  maxConcurrent: 5,
  retryAttempts: 3
}
```

### LARGE (1000+ звонков)
```javascript
{
  batchSize: 50,
  maxConcurrent: 10,
  retryAttempts: 3
}
```

## 📊 Формат входных данных

Система работает с JSON файлами от VAPI API:

```javascript
[
  {
    "id": "call-123",
    "transcript": "AI: Hello...\nUser: Hi...",
    "messages": [
      {
        "role": "bot",
        "message": "Hello",
        "time": 1000,
        "endTime": 3000,
        "secondsFromStart": 1.5
      }
    ],
    "startedAt": "2025-01-01T10:00:00Z",
    "endedAt": "2025-01-01T10:05:00Z",
    "cost": 0.05
  }
]
```

## 📈 Формат выходных данных

```javascript
{
  "callId": "call-123",
  "timestamp": "2025-01-01T10:00:00Z",
  "qci": {
    "totalScore": 75,
    "status": "review",
    "breakdown": {
      "dynamics": {
        "total": 22,
        "agentTalkRatio": { "score": 6, "evidence": {...} },
        "timeToValue": { "score": 8, "evidence": {...} },
        "firstCTA": { "score": 6, "evidence": {...} },
        "deadAirPenalty": { "penalty": 2, "evidence": [...] }
      }
      // ... остальные категории
    },
    "gates": {
      "brandGate": { "passed": true },
      "stopGate": { "passed": false, "reason": "Comply time > 10s" },
      "toolGate": { "passed": true }
    },
    "flags": ["Language"]
  }
}
```

## 🔧 Архитектура проекта

```
production_scripts/qci_analysis/
├── qci_analyzer.js           # Основной скрипт
├── config/
│   ├── qci_config.js        # Настройки QCI и пресеты
│   ├── openai_config.js     # Конфигурация OpenAI
│   └── lexicons.js          # Словари ключевых слов
├── prompts/
│   └── qci_prompt.txt       # Промпт для OpenAI
├── utils/
│   ├── call_parser.js       # Парсинг VAPI данных
│   ├── parallel_processor.js # Параллельная обработка
│   └── qci_calculator.js    # Расчет QCI скоров
└── README.md
```

## 💰 Оценка стоимости

**Модель gpt-4o-mini:**
- Input: $0.15 на 1M токенов
- Output: $0.60 на 1M токенов
- **~$0.001 на звонок = $1 на 1000 звонков**

**Альтернативы:**
- gpt-4o: ~$4 на 1000 звонков (выше качество)
- gpt-3.5-turbo: ~$0.30 на 1000 звонков (ниже качество)

## 📋 Детали анализа

### A) Dynamics (30 баллов)

**A1. Agent Talk Ratio (0-8 баллов)**
- Целевой диапазон: 35-55%
- Штраф за выход из диапазона 25-65%

**A2. Time-To-Value (0-8 баллов)**
- Цель: ≤20 секунд до первого value-предложения
- -1 балл за каждые +5 секунд

**A3. First CTA (0-8 баллов)**
- Цель: ≤120 секунд до первого call-to-action
- -2 балла за каждые +30 секунд

**A4. Dead Air Penalty (до -6 баллов)**
- Штраф за паузы >3 секунд
- -2 балла за каждый случай

### B) Objections & Compliance (20 баллов)

**B1. Recognized Resistance (0-6 баллов)**
- Распознавание возражений в течение 5-10 секунд

**B2. Time-To-Comply (0-8 баллов)**
- Цель: ≤10 секунд до compliance
- Gate: провал если >10 секунд

**B3. Alternative Offered (0-6 баллов)**
- Предложение альтернативы (email/callback)

### C) Brand & Language (20 баллов)

**C1. First Brand Mention (0-8 баллов)**
- Цель: ≤10 секунд
- Gate: провал если >10 секунд

**C2. Brand Variants (0-8 баллов)**
- Идеал: 1 вариант (идеальная консистентность)
- -4 балла за каждый дополнительный вариант

**C3. Language Match (0-4 балла)**
- Соответствие языка клиента или переключение ≤15 секунд

### D) Outcome & Hygiene (30 баллов)

**D1. Outcome (0-15 баллов)**
- meeting_booked: 15
- warm_lead: 10
- callback_set: 6
- info_sent: 4
- no_outcome: 0

**D2. Wrap-up (0-5 баллов)**
- Наличие подтверждения/резюме в конце

**D3. Tool Hygiene (0-10 баллов)**
- Отсутствие дублированных wait-фраз: +4
- ≤1 извинение в минуту: +3
- Latency после tools ≤2с: +3

## 🛠️ Расширенное использование

### Программное API

```javascript
const QCIAnalyzer = require('./qci_analyzer');

const analyzer = new QCIAnalyzer({
  batchSize: 30,
  maxConcurrent: 8,
  saveResults: true
});

const results = await analyzer.analyzeCallsFromFile('data.json');
```

### Кастомные конфигурации

```javascript
// config/qci_config.js
const CUSTOM_CONFIG = {
  batchSize: 100,
  maxConcurrent: 15,
  retryAttempts: 5,
  saveResults: true,
  verbose: false
};
```

### Модификация lexicons

```javascript
// config/lexicons.js
const LEXICONS = {
  cta: ["meeting", "schedule", "demo", "book"],
  value: ["save money", "increase sales", "ROI"],
  brand_canonical: "Your Company Name"
};
```

## 🔍 Troubleshooting

### Ошибки парсинга
- Проверьте формат входного JSON
- Убедитесь что есть поля `transcript` или `messages`

### Ошибки OpenAI API
- Проверьте API ключ в `.env`
- Убедитесь в наличии средств на счету
- При rate limiting - уменьшите `maxConcurrent`

### Низкое качество анализа
- Проверьте качество транскриптов
- Настройте lexicons под ваши данные
- Рассмотрите использование gpt-4o для лучшего качества

## 📞 Поддержка

При возникновении проблем:

1. Проверьте логи в `qci_analysis.log`
2. Запустите тест на малом объеме данных
3. Убедитесь в корректности конфигурации

Система готова к продакшен использованию и протестирована на реальных данных VAPI.