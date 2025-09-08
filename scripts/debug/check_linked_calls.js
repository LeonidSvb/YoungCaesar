require('dotenv').config();

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const CALLS_TABLE_ID = 'tblvXZt2zkkanjGdE'; // Calls - raw data
const CLIENTS_TABLE_ID = 'tblYp2tPaY7Hoz9Pe'; // CLIENTS_MASTER

async function checkLinkedCalls() {
    console.log('🔍 CHECKING WHICH CALLS ARE LINKED');
    console.log('==================================\n');

    // Get calls that have Client links
    const linkedCallsUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${CALLS_TABLE_ID}?filterByFormula=NOT({Client}="")`; 
    
    const linkedResponse = await fetch(linkedCallsUrl, {
        headers: {
            'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
            'Content-Type': 'application/json'
        }
    });

    const linkedData = await linkedResponse.json();
    
    console.log(`📊 Found ${linkedData.records.length} calls with Client links:`);
    
    if (linkedData.records.length > 0) {
        linkedData.records.forEach((call, index) => {
            console.log(`   ${index + 1}. Call ID: ${call.fields['Call ID']}`)
            console.log(`      Customer ID: ${call.fields['Customer ID']}`);
            console.log(`      Client links: ${call.fields['Client'] ? call.fields['Client'].length : 0}`);
            console.log(`      Phone: ${call.fields['Phone']}`);
            console.log('');
        });
        
        // Check what clients these calls link to
        console.log('🔗 CHECKING LINKED CLIENTS:');
        
        const clientIds = new Set();
        linkedData.records.forEach(call => {
            if (call.fields['Client']) {
                call.fields['Client'].forEach(clientId => clientIds.add(clientId));
            }
        });
        
        console.log(`📊 Calls are linked to ${clientIds.size} unique clients`);
        
        // Get client details
        for (const clientId of clientIds) {
            const clientUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${CLIENTS_TABLE_ID}/${clientId}`;
            
            try {
                const clientResponse = await fetch(clientUrl, {
                    headers: {
                        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                const clientData = await clientResponse.json();
                console.log(`   Client: ${clientData.fields['Name']} (VAPI_ID: ${clientData.fields['VAPI_ID']})`);
                
            } catch (error) {
                console.log(`   Error fetching client ${clientId}: ${error.message}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }
    
    console.log('\n🎯 SUMMARY:');
    console.log(`   Linked calls: ${linkedData.records.length}`);
    console.log(`   Total calls: 2612`);
    console.log(`   Unlinked calls: ${2612 - linkedData.records.length}`);
    console.log(`   Success rate: ${((linkedData.records.length / 2612) * 100).toFixed(2)}%`);
}

if (require.main === module) {
    checkLinkedCalls().catch(console.error);
}

module.exports = checkLinkedCalls;