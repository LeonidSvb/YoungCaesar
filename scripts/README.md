# VAPI Scripts - Optimized Structure

## Main Scripts (Use These)

### Data Collection
```bash
# Collect all VAPI calls for date range
node collect_vapi_data.js 2025-09-01 2025-09-10
```

### Airtable Synchronization
```bash
# Upload latest data to Airtable
node sync_airtable.js upload

# Upload specific file
node sync_airtable.js upload data/raw/vapi_calls.json

# Link calls to clients
node sync_airtable.js link

# Remove duplicate records
node sync_airtable.js dedupe
```

## API Clients

### VAPI Client
```javascript
const { VapiClient } = require('./api');

const vapi = new VapiClient();
const calls = await vapi.getAllCalls('2025-09-01', '2025-09-10');
const assistants = await vapi.getAssistants();
```

### Airtable Client
```javascript
const { AirtableClient } = require('./api');

const airtable = new AirtableClient();
await airtable.uploadBatch('VAPI_Calls', callsData);
await airtable.linkTables('VAPI_Calls', 'CLIENTS_MASTER', 'Customer ID', 'Customer ID');
const count = await airtable.countRecords('VAPI_Calls');
```

## Utilities

### Data Utils
```javascript
const { DataUtils } = require('./api');

await DataUtils.saveJsonData(data, 'filename.json');
const data = await DataUtils.loadJsonData('filename.json');
const backup = await DataUtils.createBackup('important_file.json');
```

### Logger
```javascript
const { Logger } = require('./api');

const logger = new Logger('my-script.log');
logger.info('Process started');
logger.success('Operation completed');
logger.error('Something failed', error);
logger.progress(50, 100, 'Processing');
```

## Directory Structure

```
scripts/
├── api/                    # Reusable API clients
│   ├── vapi_client.js     # All VAPI operations
│   ├── airtable_client.js # All Airtable operations
│   └── index.js           # Export all APIs
├── utils/                 # Utility functions
│   ├── data_utils.js      # File operations, formatting
│   └── logger.js          # Logging and progress tracking
├── collection/           # Legacy data collection (keep for reference)
├── upload/               # Legacy upload scripts (keep for reference)
├── migration/            # Table migration scripts (keep for reference)
├── analysis/             # Data analysis tools (keep for reference)
├── debug/                # Debug utilities (keep for reference)
├── archive/              # Moved obsolete scripts
├── collect_vapi_data.js  # Main data collection script
├── sync_airtable.js      # Main Airtable sync script
└── README.md            # This file
```

## Key Improvements

1. **DRY Principle**: No duplicate code - all API logic in reusable clients
2. **Clean Structure**: Clear separation of concerns
3. **Environment Variables**: All API keys from .env file
4. **Error Handling**: Comprehensive error logging and recovery
5. **Batch Processing**: Optimized for large datasets
6. **Progress Tracking**: Visual progress indicators
7. **Data Validation**: Input validation before processing
8. **Backup System**: Automatic backups before destructive operations

## Migration from Old Scripts

**Old → New Usage:**

```bash
# OLD: node scripts/collection/vapi_all_calls_collector.js
# NEW: node scripts/collect_vapi_data.js 2025-09-01 2025-09-10

# OLD: node scripts/upload/airtable_uploader.js
# NEW: node scripts/sync_airtable.js upload

# OLD: node scripts/migration/link_tables.js
# NEW: node scripts/sync_airtable.js link
```

## Configuration

All scripts use environment variables from `.env`:
- `VAPI_API_KEY`
- `AIRTABLE_API_KEY`
- `AIRTABLE_BASE_ID`
- `AIRTABLE_TABLE_ID`
- `DEBUG=true` (for debug logging)

## Logs

All operations are logged to `logs/` directory:
- `logs/vapi_collection.log`
- `logs/airtable_sync.log`
- `logs/app.log` (default)