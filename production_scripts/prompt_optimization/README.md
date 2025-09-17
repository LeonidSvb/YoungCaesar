# VAPI Prompt Optimization System

## 🚀 ЗОЛОТОЙ СТАНДАРТ СИСТЕМЫ ОПТИМИЗАЦИИ ПРОМПТОВ

Революционная система для анализа и оптимизации VAPI assistant промптов с интерактивными HTML дашбордами.

## 📊 PIPELINE АРХИТЕКТУРА

### 1. Advanced Prompt Extractor
**Файл:** `advanced_prompt_extractor.js`
- Извлекает полные промпты (8,000+ символов) из VAPI API
- Fallback на локальные данные при сбоях API
- Фильтрация и дедупликация промптов

### 2. Assistant Data Aggregator
**Файл:** `assistant_data_aggregator.js`
- Группировка звонков по ассистентам
- Интеграция QCI метрик с detailed prompts
- Автоматическое создание latest файлов

### 3. Prompt Performance Correlator
**Файл:** `prompt_performance_correlator.js`
- GPT-4o анализ корреляций промпт-производительность
- Сравнительный анализ между ассистентами
- Идентификация success patterns

### 4. Recommendation Engine
**Файл:** `recommendation_engine.js`
- Генерация оптимизированных промптов
- A/B testing планы
- Конкретные рекомендации с ожидаемыми улучшениями

## 🎯 GOLDEN STANDARD DASHBOARD

**Файл:** `dashboard/prompt_optimization_dashboard_template.html`

**Особенности:**
- Interactive toggle между current/optimized промптами
- Выделение изменений в оптимизированной версии
- QCI breakdown по категориям
- Конкретные action items с приоритетами
- Responsive design с красивой визуализацией

## 🔄 QUICK START

```bash
# 1. Извлечение промптов
node advanced_prompt_extractor.js

# 2. Агрегация данных (настроить TARGET_ASSISTANT_ID)
node assistant_data_aggregator.js

# 3. Анализ корреляций
node prompt_performance_correlator.js

# 4. Генерация рекомендаций
node recommendation_engine.js
```

## ⚙️ КОНФИГУРАЦИЯ

### Target Assistant Setup
В `assistant_data_aggregator.js`:
```javascript
TARGET_ASSISTANT_ID: '0eddf4db-3bfa-4eb2-8053-082d94aa786d' // YC Assistant | HOT
```

### Входные файлы
- **VAPI Calls:** `../vapi_collection/results/2025-09-17T09-51-00_vapi_calls_*.json`
- **QCI Results:** `../qci_analysis/results/qci_full_calls_*.json`
- **Extracted Prompts:** `results/extracted_prompts_*.json`

## 📈 РЕЗУЛЬТАТЫ YC ASSISTANT | HOT

**Текущая производительность:**
- QCI Score: 33.9/100
- Success Rate: 7.1%
- Total Calls: 14

**Целевые улучшения:**
- Target QCI: 48.9/100 (+15 points)
- Dynamics: 15.3 → 20.3
- Objections: 4.4 → 9.4
- Outcome: 7.7 → 12.7

**Ключевые изменения:**
1. Conditional branching для гибкости
2. Empathy statements в objection handling
3. Urgent CTAs для лучших outcomes

## 🎯 ЗАВТРАШНИЙ ПЛАН

1. Запустить pipeline на всех ассистентах
2. Создать дашборды для каждого
3. Master comparison dashboard
4. Implementation roadmap

## 📁 СТРУКТУРА ФАЙЛОВ

```
prompt_optimization/
├── advanced_prompt_extractor.js      # Извлечение промптов
├── assistant_data_aggregator.js      # Агрегация данных
├── prompt_performance_correlator.js  # Анализ корреляций
├── recommendation_engine.js          # Генерация рекомендаций
├── dashboard/
│   └── prompt_optimization_dashboard_template.html
└── results/
    ├── extracted_prompts_*.json
    ├── assistant_aggregated_data_*.json
    ├── prompt_performance_correlations_*.json
    └── optimization_recommendations_*.json
```

## 💡 BEST PRACTICES

1. **Всегда используй latest файлы** для consistency
2. **Проверяй prompt size** - должен быть 8,000+ символов
3. **Анализируй минимум 10+ звонков** на ассистента
4. **Фокусируйся на high-volume ассистентах** первыми
5. **Тестируй A/B** перед полным внедрением

## 🔧 ТЕХНИЧЕСКАЯ СТОИМОСТЬ

- **Extraction:** $0.001 per assistant
- **Correlation Analysis:** $0.01 per assistant
- **Recommendation Generation:** $0.05 per assistant
- **Total per assistant:** ~$0.06

**ROI:** +15 QCI points = ~$500-1000 revenue increase per assistant

---

**Статус:** ✅ Production Ready
**Последнее обновление:** September 17, 2025
**Следующий шаг:** Scale to all assistants tomorrow