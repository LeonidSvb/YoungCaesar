require('dotenv').config();

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const CALLS_TABLE_ID = 'tblvXZt2zkkanjGdE'; // Calls - raw data
const CLIENTS_TABLE_ID = 'tblYp2tPaY7Hoz9Pe'; // CLIENTS_MASTER
const ASIA_LEADS_TABLE_ID = 'tblZ9idb5hYqqSZHf'; // ASIA Leads

async function debugRounak() {
    console.log('🔍 DEBUGGING ROUNAK IDs');
    console.log('=======================\n');

    const rounakCallId = '2a3bab7e-b890-4cca-bd25-d56bf815d95b';
    const rounakVapiId = 'd75703c3-03ef-4985-9432-105b3e95a9b6';

    // 1. Search for Rounak in calls table
    console.log('1. 🔍 Searching calls table...');
    const callsUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${CALLS_TABLE_ID}?filterByFormula=SEARCH("${rounakCallId}",{Call ID})`;
    
    const callsResponse = await fetch(callsUrl, {
        headers: {
            'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
            'Content-Type': 'application/json'
        }
    });

    const callsData = await callsResponse.json();
    
    if (callsData.records.length > 0) {
        const callRecord = callsData.records[0];
        console.log(`✅ Found call record:`);
        console.log(`   Call ID: ${callRecord.fields['Call ID']}`);
        console.log(`   Customer ID: ${callRecord.fields['Customer ID']}`);
        console.log(`   Phone: ${callRecord.fields['Phone']}`);
        console.log(`   Assistant: ${callRecord.fields['Assistant Name']}`);
        console.log(`   Created: ${callRecord.fields['Created At']}`);
        console.log(`   Status: ${callRecord.fields['Status']}`);
    } else {
        console.log('❌ Call record not found');
    }

    // 2. Search for Rounak in ASIA leads
    console.log('\n2. 🔍 Searching ASIA leads table...');
    const asiaUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${ASIA_LEADS_TABLE_ID}?filterByFormula=SEARCH("Rounak",{Name})`;
    
    const asiaResponse = await fetch(asiaUrl, {
        headers: {
            'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
            'Content-Type': 'application/json'
        }
    });

    const asiaData = await asiaResponse.json();
    
    if (asiaData.records.length > 0) {
        const leadRecord = asiaData.records[0];
        console.log(`✅ Found lead record:`);
        console.log(`   Name: ${leadRecord.fields['Name']}`);
        console.log(`   VAPIiD: ${leadRecord.fields['VAPIiD']}`);
        console.log(`   Number: ${leadRecord.fields['Number']}`);
        console.log(`   Call Status: ${leadRecord.fields['Call Status']}`);
        console.log(`   BDR: ${leadRecord.fields['BDR']}`);
    } else {
        console.log('❌ Lead record not found');
    }

    // 3. Search for Rounak in CLIENTS_MASTER
    console.log('\n3. 🔍 Searching CLIENTS_MASTER table...');
    const clientsUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${CLIENTS_TABLE_ID}?filterByFormula=SEARCH("Rounak",{Name})`;
    
    const clientsResponse = await fetch(clientsUrl, {
        headers: {
            'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
            'Content-Type': 'application/json'
        }
    });

    const clientsData = await clientsResponse.json();
    
    if (clientsData.records.length > 0) {
        const clientRecord = clientsData.records[0];
        console.log(`✅ Found client record:`);
        console.log(`   Name: ${clientRecord.fields['Name']}`);
        console.log(`   VAPI_ID: ${clientRecord.fields['VAPI_ID']}`);
        console.log(`   Phone: ${clientRecord.fields['Phone']}`);
        console.log(`   Call_Status: ${clientRecord.fields['Call_Status']}`);
    } else {
        console.log('❌ Client record not found');
    }

    // 4. Search calls by Customer ID = VAPI ID
    console.log('\n4. 🔍 Searching calls by Customer ID = VAPI ID...');
    const callsByCustomerUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${CALLS_TABLE_ID}?filterByFormula={Customer ID}="${rounakVapiId}"`;
    
    const callsByCustomerResponse = await fetch(callsByCustomerUrl, {
        headers: {
            'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
            'Content-Type': 'application/json'
        }
    });

    const callsByCustomerData = await callsByCustomerResponse.json();
    
    console.log(`📊 Found ${callsByCustomerData.records.length} calls with Customer ID = ${rounakVapiId}`);
    
    if (callsByCustomerData.records.length > 0) {
        callsByCustomerData.records.forEach((call, index) => {
            console.log(`   Call ${index + 1}:`);
            console.log(`     Call ID: ${call.fields['Call ID']}`);
            console.log(`     Customer ID: ${call.fields['Customer ID']}`);
            console.log(`     Phone: ${call.fields['Phone']}`);
            console.log(`     Created: ${call.fields['Created At']}`);
            console.log(`     Status: ${call.fields['Status']}`);
            console.log('');
        });
    }

    // 5. Analysis
    console.log('\n📋 ANALYSIS:');
    console.log('=============');
    
    if (callsData.records.length > 0 && asiaData.records.length > 0) {
        const call = callsData.records[0];
        const lead = asiaData.records[0];
        
        console.log('🔍 ID COMPARISON:');
        console.log(`   Call ID: ${call.fields['Call ID']}`);
        console.log(`   Customer ID in call: ${call.fields['Customer ID']}`);
        console.log(`   VAPI ID in lead: ${lead.fields['VAPIiD']}`);
        
        if (call.fields['Customer ID'] === lead.fields['VAPIiD']) {
            console.log('✅ IDs MATCH! Customer ID = VAPI ID');
        } else {
            console.log('❌ IDs DO NOT MATCH!');
            console.log('🤔 This explains why linking failed');
            
            // Check if there's another call with matching Customer ID
            if (callsByCustomerData.records.length > 0) {
                console.log(`✅ BUT found ${callsByCustomerData.records.length} other calls with matching Customer ID`);
                console.log('💡 This person might have multiple calls');
            }
        }
        
        console.log('\n💡 EXPLANATION:');
        if (call.fields['Customer ID'] !== lead.fields['VAPIiD']) {
            console.log('The call you mentioned has a different Call ID vs Customer ID relationship');
            console.log('Call ID is unique per call, Customer ID should match VAPI ID');
            console.log(`The call ${rounakCallId} belongs to Customer ID: ${call.fields['Customer ID']}`);
            console.log(`But Rounak's VAPI ID is: ${rounakVapiId}`);
            console.log('These might be different people or different system records');
        }
    }
}

if (require.main === module) {
    debugRounak().catch(console.error);
}

module.exports = debugRounak;