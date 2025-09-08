require('dotenv').config();

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const CLIENTS_TABLE_ID = 'tblYp2tPaY7Hoz9Pe'; // CLIENTS_MASTER
const CALLS_TABLE_ID = 'tblvXZt2zkkanjGdE'; // Calls - raw data

class AllRegionsMigrator {
    constructor() {
        this.leadTables = {
            'USA_Leads': 'tblVSTLFdPSYjWQ89',
            'EU_Leads': 'tblhkE3kg4Pitcua6', 
            'QC_Advisor': 'tblg7fw9sseuGw1pr',
            'OEM_Table': 'tbleWG18EdYCz7V1m',
            'E164_YC': 'tblLmWcITpAZdKhs2',
            'E164_Biesse': 'tblZ0UPX8U6E081yC',
            'E164_QC': 'tblQvINW9Gr83ogfc'
        };
        
        this.batchSize = 10;
        this.processedCount = 0;
        this.linkedCount = 0;
        this.errors = [];
        this.callsData = new Map(); // Customer ID -> call info
    }

    async loadCallsData() {
        console.log('📊 Loading all calls data...');
        
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
                
                if (customerId) {
                    if (!this.callsData.has(customerId)) {
                        this.callsData.set(customerId, []);
                    }
                    
                    this.callsData.get(customerId).push({
                        callId: record.fields['Call ID'],
                        status: record.fields['Status'],
                        createdAt: record.fields['Created At'],
                        cost: record.fields['Cost'] || 0,
                        duration: record.fields['Duration (formatted)'],
                        assistantName: record.fields['Assistant Name'],
                        phone: record.fields['Phone']
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
        
        return this.callsData;
    }

    async getAllLeadsFromTable(tableId, tableName) {
        console.log(`📊 Fetching ${tableName}...`);
        
        const records = [];
        let offset = '';
        
        while (true) {
            try {
                const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}?pageSize=100${offset ? `&offset=${offset}` : ''}`;
                
                const response = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error(`Failed to fetch ${tableName}: ${response.status}`);
                }

                const data = await response.json();
                records.push(...data.records);
                
                if (!data.offset) break;
                offset = data.offset;
                
                await new Promise(resolve => setTimeout(resolve, 200));
                
            } catch (error) {
                console.error(`❌ Error fetching ${tableName}:`, error.message);
                this.errors.push(`${tableName}: ${error.message}`);
                break;
            }
        }
        
        console.log(`✅ ${tableName}: ${records.length} records`);
        return { tableName, records };
    }

    transformLead(record, sourceName) {
        const fields = record.fields;
        
        // Extract name (handle different field names)
        let name = fields['Name'] || fields['Person First name'] || 'Unknown';
        if (fields['Person Last name']) {
            name += ' ' + fields['Person Last name'];
        }
        name = name.trim();
        
        // Extract phone
        let phone = fields['Number'] || fields['Phone'] || fields['Person Phone'] || '';
        if (typeof phone === 'object' && phone.length) phone = phone[0];
        phone = String(phone).trim();
        
        // Skip if no phone
        if (!phone || phone === '' || phone === 'N/A') {
            return null;
        }
        
        // Extract other fields
        const email = fields['EMAIL'] || fields['Person Email'] || fields['Email'] || '';
        const company = fields['Company'] || fields['WEBSITE/CO.'] || fields['WEBSITE'] || '';
        const keywords = fields['KEYWORD'] || fields['Keywords'] || fields['KEYWORDS'] || '';
        const bdr = fields['BDR'] || '';
        const city = fields['City'] || '';
        const country = fields['Country'] || '';
        const vapiId = fields['VAPIiD'] || fields['VAPI_ID'] || '';
        const callStatus = fields['Call Status'] || 'Not Called';
        
        // Determine market
        let market = fields['MARKET'] || country;
        if (sourceName.includes('USA')) market = 'USA';
        else if (sourceName.includes('EU')) market = 'EU';
        else if (sourceName.includes('ASIA')) market = 'ASIA';
        else if (sourceName.includes('QC')) market = 'QC';
        else if (sourceName.includes('OEM')) market = 'OEM';
        else if (sourceName.includes('E164')) market = 'E164';
        
        // Check if this lead has calls
        let actualCallStatus = callStatus;
        let callCount = 0;
        
        if (vapiId && this.callsData.has(vapiId)) {
            const callInfo = this.callsData.get(vapiId);
            callCount = callInfo.length;
            if (callCount > 0) {
                actualCallStatus = 'Called';
                this.linkedCount++;
            }
        }
        
        return {
            fields: {
                'Name': name,
                'Phone': phone,
                'Email': email || '',
                'Company': company,
                'Market': market,
                'Keywords': keywords,
                'BDR': bdr,
                'Call_Status': actualCallStatus,
                'VAPI_ID': vapiId,
                'Priority': 'Medium',
                'City': city,
                'Country': country
            },
            hasCallHistory: callCount > 0,
            callCount: callCount
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

    async migrateAllRegions() {
        console.log('🚀 Starting ALL REGIONS migration...\n');
        
        try {
            // Step 1: Load calls data for linking
            await this.loadCallsData();
            
            // Step 2: Process each lead table
            let allTransformedRecords = [];
            let totalOriginalRecords = 0;
            const tableStats = {};
            
            for (const [tableName, tableId] of Object.entries(this.leadTables)) {
                try {
                    const tableData = await this.getAllLeadsFromTable(tableId, tableName);
                    
                    const transformedRecords = tableData.records
                        .map(record => this.transformLead(record, tableName))
                        .filter(record => record !== null);
                    
                    const recordsWithCalls = transformedRecords.filter(r => r.hasCallHistory);
                    
                    tableStats[tableName] = {
                        total: tableData.records.length,
                        valid: transformedRecords.length,
                        withCalls: recordsWithCalls.length
                    };
                    
                    console.log(`🔄 ${tableName}:`);
                    console.log(`   Total: ${tableData.records.length}`);
                    console.log(`   Valid: ${transformedRecords.length}`);  
                    console.log(`   With calls: ${recordsWithCalls.length}`);
                    console.log('');
                    
                    allTransformedRecords = allTransformedRecords.concat(transformedRecords);
                    totalOriginalRecords += tableData.records.length;
                    
                } catch (error) {
                    console.error(`❌ Error processing ${tableName}:`, error.message);
                    continue;
                }
            }
            
            console.log(`\n📊 MIGRATION SUMMARY:`);
            console.log(`Total original records: ${totalOriginalRecords}`);
            console.log(`Valid records to migrate: ${allTransformedRecords.length}`);
            console.log(`Records with call history: ${this.linkedCount}`);
            
            console.log('\n📋 BY TABLE:');
            Object.keys(tableStats).forEach(tableName => {
                const stats = tableStats[tableName];
                console.log(`${tableName}: ${stats.total} → ${stats.valid} (${stats.withCalls} with calls)`);
            });
            
            if (allTransformedRecords.length === 0) {
                console.log('❌ No records to migrate!');
                return;
            }
            
            // Step 3: Upload in batches
            console.log(`\n📤 Uploading ${allTransformedRecords.length} records in batches...`);
            
            for (let i = 0; i < allTransformedRecords.length; i += this.batchSize) {
                const batch = allTransformedRecords.slice(i, i + this.batchSize);
                
                try {
                    await this.uploadBatch(batch);
                    
                    if (i + this.batchSize < allTransformedRecords.length) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                    
                } catch (error) {
                    console.error(`❌ Batch ${Math.floor(i / this.batchSize) + 1} failed, continuing...`);
                    continue;
                }
            }
            
            // Final summary
            console.log(`\n🎉 MIGRATION COMPLETED!`);
            console.log(`✅ Successfully migrated: ${this.processedCount} records`);
            console.log(`🔗 Records with call history: ${this.linkedCount}`);
            console.log(`📞 Records never called: ${this.processedCount - this.linkedCount}`);
            console.log(`❌ Errors: ${this.errors.length}`);
            
            console.log('\n🔗 Next: Run linking script to connect new records with calls');
            
        } catch (error) {
            console.error('💥 Migration failed:', error.message);
            throw error;
        }
    }

    // Preview what will be migrated
    async previewMigration() {
        console.log('🔍 MIGRATION PREVIEW');
        console.log('===================\n');
        
        await this.loadCallsData();
        
        let totalRecords = 0;
        let potentialLinks = 0;
        
        for (const [tableName, tableId] of Object.entries(this.leadTables)) {
            try {
                const sample = await this.getAllLeadsFromTable(tableId, tableName);
                
                let recordsWithVAPI = 0;
                let matchingCalls = 0;
                
                sample.records.forEach(record => {
                    const vapiId = record.fields.VAPIiD || record.fields.VAPI_ID;
                    if (vapiId) {
                        recordsWithVAPI++;
                        if (this.callsData.has(vapiId)) {
                            matchingCalls++;
                        }
                    }
                });
                
                console.log(`${tableName}: ${sample.records.length} records, ${recordsWithVAPI} with VAPI ID, ${matchingCalls} with calls`);
                
                totalRecords += sample.records.length;
                potentialLinks += matchingCalls;
                
            } catch (error) {
                console.log(`❌ ${tableName}: Error accessing`);
            }
        }
        
        console.log(`\n📊 TOTALS:`);
        console.log(`Source records: ~${totalRecords}`);
        console.log(`Potential call links: ${potentialLinks}`);
        console.log(`Unlinked calls should drop from: 2596 to ~${2596 - potentialLinks}`);
    }
}

// CLI interface
if (require.main === module) {
    const migrator = new AllRegionsMigrator();
    const command = process.argv[2];

    switch (command) {
        case 'preview':
            migrator.previewMigration().catch(console.error);
            break;
        case 'migrate':
            migrator.migrateAllRegions().catch(console.error);
            break;
        default:
            console.log('Usage:');
            console.log('  node migrate_all_regions.js preview  - Show what will be migrated');
            console.log('  node migrate_all_regions.js migrate  - Migrate all regions');
    }
}

module.exports = AllRegionsMigrator;