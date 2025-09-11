require('dotenv').config();

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const CLIENTS_TABLE_ID = 'tblYp2tPaY7Hoz9Pe'; // CLIENTS_MASTER
const ASIA_LEADS_TABLE_ID = 'tblZ9idb5hYqqSZHf'; // ASIA Leads original

async function debugCallStatus() {
    console.log('🐛 DEBUGGING CALL STATUS LOGIC');
    console.log('===============================\n');

    // Check what's in CLIENTS_MASTER now
    console.log('📊 Checking CLIENTS_MASTER table...');
    const clientsUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${CLIENTS_TABLE_ID}`;
    
    const clientsResponse = await fetch(clientsUrl, {
        headers: {
            'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
            'Content-Type': 'application/json'
        }
    });

    const clientsData = await clientsResponse.json();
    console.log(`Found ${clientsData.records.length} records in CLIENTS_MASTER`);

    // Analyze call status distribution
    const statusCounts = {};
    const recordsWithVAPIID = [];
    const recordsWithoutVAPIID = [];

    clientsData.records.forEach(record => {
        const callStatus = record.fields['Call_Status'] || 'Unknown';
        const vapiId = record.fields['VAPI_ID'];
        const name = record.fields['Name'];
        
        statusCounts[callStatus] = (statusCounts[callStatus] || 0) + 1;
        
        if (vapiId) {
            recordsWithVAPIID.push({
                name,
                vapiId: vapiId.substring(0, 8) + '...',
                status: callStatus
            });
        } else {
            recordsWithoutVAPIID.push({
                name,
                status: callStatus
            });
        }
    });

    console.log('\n📊 CALL STATUS DISTRIBUTION:');
    Object.keys(statusCounts).forEach(status => {
        console.log(`  ${status}: ${statusCounts[status]} records`);
    });

    console.log(`\n🆔 RECORDS WITH VAPI ID: ${recordsWithVAPIID.length}`);
    recordsWithVAPIID.slice(0, 10).forEach((record, index) => {
        console.log(`  ${index + 1}. ${record.name} - ${record.vapiId} - Status: ${record.status}`);
    });

    console.log(`\n❌ RECORDS WITHOUT VAPI ID: ${recordsWithoutVAPIID.length}`);
    recordsWithoutVAPIID.slice(0, 5).forEach((record, index) => {
        console.log(`  ${index + 1}. ${record.name} - Status: ${record.status}`);
    });

    // Now check original ASIA leads to compare
    console.log('\n\n📊 Checking original ASIA_Leads table...');
    const asiaUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${ASIA_LEADS_TABLE_ID}`;
    
    const asiaResponse = await fetch(asiaUrl, {
        headers: {
            'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
            'Content-Type': 'application/json'
        }
    });

    const asiaData = await asiaResponse.json();
    
    const originalStatus = {};
    console.log(`Found ${asiaData.records.length} records in original ASIA_Leads`);

    asiaData.records.forEach(record => {
        const name = record.fields['Name'] || 'Unknown';
        const callStatus = record.fields['Call Status'] || 'Unknown';
        const vapiId = record.fields['VAPIiD'] || 'No VAPI ID';
        
        originalStatus[callStatus] = (originalStatus[callStatus] || 0) + 1;
        
        console.log(`  ${name} - Original Status: "${callStatus}" - VAPI ID: ${vapiId ? vapiId.substring(0, 8) + '...' : 'None'}`);
    });

    console.log('\n📊 ORIGINAL STATUS DISTRIBUTION:');
    Object.keys(originalStatus).forEach(status => {
        console.log(`  "${status}": ${originalStatus[status]} records`);
    });

    // Find the logic error
    console.log('\n🔍 LOGIC ANALYSIS:');
    console.log('==================');
    
    if (statusCounts['Called'] && statusCounts['Called'] === clientsData.records.length) {
        console.log('❌ BUG FOUND: All records marked as "Called"');
        console.log('🔍 Issue: Logic is overriding status to "Called" when VAPI ID found');
        console.log('💡 Fix: Should preserve original Call Status unless we find actual calls');
    }

    if (statusCounts['Not Called'] === undefined || statusCounts['Not Called'] === 0) {
        console.log('❌ BUG CONFIRMED: No "Not Called" records found');
        console.log('🔍 Original table shows some leads were "Not Called"');
        console.log('💡 Fix needed in transformation logic');
    }
}

if (require.main === module) {
    debugCallStatus().catch(console.error);
}

module.exports = debugCallStatus;