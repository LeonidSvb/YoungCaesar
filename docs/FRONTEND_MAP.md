# VAPI Analytics Frontend Map

**Версия:** 1.0.0
**Дата создания:** 2025-10-18
**Цель проекта:** Call data collection, QCI analysis, и AI prompt optimization для cold call machine

---

## 🎯 ЦЕЛИ ПРОЕКТА

### Фаза 1 (Текущая):
1. **Синхронизация звонков** из VAPI API → Supabase (каждые несколько часов)
2. **QCI Analysis** проанализированных звонков
3. **Prompt Optimization** для каждого ассистента
4. **Performance Tracking** каждого ассистента для непрерывного улучшения

### Будущие фазы:
- Расширенная автоматизация
- A/B testing промптов
- Real-time coaching
- Integration с другими системами

---

## 📊 ДАННЫЕ В SUPABASE

### Текущее состояние:
- **Calls:** 8,559 записей
- **Assistants:** 13 уникальных ID
- **QCI Analyses:** 884 анализа
- **Date Range:** 2025-05-21 → сегодня

### Основные таблицы:
```
calls
├── id (uuid)
├── started_at (timestamp)
├── duration_seconds (int)
├── cost (decimal)
├── assistant_id (uuid)
├── transcript (text)
├── recording_url (text)
├── customer_number (text)
└── ... (другие поля)

assistants
├── id (uuid, PK)
└── name (text)

qci_analyses
├── id (uuid)
├── call_id (uuid, FK → calls)
├── qci_total (int)
├── qci_dynamics (int)
├── qci_objections (int)
├── qci_brand (int)
├── qci_outcome (int)
├── coaching_tips (text[])
└── ... (другие поля)
```

---

## 📱 СТРАНИЦЫ ПРИЛОЖЕНИЯ

### 1. **Landing Page** (`/`)
**Статус:** ✅ Реализована (базовая версия)

**Назначение:** Обзор всех модулей системы

**Компоненты:**
- Header с названием проекта
- Module cards (Dashboard, Sync, QCI Analysis, Prompt Optimization)
- Stats summary (Total calls, Assistants, Success rate, Version)

**Приоритет:** Низкий (уже работает)

---

### 2. **Dashboard Page** (`/dashboard`)
**Статус:** 🔄 Частично реализована → Требует доработки

**Назначение:** Главная аналитическая страница

#### 2.1 Filters Panel (Верхняя часть)

**Time Range Filter:**
- По умолчанию: **Last 30 days**
- Quick presets:
  - Today
  - Yesterday
  - Last 7 days
  - Last 30 days
  - Last 90 days
  - All time
  - Custom (date picker)

**Assistant Filter:**
- Dropdown select
- По умолчанию: **All Assistants**
- Список всех 13 ассистентов (по ID + name)
- Показывать: "BIESSE - MS" а не просто ID

**Additional Filters (Checkboxes/Toggle):**
- [ ] Answered calls only (answered = true)
- [ ] Has transcript
- [ ] Has QCI analysis
- [ ] Duration >30s (Quality calls)
- [ ] Duration >60s (Engaged calls)

**Состояние фильтров:**
- Все фильтры работают **независимо** (можно комбинировать)
- Можно сортировать без выбора ассистента
- Фильтры применяются ко всему: Sales Funnel + Charts + Table

#### 2.2 Metrics Grid

**6 основных метрик:**
1. **Total Calls** - все звонки за period
2. **Quality Rate** - % calls >30s
3. **Avg Duration** - средняя длительность
4. **Avg QCI Score** - средний QCI (если есть анализ)
5. **Analyzed Calls** - кол-во с QCI analysis
6. **Active Assistants** - уникальные ассистенты

**Компоненты:**
- ✅ MetricCard (уже есть)
- 🔄 Нужно добавить: "Analyzed Calls" метрику

#### 2.3 Sales Funnel

**Структура (Вариант A - упрощенный):**
```
┌─────────────────────────────┐
│ All Calls                   │
│ 8,559 calls                 │
└─────────────────────────────┘
          ↓
┌─────────────────────────────┐
│ Quality Calls (>30s)        │
│ ~40-60% от answered         │
└─────────────────────────────┘
          ↓
┌─────────────────────────────┐
│ Engaged Calls (>60s)        │
│ ~20-30% от answered         │
└─────────────────────────────┘
          ↓
┌─────────────────────────────┐
│ Meeting Booked              │
│ ~5-15% от engaged           │
└─────────────────────────────┘
```

**Фичи:**
- Показывает conversion rates между этапами
- Гибкая настройка порогов (30s, 40s, 60s через config)
- Применяются текущие фильтры (time, assistant, etc.)

**Компоненты:**
- 🆕 SalesFunnel (взять из Shadi project)
- 🆕 Адаптировать под VAPI данные

#### 2.4 Charts

**График 1: Call Analytics (Area + Line overlay)**
```
┌─────────────────────────────────────────┐
│ 📊 Call Analytics Timeline              │
│                                         │
│ Legend:                                 │
│ ▓▓▓ Total Calls (Area - фон)           │
│ ━━━ Analyzed Calls (Line - поверх)     │
│                                         │
│ [AreaChart + LineChart overlay]        │
│                                         │
└─────────────────────────────────────────┘
```

**Данные:**
- X-axis: Дата (по дням)
- Y-axis: Количество звонков
- Фильтруется по: time range, assistant, др. фильтрам

**Компоненты:**
- 🆕 TimelineChart (улучшить текущий)
- ✅ Recharts library (уже есть)

**Опционально (если нужно):**
- График 2: Avg QCI Score trend
- График 3: Duration distribution

#### 2.5 Calls Table

**Колонки:**
| Column | Type | Sort | Description |
|--------|------|------|-------------|
| Date | timestamp | ✅ | started_at |
| Duration | seconds | ✅ | duration_seconds |
| Assistant | text | ❌ | assistant name (readable) |
| Phone | text | ❌ | customer_number |
| QCI Score | int | ✅* | qci_total (если есть анализ) |
| Status | badge | ❌ | quality/analyzed indicators |

*QCI Score сортировка: только если has_qci_analysis = true

**Сортировка по умолчанию:** Date (newest first)

**Фильтр:**
- [ ] Only analyzed calls (has QCI)

**Действие:**
- Click на строку → открывает **Call Details Sidebar**

**Компоненты:**
- ✅ CallsTable (уже есть)
- 🔄 Добавить: clickable rows
- 🔄 Добавить: sort indicators

---

### 3. **Call Details Sidebar**
**Статус:** 🆕 Новый компонент

**Тип:** Right Sidebar Panel (не modal!)

**Структура:**
```
┌──────────────────────────────────────┐
│ [X] Close                            │
├──────────────────────────────────────┤
│ 🎧 Audio Player                      │
│ ▶ [=============>      ] 2:34 / 4:12 │
├──────────────────────────────────────┤
│ 📝 Transcript                        │
│ ┌────────────────────────────────┐   │
│ │ AI: Hello, this is...          │   │
│ │ User: Hi, yes...               │   │
│ │ AI: Great! I'm calling from... │   │
│ │ [Scrollable...]                │   │
│ └────────────────────────────────┘   │
├──────────────────────────────────────┤
│ 📊 QCI Analysis        [Expand ▼]   │
│ ┌────────────────────────────────┐   │
│ │ Total Score: 45/100            │   │
│ │                                │   │
│ │ Breakdown:                     │   │
│ │ • Dynamics: 12/30              │   │
│ │ • Objections: 8/20             │   │
│ │ • Brand: 10/20                 │   │
│ │ • Outcome: 15/30               │   │
│ └────────────────────────────────┘   │
├──────────────────────────────────────┤
│ 💡 Coaching Tips       [Expand ▼]   │
│ ┌────────────────────────────────┐   │
│ │ 1. Improve talk ratio...       │   │
│ │ 2. Faster brand mention...     │   │
│ │ 3. Better objection handling...│   │
│ └────────────────────────────────┘   │
├──────────────────────────────────────┤
│ ℹ️ Metadata            [Expand ▼]   │
│ ┌────────────────────────────────┐   │
│ │ Duration: 4:12                 │   │
│ │ Cost: $0.14                    │   │
│ │ Started: 2025-10-15 14:23      │   │
│ │ Assistant: BIESSE - MS         │   │
│ │ Phone: +1234567890             │   │
│ │ Call ID: 8cd7551f...           │   │
│ └────────────────────────────────┘   │
└──────────────────────────────────────┘
```

**Компоненты:**
- 🆕 CallDetailsSidebar
- 🆕 AudioPlayer (HTML5 audio)
- 🆕 TranscriptView
- 🆕 QCIBreakdown (collapsible)
- 🆕 CoachingTips (collapsible)
- 🆕 CallMetadata (collapsible)

---

### 4. **Sync Page** (`/sync`)
**Статус:** 🆕 Новая страница

**Назначение:** Управление синхронизацией данных

**Аналог:** HubSpot Sync Page из Shadi project

#### 4.1 Sync Control Card

```
┌─────────────────────────────────────────────┐
│ 🔄 VAPI Synchronization                    │
├─────────────────────────────────────────────┤
│ Manual Sync                                 │
│ Fetch latest data from VAPI API            │
│                                             │
│               [🔄 Start Sync] ←────────┐    │
│                                        │    │
│ ℹ️ Automatic Sync: Every 2-4 hours    │    │
│ Last sync: 2 hours ago                 │    │
└─────────────────────────────────────────────┘
```

#### 4.2 Sync History

**Таблица синхронизаций:**
```
┌─────────────────────────────────────────────┐
│ Sync History                   [Filter ▼]  │
├─────────────────────────────────────────────┤
│ Oct 18, 14:23    ✅ Success   [Expand ▼]   │
│   → Fetched: 234 calls                      │
│   → New: 12, Updated: 222                   │
│   → Duration: 45s                           │
│                                             │
│ Oct 18, 12:15    ✅ Success   [Expand ▼]   │
│   → Fetched: 156 calls                      │
│   → New: 8, Updated: 148                    │
│   → Duration: 32s                           │
│                                             │
│ Oct 18, 10:00    ⚠️ Partial   [Expand ▼]   │
│   → Fetched: 300 calls                      │
│   → New: 15, Updated: 280, Failed: 5        │
│   → Duration: 58s                           │
└─────────────────────────────────────────────┘
```

**Статистика:**
- Total sessions
- Success rate
- Last sync timestamp

**Компоненты:**
- 🆕 SyncPage (взять структуру из Shadi)
- 🆕 SyncHistoryTable
- 🆕 ManualSyncButton

**API Endpoint:**
- `POST /api/sync` - trigger manual sync
- `GET /api/sync/status` - get sync history

---

### 5. **QCI Analysis Management** (Опционально для Фазы 2)
**Статус:** 🔮 Будущее

**Назначение:**
- Enable/disable auto-analysis
- Choose QCI framework
- Configure analysis parameters
- View analysis queue

**Компоненты:**
- Settings panel
- Analysis framework selector
- Config editor

**Приоритет:** Низкий (добавить позже)

---

## 🧩 КОМПОНЕНТЫ

### ✅ Уже существуют:

1. **MetricCard** (`components/MetricCard.tsx`)
   - Показывает одну метрику
   - Форматы: number, percentage, duration, currency

2. **Navigation** (`components/Navigation.tsx`)
   - Главное меню

3. **UI Components** (`components/ui/`)
   - Card, Badge, Button, Select
   - Calendar, Popover
   - Input, Label, Checkbox, Progress

4. **MetricsGrid** (`components/dashboard/MetricsGrid.tsx`)
   - Сетка из 6 метрик

5. **CallsTable** (`components/dashboard/CallsTable.tsx`)
   - Таблица звонков с фильтрацией

6. **TimelineChart** (`components/dashboard/TimelineChart.tsx`)
   - График звонков по времени

7. **AssistantBreakdown** (`components/dashboard/AssistantBreakdown.tsx`)
   - Разбивка по ассистентам

### 🆕 Нужно создать:

#### High Priority (Фаза 1):

8. **FilterPanel** (`components/dashboard/FilterPanel.tsx`)
   - Time range filter (Today, Yesterday, 7D, 30D, 90D, All, Custom)
   - Assistant dropdown select
   - Additional checkboxes (Has transcript, Has QCI, etc.)

   **Взять из:** Shadi FilterPanel + адаптировать

9. **CustomDatePicker** (`components/dashboard/CustomDatePicker.tsx`)
   - Date range picker с presets

   **Взять из:** Shadi CustomDatePicker

10. **SalesFunnel** (`components/dashboard/SalesFunnel.tsx`)
    - Визуализация воронки звонков
    - 4 этапа с conversion rates

    **Взять из:** Shadi SalesFunnel + адаптировать

11. **CallAnalyticsChart** (`components/dashboard/CallAnalyticsChart.tsx`)
    - AreaChart (все звонки) + LineChart (analyzed) overlay
    - Recharts library

    **Новый:** Комбинация двух графиков

12. **CallDetailsSidebar** (`components/dashboard/CallDetailsSidebar.tsx`)
    - Right sidebar panel
    - Audio player, transcript, QCI, metadata

    **Новый:** Основной компонент для детализации

13. **AudioPlayer** (`components/dashboard/AudioPlayer.tsx`)
    - HTML5 audio player с custom controls

    **Новый:** Простой аудио плеер

14. **TranscriptView** (`components/dashboard/TranscriptView.tsx`)
    - Отображение диалога AI/User
    - Scrollable текст

    **Новый:** Форматированный transcript

15. **QCIBreakdown** (`components/dashboard/QCIBreakdown.tsx`)
    - Collapsible секция с QCI scores
    - Breakdown по категориям

    **Новый:** QCI визуализация

16. **SyncPage** (`app/sync/page.tsx`)
    - Страница управления синхронизацией
    - История синхронизаций

    **Взять из:** Shadi SyncPage + адаптировать

17. **SyncHistoryTable** (`components/sync/SyncHistoryTable.tsx`)
    - Expandable sync sessions
    - Статистика синхронизации

    **Взять из:** Shadi sync components

#### Medium Priority (Фаза 2):

18. **QCISettingsPanel** - Настройки QCI анализа
19. **PromptEditor** - Редактор промптов ассистентов
20. **PerformanceTracker** - Трекинг улучшений

---

## 🔌 API ENDPOINTS

### Dashboard Data:

```typescript
// Get dashboard metrics
GET /api/dashboard/metrics
Query params:
  - assistant_id?: string
  - date_from: string (ISO)
  - date_to: string (ISO)
  - has_qci?: boolean
  - min_duration?: number

Response: {
  totalCalls: number
  qualityCalls: number
  analyzedCalls: number
  avgDuration: number
  avgQCI: number | null
  qualityRate: number
  totalAssistants: number
}
```

```typescript
// Get timeline data
GET /api/dashboard/timeline
Query params:
  - assistant_id?: string
  - date_from: string
  - date_to: string
  - granularity: 'day' | 'week' | 'month'

Response: {
  total_calls: Array<{ date: string, count: number }>
  analyzed_calls: Array<{ date: string, count: number }>
}
```

```typescript
// Get sales funnel data
GET /api/dashboard/funnel
Query params:
  - assistant_id?: string
  - date_from: string
  - date_to: string

Response: {
  all_calls: number
  quality_calls: number (>30s)
  engaged_calls: number (>60s)
  meetings_booked: number
  conversion_rates: {
    to_quality: number
    to_engaged: number
    to_meeting: number
  }
}
```

```typescript
// Get calls list
GET /api/dashboard/calls
Query params:
  - assistant_id?: string
  - date_from: string
  - date_to: string
  - has_transcript?: boolean
  - has_qci?: boolean
  - min_duration?: number
  - limit: number
  - offset: number
  - sort_by: 'started_at' | 'duration_seconds' | 'cost' | 'qci_total'
  - sort_order: 'asc' | 'desc'

Response: {
  calls: Array<Call>
  total: number
}
```

```typescript
// Get call details
GET /api/calls/:call_id

Response: {
  call: Call (full data)
  qci_analysis: QCIAnalysis | null
  assistant: Assistant
}
```

### Sync Management:

```typescript
// Trigger manual sync
POST /api/sync

Response: {
  success: boolean
  batch_id: string
  fetched: number
  inserted: number
  updated: number
  failed: number
  duration_seconds: number
}
```

```typescript
// Get sync status/history
GET /api/sync/status

Response: {
  logs: Array<SyncLog>
  last_sync: string (ISO timestamp)
}
```

---

## 📦 БИБЛИОТЕКИ

### Уже установлены:
- ✅ Next.js 15.5.4
- ✅ React 19.1.0
- ✅ TypeScript
- ✅ Tailwind CSS 4
- ✅ Radix UI (@radix-ui/react-*)
- ✅ Recharts 3.3.0
- ✅ date-fns 4.1.0
- ✅ Supabase (@supabase/ssr)

### Нужно установить:
- 🆕 lucide-react (для иконок) - уже есть!
- Всё остальное уже есть ✅

---

## 🗂️ СТРУКТУРА ФАЙЛОВ

```
frontend/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Landing page
│   │   ├── layout.tsx
│   │   ├── dashboard/
│   │   │   └── page.tsx                # Main dashboard
│   │   ├── sync/
│   │   │   └── page.tsx                # 🆕 Sync management
│   │   └── api/
│   │       ├── dashboard/
│   │       │   ├── metrics/route.ts
│   │       │   ├── timeline/route.ts
│   │       │   ├── funnel/route.ts
│   │       │   └── calls/route.ts
│   │       ├── calls/
│   │       │   └── [id]/route.ts
│   │       └── sync/
│   │           ├── route.ts
│   │           └── status/route.ts
│   ├── components/
│   │   ├── Navigation.tsx
│   │   ├── MetricCard.tsx
│   │   ├── dashboard/
│   │   │   ├── FilterPanel.tsx         # 🆕 Filters
│   │   │   ├── CustomDatePicker.tsx    # 🆕 Date picker
│   │   │   ├── MetricsGrid.tsx
│   │   │   ├── SalesFunnel.tsx         # 🆕 Funnel
│   │   │   ├── CallAnalyticsChart.tsx  # 🆕 Charts
│   │   │   ├── CallsTable.tsx
│   │   │   ├── CallDetailsSidebar.tsx  # 🆕 Details
│   │   │   ├── AudioPlayer.tsx         # 🆕 Player
│   │   │   ├── TranscriptView.tsx      # 🆕 Transcript
│   │   │   ├── QCIBreakdown.tsx        # 🆕 QCI
│   │   │   ├── TimelineChart.tsx
│   │   │   └── AssistantBreakdown.tsx
│   │   ├── sync/
│   │   │   ├── SyncHistoryTable.tsx    # 🆕 Sync history
│   │   │   └── ManualSyncButton.tsx    # 🆕 Sync button
│   │   └── ui/
│   │       ├── badge.tsx
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── calendar.tsx
│   │       ├── popover.tsx
│   │       ├── select.tsx
│   │       ├── checkbox.tsx
│   │       └── ... (другие UI)
│   └── lib/
│       ├── supabase/
│       │   ├── client.ts
│       │   └── server.ts
│       ├── db/
│       │   ├── metrics.ts              # 🆕 Metrics queries
│       │   ├── funnel.ts               # 🆕 Funnel queries
│       │   ├── timeline.ts             # 🆕 Timeline queries
│       │   └── calls.ts                # 🆕 Calls queries
│       └── utils.ts
├── .env.local
└── package.json
```

---

## 🚀 ROADMAP РАЗРАБОТКИ

### Фаза 1: Core Dashboard (1-2 недели)

**Week 1: Filters + Charts**
- [ ] Day 1-2: FilterPanel с time range + assistant select
- [ ] Day 3-4: CustomDatePicker integration
- [ ] Day 5-6: CallAnalyticsChart (Area + Line overlay)
- [ ] Day 7: SalesFunnel component

**Week 2: Call Details + Sync**
- [ ] Day 1-3: CallDetailsSidebar с всеми секциями
- [ ] Day 4-5: AudioPlayer + TranscriptView
- [ ] Day 6: QCIBreakdown collapsible
- [ ] Day 7: Sync Page base structure

### Фаза 2: Sync Management (3-5 дней)

- [ ] Day 1-2: Sync API endpoints (POST /api/sync, GET /api/sync/status)
- [ ] Day 3-4: SyncHistoryTable с expandable sessions
- [ ] Day 5: Manual sync button + testing

### Фаза 3: Polish & Optimization (3-5 дней)

- [ ] Performance optimization
- [ ] Loading states
- [ ] Error handling
- [ ] Responsive design check
- [ ] User testing

### Фаза 4: Future Features (по мере необходимости)

- [ ] QCI Analysis settings
- [ ] Prompt optimization UI
- [ ] Performance tracking
- [ ] Export functionality
- [ ] Advanced filtering

---

## 🎨 ДИЗАЙН GUIDELINES

### Цветовая схема:
- **Primary:** Blue (#3b82f6) - для основных действий
- **Success:** Green (#22c55e) - для успешных метрик
- **Warning:** Yellow (#eab308) - для предупреждений
- **Error:** Red (#ef4444) - для ошибок
- **Neutral:** Gray (#6b7280) - для текста

### Spacing:
- Gap between sections: 24px (1.5rem)
- Card padding: 24px
- Component gap: 12px

### Typography:
- Headers: font-semibold
- Metrics: font-bold, larger size
- Body: font-normal

---

## 💾 STATE MANAGEMENT

### Global State (React Context or Zustand):
```typescript
interface DashboardState {
  // Filters
  timeRange: {
    preset: 'today' | 'yesterday' | '7d' | '30d' | '90d' | 'all' | 'custom'
    from: Date
    to: Date
  }
  selectedAssistant: string | 'all'
  filters: {
    hasTranscript: boolean
    hasQCI: boolean
    minDuration: number | null
  }

  // Data
  metrics: DashboardMetrics | null
  calls: Call[]

  // UI State
  selectedCallId: string | null
  sidebarOpen: boolean
}
```

### API Caching:
- Use React Query или SWR для кеширования API запросов
- Refresh interval: 5 минут для metrics
- Manual refresh для calls list

---

## ✅ DEFINITION OF DONE

### Для каждого компонента:
- [ ] TypeScript типы определены
- [ ] Props интерфейс документирован
- [ ] Loading states реализованы
- [ ] Error states обработаны
- [ ] Responsive design проверен
- [ ] Accessibility (a11y) учтен

### Для каждой страницы:
- [ ] API endpoints работают
- [ ] Data fetching с loading states
- [ ] Error boundaries установлены
- [ ] SEO metadata добавлена
- [ ] Performance проверен (Lighthouse)

---

## 📝 ПРИМЕЧАНИЯ

### Важные решения:
1. **Sidebar вместо Modal** для Call Details - industry standard для desktop call centers
2. **Area + Line overlay** для графиков - визуально показывает % coverage
3. **Независимые фильтры** - можно комбинировать любые фильтры
4. **Сортировка только по raw data** - стабильные данные, не зависят от анализа
5. **Assistant ID как primary key** - если ID меняется = новый ассистент

### Технические ограничения:
- No real-time updates (WebSocket) - manual refresh или polling раз в 5 минут
- No data export (пока) - можно добавить через n8n
- No Airtable integration - всё через Supabase

---

**Конец документа**
