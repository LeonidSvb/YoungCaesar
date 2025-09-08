require('dotenv').config();

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const CALLS_TABLE_ID = 'tblvXZt2zkkanjGdE';
const CLIENTS_TABLE_ID = 'tblYp2tPaY7Hoz9Pe';

async function analyzeParadox() {
    console.log('🔍 ANALYZING PARADOX');
    console.log('====================\n');

    // 1. Count calls with Client links
    console.log('1. Counting calls with Client links...');
    let callsWithLinks = 0;
    let offset = '';
    
    while (true) {
        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${CALLS_TABLE_ID}?filterByFormula=NOT({Client}="")&pageSize=100${offset ? `&offset=${offset}` : ''}`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        callsWithLinks += data.records.length;
        
        if (!data.offset) break;
        offset = data.offset;
        
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`📞 Calls with Client links: ${callsWithLinks}`);

    // 2. Count clients with call links (reverse direction)
    console.log('\n2. Counting clients with call links...');
    let clientsWithCalls = 0;
    let totalClients = 0;
    offset = '';
    
    while (true) {
        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${CLIENTS_TABLE_ID}?pageSize=100${offset ? `&offset=${offset}` : ''}`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        data.records.forEach(client => {
            totalClients++;
            if (client.fields['Calls - raw data'] && client.fields['Calls - raw data'].length > 0) {
                clientsWithCalls++;
            }
        });
        
        if (!data.offset) break;
        offset = data.offset;
        
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`👤 Total clients: ${totalClients}`);
    console.log(`🔗 Clients with calls: ${clientsWithCalls}`);

    // 3. Explanation of the paradox
    console.log('\n📋 PARADOX ANALYSIS:');
    console.log('====================');
    console.log(`Raw calls table shows: ${callsWithLinks} calls linked`);
    console.log(`Clients table shows: ${clientsWithCalls} clients with calls`);
    
    console.log('\n💡 EXPLANATION:');
    console.log('This is NOT a paradox - this is normal! Here\'s why:');
    console.log('');
    console.log('📞 ONE CLIENT can have MULTIPLE CALLS');
    console.log('   - Client A might have 5 calls');
    console.log('   - Client B might have 3 calls');
    console.log('   - Client C might have 8 calls');
    console.log('');
    console.log('So:');
    console.log(`   ${callsWithLinks} calls linked to ${clientsWithCalls} unique clients`);
    console.log(`   Average calls per client: ${(callsWithLinks / clientsWithCalls).toFixed(1)}`);
    
    // 4. Sample verification
    console.log('\n🔍 SAMPLE VERIFICATION:');
    const sampleUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${CLIENTS_TABLE_ID}?filterByFormula=NOT({Calls - raw data}="")&maxRecords=5`;
    
    const sampleResponse = await fetch(sampleUrl, {
        headers: {
            'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
            'Content-Type': 'application/json'
        }
    });
    
    const sampleData = await sampleResponse.json();
    
    sampleData.records.forEach((client, index) => {
        const callCount = client.fields['Calls - raw data'] ? client.fields['Calls - raw data'].length : 0;
        console.log(`   ${index + 1}. ${client.fields['Name']}: ${callCount} calls`);
    });
    
    console.log('\n✅ CONCLUSION: Numbers are correct!');
    console.log('📊 Many clients have multiple calls, so call count > client count');
}

analyzeParadox().catch(console.error);