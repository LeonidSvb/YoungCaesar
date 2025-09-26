# VAPI Collection & Sync Module

## 🚀 PRODUCTION-READY VAPI DATA PIPELINE [v2.0.0]

Complete module for collecting VAPI call data and syncing to Supabase with real-time analytics dashboard.

## 📊 Current Status

- **Total calls collected:** 1,069 calls (Jan-Sep 2025)
- **API cost:** $0.03 for latest collection
- **Coverage:** 11 unique assistants
- **Data quality:** 100% success rate

## 🎯 Quick Start

```bash
# Step 1: Collect VAPI data to JSON
node src/collect_vapi_data.js

# Step 2: Sync JSON data to Supabase
node src/sync_to_supabase.js

# View analytics dashboard
open dashboard/index.html
```

## 📁 Module Structure

```
vapi_collection/
├── src/
│   ├── collect_vapi_data.js    # VAPI → JSON collection
│   └── sync_to_supabase.js     # JSON → Supabase sync
├── dashboard/
│   └── index.html              # VAPI analytics dashboard
├── results/                    # Collection outputs
│   └── *.json                  # Call data files
├── README.md                   # This file
└── history.txt                 # Module history
```

## 🔧 Scripts

### Collection Script
**File:** `src/collect_vapi_data.js`
- Collects call data from VAPI API
- Exports to JSON with metadata
- Handles rate limiting and retries
- Generates cost reports

### Sync Script
**File:** `src/sync_to_supabase.js`
- Syncs VAPI data directly to Supabase
- Full field mapping with relationships
- Batch processing with error handling
- Incremental and full sync modes

## 📊 Dashboard Features

**File:** `dashboard/index.html`

- Interactive assistant filtering (BIESSE-MS, QC Advisor, Alex1, etc.)
- Time period selection (7D, 30D, 3M, All Time, Custom)
- Real-time call analytics and cost tracking
- Upload JSON data functionality

## 📈 Data Output

Collection generates:
- `{timestamp}_vapi_calls_{date_range}_cost-{amount}.json` - Full call data
- `{timestamp}_vapi_stats_{date_range}_cost-{amount}.json` - Summary statistics

## 🔗 Integration

Complete VAPI data pipeline:
- **Collection** → `collect_vapi_data.js` (VAPI API → JSON)
- **Sync** → `sync_to_supabase.js` (JSON → Supabase)
- **Analytics** → `../vapi_analytics/` (data analysis)
- **Optimization** → `../prompt_optimization/` (prompt improvement)

## 💰 Cost Tracking

Recent collections:
- Sep 17, 2025: 1,069 calls → $0.03
- Aug-Sep 2025: 2,612 total calls → $104.23

Avg cost: $0.097 per call

## 🚀 Live Dashboard

Dashboard available at:
- **Local:** `dashboard/index.html`
- **GitHub Pages:** [View Dashboard](https://LeonidSvb.github.io/YoungCaesar/production_scripts/vapi_collection/dashboard/index.html)
- **Vercel:** [Production Dashboard](https://your-vercel.app/production_scripts/vapi_collection/dashboard/index.html)

Upload your VAPI calls JSON file to start analyzing data immediately.