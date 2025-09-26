require('dotenv').config();
const Airtable = require('airtable');
const fs = require('fs');
const path = require('path');

class AirtableClient {
    constructor() {
        this.base = new Airtable({
            apiKey: process.env.AIRTABLE_API_KEY
        }).base(process.env.AIRTABLE_BASE_ID);
        
        this.batchSize = 10;
        this.assistantMapping = this.loadAssistantMapping();
    }

    loadAssistantMapping() {
        try {
            const mappingPath = path.join(__dirname, '../../data/processed/assistant_mapping.json');
            if (fs.existsSync(mappingPath)) {
                const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
                console.log(`✅ Loaded ${Object.keys(mapping).length} assistant names`);
                return mapping;
            }
        } catch (error) {
            console.log('⚠️ Could not load assistant mapping, using IDs only');
        }
        return {};
    }

    async getAllRecords(tableName) {
        try {
            const table = this.base(tableName);
            const records = [];
            
            await table.select().eachPage((pageRecords, fetchNextPage) => {
                records.push(...pageRecords);
                fetchNextPage();
            });
            
            console.log(`✅ Retrieved ${records.length} records from ${tableName}`);
            return records;
            
        } catch (error) {
            console.error(`❌ Error getting records from ${tableName}: ${error.message}`);
            throw error;
        }
    }

    async updateRecord(tableName, recordId, fields) {
        try {
            const table = this.base(tableName);
            const updatedRecord = await table.update(recordId, fields);
            return updatedRecord;
        } catch (error) {
            console.error(`❌ Error updating record ${recordId}: ${error.message}`);
            throw error;
        }
    }

    async getRecord(tableName, recordId) {
        try {
            const table = this.base(tableName);
            const record = await table.find(recordId);
            return record;
        } catch (error) {
            console.error(`❌ Error getting record ${recordId}: ${error.message}`);
            throw error;
        }
    }

    async countRecords(tableName) {
        try {
            const records = await this.getAllRecords(tableName);
            return records.length;
        } catch (error) {
            console.error(`❌ Error counting records: ${error.message}`);
            return 0;
        }
    }

    async uploadBatch(tableName, records) {
        try {
            const table = this.base(tableName);
            const transformedRecords = records.map(record => this.transformCallData(record));
            
            const batches = [];
            for (let i = 0; i < transformedRecords.length; i += this.batchSize) {
                batches.push(transformedRecords.slice(i, i + this.batchSize));
            }

            let totalUploaded = 0;
            const failedUploads = [];

            for (let i = 0; i < batches.length; i++) {
                try {
                    console.log(`📤 Uploading batch ${i + 1}/${batches.length} (${batches[i].length} records)`);
                    
                    const result = await table.create(batches[i]);
                    totalUploaded += result.length;
                    
                    await new Promise(resolve => setTimeout(resolve, 250));
                    
                } catch (error) {
                    console.error(`❌ Batch ${i + 1} failed: ${error.message}`);
                    failedUploads.push({ batch: i + 1, error: error.message, records: batches[i] });
                }
            }

            console.log(`✅ Successfully uploaded ${totalUploaded}/${transformedRecords.length} records`);
            
            return {
                success: totalUploaded,
                total: transformedRecords.length,
                failed: failedUploads
            };

        } catch (error) {
            console.error(`❌ Upload error: ${error.message}`);
            throw error;
        }
    }

    async linkTables(sourceTable, targetTable, sourceField, targetField) {
        try {
            console.log(`🔗 Linking ${sourceTable} to ${targetTable}`);
            
            const sourceRecords = await this.getAllRecords(sourceTable);
            const targetRecords = await this.getAllRecords(targetTable);
            
            const targetMap = new Map();
            targetRecords.forEach(record => {
                const key = record.get(targetField);
                if (key) targetMap.set(key, record.id);
            });

            let linkedCount = 0;
            const updates = [];

            sourceRecords.forEach(record => {
                const sourceValue = record.get(sourceField);
                const targetId = targetMap.get(sourceValue);
                
                if (targetId) {
                    updates.push({
                        id: record.id,
                        fields: {
                            [targetTable]: [targetId]
                        }
                    });
                    linkedCount++;
                }
            });

            if (updates.length > 0) {
                const batches = [];
                for (let i = 0; i < updates.length; i += this.batchSize) {
                    batches.push(updates.slice(i, i + this.batchSize));
                }

                for (const batch of batches) {
                    await this.base(sourceTable).update(batch);
                    await new Promise(resolve => setTimeout(resolve, 250));
                }
            }

            console.log(`✅ Linked ${linkedCount} records`);
            return linkedCount;

        } catch (error) {
            console.error(`❌ Linking error: ${error.message}`);
            throw error;
        }
    }

    transformCallData(call) {
        const duration = call.duration || this.calculateDuration(call.startedAt, call.endedAt);
        const assistantInfo = this.assistantMapping[call.assistantId];
        const assistantName = assistantInfo?.name || 'Unknown Assistant';
        const phoneNumber = call.phoneNumber || call.phoneCallProviderId || call.phoneNumberId || 'N/A';

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

    calculateDuration(startedAt, endedAt) {
        if (!startedAt || !endedAt) return 0;
        try {
            const start = new Date(startedAt);
            const end = new Date(endedAt);
            return Math.floor((end - start) / 1000);
        } catch (error) {
            return 0;
        }
    }

    formatDuration(seconds) {
        if (!seconds || seconds <= 0) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    formatTransport(transport) {
        if (!transport) return 'N/A';
        if (typeof transport === 'object') {
            return JSON.stringify(transport);
        }
        return transport.toString();
    }

    async removeDuplicates(tableName, fieldName) {
        try {
            console.log(`🔍 Checking for duplicates in ${tableName} by ${fieldName}`);
            
            const records = await this.getAllRecords(tableName);
            const seen = new Map();
            const duplicates = [];

            records.forEach(record => {
                const value = record.get(fieldName);
                if (seen.has(value)) {
                    duplicates.push(record.id);
                } else {
                    seen.set(value, record.id);
                }
            });

            if (duplicates.length > 0) {
                console.log(`⚠️ Found ${duplicates.length} duplicates, removing...`);
                
                const batches = [];
                for (let i = 0; i < duplicates.length; i += this.batchSize) {
                    batches.push(duplicates.slice(i, i + this.batchSize));
                }

                for (const batch of batches) {
                    await this.base(tableName).destroy(batch);
                    await new Promise(resolve => setTimeout(resolve, 250));
                }

                console.log(`✅ Removed ${duplicates.length} duplicate records`);
            } else {
                console.log(`✅ No duplicates found`);
            }

            return duplicates.length;

        } catch (error) {
            console.error(`❌ Error removing duplicates: ${error.message}`);
            throw error;
        }
    }
}

module.exports = AirtableClient;