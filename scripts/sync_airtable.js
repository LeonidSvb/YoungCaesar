const AirtableClient = require('./api/airtable_client');
const DataUtils = require('./utils/data_utils');
const Logger = require('./utils/logger');
const fs = require('fs');
const path = require('path');

const logger = new Logger('airtable_sync.log');

async function syncToAirtable(dataSource, tableName = null) {
    try {
        logger.info('Starting Airtable synchronization');
        
        const airtableClient = new AirtableClient();
        const targetTable = tableName || process.env.AIRTABLE_TABLE_ID || 'VAPI_Calls';
        
        // Load data based on source type
        let callsData = [];
        
        if (typeof dataSource === 'string') {
            // File path provided
            if (fs.existsSync(dataSource)) {
                const rawData = JSON.parse(fs.readFileSync(dataSource, 'utf8'));
                callsData = Array.isArray(rawData) ? rawData : [rawData];
            } else {
                throw new Error(`File not found: ${dataSource}`);
            }
        } else if (Array.isArray(dataSource)) {
            // Data array provided directly
            callsData = dataSource;
        } else {
            // Auto-detect latest file
            const latestFile = await DataUtils.findLatestFile('data/raw', 'vapi_raw_calls');
            if (!latestFile) {
                throw new Error('No VAPI data files found in data/raw/');
            }
            
            logger.info(`Using latest data file: ${path.basename(latestFile)}`);
            const rawData = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
            callsData = Array.isArray(rawData) ? rawData : [rawData];
        }

        if (callsData.length === 0) {
            logger.warning('No calls data to upload');
            return { success: 0, total: 0, failed: [] };
        }

        // Validate data
        const validCalls = callsData.filter(call => {
            const validation = DataUtils.validateCallData(call);
            if (!validation.isValid) {
                logger.warning(`Invalid call data: missing ${validation.missing.join(', ')}`);
            }
            return validation.isValid;
        });

        logger.info(`Validated ${validCalls.length}/${callsData.length} calls`);

        // Check existing records to avoid duplicates
        const existingRecords = await airtableClient.getAllRecords(targetTable);
        const existingCallIds = new Set(existingRecords.map(record => record.get('Call ID')));
        
        const newCalls = validCalls.filter(call => !existingCallIds.has(call.id));
        
        if (newCalls.length === 0) {
            logger.info('All calls already exist in Airtable - no new data to upload');
            return { success: 0, total: validCalls.length, failed: [], alreadyExists: validCalls.length };
        }

        logger.info(`Found ${newCalls.length} new calls to upload (${validCalls.length - newCalls.length} already exist)`);

        // Upload in batches
        const result = await airtableClient.uploadBatch(targetTable, newCalls);
        
        // Save failed uploads for retry
        if (result.failed.length > 0) {
            const timestamp = DataUtils.generateTimestamp();
            await DataUtils.saveJsonData(result.failed, `failed_uploads_${timestamp}.json`);
            logger.warning(`Saved ${result.failed.length} failed uploads for retry`);
        }

        logger.success(`Airtable sync completed!`);
        logger.info(`Successfully uploaded: ${result.success}/${result.total} calls`);
        logger.info(`Already existed: ${validCalls.length - newCalls.length} calls`);
        
        if (result.failed.length > 0) {
            logger.warning(`Failed uploads: ${result.failed.length}`);
        }

        return {
            success: result.success,
            total: result.total,
            failed: result.failed,
            alreadyExists: validCalls.length - newCalls.length,
            newUploaded: result.success
        };

    } catch (error) {
        logger.error('Airtable synchronization failed', error);
        throw error;
    }
}

async function linkCallsToClients(callsTable = 'VAPI_Calls', clientsTable = 'CLIENTS_MASTER') {
    try {
        logger.info(`Linking ${callsTable} to ${clientsTable}`);
        
        const airtableClient = new AirtableClient();
        const linkedCount = await airtableClient.linkTables(callsTable, clientsTable, 'Customer ID', 'Customer ID');
        
        logger.success(`Successfully linked ${linkedCount} calls to clients`);
        return linkedCount;

    } catch (error) {
        logger.error('Table linking failed', error);
        throw error;
    }
}

async function removeDuplicateCalls(tableName = null) {
    try {
        const airtableClient = new AirtableClient();
        const targetTable = tableName || process.env.AIRTABLE_TABLE_ID || 'VAPI_Calls';
        
        const removedCount = await airtableClient.removeDuplicates(targetTable, 'Call ID');
        
        logger.success(`Removed ${removedCount} duplicate calls`);
        return removedCount;

    } catch (error) {
        logger.error('Duplicate removal failed', error);
        throw error;
    }
}

// Command line usage
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];
    
    switch (command) {
        case 'upload':
            const dataFile = args[1];
            const tableName = args[2];
            
            syncToAirtable(dataFile, tableName)
                .then(result => {
                    console.log('✅ Upload completed:', result);
                    process.exit(0);
                })
                .catch(error => {
                    console.error('❌ Upload failed:', error.message);
                    process.exit(1);
                });
            break;

        case 'link':
            const callsTable = args[1] || 'VAPI_Calls';
            const clientsTable = args[2] || 'CLIENTS_MASTER';
            
            linkCallsToClients(callsTable, clientsTable)
                .then(count => {
                    console.log(`✅ Linked ${count} records`);
                    process.exit(0);
                })
                .catch(error => {
                    console.error('❌ Linking failed:', error.message);
                    process.exit(1);
                });
            break;

        case 'dedupe':
            const dedupeTable = args[1];
            
            removeDuplicateCalls(dedupeTable)
                .then(count => {
                    console.log(`✅ Removed ${count} duplicates`);
                    process.exit(0);
                })
                .catch(error => {
                    console.error('❌ Deduplication failed:', error.message);
                    process.exit(1);
                });
            break;

        default:
            console.log('Usage:');
            console.log('  node sync_airtable.js upload [file] [table]     - Upload data to Airtable');
            console.log('  node sync_airtable.js link [calls-table] [clients-table] - Link tables');
            console.log('  node sync_airtable.js dedupe [table]            - Remove duplicates');
            console.log('\nExamples:');
            console.log('  node sync_airtable.js upload                    - Upload latest data');
            console.log('  node sync_airtable.js upload data.json CALLS    - Upload specific file');
            console.log('  node sync_airtable.js link                      - Link with default tables');
            process.exit(1);
    }
}

module.exports = {
    syncToAirtable,
    linkCallsToClients,
    removeDuplicateCalls
};