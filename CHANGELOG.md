# VAPI Call Data Collection

## Project Overview

Collects and analyzes call data from VAPI API for business intelligence and optimization.

## Current Status

- **Total calls collected:** 2,612 (2,268 + 344 new)
- **Calls with transcripts:** 916 (35%)
- **Date range:** August 1 - September 9, 2025
- **Total cost:** $104.23
- **Airtable sync:** ✅ Up-to-date (364 records)
- **n8n Integration:** ✅ 42 workflows analyzed and documented

## Project Structure

```
scripts/
├── collection/                        - Data collection from VAPI API
│   ├── vapi_all_calls_collector.js   - Complete call collector (primary)
│   ├── vapi_calls_extractor.js       - Filtered call collector (legacy)
│   ├── get_assistant_names.js        - Assistant metadata fetcher
│   ├── n8n_workflows_collector.js    - n8n workflow data collector
│   └── n8n_debug.js                  - n8n API debugging tool
├── upload/                            - Airtable integration
│   ├── airtable_uploader.js           - Main upload script
│   ├── test_airtable_upload.js        - Test upload functionality
│   └── create_airtable_table.js       - Table setup instructions
└── analysis/                          - Data analysis tools
    └── n8n_workflow_analyzer.js       - n8n workflow analysis and categorization

data/
├── raw/                               - Original VAPI API data
│   ├── vapi_raw_calls_*.json         - Complete call data (2,268 calls)
│   ├── vapi_analytics_report_*.json  - Daily statistics
│   └── vapi_all_call_ids_*.json      - All call IDs
├── processed/                         - Analyzed and transformed data
│   ├── assistant_mapping.json        - Assistant ID to name mapping (12 assistants)
│   ├── agents_analysis.json          - Agent performance analysis
│   ├── failed_uploads.json           - Failed Airtable uploads (currently empty)
│   ├── by_agent/                     - Per-agent transcript exports
│   ├── agent_improvements/           - AI improvement recommendations
│   └── qci_results/                  - Quality control analysis
└── templates/                         - Data templates and schemas
    └── airtable_template.csv          - Airtable table structure

dashboards/                            - Interactive visualizations
├── vapi_dashboard.html               - Main analytics dashboard
└── qci_analysis_dashboard.html       - Quality control dashboard

reports/                               - Generated reports
├── html/                             - HTML reports for web viewing
│   ├── VAPI_Analytics_Complete_Report*.html
│   ├── client-report-sep3-2025*.html
│   └── meeting-summary-sep3-2025*.html
└── pdf/                              - PDF reports for distribution
    ├── client-report-sep3-2025*.pdf
    └── vapi_dashboard.pdf

templates/                             - Documentation templates
├── pdf_generation_guide.md          - PDF creation instructions
└── slack_report_template.md         - Slack reporting format

Configuration Files:
├── .env                              - API keys and configuration
├── .env.example                      - Template for API keys
├── AIRTABLE_SETUP.md                - Airtable integration guide
├── CLAUDE.md                        - Development guidelines
└── package.json                     - Node.js dependencies
```

## Setup

1. Copy `.env.example` to `.env`
2. Add your API keys to `.env`
3. Install dependencies: `npm install`

## Usage

```bash
# Collect all call data
node scripts/collection/vapi_all_calls_collector.js

# Upload new calls to Airtable
node scripts/upload/airtable_uploader.js upload

# View dashboard
open dashboards/vapi_dashboard.html
```

## API Configuration

Required environment variables in `.env`:
- VAPI_API_KEY
- OPENAI_API_KEY  
- QDRANT_API_KEY
- AIRTABLE_API_KEY
- AIRTABLE_BASE_ID
- AIRTABLE_TABLE_ID

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

### 2025-09-08 - Airtable Table Consolidation & Two-Way Linking ✅
- **Major Data Consolidation:** Merged 23 scattered lead tables into unified CLIENTS_MASTER (1,465 records)
- **Two-Way Table Linking:** Successfully linked 2,316 calls (88.7%) to 1,054 unique clients  
- **Automated ID Matching:** VAPI ID = Customer ID relationship discovered and implemented
- **Batch Processing Optimization:** Reduced linking delay from 1000ms to 250ms (4x faster)
- **Source Field Implementation:** Added Original_Source field to track data origins (E164_Biesse, USA_Leads, etc.)
- **One-to-Many Relationships:** Average 2.2 calls per client properly linked
- **Missing Fields Identified:** 15 important fields missing (Website, Last_Called, Notes, etc.)
- **Migration Stats:**
  - Total calls: 2,612
  - Linked calls: 2,316 (88.7%)  
  - Unlinked calls: 296 (no client data exists)
  - Unique clients with calls: 1,054
  - Success rate improved from 0.61% to 88.7%
- **Table Sources Migrated:**
  - E164_Biesse: 981 records (667 with calls)
  - E164_QC: 228 records (156 with calls)
  - E164_YC: 120 records (120 with calls)
  - USA_Leads: 23 records (18 with calls)
  - ASIA_Leads: 34 records (16 with calls)
  - QC_Advisor: 76 records (74 with calls)
  - OEM_Table: 3 records (3 with calls)
- **Next Steps:** Add missing fields for complete CRM functionality

### 2025-09-08 - VAPI-Airtable Sync Automation Complete ✅ 11/10
- **Perfect Incremental Sync:** 344 new calls (Sept 4-6) uploaded with 100% success rate
- **Zero Duplicate Prevention:** Smart filtering to avoid re-uploading existing Sept 2 data (282 calls)
- **Data Structure Optimization:** Fixed uploader format compatibility for daily-structured JSON data
- **Comprehensive Verification:** Created 10-point quality checklist with automated self-verification
- **Assistant Mapping Integration:** All 12 assistant names properly resolved (BIESSE-MS, Riley, QC Advisor, etc.)
- **Batch Processing Excellence:** 34.4 batches × 10 records with 1-second rate limiting
- **Complete Error Handling:** Failed upload tracking system (0 failures recorded)
- **Future-Ready Automation:** Single-command execution ready for scheduled runs
- **Code Quality Maintenance:** Followed all CLAUDE.md principles, no breaking changes
- **Performance Metrics:** ~35 seconds total processing time for 344 records
- **Data Integrity Verified:** All 37 Airtable fields properly mapped and validated
- **Clean Restoration:** Original uploader configuration restored, temporary files cleaned

### 2025-09-03 - Meeting Summary & Text Extraction Complete
- **Meeting Summary Generated:** Created comprehensive meeting summary for VAPI AI system development discussion
- **Multi-language Support:** Generated both Bulgarian and Russian text versions from HTML report
- **Strategic Documentation:** Captured technical decisions, business context, and action items from 39-minute session
- **MCP Integration Analysis:** Documented pros/cons of Model Control Protocol implementation for flexible data analysis
- **Quality Assessment System:** Outlined current QCI (Quality Call Index) workflow with OpenAI Assistant integration
- **Technical Architecture Review:** Documented complete tech stack from VAPI API to Airtable visualization
- **Action Items Prioritization:** Organized tasks by priority levels (high/medium/long-term research)
- **Success Metrics Definition:** Established KPIs for call quality, response time, and operational efficiency
- **Text Extraction Capability:** Demonstrated HTML-to-text conversion for documentation purposes

### 2025-09-03 - Airtable Integration Complete
- **Complete Data Upload:** All 2,268 VAPI calls uploaded to Airtable with full metadata
- **Assistant Name Mapping:** Readable assistant names (Riley, YC Assistant, QC Advisor) instead of IDs
- **Audio File Integration:** Direct links to MP3/WAV recordings for playback in Airtable
- **Comprehensive Data Structure:** 37 fields including costs, transcripts, duration, phone numbers
- **Automated Upload System:** Batch processing with error handling and retry functionality
- **Business Analytics Ready:** Cost breakdowns, success evaluations, and searchable transcripts
- **Duration Calculation:** Automatic computation from call start/end times
- **Transport Format Handling:** JSON object parsing for complex transport data
- **Failed Upload Recovery:** Automatic retry system for network errors
- **CSV Template Generation:** Easy table structure creation via import

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