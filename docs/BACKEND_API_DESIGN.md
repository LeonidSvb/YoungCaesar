# Backend API Design - VAPI Analytics Dashboard

## Investigation Summary

### Database Structure

**Tables:**
- `vapi_calls_raw` (8,559 rows) - Main calls data
- `qci_analyses` (884 rows) - QCI analysis results
- `vapi_assistants` (13 rows) - Assistant metadata
- `qci_frameworks` (1 row) - QCI framework definitions
- `sync_logs` (11 rows) - Data sync history

**Views:**
- `calls` - Simplified calls view with UUID casting
- `assistants` - Simplified assistants view

**Existing RPC Functions:**
- `get_dashboard_metrics()` - Dashboard summary metrics
- `get_timeline_data()` - Chart time series data
- `get_calls_list()` - Calls table with pagination
- `get_assistant_breakdown()` - Per-assistant statistics
- `get_conversion_stats()` - Conversion funnel metrics

### Real Data Metrics

```
Total Calls: 8,559
Quality Calls (>30s): 1,156 (13.5%)
Engaged Calls (>60s): 578 (6.8%)
Meeting Booked: 38 (0.44%)
Avg Duration: 46 seconds
Avg QCI Score: 23.5 (из 884 анализов)
Active Assistants: 11

Top 3 Assistants by Call Volume:
1. BIESSE - MS: 3,967 calls (46%)
2. YC Assistant: 2,905 calls (34%)
3. QC Advisor: 1,202 calls (14%)
```

---

## HTML Prototype Breakdown

### 1. METRICS GRID (6 cards)

#### Card 1: Total Calls
**Display:** `8,559`
**Subtitle:** "All calls in period"

**SQL Calculation:**
```sql
COUNT(*) FROM vapi_calls_raw
WHERE started_at >= date_from AND started_at <= date_to
```

**Existing Function:** `get_dashboard_metrics().totalCalls`

**Issues:**
- Function returns 729 instead of 8,559 (uses default 30d filter via `calls` view)
- Need to check view definition or pass explicit date range

**Fix Needed:** Pass NULL dates for "All time" or use raw table directly

---

#### Card 2: Quality Rate
**Display:** `62.4%`
**Subtitle:** "5,342 calls >30s"

**SQL Calculation:**
```sql
-- Rate
ROUND(COUNT(*) FILTER (WHERE duration_seconds > 30) * 100.0 / COUNT(*), 1)

-- Count
COUNT(*) FILTER (WHERE duration_seconds > 30)
```

**Existing Function:** `get_dashboard_metrics().qualityRate` and `.qualityCalls`

**Real Data:** 1,156 quality calls (13.5%) - HTML prototype numbers are mock

**Status:** ✅ Function works correctly

---

#### Card 3: Avg Duration
**Display:** `42s`
**Subtitle:** "Average call length"

**SQL Calculation:**
```sql
ROUND(AVG(duration_seconds), 0)
```

**Existing Function:** `get_dashboard_metrics().avgDuration`

**Real Data:** 46 seconds

**Status:** ✅ Function works correctly

---

#### Card 4: Avg QCI Score
**Display:** `48.2`
**Subtitle:** "Quality Call Index"

**SQL Calculation:**
```sql
ROUND(AVG(q.total_score), 1)
FROM vapi_calls_raw c
LEFT JOIN qci_analyses q ON c.id = q.call_id
WHERE q.total_score IS NOT NULL
```

**Existing Function:** `get_dashboard_metrics().avgQCI`

**Real Data:** 23.5 (из 884 анализов)

**Issue:** Function returns 0 - needs investigation of JOIN logic

**Fix Needed:** Check if view filters out QCI data

---

#### Card 5: Excellent Calls
**Display:** `124`
**Subtitle:** ">60s + QCI>70"

**SQL Calculation:**
```sql
COUNT(*) FILTER (
  WHERE duration_seconds > 60
  AND q.total_score > 70
)
```

**Existing Function:** `get_dashboard_metrics().excellentCalls` (from timeline function)

**Real Data:** 0 (очень мало звонков с QCI > 70)

**Issue:** Too strict criteria - only 884 QCI analyses, avg score 23.5

**Options:**
1. Lower threshold to QCI > 50
2. Remove QCI requirement - just >60s calls
3. Add "Analyzed" card instead

**Recommendation:** Replace with "Analyzed Calls" metric

---

#### Card 6: Active Assistants
**Display:** `13`
**Subtitle:** "AI assistants in use"

**SQL Calculation:**
```sql
COUNT(DISTINCT assistant_id)
FROM vapi_calls_raw
WHERE started_at >= date_from AND started_at <= date_to
```

**Existing Function:** `get_dashboard_metrics().totalAssistants`

**Real Data:** 11 active assistants

**Status:** ✅ Function works correctly

---

### 2. SALES FUNNEL (4 stages)

#### Stage 1: All Calls
**Display:** `8,559 (100%)`

**SQL:** Same as Total Calls metric

**Status:** ✅ Covered by get_dashboard_metrics

---

#### Stage 2: Quality Calls (>30s)
**Display:** `5,342 (62.4%)`

**SQL:** Same as Quality Rate metric

**Real Data:** 1,156 (13.5%)

**Status:** ✅ Covered by get_dashboard_metrics

---

#### Stage 3: Engaged Calls (>60s)
**Display:** `1,512 (17.7%)`

**SQL Calculation:**
```sql
COUNT(*) FILTER (WHERE duration_seconds > 60)
```

**Real Data:** 578 (6.8%)

**Status:** ❌ NOT in get_dashboard_metrics - need to add

**Fix Needed:** Add engagedCalls to function output

---

#### Stage 4: Meeting Booked
**Display:** `38 (0.44%)`

**SQL Calculation:**
```sql
-- Option 1: Check VAPI success evaluation
COUNT(*) FILTER (
  WHERE vapi_success_evaluation ILIKE '%meeting outcome: booked%'
  OR vapi_success_evaluation ILIKE '%meeting outcome: yes%'
)

-- Option 2: Check tool calls in raw_json
COUNT(*) FILTER (
  WHERE raw_json->'messages' @> '[{"toolCalls": [{"function": {"name": "google_calendar_tool"}}]}]'::jsonb
)

-- Option 3: Combined
COUNT(*) FILTER (
  WHERE (
    vapi_success_evaluation ILIKE '%booked%'
    OR raw_json->'analysis'->>'successEvaluation' = 'success'
  )
)
```

**Existing Function:** `get_conversion_stats().meetings_booked`

**Real Data:** 38 confirmed (tested manually)

**Status:** ✅ Function exists but separate - should integrate into dashboard metrics

---

### 3. CALL ANALYTICS CHART

**Display:** Line chart with 3 toggleable lines over time
- All Calls (blue area)
- Analyzed (purple line)
- Quality >30s (green line)

**Data Requirements:**
- X-axis: Time periods (adaptive grouping)
- Y-axis: Call counts
- 3 separate datasets

**Grouping Logic by Time Range:**
- Today/Yesterday: Hourly (24 points)
- 7 days: Daily (7 points)
- 30 days: Daily (30 points)
- 90 days: Weekly (~13 points)
- All time: Monthly (12-24 points)

**Existing Function:** `get_timeline_data()`

**Parameters:**
```sql
p_assistant_id UUID,
p_date_from TIMESTAMP,
p_date_to TIMESTAMP,
p_granularity TEXT  -- 'hour', 'day', 'week', 'month'
```

**Returns:**
```json
[
  {
    "date": "2025-10-16",
    "total_calls": 103,
    "quality_calls": 54,
    "excellent_calls": 0
  }
]
```

**Issues Found:**
1. ❌ Granularity bug: Expects 'day' not 'daily'
2. ❌ No 'analyzed_calls' in output (only excellent_calls)
3. ✅ Works correctly for daily grouping

**Fix Needed:**
```sql
-- Add analyzed_calls count
COUNT(q.id) as analyzed_calls

-- Fix granularity validation
CASE p_granularity
  WHEN 'hour' THEN DATE_TRUNC('hour', c.started_at)
  WHEN 'day' THEN DATE_TRUNC('day', c.started_at)
  WHEN 'week' THEN DATE_TRUNC('week', c.started_at)
  WHEN 'month' THEN DATE_TRUNC('month', c.started_at)
END
```

**Test Query:**
```sql
SELECT * FROM get_timeline_data(
  NULL,  -- all assistants
  CURRENT_DATE - INTERVAL '7 days',
  CURRENT_DATE,
  'day'
);
```

**Result:** ✅ Returns 4 days of data correctly

---

### 4. CALLS TABLE

**Display:** Paginated table with sorting
- Date, Duration, Assistant, Phone, QCI, Status
- Initial: 50 rows
- Load More: +25 rows per click
- Sorting: 8 options (date, duration, QCI, cost - asc/desc)

**Existing Function:** `get_calls_list()`

**Parameters:**
```sql
p_assistant_id UUID,
p_date_from TIMESTAMP,
p_date_to TIMESTAMP,
p_quality_filter TEXT,  -- 'all', 'quality', 'excellent', 'with_qci', 'with_transcript'
p_limit INTEGER,
p_offset INTEGER
```

**Returns:**
```json
{
  "id": "uuid",
  "started_at": "2025-10-16 02:45:54",
  "duration_seconds": 60,
  "assistant_id": "uuid",
  "assistant_name": "BIESSE - MS",
  "customer_number": "+6069857388",
  "qci_score": null,
  "has_transcript": true,
  "has_qci": false,
  "status": "ended",
  "quality": "average",
  "cost": 0.2140
}
```

**Issues:**
1. ❌ No sorting parameter (p_sort_by, p_sort_order)
2. ✅ Pagination works
3. ✅ Quality filter works
4. ✅ JOIN with assistants works

**Fix Needed:** Add sorting parameters

**Current workaround:** Sort on frontend after fetch

**Test Query:**
```sql
SELECT * FROM get_calls_list(
  NULL, NULL, NULL, 'all', 50, 0
);
```

**Result:** ✅ Returns 50 rows correctly

---

### 5. ASSISTANT FILTER DROPDOWN

**Display:** Dropdown sorted by call volume (DESC)
- "All Assistants"
- "BIESSE - MS (3,967 calls)"
- "YC Assistant (2,905 calls)"
- etc.

**SQL Calculation:**
```sql
SELECT
  c.assistant_id,
  a.name,
  COUNT(*) as call_count
FROM vapi_calls_raw c
LEFT JOIN vapi_assistants a ON c.assistant_id = a.assistant_id
WHERE c.started_at >= date_from AND c.started_at <= date_to
GROUP BY c.assistant_id, a.name
ORDER BY call_count DESC;
```

**Existing Function:** `get_assistant_breakdown()`

**Returns:**
```json
{
  "assistant_id": "uuid",
  "assistant_name": "BIESSE - MS",
  "total_calls": 3967,
  "quality_calls": 520,
  "quality_rate": 13.1,
  "avg_qci": 24.5,
  "avg_duration": 48
}
```

**Status:** ✅ Perfect for dropdown + bonus stats

---

### 6. CALL DETAILS SIDEBAR

**Display:** Right sidebar with call details
- Audio player
- Transcript
- QCI Analysis (collapsible)
- Coaching Tips (collapsible)
- Metadata (collapsible)

**Data Requirements:**
```json
{
  "id": "uuid",
  "started_at": "timestamp",
  "ended_at": "timestamp",
  "duration_seconds": 60,
  "cost": 0.214,
  "assistant_name": "BIESSE - MS",
  "customer_phone_number": "+1234567890",
  "recording_url": "https://...",
  "transcript": "full text...",
  "status": "ended",
  "ended_reason": "customer-ended-call",

  "qci_analysis": {
    "total_score": 45,
    "dynamics_score": 12,
    "objections_score": 8,
    "brand_score": 10,
    "outcome_score": 15,
    "coaching_tips": [],
    "recommendations": "text"
  }
}
```

**SQL Query:**
```sql
SELECT
  c.*,
  a.name as assistant_name,
  row_to_json(q.*) as qci_analysis
FROM vapi_calls_raw c
LEFT JOIN vapi_assistants a ON c.assistant_id = a.assistant_id
LEFT JOIN qci_analyses q ON c.id = q.call_id
WHERE c.id = $1;
```

**Existing Function:** ❌ No dedicated function

**Status:** Need to create `get_call_details(p_call_id TEXT)`

---

## API Endpoints Design

### Architecture: Next.js App Router + Supabase RPC

**Flow:**
```
Frontend Component
  ↓ (fetch)
Next.js API Route (/app/api/...)
  ↓ (supabase.rpc)
Supabase RPC Function
  ↓ (SQL execution)
PostgreSQL Database
  ↓ (return JSON)
Frontend Component
```

---

### Endpoint 1: Dashboard Metrics

**Path:** `GET /api/dashboard/metrics`

**Query Params:**
- `timeRange`: 'today' | 'yesterday' | '7d' | '30d' | '90d' | 'all'
- `assistantId`: UUID (optional)

**Supabase RPC:**
```typescript
const { data } = await supabase.rpc('get_dashboard_metrics', {
  p_assistant_id: assistantId || null,
  p_date_from: calculateDateFrom(timeRange),
  p_date_to: new Date()
});
```

**Response:**
```json
{
  "totalCalls": 8559,
  "qualityCalls": 1156,
  "excellentCalls": 0,
  "avgDuration": 46,
  "avgQCI": 23.5,
  "qualityRate": 13.5,
  "totalAssistants": 11
}
```

**Status:** ✅ Function exists, needs date range fix

---

### Endpoint 2: Sales Funnel

**Path:** `GET /api/dashboard/funnel`

**Query Params:**
- `timeRange`: same as above
- `assistantId`: UUID (optional)

**Supabase RPC:**
```typescript
// Option 1: Use existing get_dashboard_metrics + get_conversion_stats
const metrics = await supabase.rpc('get_dashboard_metrics', params);
const conversions = await supabase.rpc('get_conversion_stats');

// Combine results
return {
  allCalls: metrics.totalCalls,
  qualityCalls: metrics.qualityCalls,
  engagedCalls: /* need to add */,
  meetingBooked: conversions.meetings_booked
};
```

**Response:**
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

**Status:** ⚠️ Need to create combined function or merge data on API layer

---

### Endpoint 3: Chart Data

**Path:** `GET /api/dashboard/chart`

**Query Params:**
- `timeRange`: 'today' | 'yesterday' | '7d' | '30d' | '90d' | 'all'
- `assistantId`: UUID (optional)
- `granularity`: auto-calculated based on timeRange

**Granularity Logic:**
```typescript
function getGranularity(timeRange: string): string {
  switch(timeRange) {
    case 'today':
    case 'yesterday':
      return 'hour';
    case '7d':
    case '30d':
      return 'day';
    case '90d':
      return 'week';
    case 'all':
      return 'month';
  }
}
```

**Supabase RPC:**
```typescript
const { data } = await supabase.rpc('get_timeline_data', {
  p_assistant_id: assistantId || null,
  p_date_from: calculateDateFrom(timeRange),
  p_date_to: new Date(),
  p_granularity: getGranularity(timeRange)
});
```

**Response:**
```json
{
  "labels": ["2025-10-13", "2025-10-14", "2025-10-15", "2025-10-16"],
  "datasets": [
    {
      "label": "All Calls",
      "data": [161, 136, 12, 103]
    },
    {
      "label": "Analyzed",
      "data": [0, 0, 0, 0]
    },
    {
      "label": "Quality (>30s)",
      "data": [113, 76, 7, 54]
    }
  ]
}
```

**Status:** ⚠️ Function exists but needs analyzed_calls added

---

### Endpoint 4: Calls List

**Path:** `GET /api/calls`

**Query Params:**
- `timeRange`: string
- `assistantId`: UUID (optional)
- `qualityFilter`: 'all' | 'quality' | 'with_qci' | 'with_transcript'
- `sortBy`: 'date' | 'duration' | 'qci' | 'cost'
- `sortOrder`: 'asc' | 'desc'
- `limit`: number (default 50)
- `offset`: number (default 0)

**Supabase RPC:**
```typescript
const { data } = await supabase.rpc('get_calls_list', {
  p_assistant_id: assistantId || null,
  p_date_from: calculateDateFrom(timeRange),
  p_date_to: new Date(),
  p_quality_filter: qualityFilter,
  p_limit: limit,
  p_offset: offset
});

// Frontend sorting (until SQL function updated)
const sorted = sortData(data, sortBy, sortOrder);
```

**Response:**
```json
{
  "calls": [...],
  "total": 8559,
  "shown": 50,
  "hasMore": true
}
```

**Status:** ✅ Function exists, sorting done on frontend

---

### Endpoint 5: Call Details

**Path:** `GET /api/calls/[id]`

**Path Params:**
- `id`: Call UUID

**Supabase Query:**
```typescript
// Direct query (no RPC function yet)
const { data } = await supabase
  .from('vapi_calls_raw')
  .select(`
    *,
    assistant:vapi_assistants(name),
    qci:qci_analyses(*)
  `)
  .eq('id', callId)
  .single();
```

**Response:**
```json
{
  "id": "uuid",
  "started_at": "timestamp",
  "duration_seconds": 60,
  "cost": 0.214,
  "transcript": "full text",
  "recording_url": "https://...",
  "assistant": {
    "name": "BIESSE - MS"
  },
  "qci": {
    "total_score": 45,
    "dynamics_score": 12,
    "coaching_tips": []
  }
}
```

**Status:** ❌ No RPC function - use direct query or create one

---

### Endpoint 6: Assistants List

**Path:** `GET /api/assistants`

**Query Params:**
- `timeRange`: string (for call counts)

**Supabase RPC:**
```typescript
const { data } = await supabase.rpc('get_assistant_breakdown', {
  p_date_from: calculateDateFrom(timeRange),
  p_date_to: new Date()
});

// Sort by call count DESC
const sorted = data.sort((a, b) => b.total_calls - a.total_calls);
```

**Response:**
```json
[
  {
    "assistant_id": "uuid",
    "assistant_name": "BIESSE - MS",
    "total_calls": 3967,
    "quality_calls": 520,
    "quality_rate": 13.1
  }
]
```

**Status:** ✅ Function works perfectly

---

## SQL Functions - Required Updates

### 1. Fix: get_dashboard_metrics()

**Issues:**
- Returns only 729 calls instead of 8,559
- avgQCI returns 0 despite 884 analyses

**Investigation Needed:**
```sql
-- Check view definition
SELECT definition FROM pg_views WHERE viewname = 'calls';

-- Check if default date filter applied
```

**Expected Fix:**
- Remove default 30d filter when dates are NULL
- Fix QCI JOIN logic

---

### 2. Enhancement: get_dashboard_metrics()

**Add missing field:**
```sql
COUNT(*) FILTER (WHERE duration_seconds > 60) as engaged_calls
```

**Update return type:**
```json
{
  "totalCalls": 8559,
  "qualityCalls": 1156,
  "engagedCalls": 578,  // NEW
  "analyzedCalls": 884,  // NEW (instead of excellentCalls)
  "avgDuration": 46,
  "avgQCI": 23.5,
  "qualityRate": 13.5,
  "totalAssistants": 11
}
```

---

### 3. Fix: get_timeline_data()

**Add missing field:**
```sql
COUNT(q.id) as analyzed_calls
```

**Fix granularity bug:**
```sql
-- Current: Breaks with 'daily'
DATE_TRUNC(p_granularity, c.started_at)

-- Fixed: Validate input
CASE p_granularity
  WHEN 'hour' THEN DATE_TRUNC('hour', c.started_at)
  WHEN 'day' THEN DATE_TRUNC('day', c.started_at)
  WHEN 'week' THEN DATE_TRUNC('week', c.started_at)
  WHEN 'month' THEN DATE_TRUNC('month', c.started_at)
  ELSE DATE_TRUNC('day', c.started_at)
END
```

---

### 4. Enhancement: get_calls_list()

**Add sorting parameters:**
```sql
CREATE OR REPLACE FUNCTION get_calls_list(
  p_assistant_id UUID DEFAULT NULL,
  p_date_from TIMESTAMP DEFAULT NULL,
  p_date_to TIMESTAMP DEFAULT NULL,
  p_quality_filter TEXT DEFAULT 'all',
  p_sort_by TEXT DEFAULT 'date',        -- NEW
  p_sort_order TEXT DEFAULT 'desc',     -- NEW
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
```

**Sorting logic:**
```sql
ORDER BY
  CASE
    WHEN p_sort_by = 'date' AND p_sort_order = 'desc' THEN started_at
  END DESC,
  CASE
    WHEN p_sort_by = 'date' AND p_sort_order = 'asc' THEN started_at
  END ASC,
  CASE
    WHEN p_sort_by = 'duration' AND p_sort_order = 'desc' THEN duration_seconds
  END DESC,
  -- ... etc
```

---

### 5. New: get_call_details()

**Create new function:**
```sql
CREATE OR REPLACE FUNCTION get_call_details(p_call_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN (
    SELECT row_to_json(result)
    FROM (
      SELECT
        c.*,
        a.name as assistant_name,
        q.*
      FROM vapi_calls_raw c
      LEFT JOIN vapi_assistants a ON c.assistant_id = a.assistant_id
      LEFT JOIN qci_analyses q ON c.id = q.call_id
      WHERE c.id = p_call_id
    ) result
  );
END;
$$;
```

---

### 6. New: get_sales_funnel()

**Create combined function:**
```sql
CREATE OR REPLACE FUNCTION get_sales_funnel(
  p_assistant_id UUID DEFAULT NULL,
  p_date_from TIMESTAMP DEFAULT NULL,
  p_date_to TIMESTAMP DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_all_calls INTEGER;
  v_quality_calls INTEGER;
  v_engaged_calls INTEGER;
  v_meeting_booked INTEGER;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE duration_seconds > 30),
    COUNT(*) FILTER (WHERE duration_seconds > 60),
    COUNT(*) FILTER (
      WHERE vapi_success_evaluation ILIKE '%booked%'
      OR raw_json->'analysis'->>'successEvaluation' = 'success'
    )
  INTO v_all_calls, v_quality_calls, v_engaged_calls, v_meeting_booked
  FROM vapi_calls_raw
  WHERE (p_assistant_id IS NULL OR assistant_id = p_assistant_id)
    AND (p_date_from IS NULL OR started_at >= p_date_from)
    AND (p_date_to IS NULL OR started_at <= p_date_to);

  RETURN json_build_object(
    'stages', json_build_array(
      json_build_object('name', 'All Calls', 'count', v_all_calls, 'rate', 100),
      json_build_object('name', 'Quality (>30s)', 'count', v_quality_calls, 'rate', ROUND(v_quality_calls * 100.0 / NULLIF(v_all_calls, 0), 1)),
      json_build_object('name', 'Engaged (>60s)', 'count', v_engaged_calls, 'rate', ROUND(v_engaged_calls * 100.0 / NULLIF(v_all_calls, 0), 1)),
      json_build_object('name', 'Meeting Booked', 'count', v_meeting_booked, 'rate', ROUND(v_meeting_booked * 100.0 / NULLIF(v_all_calls, 0), 2))
    )
  );
END;
$$;
```

---

## Development Roadmap

### Phase 1: Fix Existing SQL Functions (Priority)
1. ✅ Investigation complete
2. ⏳ Fix get_dashboard_metrics() - date filter issue
3. ⏳ Fix get_timeline_data() - granularity bug
4. ⏳ Add engagedCalls and analyzedCalls to metrics

### Phase 2: Enhance SQL Functions
1. ⏳ Add sorting to get_calls_list()
2. ⏳ Create get_sales_funnel()
3. ⏳ Create get_call_details()

### Phase 3: Build API Endpoints
1. ⏳ /api/dashboard/metrics
2. ⏳ /api/dashboard/funnel
3. ⏳ /api/dashboard/chart
4. ⏳ /api/calls
5. ⏳ /api/calls/[id]
6. ⏳ /api/assistants

### Phase 4: Build React Components
1. ⏳ MetricsGrid component (uses /api/dashboard/metrics)
2. ⏳ SalesFunnel component (uses /api/dashboard/funnel)
3. ⏳ CallsChart component (uses /api/dashboard/chart)
4. ⏳ CallsTable component (uses /api/calls)
5. ⏳ CallDetailsSidebar component (uses /api/calls/[id])

### Phase 5: Integration & Testing
1. ⏳ Connect filters to all components
2. ⏳ Test time range switching
3. ⏳ Test assistant filtering
4. ⏳ Test pagination
5. ⏳ Test sorting

---

## Next Steps

1. **Fix SQL Functions First:**
   - Fix get_dashboard_metrics date filter
   - Fix get_timeline_data granularity
   - Add missing fields (engagedCalls, analyzedCalls)

2. **Test Fixed Functions:**
   - Verify all metrics match real data
   - Test all time ranges
   - Test assistant filtering

3. **Create Missing Functions:**
   - get_sales_funnel()
   - get_call_details()

4. **Build API Layer:**
   - Create Next.js API routes
   - Connect to Supabase RPC
   - Add error handling

5. **Migrate to React:**
   - One component at a time
   - Test against HTML prototype
   - Ensure no UI/UX changes

**Ready to start Phase 1: Fix SQL Functions?**
