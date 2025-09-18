# Prompt Optimization Module

## 🚀 AI-POWERED VAPI PROMPT OPTIMIZATION SYSTEM [v2.0.0]

Advanced modular system for analyzing and optimizing VAPI assistant prompts with static HTML dashboards.

## 📊 MODULE ARCHITECTURE

### 1. Data Aggregator
**File:** `src/data_aggregator.js` (v2.0.0)
- Groups calls by assistant and calculates performance metrics
- Integrates QCI scores with call data
- Extracts sample calls for detailed analysis

### 2. Performance Correlator
**File:** `src/performance_correlator.js` (v2.0.0)
- GPT-4o powered analysis of prompt-performance correlations
- Uses centralized prompts from `prompts.md`
- Identifies structural strengths and weaknesses

### 3. Recommendation Engine
**File:** `src/recommendation_engine.js` (v2.0.0)
- Generates specific optimization recommendations
- Creates optimized prompt versions
- Provides A/B testing strategies with success metrics

### 4. Dashboard Generator
**File:** `src/dashboard_generator.js` (v2.0.0)
- Creates static HTML dashboards (GitHub Pages compatible)
- Executive summary with quick wins
- Assistant-by-assistant performance breakdown

## 🎯 GOLDEN STANDARD DASHBOARD

**Файл:** `dashboard/prompt_optimization_dashboard_template.html`

**Особенности:**
- Interactive toggle между current/optimized промптами
- Выделение изменений в оптимизированной версии
- QCI breakdown по категориям
- Конкретные action items с приоритетами
- Responsive design с красивой визуализацией

## 🔄 QUICK START

### Standard Pipeline
```bash
# Navigate to module directory
cd production_scripts/prompt_optimization

# Run the complete pipeline (v2.0.0)
node src/data_aggregator.js          # Step 1: Process call data
node src/performance_correlator.js   # Step 2: Analyze correlations
node src/recommendation_engine.js    # Step 3: Generate recommendations
node src/dashboard_generator.js      # Step 4: Create dashboard
```

### Agent-based Execution (Recommended)
```bash
# Use Claude agent for intelligent orchestration
/agent vapi-prompt-optimizer
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

## 📁 MODULE STRUCTURE [v2.0.0]

```
prompt_optimization/
├── src/                              # Core scripts (v2.0.0)
│   ├── data_aggregator.js           # Groups calls by assistant
│   ├── performance_correlator.js    # Analyzes prompt-performance correlations
│   ├── recommendation_engine.js     # Generates optimization suggestions
│   └── dashboard_generator.js       # Creates HTML dashboards
├── prompts.md                       # Centralized AI prompts
├── history.txt                      # Module version history
├── README.md                        # This documentation
├── results/                         # Generated analysis files
├── dashboard/                       # HTML dashboard outputs
└── archive/                         # Legacy script versions
    ├── advanced_prompt_extractor.js
    ├── prompt_performance_correlator_refactored.js
    └── optimize_assistant_prompt.js
```

## 🔗 DEPENDENCIES

### Project-level Shared Utilities
- `../shared/logger.js` - Standardized logging across modules
- `../shared/prompt_parser.js` - Markdown prompt parsing utility

### External Dependencies
- OpenAI API key (`OPENAI_API_KEY` in .env)
- VAPI call data from collection pipeline
- QCI analysis results (optional but recommended)

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