require('dotenv').config();
const Airtable = require('airtable');
const fs = require('fs');
const path = require('path');

// Configure Airtable
const base = new Airtable({
    apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE_ID);

const table = base(process.env.AIRTABLE_TABLE_ID);

class AirtableUploader {
    constructor() {
        this.batchSize = 10; // Airtable allows max 10 records per batch
        this.uploadCount = 0;
        this.failedUploads = [];
        this.assistantMapping = this.loadAssistantMapping();
    }

    // Load assistant ID to name mapping
    loadAssistantMapping() {
        try {
            const mappingPath = path.join(__dirname, '../../data/processed/assistant_mapping.json');
            if (fs.existsSync(mappingPath)) {
                const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
                console.log(`✅ Loaded ${Object.keys(mapping).length} assistant names`);
                return mapping;
            }
        } catch (error) {
            console.log('⚠️  Could not load assistant mapping, using IDs only');
        }
        return {};
    }

    // Transform VAPI call data to Airtable format
    transformCallData(call) {
        // Calculate duration if not provided
        const duration = call.duration || this.calculateDuration(call.startedAt, call.endedAt);
        
        // Get assistant name from mapping
        const assistantInfo = this.assistantMapping[call.assistantId];
        const assistantName = assistantInfo?.name || 'Unknown Assistant';
        
        // Extract phone number from phoneCallProviderId or other sources
        const phoneNumber = call.phoneNumber || 
                          call.phoneCallProviderId || 
                          call.phoneNumberId || 
                          'N/A';

        return {
            fields: {
                'Call ID': call.id || 'N/A',
                'Phone': phoneNumber,
                'Cost': call.cost || 0,
                'Duration (seconds)': duration,
                'Duration (formatted)': this.formatDuration(duration),
                'Type': call.type || 'N/A',
                'Status': call.status || 'N/A',
                'End Reason': call.endedReason || 'N/A',
                'Created At': call.createdAt || 'N/A',
                'Started At': call.startedAt || 'N/A',
                'Ended At': call.endedAt || 'N/A',
                'Updated At': call.updatedAt || 'N/A',
                'Assistant ID': call.assistantId || 'N/A',
                'Assistant Name': assistantName,
                'Customer ID': call.customerId || 'N/A',
                'Phone Number ID': call.phoneNumberId || 'N/A',
                'Organization ID': call.orgId || 'N/A',
                'Phone Provider': call.phoneCallProvider || 'N/A',
                'Phone Provider ID': call.phoneCallProviderId || 'N/A',
                'Transport': this.formatTransport(call.phoneCallTransport || call.transport),
                'Transcript': call.transcript || 'N/A',
                'Summary': call.summary || 'N/A',
                'Recording URL': call.recordingUrl || 'N/A',
                'Stereo Recording URL': call.stereoRecordingUrl || 'N/A',
                'STT Cost': call.costBreakdown?.stt || 0,
                'LLM Cost': call.costBreakdown?.llm || 0,
                'TTS Cost': call.costBreakdown?.tts || 0,
                'VAPI Cost': call.costBreakdown?.vapi || 0,
                'Chat Cost': call.costBreakdown?.chat || 0,
                'Analysis Cost': call.costBreakdown?.analysisCostBreakdown?.summary || 0,
                'LLM Prompt Tokens': call.costBreakdown?.llmPromptTokens || 0,
                'LLM Completion Tokens': call.costBreakdown?.llmCompletionTokens || 0,
                'TTS Characters': call.costBreakdown?.ttsCharacters || 0,
                'Messages Count': call.messages?.length || 0,
                'First Message': call.messages?.[0]?.message || 'N/A',
                'Last Message': call.messages?.[call.messages?.length - 1]?.message || 'N/A',
                'Success Evaluation': call.analysis?.successEvaluation || 'N/A'
            }
        };
    }

    // Calculate duration from start and end times
    calculateDuration(startedAt, endedAt) {
        if (!startedAt || !endedAt) return 0;
        try {
            const start = new Date(startedAt);
            const end = new Date(endedAt);
            return Math.floor((end - start) / 1000); // Duration in seconds
        } catch (error) {
            return 0;
        }
    }

    // Format transport field (handle JSON objects)
    formatTransport(transport) {
        if (!transport) return 'N/A';
        if (typeof transport === 'string') return transport;
        if (typeof transport === 'object') {
            if (transport.provider) return transport.provider;
            return JSON.stringify(transport).slice(0, 100); // Truncate if too long
        }
        return 'N/A';
    }

    // Format duration from seconds to readable format
    formatDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    // Upload batch of records to Airtable
    async uploadBatch(records) {
        try {
            const result = await table.create(records);
            console.log(`✅ Successfully uploaded batch of ${records.length} records`);
            this.uploadCount += records.length;
            return result;
        } catch (error) {
            console.error(`❌ Failed to upload batch:`, error.message);
            this.failedUploads.push(...records);
            throw error;
        }
    }

    // Process all calls from the data file
    async uploadAllCalls() {
        try {
            console.log('🚀 Starting Airtable upload process...');
            
            // Read the raw calls data
            const dataPath = path.join(__dirname, '../../data/raw/vapi_raw_calls_2025-09-03.json');
            
            if (!fs.existsSync(dataPath)) {
                throw new Error(`Data file not found: ${dataPath}`);
            }

            console.log('📖 Loading call data...');
            const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
            
            // Extract all calls from all dates
            let allCalls = [];
            rawData.forEach(dateEntry => {
                if (dateEntry.calls && Array.isArray(dateEntry.calls)) {
                    allCalls = allCalls.concat(dateEntry.calls);
                }
            });

            console.log(`📊 Found ${allCalls.length} total calls to upload`);

            if (allCalls.length === 0) {
                console.log('⚠️  No calls found to upload');
                return;
            }

            // Transform all calls
            console.log('🔄 Transforming call data...');
            const transformedCalls = allCalls.map(call => this.transformCallData(call));

            // Upload in batches
            console.log(`📤 Uploading in batches of ${this.batchSize}...`);
            
            for (let i = 0; i < transformedCalls.length; i += this.batchSize) {
                const batch = transformedCalls.slice(i, i + this.batchSize);
                
                try {
                    await this.uploadBatch(batch);
                    console.log(`📈 Progress: ${Math.min(i + this.batchSize, transformedCalls.length)}/${transformedCalls.length} calls uploaded`);
                    
                    // Add delay between batches to respect rate limits
                    if (i + this.batchSize < transformedCalls.length) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                } catch (error) {
                    console.error(`❌ Batch ${Math.floor(i / this.batchSize) + 1} failed:`, error.message);
                    // Continue with next batch
                    continue;
                }
            }

            // Summary
            console.log('\n📋 UPLOAD SUMMARY');
            console.log('==================');
            console.log(`✅ Successfully uploaded: ${this.uploadCount} calls`);
            console.log(`❌ Failed uploads: ${this.failedUploads.length} calls`);
            console.log(`📊 Total processed: ${allCalls.length} calls`);
            
            if (this.failedUploads.length > 0) {
                // Save failed uploads for retry
                const failedPath = path.join(__dirname, '../../data/failed_uploads.json');
                fs.writeFileSync(failedPath, JSON.stringify(this.failedUploads, null, 2));
                console.log(`💾 Failed uploads saved to: ${failedPath}`);
            }

            console.log('\n🎉 Upload process completed!');
            
        } catch (error) {
            console.error('💥 Upload process failed:', error.message);
            throw error;
        }
    }

    // Retry failed uploads
    async retryFailedUploads() {
        const failedPath = path.join(__dirname, '../../data/failed_uploads.json');
        
        if (!fs.existsSync(failedPath)) {
            console.log('📝 No failed uploads file found');
            return;
        }

        console.log('🔄 Retrying failed uploads...');
        const failedUploads = JSON.parse(fs.readFileSync(failedPath, 'utf8'));
        
        this.failedUploads = [];
        this.uploadCount = 0;

        for (let i = 0; i < failedUploads.length; i += this.batchSize) {
            const batch = failedUploads.slice(i, i + this.batchSize);
            
            try {
                await this.uploadBatch(batch);
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`❌ Retry batch failed:`, error.message);
                continue;
            }
        }

        console.log(`🔄 Retry completed. Successfully uploaded: ${this.uploadCount} calls`);
    }

    // Clear all records from table (use with caution!)
    async clearTable() {
        try {
            console.log('⚠️  Clearing all records from Airtable...');
            
            const records = await table.select().all();
            console.log(`🗑️  Found ${records.length} records to delete`);

            if (records.length === 0) {
                console.log('✅ Table is already empty');
                return;
            }

            // Delete in batches of 10
            for (let i = 0; i < records.length; i += 10) {
                const batch = records.slice(i, i + 10);
                const recordIds = batch.map(record => record.id);
                
                await table.destroy(recordIds);
                console.log(`🗑️  Deleted ${Math.min(i + 10, records.length)}/${records.length} records`);
                
                // Delay between batches
                if (i + 10 < records.length) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            console.log('✅ All records cleared from table');
        } catch (error) {
            console.error('❌ Failed to clear table:', error.message);
            throw error;
        }
    }
}

// CLI interface
if (require.main === module) {
    const uploader = new AirtableUploader();
    const command = process.argv[2];

    switch (command) {
        case 'upload':
            uploader.uploadAllCalls().catch(console.error);
            break;
        case 'retry':
            uploader.retryFailedUploads().catch(console.error);
            break;
        case 'clear':
            uploader.clearTable().catch(console.error);
            break;
        default:
            console.log('Usage:');
            console.log('  node airtable_uploader.js upload   - Upload all calls to Airtable');
            console.log('  node airtable_uploader.js retry    - Retry failed uploads');
            console.log('  node airtable_uploader.js clear    - Clear all records from table');
    }
}

module.exports = AirtableUploader;