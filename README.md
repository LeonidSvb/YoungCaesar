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

reports/                # Generated reports
├── html/               # Web-viewable reports
└── pdf/                # PDF reports for distribution

data/
├── raw/                # Original API responses
├── processed/          # Transformed data & CSV files
├── migration_backups/  # Pre-migration data backups
└── vectors/            # Qdrant vector embeddings

docs/                   # Project documentation
├── AIRTABLE_SETUP.md
├── N8N_WORKFLOW_NAVIGATION.md
├── QUICK_COMMANDS.md
├── VAPI_SYNC_VERIFICATION_CHECKLIST.md
├── pdf_generation_guide.md
└── slack_report_template.md
```

## Quick Start

1. Clone repository
2. Copy `.env.example` to `.env` and add API keys
3. Install dependencies: `npm install`
4. Collect data: `node scripts/collect_vapi_data.js 2025-09-01 2025-09-10`
5. Sync to Airtable: `node scripts/sync_airtable.js upload`
6. View dashboard: Open `dashboards/consolidation_report.html`

## 🚀 Live Dashboards

### Production Dashboards (GitHub Pages)
[![🎯 Prompt Optimization Dashboard](https://img.shields.io/badge/📊_Prompt_Optimization-Dashboard-blue?style=for-the-badge)](https://LeonidSvb.github.io/YoungCaesar/production_scripts/prompt_optimization/dashboard/)
[![📈 QCI Analysis Dashboard](https://img.shields.io/badge/📈_QCI_Analysis-Dashboard-green?style=for-the-badge)](https://LeonidSvb.github.io/YoungCaesar/production_scripts/qci_analysis/dashboard/)

### Main Analytics Dashboards
[![📊 Main Analytics](https://img.shields.io/badge/📊_Main-Analytics-orange?style=for-the-badge)](https://LeonidSvb.github.io/YoungCaesar/dashboards/vapi_dashboard.html)
[![🔄 Consolidation Report](https://img.shields.io/badge/🔄_Consolidation-Report-purple?style=for-the-badge)](https://LeonidSvb.github.io/YoungCaesar/dashboards/consolidation_report.html)

### Reports & Analysis
[![📋 Complete VAPI Report](https://img.shields.io/badge/📋_Complete-VAPI_Report-red?style=for-the-badge)](https://LeonidSvb.github.io/YoungCaesar/reports/html/VAPI_Analytics_Complete_Report_EN.html)
[![📞 Meeting Summary](https://img.shields.io/badge/📞_Meeting-Summary-teal?style=for-the-badge)](https://LeonidSvb.github.io/YoungCaesar/reports/html/meeting-summary-sep3-2025-en.html)

## 📚 Documentation

- **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - Шпаргалка основных команд
- **[SCRIPTS_GUIDE.md](SCRIPTS_GUIDE.md)** - Полное описание всех скриптов по важности
- **[scripts/README.md](scripts/README.md)** - Техническая документация API

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