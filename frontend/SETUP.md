# VAPI Analytics Dashboard - Setup Guide

## 🚀 Быстрый старт

### 1. Установка зависимостей

```bash
cd frontend
npm install
```

### 2. Настройка Supabase

#### Шаг 2.1: Получить credentials из Supabase

1. Открой [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Выбери свой проект
3. Перейди в Settings → API
4. Скопируй:
   - **Project URL** (`NEXT_PUBLIC_SUPABASE_URL`)
   - **anon/public key** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)

#### Шаг 2.2: Настроить `.env.local`

Отредактируй файл `frontend/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Применить миграции Supabase

Выполни SQL миграцию в Supabase SQL Editor:

```bash
# Открой файл
database/migrations/007_create_dashboard_rpc_functions.sql

# Скопируй весь SQL код
# Вставь в Supabase SQL Editor
# Нажми RUN
```

**Что делает миграция:**
- ✅ Создает 4 RPC функции для dashboard
- ✅ `get_dashboard_metrics()` - основные метрики
- ✅ `get_timeline_data()` - данные для графиков
- ✅ `get_calls_list()` - список звонков с фильтрами
- ✅ `get_assistant_breakdown()` - статистика по ассистентам

### 4. Запустить development сервер

```bash
npm run dev
```

Dashboard будет доступен на: **http://localhost:3000/dashboard**

---

## 📊 Архитектура

### Структура проекта

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout с Navigation
│   │   ├── page.tsx                # Landing page (модули)
│   │   └── dashboard/              # Dashboard page
│   │       └── page.tsx            # Main analytics dashboard
│   │
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── MetricsGrid.tsx     # KPI метрики (6 карточек)
│   │   │   ├── TimelineChart.tsx   # Multi-line график
│   │   │   ├── AssistantBreakdown.tsx # Статистика по ассистентам
│   │   │   └── CallsTable.tsx      # Таблица звонков с фильтрами
│   │   │
│   │   ├── ui/                     # shadcn/ui компоненты
│   │   ├── MetricCard.tsx          # Переиспользуемая KPI карточка
│   │   └── Navigation.tsx          # Top navigation
│   │
│   └── lib/
│       └── supabase/
│           ├── server.ts           # Server-side Supabase client
│           └── client.ts           # Browser Supabase client
│
├── .env.local                      # Environment variables
└── package.json
```

---

## 🎯 Основные компоненты

### 1. MetricsGrid
Отображает 6 KPI метрик:
- Total Calls
- Quality Rate (% звонков >30s)
- Avg Duration
- Avg QCI Score
- Excellent Calls (>60s + QCI>70)
- Active Assistants

### 2. TimelineChart (Multi-line)
График с 3 линиями:
- **Total Calls** (серая) - все звонки
- **Quality Calls** (зеленая) - звонки >30s
- **Excellent Calls** (синяя) - звонки >60s + QCI>70

### 3. AssistantBreakdown
Карточки с каждым ассистентом:
- Total Calls
- Quality Rate
- Avg QCI
- Avg Duration

### 4. CallsTable
Таблица звонков с фильтрами:
- **All Calls** - все звонки
- **Quality Only** - только >30s
- **Excellent Only** - >60s + QCI>70
- **With QCI** - со анализом QCI
- **With Transcript** - с транскриптом

---

## 🔧 Технологический стек

- **Framework:** Next.js 15.5.4 (App Router)
- **UI Library:** Radix UI + shadcn/ui
- **Charts:** Recharts
- **Database:** Supabase PostgreSQL
- **Styling:** Tailwind CSS 4
- **TypeScript:** 5

---

## 📝 Следующие шаги

### 1. Запустить синхронизацию данных

```bash
cd ..
node production_scripts/vapi_collection/src/sync_to_supabase.js
```

Это заполнит Supabase данными из VAPI API.

### 2. Проверить данные в Supabase

Открой Supabase Table Editor и проверь таблицы:
- `calls` - должны быть звонки
- `assistants` - должны быть ассистенты
- `qci_analyses` - QCI анализы (если есть)

### 3. Тестировать RPC функции

В Supabase SQL Editor:

```sql
-- Тест метрик (последние 7 дней)
SELECT * FROM get_dashboard_metrics(
  NULL,
  NOW() - INTERVAL '7 days',
  NOW()
);

-- Тест timeline данных
SELECT * FROM get_timeline_data(
  NULL,
  NOW() - INTERVAL '7 days',
  NOW(),
  'day'
);

-- Тест списка звонков
SELECT * FROM get_calls_list(
  NULL,
  NOW() - INTERVAL '7 days',
  NOW(),
  'all',
  10,
  0
);
```

---

## 🐛 Troubleshooting

### Dashboard показывает ошибку "Error loading dashboard data"

**Причина:** Неправильные Supabase credentials или миграция не применена.

**Решение:**
1. Проверь `.env.local` - правильные ли URL и key
2. Примени миграцию `007_create_dashboard_rpc_functions.sql`
3. Убедись, что в таблице `calls` есть данные

### "Function get_dashboard_metrics does not exist"

**Причина:** Миграция не применена.

**Решение:**
Выполни миграцию в Supabase SQL Editor (см. Шаг 3 выше).

### Timeline chart пустой

**Причина:** Нет данных за выбранный период.

**Решение:**
1. Проверь таблицу `calls` в Supabase - есть ли записи?
2. Запусти синхронизацию: `node production_scripts/vapi_collection/src/sync_to_supabase.js`

---

## 📞 Поддержка

Если возникли проблемы:
1. Проверь логи в терминале (`npm run dev`)
2. Проверь браузерную консоль (F12)
3. Проверь Supabase logs (Dashboard → Logs)

---

**Готово! 🚀 Dashboard настроен и готов к использованию.**
