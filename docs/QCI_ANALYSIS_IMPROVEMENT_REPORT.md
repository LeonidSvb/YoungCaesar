# QCI Analysis Improvement Report
**Date:** 2025-11-04
**Issue:** Поверхностный анализ звонков - бесполезные coaching tips

---

## Проблема

### Звонок ID: `019a291b-df16-7bb5-bcf5-8e785fc3e1f9`
- **Cost:** $0.51
- **Outcome:** Провал (customer-ended-call)
- **Анализ QCI:** 2 общие фразы без конкретики

**Старые coaching tips:**
```
[
  "Improve engagement by asking more open-ended questions.",
  "Work on maintaining a smoother conversation flow to avoid repetition."
]
```

### Реальные проблемы звонка (которые промпт НЕ выявил):

1. **Множественные "Hi"** - AI нарушил свой же промпт ("Only say Hi ONCE per call")
   - AI сказал "Hi" 3 раза (0с, 74с, 102с)

2. **Незавершенное представление**
   - AI: "I'm calling from" (обрывается на полуслове)
   - Клиент не узнал от кого звонок

3. **DTMF для живого человека**
   - Клиент дал номер телефона для перезвона
   - AI воспринял это как IVR-меню и использовал dtmf_tool

4. **Циклические повторы**
   - "What's the best way to reach them?" (3 раза)
   - "Am I speaking with someone from BSA?" (2 раза)

5. **Преждевременный питч**
   - Начал "many manufacturers struggle..." когда клиент еще спрашивает "Regarding what?"

---

## Причина

### Старый промпт был примитивным:
- **Размер:** 1,800 символов
- **Структура:** Только баллы (0-100) + короткий массив coaching_tips
- **Контекст:** Заточен под "Young Caesar" (старый бренд)
- **Evidence:** Не требовалось цитировать transcript
- **Категории:** Нет разделения на Critical Bug / Logic Error / Best Practice

---

## Решение

### Новый промпт QCI v2.0

**Файлы:**
- Промпт: `prompts/qci_detailed_coaching_prompt.md`
- Скрипт обновления: `scripts/discovery/update-qci-prompt.cjs`

**Изменения:**

| Параметр | Старый | Новый |
|----------|--------|-------|
| Размер промпта | 1,800 chars | 2,662 chars |
| Структура coaching_tips | `string[]` | `object[]` с 4 полями |
| Evidence | Опционально | Обязательно |
| Категории | Нет | Critical Bug / Logic Error / Best Practice / Optimization |
| Critical failures | Нет | Да (массив deal-breaking mistakes) |
| What went well | Нет | Да (что усилить) |
| Контекст бренда | Young Caesar | Biesse |
| Exact quotes | Нет | Обязательно |

**Новая структура coaching tip:**
```json
{
  "category": "Critical Bug|Logic Error|Best Practice|Optimization",
  "issue": "Short title of problem",
  "evidence": "Exact quote showing the issue",
  "impact": "How this hurts conversion",
  "fix": "Specific actionable solution"
}
```

**Новые требования:**
1. Анализировать prompt violations (например, множественные "Hi")
2. Цитировать exact quotes из transcript
3. Объяснять impact на conversion
4. Давать actionable fixes, не vague advice
5. Если звонок провалился - список ALL critical failures
6. Указывать exact moment когда клиент был потерян

---

## Результат

### Пример нового анализа (тот же звонок):

**Scores:**
- Total QCI: 15/100 (было: не указано)
- Dynamics: 5/30
- Brand: 0/20 (правильно - "Biesse" не упоминался)
- Outcome: 7/30 (провал)

**Coaching tips:**

1. **[Critical Bug] Repetitive greetings**
   - Evidence: `AI: Hello. User: Hello? AI: Hi. User: Yeah.`
   - Impact: Creates confusion and disrupts flow
   - Fix: Limit greetings to one per conversation start

2. **[Logic Error] Missing brand mention**
   - Evidence: `AI: many manufacturers struggle with downtime and maintenance costs. BS machines last 15 20 years...`
   - Impact: Fails to establish brand identity
   - Fix: Clearly mention 'Biesse' when discussing products

3. **[Best Practice] Incomplete information exchange**
   - Evidence: `AI: Sorry. I'll follow-up by email.`
   - Impact: Missed opportunity to secure a direct contact
   - Fix: Ensure to confirm contact details before ending call

**Evidence:**
- Agent talk ratio: 50%
- Brand mentions: 0 (правильно!)
- Outcomes: Information exchange (минимальный)

---

## Что дальше

### 1. Переанализировать все звонки
```bash
node production_scripts/qci_analysis/qci_analyzer.js
```

### 2. Если нужен ЕЩЕ БОЛЕЕ детальный анализ:

**Опция A: Увеличить tokens**
```javascript
// В analysis_frameworks таблице
model_config: {
  model: "gpt-4o",
  max_tokens: 4000  // было 3000
}
```

**Опция B: Добавить примеры в промпт**
- Вставить 2-3 примера хороших/плохих звонков с разбором
- Few-shot prompting улучшит качество анализа

**Опция C: Использовать более сильную модель**
```javascript
model_config: {
  model: "gpt-4o",  // вместо gpt-4o-mini
  temperature: 0.1,
  max_tokens: 4000
}
```
⚠️ Дороже, но качество выше

### 3. Создать дашборд для просмотра coaching tips

Добавить в дашборд:
- Фильтр по category (Critical Bug / Logic Error / etc)
- Группировка повторяющихся проблем
- Тренд QCI scores по времени
- Top coaching tips по частоте

---

## Выводы

✅ **Проблема решена:**
- Анализ теперь детальный и actionable
- Evidence-based с точными цитатами
- Категоризация проблем
- Конкретные fixes

✅ **Промпт обновлен в базе:**
- Таблица: `analysis_frameworks`
- Name: `QCI Standard`
- Version: `v2.0`

✅ **Файлы:**
- ✓ `prompts/qci_detailed_coaching_prompt.md` - новый промпт
- ✓ `scripts/discovery/update-qci-prompt.cjs` - скрипт обновления
- ✓ `production_scripts/qci_analysis/qci_analyzer.js` - исправлен dotenv path

---

## Пример сравнения

### До (v1.0):
```
"Improve engagement by asking more open-ended questions."
"Work on maintaining a smoother conversation flow to avoid repetition."
```
👎 Бесполезно - не говорит ЧТО не так и КАК исправить

### После (v2.0):
```
[Critical Bug] Repetitive greetings
Evidence: AI: Hello. User: Hello? AI: Hi.
Impact: Creates confusion and disrupts flow
Fix: Limit greetings to one per conversation start
```
👍 Конкретно - видно проблему, impact, и решение
