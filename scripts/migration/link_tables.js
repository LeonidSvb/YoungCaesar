require('dotenv').config();

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const CALLS_TABLE_ID = 'tblvXZt2zkkanjGdE'; // Calls - raw data
const CLIENTS_TABLE_ID = 'tblYp2tPaY7Hoz9Pe'; // CLIENTS_MASTER

class TableLinker {
    constructor() {
        this.batchSize = 10; // Airtable API limit for PATCH operations
        this.linkedCount = 0;
        this.notFoundCount = 0;
        this.errors = [];
        this.clientsMap = new Map(); // VAPI_ID -> Airtable Record ID
    }

    async loadClientsMapping() {
        console.log('📊 Loading CLIENTS_MASTER mapping...');
        
        let offset = '';
        let totalClients = 0;
        
        while (true) {
            const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${CLIENTS_TABLE_ID}?pageSize=100${offset ? `&offset=${offset}` : ''}`;
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch clients: ${response.status}`);
            }

            const data = await response.json();
            
            data.records.forEach(record => {
                const vapiId = record.fields['VAPI_ID'];
                if (vapiId) {
                    this.clientsMap.set(vapiId, record.id);
                }
            });
            
            totalClients += data.records.length;
            
            if (!data.offset) break;
            offset = data.offset;
            
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        console.log(`✅ Loaded ${totalClients} clients`);
        console.log(`🆔 Found ${this.clientsMap.size} clients with VAPI_ID`);
    }

    async getAllCalls() {
        console.log('📊 Loading all calls...');
        
        const calls = [];
        let offset = '';
        
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
            calls.push(...data.records);
            
            if (!data.offset) break;
            offset = data.offset;
            
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        console.log(`✅ Found ${calls.length} call records`);
        return calls;
    }

    async addClientLinkField() {
        console.log('🔗 Adding Client link field to Calls table...');
        
        // First, let's check if the field already exists
        const metaUrl = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`;
        
        const metaResponse = await fetch(metaUrl, {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const metaData = await metaResponse.json();
        const callsTable = metaData.tables.find(t => t.id === CALLS_TABLE_ID);
        
        if (!callsTable) {
            throw new Error('Calls table not found in meta data');
        }

        // Check if Client field already exists
        const existingClientField = callsTable.fields.find(f => f.name === 'Client');
        
        if (existingClientField) {
            console.log('✅ Client link field already exists');
            return existingClientField.id;
        }

        console.log('📝 Client link field not found. You need to add it manually:');
        console.log('1. Go to Calls table in Airtable');
        console.log('2. Add new field called "Client"');
        console.log('3. Set type to "Link to another record"');
        console.log(`4. Link to table: CLIENTS_MASTER (${CLIENTS_TABLE_ID})`);
        console.log('5. Run this script again after adding the field');
        
        throw new Error('Please add Client link field manually first');
    }

    async updateCallsWithClientLinks(calls) {
        console.log('🔄 Linking calls to clients...');
        
        const callsToUpdate = [];
        
        calls.forEach(call => {
            const customerId = call.fields['Customer ID'];
            
            if (customerId && this.clientsMap.has(customerId)) {
                const clientRecordId = this.clientsMap.get(customerId);
                
                callsToUpdate.push({
                    id: call.id,
                    fields: {
                        'Client': [clientRecordId] // Link field expects array
                    }
                });
                
                this.linkedCount++;
            } else if (customerId) {
                this.notFoundCount++;
            }
        });
        
        console.log(`📊 LINKING ANALYSIS:`);
        console.log(`   Calls with Customer ID: ${calls.filter(c => c.fields['Customer ID']).length}`);
        console.log(`   Calls to be linked: ${callsToUpdate.length}`);
        console.log(`   Clients not found: ${this.notFoundCount}`);
        
        if (callsToUpdate.length === 0) {
            console.log('❌ No calls to link!');
            return;
        }

        // Update in batches
        console.log(`📤 Updating calls in batches of ${this.batchSize}...`);
        
        let updated = 0;
        
        for (let i = 0; i < callsToUpdate.length; i += this.batchSize) {
            const batch = callsToUpdate.slice(i, i + this.batchSize);
            
            try {
                await this.updateBatch(batch);
                updated += batch.length;
                
                console.log(`✅ Updated batch: ${batch.length} calls (Total: ${updated}/${callsToUpdate.length})`);
                
                // Rate limiting
                if (i + this.batchSize < callsToUpdate.length) {
                    await new Promise(resolve => setTimeout(resolve, 250)); // 4 requests per second
                }
                
            } catch (error) {
                console.error(`❌ Batch ${Math.floor(i / this.batchSize) + 1} failed:`, error.message);
                this.errors.push(`Batch update failed: ${error.message}`);
                continue;
            }
        }
        
        return updated;
    }

    async updateBatch(batch) {
        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${CALLS_TABLE_ID}`;
        
        const response = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ records: batch })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
        }

        return await response.json();
    }

    async linkTables() {
        console.log('🚀 Starting table linking process...\n');
        
        try {
            // Step 1: Load clients mapping
            await this.loadClientsMapping();
            
            // Step 2: Check if Client field exists (or guide user to add it)
            await this.addClientLinkField();
            
            // Step 3: Get all calls
            const calls = await this.getAllCalls();
            
            // Step 4: Update calls with client links
            const updated = await this.updateCallsWithClientLinks(calls);
            
            // Final summary
            console.log(`\n🎉 LINKING COMPLETED!`);
            console.log(`✅ Successfully linked: ${updated || this.linkedCount} calls`);
            console.log(`❌ Clients not found: ${this.notFoundCount}`);
            console.log(`⚠️ Errors: ${this.errors.length}`);
            
            if (this.errors.length > 0) {
                console.log('\nErrors:');
                this.errors.forEach(error => console.log(`  - ${error}`));
            }
            
            console.log('\n🔗 Now each call is linked to its client in CLIENTS_MASTER!');
            console.log('📊 You can see call history in the Client records');
            
        } catch (error) {
            console.error('💥 Linking failed:', error.message);
            
            if (error.message.includes('add Client link field')) {
                console.log('\n📝 MANUAL STEP REQUIRED:');
                console.log('Add "Client" link field to Calls table first, then run again');
            }
        }
    }

    // Helper method to check current linking status
    async checkLinkingStatus() {
        console.log('🔍 CHECKING CURRENT LINKING STATUS');
        console.log('===================================\n');
        
        const calls = await this.getAllCalls();
        const callsWithClientField = calls.filter(call => call.fields['Client']);
        const callsWithCustomerId = calls.filter(call => call.fields['Customer ID']);
        
        console.log(`📊 CURRENT STATUS:`);
        console.log(`   Total calls: ${calls.length}`);
        console.log(`   Calls with Customer ID: ${callsWithCustomerId.length}`);
        console.log(`   Calls with Client link: ${callsWithClientField.length}`);
        console.log(`   Calls needing linking: ${callsWithCustomerId.length - callsWithClientField.length}`);
        
        if (callsWithClientField.length > 0) {
            console.log('\n✅ Some calls are already linked!');
        } else {
            console.log('\n❌ No calls are linked yet');
        }
    }
}

// CLI interface
if (require.main === module) {
    const linker = new TableLinker();
    const command = process.argv[2];

    switch (command) {
        case 'status':
            linker.checkLinkingStatus().catch(console.error);
            break;
        case 'link':
            linker.linkTables().catch(console.error);
            break;
        default:
            console.log('Usage:');
            console.log('  node link_tables.js status - Check current linking status');
            console.log('  node link_tables.js link   - Link tables together');
    }
}

module.exports = TableLinker;