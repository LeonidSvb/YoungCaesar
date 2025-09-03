# VAPI Call Data Collection

## Project Overview

Collects and analyzes call data from VAPI API for business intelligence and optimization.

## Current Status

- **Total calls collected:** 2,268
- **Calls with transcripts:** 910 (40%)
- **Date range:** August 1 - September 3, 2025
- **Total cost:** $103.03

## Project Structure

```
scripts/collection/
├── vapi_calls_extractor.js      - Original filtered call collector
└── vapi_all_calls_collector.js  - Complete call collector (recommended)

data/raw/
├── vapi_all_call_ids_*.json           - All call IDs (2,268 total)
├── vapi_analytics_report_*.json       - Daily statistics and summary
├── vapi_call_ids_only.json            - Simple ID list
├── vapi_calls_*.json                  - Filtered calls data
└── vapi_raw_calls_*.json              - Complete raw call data

data/processed/
└── vapi_daily_stats_*.csv             - CSV export for Excel/Sheets

dashboards/
└── vapi_dashboard.html                - Analytics visualization

Configuration Files:
├── .env                               - API keys and configuration
├── .env.example                       - Template for API keys
├── .gitignore                         - Git ignore rules
└── package.json                       - Node.js dependencies
```

## Setup

1. Copy `.env.example` to `.env`
2. Add your API keys to `.env`
3. Install dependencies: `npm install`

## Usage

```bash
# Collect all call data
node scripts/collection/vapi_all_calls_collector.js

# View dashboard
open dashboards/vapi_dashboard.html
```

## API Configuration

Required environment variables in `.env`:
- VAPI_API_KEY
- OPENAI_API_KEY  
- QDRANT_API_KEY

## File Types

**Data Collection Scripts:**
- `vapi_all_calls_collector.js` - Gets ALL calls with analytics
- `vapi_calls_extractor.js` - Gets only calls with transcripts (legacy)

**Generated Data Files:**
- `*_raw_calls_*.json` - Complete call data from VAPI API
- `*_analytics_*.json` - Processed statistics and summaries  
- `*_daily_stats_*.csv` - Spreadsheet-ready data export
- `*_call_ids_*.json` - Call ID lists for further processing

**Visualization:**
- `vapi_dashboard.html` - Interactive analytics dashboard

## Changelog

### 2025-09-03 - Production Integration Complete
- **VAPI → Qdrant Integration:** 781 quality calls uploaded with OpenAI embeddings
- **Quality Filtering System:** 40% of calls met high-quality criteria (≥20 chars, ≥$0.01 cost)
- **Semantic Search Ready:** OpenAI text-embedding-3-small (1536 dimensions) for vector search
- **Client Reporting:** English and Bulgarian PDF reports generated via Playwright
- **GitHub Repository:** Complete project structure pushed to https://github.com/LeonidSvb/YoungCaesar
- **Airtable Integration:** Migration script prepared for team access
- **Security Implementation:** Sensitive data excluded from version control
- **PDF Generation:** Automated HTML-to-PDF conversion for client deliverables
- **N8N Workflows:** Real-time processing system designed for production deployment

### 2025-09-03 - Initial Setup
- Initial data collection from VAPI API
- Created analytics dashboard with Chart.js
- Implemented adaptive time-splitting for large datasets
- Generated comprehensive call statistics and reports
- Project structure cleanup and organization
- Added environment variable configuration