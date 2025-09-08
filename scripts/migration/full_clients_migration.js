require('dotenv').config();
const fs = require('fs');

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const CLIENTS_TABLE_ID = 'tblYp2tPaY7Hoz9Pe'; // Your new CLIENTS_MASTER table

class FullClientsMigrator {
    constructor() {
        this.leadTables = {
            'E164_YC': 'tblLmWcITpAZdKhs2',
            'E164_Biesse': 'tblZ0UPX8U6E081yC',
            'E164_QC': 'tblQvINW9Gr83ogfc',
            'USA_Leads': 'tblVSTLFdPSYjWQ89',
            'EU_Leads': 'tblhkE3kg4Pitcua6',
            'ASIA_Leads': 'tblZ9idb5hYqqSZHf',
            'QC_Advisor': 'tblg7fw9sseuGw1pr',
            'OEM_Table': 'tbleWG18EdYCz7V1m'
        };
        
        this.batchSize = 10;
        this.processedCount = 0;
        this.duplicatesSkipped = 0;
        this.errors = [];
        this.vapiIdsSeen = new Set();
    }

    async getAllRecords(tableId, tableName) {
        const records = [];
        let offset = '';
        
        console.log(`📊 Fetching ${tableName}...`);
        
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
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                records.push(...data.records);
                
                if (!data.offset) break;
                offset = data.offset;
                
                await new Promise(resolve => setTimeout(resolve, 200));
                
            } catch (error) {
                console.error(`❌ Error fetching ${tableName}:`, error.message);
                break;
            }
        }
        
        console.log(`✅ ${tableName}: ${records.length} records`);
        return { tableName, records };
    }

    transformRecord(record, sourceName) {
        const fields = record.fields;
        
        // Extract name (handle different field names)
        let name = fields['Name'] || fields['Person First name'] || '';
        if (fields['Person Last name']) {
            name += ' ' + fields['Person Last name'];
        }
        name = name.trim() || 'Unknown';
        
        // Extract phone (normalize different formats)
        let phone = fields['Number'] || fields['Phone'] || fields['Person Phone'] || '';
        if (typeof phone === 'object' && phone.length) phone = phone[0]; // Handle arrays
        phone = String(phone).trim();
        
        // Extract email
        let email = fields['EMAIL'] || fields['Person Email'] || fields['Email'] || '';
        
        // Extract company
        let company = fields['Company'] || fields['WEBSITE/CO.'] || fields['WEBSITE'] || '';
        
        // Extract market
        let market = fields['MARKET'] || fields['Country'] || '';
        if (sourceName.includes('USA')) market = 'USA';
        else if (sourceName.includes('EU')) market = 'EU';
        else if (sourceName.includes('ASIA')) market = 'ASIA';
        
        // Extract keywords
        let keywords = fields['KEYWORD'] || fields['Keywords'] || fields['KEYWORDS'] || '';
        
        // Extract BDR
        let bdr = fields['BDR'] || '';
        
        // Extract call status
        let callStatus = fields['Call Status'] || 'Not Called';
        
        // Extract VAPI ID (most important for linking!)
        let vapiId = fields['VAPIiD'] || fields['VAPI_ID'] || '';
        
        // Extract priority
        let priority = fields['Priority'] || fields['Priorirty'] || 'Medium';
        
        // Extract location
        let city = fields['City'] || '';
        let country = fields['Country'] || market;
        
        // Skip if no phone number
        if (!phone || phone === '' || phone === 'N/A') {
            return null;
        }
        
        // Skip if duplicate VAPI ID
        if (vapiId && this.vapiIdsSeen.has(vapiId)) {
            this.duplicatesSkipped++;
            return null;
        }
        
        if (vapiId) this.vapiIdsSeen.add(vapiId);
        
        return {
            fields: {
                'Name': name,
                'Phone': phone,
                'Email': email || '',
                'Company': company,
                'Market': market,
                'Keywords': keywords,
                'BDR': bdr,
                'Call_Status': callStatus,
                'VAPI_ID': vapiId,
                'Priority': priority,
                'City': city,
                'Country': country
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
                body: JSON.stringify({ records })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            this.processedCount += records.length;
            
            console.log(`✅ Uploaded batch of ${records.length} records (Total: ${this.processedCount})`);
            
            return result;
        } catch (error) {
            console.error(`❌ Failed to upload batch:`, error.message);
            this.errors.push(`Batch upload failed: ${error.message}`);
            throw error;
        }
    }

    async migrateAllTables() {
        console.log('🚀 Starting full clients migration...\n');
        
        let allTransformedRecords = [];
        
        // Step 1: Fetch all data
        for (const [tableName, tableId] of Object.entries(this.leadTables)) {
            try {
                const tableData = await this.getAllRecords(tableId, tableName);
                
                // Transform records
                const transformedRecords = tableData.records
                    .map(record => this.transformRecord(record, tableName))
                    .filter(record => record !== null); // Remove nulls
                
                console.log(`🔄 ${tableName}: ${transformedRecords.length} valid records (${tableData.records.length - transformedRecords.length} skipped)`);
                
                allTransformedRecords = allTransformedRecords.concat(transformedRecords);
                
            } catch (error) {
                console.error(`❌ Error processing ${tableName}:`, error.message);
                this.errors.push(`Table ${tableName}: ${error.message}`);
            }
        }
        
        console.log(`\n📊 MIGRATION SUMMARY:`);
        console.log(`Total records collected: ${allTransformedRecords.length}`);
        console.log(`Duplicates skipped: ${this.duplicatesSkipped}`);
        console.log(`Unique VAPI IDs: ${this.vapiIdsSeen.size}`);
        
        if (allTransformedRecords.length === 0) {
            console.log('❌ No records to migrate!');
            return;
        }
        
        // Step 2: Upload in batches
        console.log(`\n📤 Uploading in batches of ${this.batchSize}...`);
        
        for (let i = 0; i < allTransformedRecords.length; i += this.batchSize) {
            const batch = allTransformedRecords.slice(i, i + this.batchSize);
            
            try {
                await this.uploadBatch(batch);
                
                // Rate limiting
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
        console.log(`❌ Errors encountered: ${this.errors.length}`);
        
        if (this.errors.length > 0) {
            console.log('\nErrors:');
            this.errors.forEach(error => console.log(`  - ${error}`));
        }
        
        console.log(`\n🔗 Next step: Link with calls table by VAPI ID`);
    }

    // Quick stats about what will be migrated
    async previewMigration() {
        console.log('🔍 MIGRATION PREVIEW');
        console.log('===================\n');
        
        let totalRecords = 0;
        let tablesWithVAPI = 0;
        
        for (const [tableName, tableId] of Object.entries(this.leadTables)) {
            try {
                const sample = await this.getAllRecords(tableId, tableName);
                totalRecords += sample.records.length;
                
                // Check if has VAPI IDs
                const hasVAPI = sample.records.some(r => r.fields.VAPIiD || r.fields.VAPI_ID);
                if (hasVAPI) tablesWithVAPI++;
                
            } catch (error) {
                console.log(`❌ ${tableName}: Error accessing`);
            }
        }
        
        console.log(`📊 Total source records: ~${totalRecords}`);
        console.log(`🆔 Tables with VAPI IDs: ${tablesWithVAPI}/${Object.keys(this.leadTables).length}`);
        console.log(`📍 Target table: CLIENTS_MASTER (${CLIENTS_TABLE_ID})`);
        console.log(`\nProceed with migration? (y/n)`);
    }
}

// CLI interface
if (require.main === module) {
    const migrator = new FullClientsMigrator();
    const command = process.argv[2];

    switch (command) {
        case 'preview':
            migrator.previewMigration();
            break;
        case 'migrate':
            migrator.migrateAllTables();
            break;
        default:
            console.log('Usage:');
            console.log('  node full_clients_migration.js preview  - Show migration preview');
            console.log('  node full_clients_migration.js migrate  - Run full migration');
    }
}

module.exports = FullClientsMigrator;