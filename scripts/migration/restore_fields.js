require('dotenv').config();

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const CLIENTS_TABLE_ID = 'tblYp2tPaY7Hoz9Pe'; // CLIENTS_MASTER

class FieldRestorer {
    constructor() {
        // Standard fields we should have
        this.requiredFields = [
            'Name',
            'Phone', 
            'Email',
            'Company',
            'Market',
            'Keywords',
            'BDR',
            'Website',
            'Call_Status',
            'Last_Called',
            'Total_Attempts',
            'Max_Attempts',
            'Success_Level',
            'Meeting_Outcome', 
            'Next_Step',
            'Interest_Level',
            'DNC',
            'City',
            'State',
            'Country',
            'Timezone',
            'Original_Source',
            'VAPI_ID',
            'Priority',
            'Weight',
            'Created_At',
            'Updated_At',
            'Notes'
        ];
    }

    async getCurrentFields() {
        console.log('🔍 Checking current fields in CLIENTS_MASTER...');
        
        const metaUrl = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`;
        
        const response = await fetch(metaUrl, {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        const clientsTable = data.tables.find(t => t.id === CLIENTS_TABLE_ID);
        
        if (!clientsTable) {
            throw new Error('CLIENTS_MASTER table not found');
        }

        const currentFields = clientsTable.fields.map(f => f.name);
        
        console.log('📋 Current fields:');
        currentFields.forEach((field, index) => {
            console.log(`  ${index + 1}. ${field}`);
        });

        // Find missing fields
        const missingFields = this.requiredFields.filter(field => !currentFields.includes(field));
        
        console.log(`\n❌ Missing fields (${missingFields.length}):`);
        missingFields.forEach((field, index) => {
            console.log(`  ${index + 1}. ${field}`);
        });

        return { currentFields, missingFields };
    }

    generateFieldInstructions(missingFields) {
        console.log('\n📝 FIELD RESTORATION INSTRUCTIONS');
        console.log('==================================');
        console.log('\nGo to CLIENTS_MASTER table and add these fields manually:\n');

        const fieldTypes = {
            'Name': 'Single line text',
            'Phone': 'Phone number', 
            'Email': 'Email',
            'Company': 'Single line text',
            'Market': 'Single select (USA, EU, ASIA, QC, OEM, E164)',
            'Keywords': 'Long text',
            'BDR': 'Single line text',
            'Website': 'URL',
            'Call_Status': 'Single select (Not Called, Called, Scheduled, Completed, DNC)',
            'Last_Called': 'Date and time',
            'Total_Attempts': 'Number',
            'Max_Attempts': 'Number (default: 3)',
            'Success_Level': 'Single select (None, Low, Medium, High, Converted)',
            'Meeting_Outcome': 'Single line text',
            'Next_Step': 'Single line text', 
            'Interest_Level': 'Rating (1-5)',
            'DNC': 'Checkbox',
            'City': 'Single line text',
            'State': 'Single line text',
            'Country': 'Single select (USA, Canada, UK, Germany, France, Italy, China, Japan, India, Other)',
            'Timezone': 'Single line text',
            'Original_Source': 'Single select (USA_Leads, EU_Leads, ASIA_Leads, QC_Advisor, OEM_Table, E164_Biesse, E164_QC, E164_YC)',
            'VAPI_ID': 'Single line text',
            'Priority': 'Single select (Low, Medium, High, Urgent)',
            'Weight': 'Number (default: 1)',
            'Created_At': 'Date and time',
            'Updated_At': 'Date and time', 
            'Notes': 'Long text'
        };

        missingFields.forEach((field, index) => {
            const fieldType = fieldTypes[field] || 'Single line text';
            console.log(`${index + 1}. Field Name: "${field}"`);
            console.log(`   Type: ${fieldType}`);
            console.log('');
        });

        console.log('💡 QUICK RESTORE:');
        console.log('1. Copy field names from above');
        console.log('2. In Airtable: Click "+" to add field');
        console.log('3. Paste field name and set correct type');
        console.log('4. Repeat for all missing fields');
        console.log('\n⚠️  After adding fields, run migration again to populate data');
    }

    async createCSVTemplate() {
        console.log('\n📄 Creating CSV template with all fields...');
        
        const csvHeaders = this.requiredFields.join(',');
        const sampleData = [
            'John Sample,+1-555-0001,john@sample.com,Sample Co,USA,test keywords,Sample BDR,https://sample.com,Not Called,,0,3,None,,,3,FALSE,Sample City,CA,USA,America/Los_Angeles,USA_Leads,sample-vapi-001,Medium,1,2025-01-01T00:00:00Z,2025-01-01T00:00:00Z,Sample note'
        ];
        
        const csvContent = [csvHeaders, ...sampleData].join('\n');
        
        const fs = require('fs');
        const csvPath = './clients_master_template.csv';
        
        fs.writeFileSync(csvPath, csvContent);
        
        console.log(`✅ Template saved: ${csvPath}`);
        console.log('📊 You can import this CSV to recreate the table structure');
        
        return csvPath;
    }

    async restoreFields() {
        try {
            const { currentFields, missingFields } = await this.getCurrentFields();
            
            if (missingFields.length === 0) {
                console.log('\n✅ All fields are present! No restoration needed.');
                return;
            }

            this.generateFieldInstructions(missingFields);
            await this.createCSVTemplate();
            
            console.log('\n🚀 NEXT STEPS:');
            console.log('1. Add missing fields manually (see instructions above)');
            console.log('2. Run migration script to populate data');
            console.log('3. All existing data will be preserved');
            
        } catch (error) {
            console.error('❌ Error restoring fields:', error.message);
        }
    }
}

if (require.main === module) {
    const restorer = new FieldRestorer();
    restorer.restoreFields().catch(console.error);
}

module.exports = FieldRestorer;