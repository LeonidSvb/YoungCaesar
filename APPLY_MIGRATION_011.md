# Применить миграцию 011: Исправить Quality Badge

## Проблема
Quality badge показывается для ВСЕХ звонков (average/poor) даже если они не проанализированы.
Это вводит в заблуждение - выглядит как будто все звонки имеют QCI анализ.

## Решение
Quality badge должен показываться ТОЛЬКО для звонков с реальным QCI анализом.

---

## Шаги применения:

### 1. Открой Supabase Dashboard

https://supabase.com/dashboard/project/fuwxksgzshrvpbmcbnjl/sql/new

### 2. Скопируй SQL код

Открой файл: `data/migrations/011_fix_quality_badge_logic.sql`

Или скопируй отсюда:

```sql
CREATE OR REPLACE FUNCTION get_calls_list(
  p_assistant_id UUID DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL,
  p_quality_filter TEXT DEFAULT 'all',
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  started_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  assistant_id UUID,
  assistant_name TEXT,
  customer_number TEXT,
  qci_score NUMERIC,
  has_transcript BOOLEAN,
  has_qci BOOLEAN,
  status TEXT,
  quality TEXT,
  cost NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.started_at,
    c.duration_seconds,
    c.assistant_id,
    a.name as assistant_name,
    c.customer_number,
    q.qci_total_score as qci_score,
    (c.transcript IS NOT NULL AND c.transcript != '') as has_transcript,
    (q.id IS NOT NULL) as has_qci,
    c.status,
    -- Quality badge ТОЛЬКО для звонков с QCI анализом
    CASE
      WHEN q.id IS NULL THEN NULL  -- Нет QCI анализа = нет badge
      WHEN c.duration_seconds > 60 AND q.qci_total_score > 70 THEN 'excellent'
      WHEN c.duration_seconds > 30 AND q.qci_total_score > 50 THEN 'good'
      WHEN c.duration_seconds > 15 THEN 'average'
      ELSE 'poor'
    END as quality,
    c.cost
  FROM calls c
  LEFT JOIN assistants a ON c.assistant_id = a.id
  LEFT JOIN qci_analyses q ON c.id = q.call_id
  WHERE c.started_at >= COALESCE(p_date_from, NOW() - INTERVAL '7 days')
    AND c.started_at <= COALESCE(p_date_to, NOW())
    AND (p_assistant_id IS NULL OR c.assistant_id = p_assistant_id)
    AND (
      p_quality_filter = 'all' OR
      (p_quality_filter = 'quality' AND c.duration_seconds > 30) OR
      (p_quality_filter = 'excellent' AND c.duration_seconds > 60 AND q.qci_total_score > 70) OR
      (p_quality_filter = 'with_qci' AND q.id IS NOT NULL) OR
      (p_quality_filter = 'with_transcript' AND c.transcript IS NOT NULL AND c.transcript != '')
    )
  ORDER BY c.started_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
```

### 3. Выполни в Supabase

1. Вставь SQL в SQL Editor
2. Нажми "Run" или Ctrl+Enter
3. Должно показать "Success"

### 4. Проверь результат

Обнови dashboard в браузере (http://localhost:3004)

**До:**
- Все звонки имеют badge: "average", "poor", "good"

**После:**
- Только проанализированные звонки имеют badge
- Непроанализированные звонки: колонка "Status" без quality badge, только "QCI" badge если есть

---

## Что изменилось

**Старая логика:**
```sql
CASE
  WHEN duration > 60 AND qci > 70 THEN 'excellent'
  WHEN duration > 30 AND qci > 50 THEN 'good'
  WHEN duration > 15 THEN 'average'  ← срабатывает для ВСЕХ звонков >15s
  ELSE 'poor'  ← срабатывает для всех остальных
END
```

**Новая логика:**
```sql
CASE
  WHEN q.id IS NULL THEN NULL  ← НЕТ QCI = НЕТ BADGE ✓
  WHEN duration > 60 AND qci > 70 THEN 'excellent'
  WHEN duration > 30 AND qci > 50 THEN 'good'
  WHEN duration > 15 THEN 'average'
  ELSE 'poor'
END
```
