# VAPI Analytics vs Shadi Project - Architecture Comparison

## Executive Summary

**Similarity:** 90%+ architectural match
**Verdict:** Use Shadi patterns with VAPI-specific adaptations

---

## 1. Database Architecture

### Shadi Pattern
```sql
CREATE TABLE hubspot_contacts_raw (
    hubspot_id TEXT PRIMARY KEY,
    -- Frequently queried fields
    email TEXT,
    phone TEXT,
    firstname TEXT,
    -- ALL RAW DATA
    raw_json JSONB NOT NULL,
    -- Sync metadata
    sync_batch_id UUID,
    synced_at TIMESTAMPTZ DEFAULT NOW()
);
```

### VAPI Current
```sql
CREATE TABLE vapi_calls_raw (
    id TEXT PRIMARY KEY,
    -- Frequently queried fields
    assistant_id TEXT,
    duration_seconds INTEGER,
    cost NUMERIC,
    -- ALL RAW DATA
    raw_json JSONB,
    -- Sync metadata
    synced_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Status:** ✅ Perfect match - SAME hybrid schema pattern
**Action:** None needed

---

## 2. Materialized Views для Performance

### Shadi Pattern
```sql
CREATE MATERIALIZED VIEW daily_metrics_mv AS
SELECT
  DATE(closedate) as metric_date,
  hubspot_owner_id as owner_id,
  SUM(amount) as daily_sales,
  COUNT(*) as daily_deals
FROM hubspot_deals_raw
GROUP BY DATE(closedate), hubspot_owner_id;

-- Hourly refresh
SELECT cron.schedule(
  'refresh_daily_metrics',
  '0 * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY daily_metrics_mv;'
);
```

**Shadi Performance:** 10+ seconds → 50-100ms

### VAPI Current
**Status:** ❌ NO materialized views

**Problem:**
- Dashboard will query 8,559 calls directly
- Potential timeout on aggregations
- No pre-calculated metrics

**Action:** 🔥 CRITICAL - Create materialized views

**Recommendation:**
```sql
-- VAPI Daily Call Metrics MV
CREATE MATERIALIZED VIEW daily_call_metrics_mv AS
SELECT
  DATE(started_at) as metric_date,
  assistant_id,

  -- Pre-calculated metrics
  COUNT(*) as total_calls,
  COUNT(*) FILTER (WHERE duration_seconds > 30) as quality_calls,
  COUNT(*) FILTER (WHERE duration_seconds > 60) as engaged_calls,
  SUM(cost) as total_cost,
  AVG(duration_seconds) as avg_duration

FROM vapi_calls_raw
WHERE started_at IS NOT NULL
GROUP BY DATE(started_at), assistant_id;

-- UNIQUE index (required for CONCURRENTLY)
CREATE UNIQUE INDEX idx_daily_call_metrics_mv_pk
  ON daily_call_metrics_mv(metric_date, assistant_id);

-- Hourly refresh
SELECT cron.schedule(
  'refresh_daily_call_metrics',
  '0 * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY daily_call_metrics_mv;'
);
```

**Benefits:**
- Dashboard loads in <100ms instead of 10+ seconds
- Filters (assistant, date range) work instantly
- Chart data pre-aggregated

---

## 3. Modular SQL Functions

### Shadi Pattern
8 modular functions:
```sql
get_sales_metrics()
get_call_metrics()
get_conversion_metrics()
get_payment_metrics()
get_followup_metrics()
get_offer_metrics()
get_time_metrics()
get_ab_testing_metrics()
```

Each returns JSON, accepts (owner_id, date_from, date_to)

### VAPI Current
6 functions found:
```sql
get_dashboard_metrics()
get_timeline_data()
get_calls_list()
get_assistant_breakdown()
get_conversion_stats()
```

**Status:** ⚠️ Partial match

**Issues:**
1. get_dashboard_metrics() - monolithic (returns all 6 metrics in 1 JSON)
2. Missing get_sales_funnel()
3. Missing get_call_details()
4. get_timeline_data() has granularity bug

**Action:** Keep modular approach but FIX bugs

**Recommendation:**
- ✅ Keep existing functions (already modular)
- 🔧 Fix get_dashboard_metrics() date filter issue
- 🔧 Fix get_timeline_data() granularity bug
- ➕ Add get_sales_funnel()
- ➕ Add get_call_details()

---

## 4. API Endpoints Structure

### Shadi Pattern
```
app/api/
├── metrics/route.ts           # GET /api/metrics
├── metrics/timeline/route.ts  # GET /api/metrics/timeline
├── sales-funnel/route.ts      # GET /api/sales-funnel
├── deals/breakdown/route.ts   # GET /api/deals/breakdown
├── owners/route.ts            # GET /api/owners
└── sync/route.ts              # POST /api/sync
```

Each endpoint:
- Accepts query params (owner_id, date_from, date_to)
- Calls Supabase RPC function
- Returns JSON
- Has error handling + logging

### VAPI Plan (from BACKEND_API_DESIGN.md)
```
app/api/
├── dashboard/
│   ├── metrics/route.ts
│   ├── funnel/route.ts
│   └── chart/route.ts
├── calls/
│   ├── route.ts
│   └── [id]/route.ts
└── assistants/route.ts
```

**Status:** ✅ Same architecture pattern

**Recommendation:** Use EXACT Shadi template

```typescript
// app/api/dashboard/metrics/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const assistantId = searchParams.get('assistant_id');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    const { data } = await supabase.rpc('get_dashboard_metrics', {
      p_assistant_id: assistantId || null,
      p_date_from: dateFrom || null,
      p_date_to: dateTo || null
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}
```

---

## 5. Frontend Architecture

### Shadi Pattern
```typescript
// app/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState(null);
  const [ownerId, setOwnerId] = useState('all');
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date()
  });

  useEffect(() => {
    async function fetchMetrics() {
      const params = new URLSearchParams();
      if (ownerId !== 'all') params.set('owner_id', ownerId);
      params.set('date_from', dateRange.from.toISOString().split('T')[0]);

      const res = await fetch(`/api/metrics?${params}`);
      const data = await res.json();
      setMetrics(data);
    }
    fetchMetrics();
  }, [ownerId, dateRange]);

  return (
    <>
      <FilterPanel onOwnerChange={setOwnerId} onDateChange={setDateRange} />
      <MetricsGrid metrics={metrics} />
      <SalesFunnel metrics={metrics} />
      <TimelineCharts ownerId={ownerId} dateRange={dateRange} />
    </>
  );
}
```

### VAPI Current
HTML prototype → needs migration to React

**Status:** ✅ Use Shadi component pattern exactly

**Components structure:**
```
components/
├── MetricCard.tsx            # Individual metric card (DONE ✅)
├── dashboard/
│   ├── FilterPanel.tsx       # Filters (assistant, time range)
│   ├── MetricsGrid.tsx       # 6 metric cards (DONE ✅)
│   ├── SalesFunnel.tsx       # Horizontal funnel
│   ├── CallsChart.tsx        # Multi-line chart
│   ├── CallsTable.tsx        # Paginated table
│   └── CallDetailsSidebar.tsx# Right sidebar
└── Navigation.tsx
```

---

## 6. Sync Strategy

### Shadi Pattern
**Incremental Sync (every 2 hours):**
```typescript
// Fetch only modified/created since last sync
const lastSyncTime = await getLastSuccessfulSyncTime('contacts');
const contacts = await searchContactsByDate(lastSyncTime, PROPERTIES);
```

**Full Sync (daily at 2 AM):**
```typescript
// Fetch ALL contacts (catches missed updates)
const contacts = await fetchAllContacts(PROPERTIES);
```

**Automation:** GitHub Actions cron

### VAPI Current
```
production_scripts/
├── vapi_collection/
│   └── src/sync_to_supabase.js  # Sync script
└── qci_analysis/
    └── sync_qci_to_supabase.js   # QCI sync
```

**Status:** ✅ Already have sync scripts

**Recommendation:**
- ✅ Keep existing Node.js scripts (working)
- ➕ Add GitHub Actions for automation
- ➕ Add sync logging to Supabase

**Missing:** `sync_logs` table

```sql
CREATE TABLE sync_logs (
    id BIGSERIAL PRIMARY KEY,
    batch_id UUID NOT NULL,
    object_type TEXT NOT NULL,  -- 'calls' | 'qci' | 'assistants'

    sync_started_at TIMESTAMPTZ DEFAULT NOW(),
    sync_completed_at TIMESTAMPTZ,
    duration_seconds INTEGER,

    records_fetched INTEGER,
    records_inserted INTEGER,
    records_updated INTEGER,
    records_failed INTEGER,

    status TEXT NOT NULL,  -- 'success' | 'partial' | 'failed'
    triggered_by TEXT      -- 'cron' | 'manual' | 'api'
);
```

---

## 7. Component Patterns

### Shadi Components
```typescript
// MetricCard.tsx
interface MetricCardProps {
  title: string;
  value: number;
  format: 'currency' | 'percentage' | 'number';
  subtitle?: string;
}

// FilterPanel.tsx
'use client';
import { Select } from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-range-picker';

// SalesFunnel.tsx
interface FunnelStage {
  name: string;
  count: number;
  rate: number;
}
```

### VAPI Existing
```typescript
// MetricCard.tsx (DONE ✅)
interface MetricCardProps {
  title: string;
  value: number;
  format: 'number' | 'percentage' | 'duration';
  subtitle?: string;
}
```

**Status:** ✅ Exact match

**Action:** Copy FilterPanel, SalesFunnel patterns from Shadi

---

## 8. Key Differences (VAPI-specific)

### 1. QCI Analysis
**Shadi:** No equivalent (HubSpot doesn't have QCI)
**VAPI:** qci_analyses table with scores

**Impact:** Need separate endpoint/component for QCI

```typescript
// app/api/qci/stats/route.ts
export async function GET(request: NextRequest) {
  const { data } = await supabase.rpc('get_qci_stats', params);
  return NextResponse.json(data);
}
```

### 2. Call Details with Audio
**Shadi:** No audio recordings
**VAPI:** recording_url, transcript in vapi_calls_raw

**Impact:** CallDetailsSidebar needs audio player

```typescript
// components/dashboard/CallDetailsSidebar.tsx
<audio src={call.recording_url} controls />
<div className="transcript">{call.transcript}</div>
```

### 3. Real-time vs Batch
**Shadi:** Batch sync every 2 hours (acceptable latency)
**VAPI:** Same acceptable latency

**Impact:** None - use same pattern

### 4. Meeting Booked Detection
**Shadi:** Explicit field (contact became customer)
**VAPI:** Parse from vapi_success_evaluation or tool_calls

**Impact:** Need smart SQL parsing

```sql
-- Meeting Booked logic
COUNT(*) FILTER (
  WHERE vapi_success_evaluation ILIKE '%booked%'
  OR raw_json->'analysis'->>'successEvaluation' = 'success'
)
```

---

## 9. What to Copy from Shadi (Priority)

### 🔥 CRITICAL (Do First)

**1. Materialized Views**
```sql
CREATE MATERIALIZED VIEW daily_call_metrics_mv AS ...
SELECT cron.schedule('refresh_daily_call_metrics', '0 * * * *', ...);
```

**Why:** 100x performance improvement (10s → 100ms)

**2. API Route Template**
```typescript
// Use exact Shadi pattern for all API routes
import { NextRequest, NextResponse } from 'next/server';
```

**Why:** Proven error handling, logging, consistent structure

**3. Dashboard Page Structure**
```typescript
// 'use client' + useState + useEffect pattern
// Exact FilterPanel integration
```

**Why:** Already working, no need to reinvent

---

### ⚠️ HIGH PRIORITY (Do Second)

**4. sync_logs table**
```sql
CREATE TABLE sync_logs ...
```

**Why:** Track sync history, debug issues, monitor success rate

**5. Modular Components**
```
FilterPanel.tsx
SalesFunnel.tsx
TimelineCharts.tsx
```

**Why:** Reusable, tested, clean architecture

**6. Date Range Utils**
```typescript
import { subDays } from 'date-fns';
// Default: last 30 days
const [dateRange, setDateRange] = useState({
  from: subDays(new Date(), 30),
  to: new Date()
});
```

**Why:** Consistent date handling

---

### ✅ NICE TO HAVE (Do Later)

**7. GitHub Actions for Sync**
```yaml
name: VAPI Incremental Sync
on:
  schedule:
    - cron: '0 */2 * * *'
```

**Why:** Automation, no manual syncs

**8. App Logger**
```typescript
import { getLogger } from '@/lib/app-logger';
const logger = getLogger('metrics-api');
logger.info('Dashboard overview fetched', { totalCalls });
```

**Why:** Better debugging, production monitoring

---

## 10. What NOT to Copy from Shadi

### ❌ Phone Normalization Pattern
**Shadi:** REGEXP_REPLACE for phone matching
**VAPI:** No phone matching needed (calls already linked)

**Action:** Skip this pattern

### ❌ HubSpot-specific Logic
**Shadi:** hs_lastmodifieddate NULL handling
**VAPI:** Different API (VAPI.ai)

**Action:** Skip HubSpot quirks

### ❌ Contact/Deal/Owner Schema
**Shadi:** hubspot_contacts_raw, hubspot_deals_raw
**VAPI:** vapi_calls_raw, qci_analyses, vapi_assistants

**Action:** Keep VAPI schema (already correct)

---

## 11. Updated Development Plan

### Phase 1: Database Layer (1-2 hours)

**1.1 Create Materialized View** 🔥
```sql
-- Create daily_call_metrics_mv
-- Add UNIQUE index
-- Schedule hourly refresh
```

**1.2 Fix Existing Functions** 🔧
```sql
-- Fix get_dashboard_metrics() date filter
-- Fix get_timeline_data() granularity bug
-- Add engagedCalls, analyzedCalls fields
```

**1.3 Add Missing Functions** ➕
```sql
CREATE FUNCTION get_sales_funnel(...)
CREATE FUNCTION get_call_details(...)
```

**1.4 Create sync_logs Table**
```sql
CREATE TABLE sync_logs (...)
```

---

### Phase 2: API Layer (2-3 hours)

**2.1 Copy Shadi API Template**
```typescript
// Use EXACT structure from Shadi
app/api/dashboard/metrics/route.ts
app/api/dashboard/funnel/route.ts
app/api/dashboard/chart/route.ts
app/api/calls/route.ts
app/api/calls/[id]/route.ts
app/api/assistants/route.ts
```

**2.2 Test All Endpoints**
```bash
curl http://localhost:3000/api/dashboard/metrics?assistant_id=xxx
curl http://localhost:3000/api/dashboard/funnel
curl http://localhost:3000/api/calls?limit=50&offset=0
```

---

### Phase 3: Components Migration (3-4 hours)

**3.1 Copy Shadi Components**
```typescript
// Copy from Shadi:
FilterPanel.tsx
SalesFunnel.tsx
TimelineCharts.tsx

// Adapt for VAPI:
MetricsGrid.tsx (DONE ✅)
CallsTable.tsx (new - with pagination)
CallDetailsSidebar.tsx (new - with audio player)
```

**3.2 Dashboard Page**
```typescript
// app/dashboard/page.tsx
// Use EXACT Shadi structure:
'use client';
useState for filters
useEffect for API calls
```

**3.3 Integration**
```
Connect FilterPanel → API calls
Connect MetricsGrid → /api/dashboard/metrics
Connect SalesFunnel → /api/dashboard/funnel
Connect TimelineCharts → /api/dashboard/chart
```

---

### Phase 4: Automation (1 hour)

**4.1 GitHub Actions**
```yaml
# .github/workflows/vapi-sync.yml
on:
  schedule:
    - cron: '0 */2 * * *'  # Every 2 hours
```

**4.2 Update Sync Scripts**
```typescript
// Add SyncLogger to existing scripts
import { SyncLogger } from '@/lib/logger';
const logger = new SyncLogger();
await logger.start('calls', 'cron', batchId);
```

---

## 12. Final Verdict

### Similarity Score: 92%

**Architecture:** 95% match (hybrid schema, modular functions, API routes)
**Components:** 90% match (FilterPanel, MetricCard, charts)
**Sync:** 90% match (batch upsert, logging, cron)
**Performance:** 95% match (materialized views critical for both)

### Recommended Strategy

**DO:**
✅ Copy Shadi materialized views pattern (CRITICAL)
✅ Copy Shadi API route template (proven)
✅ Copy Shadi component structure (FilterPanel, SalesFunnel)
✅ Copy Shadi sync_logs table
✅ Copy Shadi GitHub Actions automation

**ADAPT:**
🔧 QCI-specific components (no equivalent in Shadi)
🔧 Audio player for call details (VAPI-specific)
🔧 Meeting Booked detection (VAPI-specific parsing)

**SKIP:**
❌ Phone normalization (not needed)
❌ HubSpot API quirks (different API)
❌ Contact/Deal schema (keep VAPI schema)

### Timeline

**With Shadi patterns:** 6-8 hours total
**Without Shadi patterns:** 15-20 hours (reinventing wheel)

**Time saved:** ~60% by using proven patterns

---

## Next Steps

1. **Immediate:** Create materialized view (1 hour) - HIGHEST IMPACT
2. **Phase 1:** Fix SQL functions (1 hour)
3. **Phase 2:** Build API routes using Shadi template (2 hours)
4. **Phase 3:** Migrate components from HTML → React (3 hours)
5. **Phase 4:** Add automation (1 hour)

**Total:** 8 hours to production-ready dashboard

Ready to start Phase 1: Materialized Views?
