# Call Conversions View - Usage Guide

## Overview
Materialized view `call_conversions` предоставляет быстрый доступ к метрикам конверсий встреч из VAPI звонков.

## Setup
1. View уже создана через MCP Supabase
2. Примени индексы и функции: `008_add_conversion_indexes_and_functions.sql` в Supabase SQL Editor

## Текущая статистика
- **8,559 звонков** всего
- **2,051 звонков** с AI анализом
- **46 встреч** забукировано (2.24% conversion rate)
- **75 попыток** букирования (46 успешных, 29 провалено)

## Frontend Examples

### 1. Получить все забукированные встречи
```typescript
const { data: bookedMeetings } = await supabase
  .from('call_conversions')
  .select('*')
  .eq('meeting_booked', true)
  .order('created_at', { ascending: false });
```

### 2. Статистика по ассистентам
```typescript
const { data: assistantStats } = await supabase
  .from('call_conversions')
  .select('assistant_id, meeting_outcome')
  .not('assistant_id', 'is', null);

// Группировка на клиенте
const statsByAssistant = assistantStats.reduce((acc, call) => {
  if (!acc[call.assistant_id]) {
    acc[call.assistant_id] = { booked: 0, failed: 0, total: 0 };
  }
  acc[call.assistant_id].total++;
  if (call.meeting_outcome === 'booked') acc[call.assistant_id].booked++;
  if (call.meeting_outcome === 'failed') acc[call.assistant_id].failed++;
  return acc;
}, {});
```

### 3. Агрегированная статистика (после применения функции)
```typescript
const { data: stats } = await supabase
  .rpc('get_conversion_stats');

// Возвращает:
// {
//   total_calls: 8559,
//   calls_with_analysis: 2051,
//   meetings_booked: 46,
//   conversion_rate: 2.24,
//   attempt_rate: 3.66,
//   success_rate_among_attempts: 61.33
// }
```

### 4. Фильтрация по датам
```typescript
const { data: recentBookings } = await supabase
  .from('call_conversions')
  .select('*')
  .eq('meeting_booked', true)
  .gte('created_at', '2025-10-01')
  .order('created_at', { ascending: false });
```

### 5. Звонки с упоминанием встреч (неясный исход)
```typescript
const { data: mentionedCalls } = await supabase
  .from('call_conversions')
  .select('id, summary, created_at')
  .eq('meeting_outcome', 'mentioned')
  .limit(20);
```

## Поля в view

### Идентификация
- `id` - ID звонка
- `assistant_id` - ID ассистента
- `customer_id` - ID клиента

### Timestamps
- `created_at` - Когда звонок создан
- `started_at` - Когда начался
- `ended_at` - Когда закончился
- `duration_seconds` - Длительность

### Метрики
- `cost` - Стоимость звонка
- `customer_phone_number` - Телефон клиента

### Конверсионные данные
- `meeting_outcome` - Результат: `'booked'`, `'failed'`, `'mentioned'`, `'no_discussion'`
- `meeting_booked` - Boolean флаг (true = встреча забукирована)
- `summary` - AI summary звонка
- `vapi_success_flag` - Флаг успеха от VAPI
- `has_analysis` - Есть ли AI анализ

## Обновление данных

После синхронизации новых звонков из VAPI:
```typescript
await supabase.rpc('refresh_call_conversions');
```

Или через SQL:
```sql
SELECT refresh_call_conversions();
```

## Performance Notes
- View материализована - данные pre-computed, запросы очень быстрые
- Индексы созданы на `meeting_outcome`, `meeting_booked`, `created_at`, `assistant_id`
- Для больших выборок используй `limit` и пагинацию

## Example Dashboard Component

```typescript
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export function ConversionMetrics() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const { data } = await supabase.rpc('get_conversion_stats');
      setStats(data[0]);
      setLoading(false);
    }
    fetchStats();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="stat">
        <div className="stat-title">Conversion Rate</div>
        <div className="stat-value">{stats.conversion_rate}%</div>
        <div className="stat-desc">{stats.meetings_booked} meetings booked</div>
      </div>

      <div className="stat">
        <div className="stat-title">Attempt Rate</div>
        <div className="stat-value">{stats.attempt_rate}%</div>
        <div className="stat-desc">From {stats.calls_with_analysis} analyzed calls</div>
      </div>

      <div className="stat">
        <div className="stat-title">Success Rate</div>
        <div className="stat-value">{stats.success_rate_among_attempts}%</div>
        <div className="stat-desc">Among booking attempts</div>
      </div>
    </div>
  );
}
```
