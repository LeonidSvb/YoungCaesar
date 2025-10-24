# TODO: Prompt Optimization Frontend

## Цель
Создать фронтенд для отображения результатов оптимизации промптов в Next.js приложении

## Статус
- ✅ База данных готова (таблица `prompt_analysis_results`)
- ✅ Скрипт оптимизации работает (`optimize_prompts.js`)
- ⏸️ Фронтенд - следующая сессия

## Текущий стек
- Next.js 15 + React 19 + TypeScript
- Tailwind CSS + Radix UI
- Supabase
- Recharts для графиков

## Существующая структура
```
frontend/src/app/
├── dashboard/          # Аналитика звонков
│   └── page.tsx
└── logs/              # Логи выполнения
    └── page.tsx
```

## Вопросы для планирования

### 1. Маршрутизация
- [ ] Создать `/prompt-optimization` как отдельную страницу?
- [ ] Или добавить вкладку в существующий `/dashboard`?

### 2. Компоненты

#### Основные компоненты:
- [ ] **AssistantsList** - список ассистентов с метриками
  - Название ассистента
  - Текущий QCI
  - Ожидаемый QCI
  - Дельта улучшения
  - Дата последнего анализа

- [ ] **PromptComparison** - сравнение промптов
  - Side-by-side текущий vs оптимизированный
  - Diff highlighting (опционально)
  - Кнопка "Копировать оптимизированный промпт"

- [ ] **OptimizationReasons** - причины изменений
  - Список top_reasons из анализа
  - Визуализация проблемных мест

#### Дополнительные фичи:
- [ ] **RunAnalysisButton** - кнопка запуска анализа
  - API endpoint `/api/prompt-optimization/run`
  - Индикатор выполнения
  - Уведомление о завершении

- [ ] **HistoryView** - история анализов
  - Фильтр по дате
  - Фильтр по ассистенту
  - Сравнение версий

### 3. API Integration

#### Чтение данных:
```typescript
// GET /api/prompt-optimization/results
// Возвращает список результатов из prompt_analysis_results
```

#### Запуск анализа (опционально):
```typescript
// POST /api/prompt-optimization/run
// Запускает скрипт optimize_prompts.js через child_process
// Возвращает run_id для отслеживания прогресса
```

### 4. UI/UX Design

#### Метрики (верхняя панель):
- Всего ассистентов проанализировано
- Средний прирост QCI
- Общее количество звонков в анализе
- Стоимость анализа

#### Фильтры:
- По дате анализа
- По ассистенту
- По приросту QCI (сортировка)

#### Детальная карточка:
```
┌─────────────────────────────────────────┐
│ Assistant Name           25.6 → 40.6    │
│                          +15 points     │
├─────────────────────────────────────────┤
│ Основные причины изменений:             │
│ 1. Lack of personalization              │
│ 2. Poor tool usage guidance             │
│ 3. Rigid conversation flow              │
├─────────────────────────────────────────┤
│ Текущий промпт    │ Оптимизированный   │
│ [scroll area]     │ [scroll area]       │
│                   │ [Copy Button]       │
└─────────────────────────────────────────┘
```

## Технические детали

### Database Schema
```sql
prompt_analysis_results
├── id
├── assistant_id (FK -> vapi_assistants)
├── analyzed_at
├── current_prompt
├── proposed_prompt
├── current_qci
├── expected_qci
├── improvement_delta
├── top_reasons (TEXT[])
├── calls_analyzed
├── sample_call_ids (TEXT[])
├── framework_used
├── analysis_cost
└── analysis_model
```

### Пример компонента
```typescript
// frontend/src/app/prompt-optimization/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function PromptOptimizationPage() {
  const [results, setResults] = useState([]);

  useEffect(() => {
    loadResults();
  }, []);

  async function loadResults() {
    const supabase = createClient();
    const { data } = await supabase
      .from('prompt_analysis_results')
      .select(`
        *,
        vapi_assistants (name)
      `)
      .order('analyzed_at', { ascending: false });

    setResults(data || []);
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Components here */}
    </div>
  );
}
```

## Следующие шаги

1. Обсудить архитектуру (отдельная страница vs вкладка)
2. Определить минимальный набор компонентов для MVP
3. Создать API routes если нужно
4. Реализовать компоненты
5. Тестирование

## Вопросы к обсуждению

- Нужна ли возможность запускать анализ из UI? Или только просмотр результатов?
- Нужен ли diff highlighting для промптов?
- Как часто будет обновляться данные? Real-time или по запросу?
- Нужна ли история изменений промптов?
