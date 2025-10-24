# QCI ANALYSIS - ПОЛНЫЙ ОТЧЕТ

Дата: 2025-10-23

## 1. ФИЛЬТРЫ QCI АНАЛИЗА

### Какие звонки анализируются:
- ✅ Звонки с транскриптом **> 100 символов**
- ✅ Любой статус звонка (успешные, неуспешные)
- ✅ Любая длительность звонка
- ✅ Все ассистенты

### Какие звонки НЕ анализируются:
- ❌ Звонки **БЕЗ транскрипта**
- ❌ Звонки с транскриптом **<= 100 символов**

### Конфигурация в `qci_analyzer.js`:
```javascript
CONFIG.INPUT.MIN_TRANSCRIPT_LENGTH = 100  // Минимум 100 символов
CONFIG.TESTING.ENABLED = false            // Полный анализ (не тестовый режим)
CONFIG.PROCESSING.CONCURRENCY = 15        // 15 одновременных запросов
CONFIG.OPENAI.MODEL = "gpt-4o-mini"      // Модель GPT-4o-mini
```

### Текущая статистика:
- **Всего звонков в базе:** 8,559
- **Звонков с транскриптом:** 1,978 (23.1%)
- **Звонков с транскриптом > 100:** 665
- **QCI анализов выполнено:** 884
- **Покрытие звонков > 100 символов:** 56.2% (374 из 665)
- **Остается проанализировать:** 291 звонок

---

## 2. ЛОГИРОВАНИЕ QCI

### ❌ ПРОБЛЕМА: QCI НЕ ЛОГИРУЕТСЯ В SUPABASE

**Текущая ситуация:**
- ✅ Таблицы `runs` и `logs` существуют в Supabase
- ✅ VAPI sync логируется корректно (есть записи в runs)
- ❌ QCI analyzer **НЕ пишет** в таблицы runs/logs
- ❌ QCI analyzer использует **СТАРЫЙ логгер** (пишет в файлы)

**Причина:**
```javascript
// qci_analyzer.js использует:
const { createLogger } = require('../shared/logger');  // ❌ ФАЙЛОВЫЙ логгер

// Должен использовать:
const { createRun, updateRun, Logger } = require('../../lib/logger');  // ✅ SUPABASE логгер
```

**Последние записи в runs таблице:**
```
vapi-sync | success | 2025-10-23 | calls: 0
vapi-sync | success | 2025-10-22 | calls: 0
test-from-claude | running | 2025-10-23 | calls: 0
```
(Нет ни одной записи с script_name = 'qci-analysis')

---

## 3. РЕШЕНИЕ

### A. Интегрировать lib/logger.js в qci_analyzer.js

**Изменения в qci_analyzer.js:**
1. Заменить `require('../shared/logger')` на `require('../../lib/logger')`
2. Добавить createRun() в начале анализа
3. Добавить updateRun() в конце с результатами
4. Логировать calls_analyzed и api_cost

### B. Создать GitHub Action для автоматического QCI анализа

**Workflow файл:** `.github/workflows/qci-analysis.yml`
- Запуск по расписанию (каждые 6 часов или раз в день)
- Ручной запуск через workflow_dispatch
- Автоматическая синхронизация результатов в Supabase

---

## 4. ФИЛЬТРЫ В sync_qci_to_supabase.js

**Конфигурация синхронизации:**
```javascript
MIN_QCI_SCORE: 0                    // ✅ Все скоры (0-100)
INCLUDE_FAILED: true                // ✅ Включая провалившиеся анализы
MIN_TRANSCRIPT_LENGTH: 100          // ✅ Совпадает с analyzer
SKIP_ORPHANED_CALLS: false          // ✅ Синхронизирует все
```

---

## 5. РЕКОМЕНДАЦИИ

### Краткосрочные (сегодня):
1. ✅ Создать GitHub Action для QCI анализа
2. ⏳ Интегрировать lib/logger.js в qci_analyzer.js
3. ⏳ Запустить анализ оставшихся 291 звонков

### Долгосрочные:
1. Настроить автоматический QCI анализ для новых звонков
2. Добавить дашборд для мониторинга QCI прогресса
3. Настроить алерты при низких QCI скорах
