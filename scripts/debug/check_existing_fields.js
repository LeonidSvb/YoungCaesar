require('dotenv').config();

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const CLIENTS_TABLE_ID = 'tblYp2tPaY7Hoz9Pe'; // CLIENTS_MASTER

async function checkFields() {
    console.log('🔍 Checking existing fields in CLIENTS_MASTER...');
    
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

    console.log('📋 Current fields:');
    clientsTable.fields.forEach((field, index) => {
        console.log(`  ${index + 1}. ${field.name} (${field.type})`);
    });
    
    // Check if Original_Source exists
    const hasOriginalSource = clientsTable.fields.some(f => f.name === 'Original_Source');
    console.log(`\n🔍 Has Original_Source field: ${hasOriginalSource ? '✅ YES' : '❌ NO'}`);
    
    if (!hasOriginalSource) {
        console.log('\n📝 MANUAL ACTION REQUIRED:');
        console.log('1. Go to CLIENTS_MASTER table in Airtable');
        console.log('2. Add new field called "Original_Source"');
        console.log('3. Set type to "Single select"');
        console.log('4. Add these options:');
        console.log('   - E164_Biesse');
        console.log('   - E164_QC');
        console.log('   - E164_YC');
        console.log('   - USA_Leads');
        console.log('   - ASIA_Leads');
        console.log('   - EU_Leads');
        console.log('   - QC_Advisor');
        console.log('   - OEM_Table');
        console.log('5. Run the source update script again');
    }
}

checkFields().catch(console.error);