# Database Views Documentation

## Overview

Database views contain all business logic for call analysis. This is the **single source of truth** for:
- Call categorization (error/voicemail/quality/short/failed)
- Quality assessment
- Tool usage tracking
- QCI score integration

## Architecture Principle

```
Views = BUSINESS LOGIC (what is a quality call?)
WHERE = PARAMETERS (which assistant? which date?)
```

**Industry standard:** Put complex logic in views, use WHERE for filtering.

---

## Available Views

### 1. `calls_enriched` (Main View)

**Purpose:** All calls with complete business logic and JOIN to related data.

**Contains:**
- All fields from `vapi_calls_raw`
- QCI analysis data (scores, tips, classification)
- Assistant data (name, model, voice)
- **Business Logic:**
  - `call_category`: error/voicemail/quality/short/failed
  - `quality_level`: excellent/good/average/poor
  - `has_transcript`, `has_qci` flags
  - `effective_date`: COALESCE(started_at, created_at)

**Usage:**
```typescript
// Get all quality calls for assistant
const { data } = await supabase
  .from('calls_enriched')
  .select('*')
  .eq('assistant_id', id)
  .eq('call_category', 'quality')
  .order('effective_date', { ascending: false });
```

**Statistics:**
- Total: 8,559 calls
- Performance: Fast (indexed JOIN)

---

### 2. `quality_calls` (Specialized)

**Purpose:** Quality calls only (≥60s, no errors/voicemail). **Main view for daily operations.**

**Business rule:**
```sql
WHERE call_category = 'quality'
-- Means: duration >= 60s AND NOT error AND NOT voicemail
```

**Usage:**
```typescript
// Get recent quality calls
const { data } = await supabase
  .from('quality_calls')
  .select('*')
  .gte('effective_date', dateFrom)
  .order('effective_date', { ascending: false })
  .limit(50);
```

**Statistics:**
- Count: 411 calls (4.8% of total)
- Use case: Daily call review, quality monitoring

---

### 3. `error_calls` (Specialized)

**Purpose:** Error calls for debugging and system health monitoring.

**Includes:**
- twilio-failed-to-connect-call
- customer-busy
- customer-did-not-answer
- silence-timed-out
- call.start.error-*
- Any ended_reason with '%error%'

**Usage:**
```typescript
// Get today's errors
const { data } = await supabase
  .from('error_calls')
  .select('ended_reason, COUNT(*)')
  .gte('effective_date', todayStart)
  .group('ended_reason');
```

**Statistics:**
- Count: 6,392 calls (74.7% of total)
- Use case: System health, debugging

---

### 4. `voicemail_calls` (Specialized)

**Purpose:** Voicemail calls for message quality analysis.

**Business rule:**
```sql
WHERE ended_reason = 'voicemail'
```

**Usage:**
```typescript
// Get voicemail calls with transcripts
const { data } = await supabase
  .from('voicemail_calls')
  .select('*')
  .eq('has_transcript', true)
  .order('effective_date', { ascending: false });
```

**Statistics:**
- Count: 218 calls (2.5% of total)
- Use case: Voicemail message quality review

---

### 5. `calls_with_tools` (Specialized)

**Purpose:** Quality calls with tool usage (successful actions).

**Business rule:**
```sql
WHERE has_tool_calls = true AND call_category = 'quality'
```

**Indicates:**
- Google Calendar booking
- GetTime calculation
- DTMF dialing
- Other tool usage

**Usage:**
```typescript
// Get calls with successful calendar bookings
const { data } = await supabase
  .from('calls_with_tools')
  .select('*')
  .eq('has_calendar_booking', true)
  .order('effective_date', { ascending: false });
```

**Statistics:**
- Count: 140 calls (1.6% of total)
- Use case: Success tracking, conversion monitoring

---

## Call Categorization Logic

### Categories

**1. `error` (74.7%)**
- Connection failures, busy, no answer, timeouts
- ended_reason IN ('twilio-failed-to-connect-call', 'customer-busy', 'customer-did-not-answer', 'silence-timed-out', ...)
- OR ended_reason LIKE '%error%'

**2. `voicemail` (2.5%)**
- ended_reason = 'voicemail'
- Analyzed separately for message quality

**3. `quality` (4.8%)**
- duration_seconds >= 60
- NOT error, NOT voicemail
- Main focus for daily operations

**4. `short` (13.8%)**
- duration_seconds >= 1 AND < 60
- Real calls but too short for quality

**5. `failed` (4.2%)**
- No duration or 0 seconds
- Never started properly

---

## Quality Levels

Used in RPC compatibility:

```typescript
'excellent' // duration > 60s AND qci_score > 70
'good'      // duration > 30s AND qci_score > 50
'average'   // duration > 15s
'poor'      // duration <= 15s
NULL        // No QCI analysis yet
```

---

## Usage Patterns

### Pattern 1: Get quality calls with filters

```typescript
const { data } = await supabase
  .from('quality_calls')
  .select('*')
  .eq('assistant_id', assistantId)
  .gte('effective_date', dateFrom)
  .order('qci_score', { ascending: false });
```

### Pattern 2: Count by category

```typescript
const { data } = await supabase
  .from('calls_enriched')
  .select('call_category')
  .gte('effective_date', dateFrom);

const counts = data.reduce((acc, call) => {
  acc[call.call_category] = (acc[call.call_category] || 0) + 1;
  return acc;
}, {});
```

### Pattern 3: Tool usage analysis

```typescript
const { data } = await supabase
  .from('calls_with_tools')
  .select('tool_names')
  .contains('tool_names', ['google_calendar']);
```

---

## Migration Strategy

### What we did:

✅ Created new views with business logic
✅ Did NOT touch existing RPC functions
✅ Zero risk to existing functionality

### What's next:

**Option 1: Keep RPC (recommended)**
- RPC functions continue to work
- New features use views directly
- Gradual migration if needed

**Option 2: Migrate to views (optional)**
- Replace RPC calls with view queries
- Simplify API layer
- Better performance

---

## Performance Notes

- Views use existing indexes on `vapi_calls_raw`
- JOIN to qci_analyses is LEFT JOIN (no performance impact)
- PostgreSQL query planner optimizes view queries
- Use WHERE filters to limit data (indexed columns: assistant_id, created_at)

---

## Testing Views

```sql
-- Test categorization
SELECT call_category, COUNT(*)
FROM calls_enriched
GROUP BY call_category;

-- Test quality calls
SELECT COUNT(*) FROM quality_calls;

-- Test tools
SELECT tool_names, COUNT(*)
FROM calls_with_tools
GROUP BY tool_names;

-- Verify ended_reason mapping
SELECT ended_reason, call_category, COUNT(*)
FROM calls_enriched
WHERE ended_reason IS NOT NULL
GROUP BY ended_reason, call_category
ORDER BY COUNT(*) DESC;
```

---

## Related Files

- Migration: `migrations/2025-10-24-create-business-logic-views.sql`
- CHANGELOG: Updated with view creation
- This doc: `docs/VIEWS_DOCUMENTATION.md`
