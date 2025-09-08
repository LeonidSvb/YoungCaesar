# VAPI Call Analytics & CRM Integration

## Overview

Comprehensive call data analytics platform integrating VAPI voice API with Airtable CRM. Successfully consolidated 23 scattered data tables into a unified system with 88.7% call-to-client linking accuracy.

## Key Achievements

- **2,612** total calls collected and analyzed
- **2,316** calls (88.7%) successfully linked to clients
- **1,465** unique client records consolidated
- **23 → 1** table consolidation
- **4x** faster processing with optimized batch operations

## Project Structure

```
scripts/
├── collection/          # VAPI API data collection
├── upload/             # Airtable synchronization  
├── migration/          # Table consolidation & linking
├── analysis/           # Data analysis & reporting
└── debug/              # Testing & troubleshooting

dashboards/             # Interactive HTML dashboards
├── vapi_dashboard.html
├── qci_analysis_dashboard.html  
└── consolidation_report.html

data/
├── raw/                # Original API responses
├── processed/          # Transformed & analyzed data
└── templates/          # CSV templates for imports
```

## Quick Start

1. Clone repository
2. Copy `.env.example` to `.env` and add API keys
3. Install dependencies: `npm install`
4. Run data collection: `node scripts/collection/vapi_all_calls_collector.js`
5. Sync to Airtable: `node scripts/upload/airtable_uploader.js`
6. View dashboard: Open `dashboards/consolidation_report.html`

## Core Features

### Data Collection
- Complete call history from VAPI API
- Assistant metadata mapping
- Cost analysis & duration tracking
- Transcript extraction

### Airtable Integration  
- Two-way table linking (calls ↔ clients)
- Incremental sync without duplicates
- Batch processing with rate limiting
- Failed upload recovery

### Data Consolidation
- Merged 7 regional lead tables into CLIENTS_MASTER
- VAPI ID to Customer ID matching
- Source tracking for filtering
- Phone number normalization

### Analytics Dashboards
- Real-time call statistics
- Client activity visualization
- Regional performance metrics
- Before/after migration comparison

## API Requirements

Required environment variables in `.env`:
- `VAPI_API_KEY` - VAPI voice API access
- `AIRTABLE_API_KEY` - Airtable API access
- `AIRTABLE_BASE_ID` - Your Airtable base
- `OPENAI_API_KEY` - For AI analysis (optional)

## Data Flow

```
VAPI API → Collection Scripts → Local JSON Storage
    ↓
Processing & Analysis
    ↓
Airtable Upload → CLIENTS_MASTER + Calls Tables
    ↓
Interactive Dashboards
```

## Migration Scripts

Key scripts for table consolidation:
- `migrate_all_regions.js` - Consolidate all lead tables
- `link_tables.js` - Create two-way links
- `add_source_column.js` - Add source tracking

## Performance Metrics

- Collection: ~2,600 calls in 35 seconds
- Upload: 10 records/batch with 250ms delay
- Linking: 2,316 relationships in ~10 minutes
- Dashboard: Real-time Chart.js visualizations

## Next Steps

1. Add missing CRM fields (Website, Last_Called, Notes)
2. Implement lead scoring system
3. Automate daily sync
4. Add predictive analytics

## License

Private repository - All rights reserved

## Support

For issues or questions, check the CHANGELOG.md for recent updates.