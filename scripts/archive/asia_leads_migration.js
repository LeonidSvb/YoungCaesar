require('dotenv').config();

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const ASIA_LEADS_TABLE_ID = 'tblZ9idb5hYqqSZHf'; // ASIA Leads
const CLIENTS_TABLE_ID = 'tblYp2tPaY7Hoz9Pe'; // CLIENTS_MASTER
const CALLS_TABLE_ID = 'tblvXZt2zkkanjGdE'; // Calls - raw data

class AsiaLeadsMigrator {
    constructor() {
        this.batchSize = 10;
        this.processedCount = 0;
        this.linkedCount = 0;
        this.errors = [];
        this.callsData = new Map(); // Customer ID -> call info
    }

    async loadCallsData() {
        console.log('📊 Loading calls data for linking...');
        
        let offset = '';
        let totalCalls = 0;
        
        while (true) {
            const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${CALLS_TABLE_ID}?pageSize=100${offset ? `&offset=${offset}` : ''}`;
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch calls: ${response.status}`);
            }

            const data = await response.json();
            
            data.records.forEach(record => {
                const customerId = record.fields['Customer ID'];
                const assistantName = record.fields['Assistant Name'];
                const status = record.fields['Status'];
                const createdAt = record.fields['Created At'];
                const cost = record.fields['Cost'];
                const duration = record.fields['Duration (formatted)'];
                
                if (customerId) {
                    if (!this.callsData.has(customerId)) {
                        this.callsData.set(customerId, []);
                    }
                    
                    this.callsData.get(customerId).push({
                        callId: record.fields['Call ID'],
                        status,
                        createdAt,
                        cost: cost || 0,
                        duration,
                        assistantName
                    });
                }
            });
            
            totalCalls += data.records.length;
            
            if (!data.offset) break;
            offset = data.offset;
            
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        console.log(`✅ Loaded ${totalCalls} calls`);
        console.log(`📈 Found ${this.callsData.size} unique customers with calls`);
    }

    async getAllAsiaLeads() {
        console.log('📊 Fetching ASIA leads...');
        
        const records = [];
        let offset = '';
        
        while (true) {
            const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${ASIA_LEADS_TABLE_ID}?pageSize=100${offset ? `&offset=${offset}` : ''}`;
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch ASIA leads: ${response.status}`);
            }

            const data = await response.json();
            records.push(...data.records);
            
            if (!data.offset) break;
            offset = data.offset;
            
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        console.log(`✅ Found ${records.length} ASIA leads`);
        return records;
    }

    transformAsiaLead(record) {
        const fields = record.fields;
        
        // Extract name
        let name = fields['Name'] || 'Unknown';
        name = name.trim();
        
        // Extract phone
        let phone = fields['Number'] || '';
        phone = String(phone).trim();
        
        // Skip if no phone
        if (!phone || phone === '' || phone === 'N/A') {
            return null;
        }
        
        // Extract other fields
        const email = fields['EMAIL'] || '';
        const company = fields['WEBSITE/CO.'] || '';
        const keywords = fields['KEYWORD'] || '';
        const bdr = fields['BDR'] || '';
        const city = fields['City'] || '';
        const state = fields['State'] || '';
        const country = fields['Country'] || 'ASIA';
        const vapiId = fields['VAPIiD'] || '';
        const callStatus = fields['Call Status'] || 'Not Called';
        const lastCalled = fields['Last Called'] || '';
        const calls = fields['Calls'] || 0;
        
        // Check if this lead has calls (by VAPI ID = Customer ID)
        let callInfo = null;
        let actualCallStatus = callStatus;
        let totalCost = 0;
        let callCount = 0;
        let lastCallDate = lastCalled;
        
        if (vapiId && this.callsData.has(vapiId)) {
            callInfo = this.callsData.get(vapiId);
            callCount = callInfo.length;
            totalCost = callInfo.reduce((sum, call) => sum + (call.cost || 0), 0);
            
            // Get latest call date
            if (callInfo.length > 0) {
                const sortedCalls = callInfo.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                lastCallDate = sortedCalls[0].createdAt;
                actualCallStatus = 'Called';
            }
            
            this.linkedCount++;
        }
        
        return {
            fields: {
                'Name': name,
                'Phone': phone,
                'Email': email,
                'Company': company,
                'Market': 'ASIA',
                'Keywords': keywords,
                'BDR': bdr,
                'Call_Status': actualCallStatus,
                'VAPI_ID': vapiId,
                'Priority': 'Medium',
                'City': city,
                'Country': country
            },
            callInfo: callInfo,
            originalData: {
                calls: calls,
                lastCalled: lastCalled
            }
        };
    }

    async uploadBatch(records) {
        try {
            const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${CLIENTS_TABLE_ID}`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ records: records.map(r => ({ fields: r.fields })) })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
            }

            const result = await response.json();
            this.processedCount += records.length;
            
            console.log(`✅ Uploaded batch: ${records.length} records (Total: ${this.processedCount})`);
            
            return result;
        } catch (error) {
            console.error(`❌ Failed to upload batch:`, error.message);
            this.errors.push(`Batch upload failed: ${error.message}`);
            throw error;
        }
    }

    async migrateAsiaLeads() {
        console.log('🚀 Starting ASIA leads migration...\n');
        
        try {
            // Step 1: Load calls data for linking
            await this.loadCallsData();
            
            // Step 2: Get all ASIA leads
            const asiaLeads = await this.getAllAsiaLeads();
            
            // Step 3: Transform leads and link with calls
            console.log('\n🔄 Transforming leads and linking with calls...');
            const transformedLeads = asiaLeads
                .map(record => this.transformAsiaLead(record))
                .filter(record => record !== null);
            
            console.log(`📊 TRANSFORMATION RESULTS:`);
            console.log(`   Total ASIA leads: ${asiaLeads.length}`);
            console.log(`   Valid leads (with phone): ${transformedLeads.length}`);
            console.log(`   Leads with call history: ${this.linkedCount}`);
            console.log(`   Leads never called: ${transformedLeads.length - this.linkedCount}`);
            
            // Step 4: Upload in batches
            if (transformedLeads.length === 0) {
                console.log('❌ No valid leads to migrate!');
                return;
            }
            
            console.log(`\n📤 Uploading ${transformedLeads.length} leads in batches...`);
            
            for (let i = 0; i < transformedLeads.length; i += this.batchSize) {
                const batch = transformedLeads.slice(i, i + this.batchSize);
                
                try {
                    await this.uploadBatch(batch);
                    
                    // Rate limiting
                    if (i + this.batchSize < transformedLeads.length) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                    
                } catch (error) {
                    console.error(`❌ Batch ${Math.floor(i / this.batchSize) + 1} failed, continuing...`);
                    continue;
                }
            }
            
            // Step 5: Show linking statistics
            console.log(`\n📊 LINKING ANALYSIS:`);
            const leadsWithCalls = transformedLeads.filter(lead => lead.callInfo && lead.callInfo.length > 0);
            
            if (leadsWithCalls.length > 0) {
                console.log(`✅ Successfully linked ${leadsWithCalls.length} leads with their call history`);
                console.log('\nSample linked data:');
                
                leadsWithCalls.slice(0, 3).forEach((lead, index) => {
                    console.log(`${index + 1}. ${lead.fields.Name} (${lead.fields.Phone})`);
                    console.log(`   VAPI ID: ${lead.fields.VAPI_ID}`);
                    console.log(`   Calls: ${lead.callInfo.length}`);
                    lead.callInfo.forEach((call, i) => {
                        console.log(`     Call ${i + 1}: ${call.createdAt} - ${call.status} - $${call.cost}`);
                    });
                    console.log('');
                });
            }
            
            // Final summary
            console.log(`\n🎉 MIGRATION COMPLETED!`);
            console.log(`✅ Successfully migrated: ${this.processedCount} leads`);
            console.log(`🔗 Leads with call history: ${this.linkedCount}`);
            console.log(`📞 Leads never called: ${this.processedCount - this.linkedCount}`);
            console.log(`❌ Errors: ${this.errors.length}`);
            
            if (this.errors.length > 0) {
                console.log('\nErrors:');
                this.errors.forEach(error => console.log(`  - ${error}`));
            }
            
        } catch (error) {
            console.error('💥 Migration failed:', error.message);
            throw error;
        }
    }
}

if (require.main === module) {
    const migrator = new AsiaLeadsMigrator();
    migrator.migrateAsiaLeads().catch(console.error);
}

module.exports = AsiaLeadsMigrator;