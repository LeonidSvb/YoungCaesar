require('dotenv').config();

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const CLIENTS_TABLE_ID = 'tblYp2tPaY7Hoz9Pe'; // CLIENTS_MASTER

// Standard fields from CSV template
const STANDARD_FIELDS = [
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

async function analyzeFields() {
    console.log('📊 FIELD ANALYSIS FOR CLIENTS_MASTER');
    console.log('====================================\n');

    // Get current fields
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
        console.log('❌ CLIENTS_MASTER table not found');
        return;
    }

    const currentFields = clientsTable.fields.map(f => f.name);
    
    console.log('✅ EXISTING FIELDS (15):');
    currentFields.forEach(field => {
        if (!field.includes('Calls - raw data')) {
            console.log(`   ✓ ${field}`);
        }
    });

    console.log('\n❌ MISSING FIELDS (13):');
    const missingFields = STANDARD_FIELDS.filter(field => !currentFields.includes(field));
    missingFields.forEach(field => {
        console.log(`   ✗ ${field}`);
    });

    console.log('\n📝 FIELD TYPES FOR MISSING FIELDS:');
    const fieldTypes = {
        'Website': 'URL field',
        'Last_Called': 'Date and time field',
        'Total_Attempts': 'Number field (default: 0)',
        'Max_Attempts': 'Number field (default: 3)',
        'Success_Level': 'Single select (None, Low, Medium, High, Converted)',
        'Meeting_Outcome': 'Single line text',
        'Next_Step': 'Single line text',
        'Interest_Level': 'Rating (1-5 stars)',
        'DNC': 'Checkbox',
        'State': 'Single line text',
        'Timezone': 'Single line text',
        'Weight': 'Number field (default: 1)',
        'Created_At': 'Date and time field',
        'Updated_At': 'Date and time field',
        'Notes': 'Long text field'
    };

    console.log('');
    missingFields.forEach(field => {
        const type = fieldTypes[field] || 'Single line text';
        console.log(`   ${field}: ${type}`);
    });

    console.log('\n🔧 MANUAL STEPS TO ADD MISSING FIELDS:');
    console.log('1. Go to CLIENTS_MASTER table in Airtable');
    console.log('2. For each missing field above:');
    console.log('   - Click "+" to add field');
    console.log('   - Name it exactly as shown');
    console.log('   - Set the correct field type');
    console.log('3. After adding all fields, we can populate data');

    console.log('\n💡 IMPORTANT FIELDS FOR FUNCTIONALITY:');
    console.log('   Website - For company research');
    console.log('   Last_Called - For call scheduling');
    console.log('   Total_Attempts - For tracking outreach');
    console.log('   Interest_Level - For lead scoring');
    console.log('   DNC - For compliance');
    console.log('   Notes - For call history');
}

analyzeFields().catch(console.error);