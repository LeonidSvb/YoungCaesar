# API Testing Guide - VAPI Analytics

Это руководство для тестирования всех 6 API endpoints через curl или браузер.

**Base URL:** `http://localhost:3000` (dev) или `https://your-app.vercel.app` (production)

---

## 1. Dashboard Metrics

**Endpoint:** `GET /api/dashboard/metrics`

### Test 1.1: All metrics without filters

```bash
curl "http://localhost:3000/api/dashboard/metrics"
```

**Expected Response:**
```json
{
  "totalCalls": 729,
  "qualityCalls": 366,
  "excellentCalls": 0,
  "avgDuration": 45.8,
  "avgQCI": 0,
  "qualityRate": 50.2,
  "totalAssistants": 5
}
```

**Check:**
- ✅ totalCalls должен быть > 0
- ✅ qualityRate должен быть 0-100%
- ✅ avgDuration в секундах
- ✅ Response время < 1 second

---

### Test 1.2: Metrics with assistant filter

```bash
curl "http://localhost:3000/api/dashboard/metrics?assistant_id=35cd1a47-714b-4436-9a19-34d7f2d00b56"
```

**Expected Response:**
```json
{
  "totalCalls": 3967,
  "qualityCalls": 520,
  "avgDuration": 48,
  "qualityRate": 13.1
}
```

**Check:**
- ✅ totalCalls должен быть меньше чем без фильтра
- ✅ Response время < 100ms (с index)

---

### Test 1.3: Metrics with date range

```bash
curl "http://localhost:3000/api/dashboard/metrics?date_from=2025-10-01&date_to=2025-10-18"
```

**Expected Response:**
```json
{
  "totalCalls": 729,
  "qualityCalls": 366
}
```

**Check:**
- ✅ Должен вернуть только звонки за указанный период
- ✅ totalCalls <= all time total

---

### Test 1.4: Metrics with assistant + date range

```bash
curl "http://localhost:3000/api/dashboard/metrics?assistant_id=35cd1a47-714b-4436-9a19-34d7f2d00b56&date_from=2025-10-13&date_to=2025-10-18"
```

**Expected Response:**
```json
{
  "totalCalls": 103,
  "qualityCalls": 54
}
```

**Check:**
- ✅ totalCalls должен быть меньше чем с одним фильтром
- ✅ AND логика (оба фильтра применены)

---

## 2. Sales Funnel

**Endpoint:** `GET /api/dashboard/funnel`

### Test 2.1: Funnel without filters

```bash
curl "http://localhost:3000/api/dashboard/funnel"
```

**Expected Response:**
```json
{
  "stages": [
    { "name": "All Calls", "count": 8559, "rate": 100 },
    { "name": "Quality (>30s)", "count": 1156, "rate": 13.5 },
    { "name": "Engaged (>60s)", "count": 578, "rate": 6.8 },
    { "name": "Meeting Booked", "count": 38, "rate": 0.44 }
  ]
}
```

**Check:**
- ✅ stages[0].count = totalCalls из metrics
- ✅ stages[0].rate всегда 100
- ✅ stages[1].count <= stages[0].count (воронка)
- ✅ stages[2].count <= stages[1].count (воронка)
- ✅ stages[3].count <= stages[2].count (воронка)
- ✅ Rate должен уменьшаться от 100% вниз

---

### Test 2.2: Funnel with assistant filter

```bash
curl "http://localhost:3000/api/dashboard/funnel?assistant_id=35cd1a47-714b-4436-9a19-34d7f2d00b56"
```

**Expected Response:**
```json
{
  "stages": [
    { "name": "All Calls", "count": 3967, "rate": 100 },
    { "name": "Quality (>30s)", "count": 520, "rate": 13.1 },
    { "name": "Engaged (>60s)", "count": 245, "rate": 6.2 },
    { "name": "Meeting Booked", "count": 15, "rate": 0.38 }
  ]
}
```

**Check:**
- ✅ stages[0].count должен совпадать с totalCalls для assistant
- ✅ Воронка уменьшается

---

### Test 2.3: Funnel with date range

```bash
curl "http://localhost:3000/api/dashboard/funnel?date_from=2025-10-13&date_to=2025-10-18"
```

**Check:**
- ✅ All Calls count = metrics totalCalls для того же периода
- ✅ Conversion rates могут отличаться от all time

---

## 3. Chart Data

**Endpoint:** `GET /api/dashboard/chart`

### Test 3.1: Chart data for last 7 days

```bash
curl "http://localhost:3000/api/dashboard/chart?date_from=2025-10-11&date_to=2025-10-18&granularity=day"
```

**Expected Response:**
```json
{
  "labels": ["2025-10-13", "2025-10-14", "2025-10-15", "2025-10-16"],
  "datasets": [
    {
      "label": "All Calls",
      "data": [161, 136, 12, 103]
    },
    {
      "label": "Quality (>30s)",
      "data": [113, 76, 7, 54]
    },
    {
      "label": "Excellent (>60s)",
      "data": [0, 0, 0, 0]
    }
  ]
}
```

**Check:**
- ✅ labels.length должен быть 4-8 (дни в периоде)
- ✅ datasets[0].data.length = labels.length
- ✅ datasets[1].data[i] <= datasets[0].data[i] (Quality <= All)
- ✅ datasets[2].data[i] <= datasets[1].data[i] (Excellent <= Quality)
- ✅ SUM(datasets[0].data) примерно = totalCalls для периода

---

### Test 3.2: Chart data with assistant filter

```bash
curl "http://localhost:3000/api/dashboard/chart?assistant_id=35cd1a47-714b-4436-9a19-34d7f2d00b56&date_from=2025-10-13&date_to=2025-10-18&granularity=day"
```

**Check:**
- ✅ Должен показать данные только для выбранного assistant
- ✅ SUM(All Calls) <= all time for assistant

---

### Test 3.3: Chart hourly granularity

```bash
curl "http://localhost:3000/api/dashboard/chart?date_from=2025-10-18&date_to=2025-10-18&granularity=hour"
```

**Expected:**
- labels: ["00:00", "01:00", ..., "23:00"] или timestamps
- datasets[0].data: hourly call counts

**Check:**
- ✅ Granularity = hour работает
- ✅ До 24 data points

---

## 4. Calls List

**Endpoint:** `GET /api/calls`

### Test 4.1: First 50 calls

```bash
curl "http://localhost:3000/api/calls?limit=50&offset=0"
```

**Expected Response:**
```json
{
  "calls": [
    {
      "id": "0199eae8-88b3-7bb5-8325-97357b7a5d8d",
      "started_at": "2025-10-16 02:45:54.778+00",
      "duration_seconds": 60,
      "assistant_id": "35cd1a47-714b-4436-9a19-34d7f2d00b56",
      "assistant_name": "BIESSE - MS",
      "customer_number": "+6069857388",
      "qci_score": null,
      "has_transcript": true,
      "has_qci": false,
      "status": "ended",
      "quality": "average",
      "cost": "0.2140"
    }
  ],
  "total": 8559,
  "shown": 50,
  "hasMore": true
}
```

**Check:**
- ✅ calls.length = 50
- ✅ shown = 50
- ✅ hasMore = true (если total > 50)
- ✅ Calls отсортированы по started_at DESC (newest first)

---

### Test 4.2: Pagination (next 50)

```bash
curl "http://localhost:3000/api/calls?limit=50&offset=50"
```

**Expected:**
```json
{
  "calls": [...],
  "total": 8559,
  "shown": 50,
  "hasMore": true
}
```

**Check:**
- ✅ Calls отличаются от первой страницы
- ✅ total остаётся тот же
- ✅ shown = 50

---

### Test 4.3: Calls with quality filter

```bash
curl "http://localhost:3000/api/calls?quality_filter=quality&limit=50"
```

**Expected:**
- Все calls должны иметь duration_seconds > 30

**Check:**
- ✅ ALL calls.duration_seconds > 30
- ✅ total < all time total
- ✅ hasMore корректно рассчитан

---

### Test 4.4: Calls with assistant + date + quality filters

```bash
curl "http://localhost:3000/api/calls?assistant_id=35cd1a47-714b-4436-9a19-34d7f2d00b56&date_from=2025-10-13&date_to=2025-10-18&quality_filter=quality&limit=50"
```

**Check:**
- ✅ ALL calls.assistant_id = filter value
- ✅ ALL calls.started_at >= date_from AND <= date_to
- ✅ ALL calls.duration_seconds > 30
- ✅ AND логика всех фильтров

---

### Test 4.5: Calls with QCI filter

```bash
curl "http://localhost:3000/api/calls?quality_filter=with_qci&limit=50"
```

**Expected:**
- Все calls должны иметь has_qci = true
- qci_score != null

**Check:**
- ✅ ALL calls.has_qci = true
- ✅ ALL calls.qci_score IS NOT NULL

---

## 5. Call Details

**Endpoint:** `GET /api/calls/[id]`

### Test 5.1: Get call with QCI

```bash
# Replace with actual call_id that has QCI
curl "http://localhost:3000/api/calls/41821761-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**Expected Response:**
```json
{
  "id": "41821761-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "started_at": "2025-10-15 18:45:36",
  "ended_at": "2025-10-15 18:47:00",
  "duration_seconds": 84,
  "cost": 0.3899,
  "status": "ended",
  "ended_reason": "customer-ended-call",
  "customer_phone_number": "+1234567890",
  "transcript": "AI: Hello...",
  "recording_url": "https://...",
  "vapi_success_evaluation": "Meeting Outcome: Not booked...",
  "assistant": {
    "name": "BIESSE - MS"
  },
  "qci": {
    "id": 123,
    "total_score": 45,
    "dynamics_score": 12,
    "objections_score": 8,
    "brand_score": 10,
    "outcome_score": 15,
    "coaching_tips": [...],
    "recommendations": "..."
  },
  "raw_json": {...}
}
```

**Check:**
- ✅ id совпадает с запросом
- ✅ assistant.name присутствует
- ✅ qci объект полный (если call имеет QCI)
- ✅ transcript есть строка
- ✅ recording_url валидный URL

---

### Test 5.2: Get call without QCI

```bash
# Replace with call_id WITHOUT QCI
curl "http://localhost:3000/api/calls/0199e991-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**Expected:**
```json
{
  "id": "...",
  "duration_seconds": 55,
  "qci": null,
  "assistant": {
    "name": "QC Advisor"
  }
}
```

**Check:**
- ✅ qci = null (не ошибка, а null)
- ✅ Все остальные поля присутствуют

---

### Test 5.3: Non-existent call ID

```bash
curl "http://localhost:3000/api/calls/fake-id-12345"
```

**Expected Response:**
```json
{
  "error": "Call not found",
  "details": "..."
}
```

**Status Code:** 404

**Check:**
- ✅ Статус 404
- ✅ Error message понятен

---

## 6. Assistants List

**Endpoint:** `GET /api/assistants`

### Test 6.1: All assistants without date filter

```bash
curl "http://localhost:3000/api/assistants"
```

**Expected Response:**
```json
[
  {
    "assistant_id": "35cd1a47-714b-4436-9a19-34d7f2d00b56",
    "assistant_name": "BIESSE - MS",
    "total_calls": 3967,
    "quality_calls": 520,
    "quality_rate": 13.1,
    "avg_qci": 24.5,
    "avg_duration": 48
  },
  {
    "assistant_id": "1a9692a3-bc41-4d9f-b1db-a45170e9fbfe",
    "assistant_name": "YC Assistant",
    "total_calls": 2905,
    "quality_calls": 380,
    "quality_rate": 13.1,
    "avg_qci": 22.1,
    "avg_duration": 45
  }
]
```

**Check:**
- ✅ Отсортировано по total_calls DESC (largest first)
- ✅ assistants.length = 11 (active assistants)
- ✅ SUM(total_calls) примерно = totalCalls из metrics

---

### Test 6.2: Assistants with date filter

```bash
curl "http://localhost:3000/api/assistants?date_from=2025-10-13&date_to=2025-10-18"
```

**Check:**
- ✅ total_calls для периода < all time total_calls
- ✅ Сортировка по total_calls DESC сохранена
- ✅ Может быть меньше assistants (если некоторые не имеют звонков в периоде)

---

## Summary: Testing Checklist

### ✅ Phase 1: Basic Functionality
- [ ] Все 6 endpoints возвращают 200 OK
- [ ] Все endpoints возвращают valid JSON
- [ ] Response время < 1 second

### ✅ Phase 2: Filters Testing
- [ ] Assistant filter работает на всех endpoints
- [ ] Date range filter работает на всех endpoints
- [ ] Комбинация assistant + date работает
- [ ] Quality filters работают (/api/calls)

### ✅ Phase 3: Data Consistency
- [ ] totalCalls в metrics = All Calls в funnel
- [ ] SUM(chart data) ≈ totalCalls для периода
- [ ] Pagination total count корректен
- [ ] Funnel stages логически правильны (decreasing)

### ✅ Phase 4: Edge Cases
- [ ] Несуществующий assistant_id возвращает пустые результаты
- [ ] Несуществующий call_id возвращает 404
- [ ] Date range без данных возвращает пустой массив
- [ ] limit=0 обрабатывается корректно
- [ ] offset > total возвращает пустой массив

### ✅ Phase 5: Performance
- [ ] Dashboard metrics < 600ms
- [ ] Dashboard metrics with filter < 100ms
- [ ] Chart data < 100ms
- [ ] Calls list first page < 200ms
- [ ] Call details < 100ms
- [ ] Assistants list < 200ms

---

## Quick Test Script

Можешь использовать этот bash скрипт для быстрой проверки всех endpoints:

```bash
#!/bin/bash

BASE_URL="http://localhost:3000"

echo "Testing VAPI Analytics API Endpoints..."

echo "\n1. Dashboard Metrics"
curl -s "$BASE_URL/api/dashboard/metrics" | jq '.totalCalls'

echo "\n2. Sales Funnel"
curl -s "$BASE_URL/api/dashboard/funnel" | jq '.stages[0].count'

echo "\n3. Chart Data"
curl -s "$BASE_URL/api/dashboard/chart?granularity=day&date_from=2025-10-13&date_to=2025-10-18" | jq '.labels | length'

echo "\n4. Calls List"
curl -s "$BASE_URL/api/calls?limit=10" | jq '.shown'

echo "\n5. Assistants"
curl -s "$BASE_URL/api/assistants" | jq 'length'

echo "\nAll tests completed!"
```

**Запуск:**
```bash
chmod +x test-api.sh
./test-api.sh
```

---

## Browser Testing

Можно также открыть в браузере:

```
http://localhost:3000/api/dashboard/metrics
http://localhost:3000/api/dashboard/funnel
http://localhost:3000/api/dashboard/chart?granularity=day
http://localhost:3000/api/calls?limit=10
http://localhost:3000/api/assistants
```

Chrome/Firefox автоматически форматируют JSON для удобного просмотра.

---

## Postman Collection (Optional)

Если используешь Postman, можно импортировать эту коллекцию:

```json
{
  "info": { "name": "VAPI Analytics API", "schema": "..." },
  "item": [
    {
      "name": "Dashboard Metrics",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/api/dashboard/metrics"
      }
    }
  ],
  "variable": [
    { "key": "baseUrl", "value": "http://localhost:3000" }
  ]
}
```

---

Готово! Теперь можешь проверить все endpoints с разными комбинациями фильтров.
