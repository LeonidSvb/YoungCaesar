require('dotenv').config();
const fs = require('fs');
const path = require('path');

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID;

async function getLastAirtableCall() {
    try {
        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?maxRecords=1&sort[0][field]=Started%20At&sort[0][direction]=desc`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.error('Airtable API error:', response.status);
            return null;
        }

        const data = await response.json();
        if (data.records && data.records.length > 0) {
            const lastRecord = data.records[0].fields;
            return {
                callId: lastRecord['Call ID'],
                startedAt: lastRecord['Started At'],
                endedAt: lastRecord['Ended At'],
                createdAt: lastRecord['Created At']
            };
        }
        return null;
    } catch (error) {
        console.error('Error fetching from Airtable:', error);
        return null;
    }
}

async function getAllVAPICallsWithPagination() {
    const allCalls = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
        try {
            const url = `https://api.vapi.ai/call?limit=100&page=${page}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${VAPI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                console.error(`VAPI API error on page ${page}:`, response.status);
                break;
            }

            const calls = await response.json();
            
            if (Array.isArray(calls) && calls.length > 0) {
                allCalls.push(...calls);
                page++;
                
                // If we get less than 100, we reached the end
                if (calls.length < 100) {
                    hasMore = false;
                }
            } else {
                hasMore = false;
            }
        } catch (error) {
            console.error(`Error fetching VAPI page ${page}:`, error);
            break;
        }
    }
    
    return allCalls;
}

async function checkSyncStatus() {
    console.log('🔍 Checking synchronization status between VAPI and Airtable...\n');
    
    // Get last call from Airtable
    console.log('📊 Fetching last call from Airtable...');
    const lastAirtableCall = await getLastAirtableCall();
    
    if (lastAirtableCall) {
        console.log('Last call in Airtable:');
        console.log(`  Call ID: ${lastAirtableCall.callId}`);
        console.log(`  Started: ${lastAirtableCall.startedAt || 'N/A'}`);
        console.log(`  Created: ${lastAirtableCall.createdAt || 'N/A'}`);
        
        const lastDate = lastAirtableCall.startedAt || lastAirtableCall.createdAt;
        if (lastDate) {
            console.log(`  Last date: ${new Date(lastDate).toLocaleString()}`);
        }
    } else {
        console.log('❌ No calls found in Airtable or unable to connect');
    }
    
    // Get all calls from VAPI
    console.log('\n📞 Fetching all calls from VAPI API...');
    const vapiCalls = await getAllVAPICallsWithPagination();
    console.log(`Total calls in VAPI: ${vapiCalls.length}`);
    
    if (vapiCalls.length > 0) {
        // Sort by date to find the latest
        vapiCalls.sort((a, b) => {
            const dateA = new Date(a.startedAt || a.createdAt);
            const dateB = new Date(b.startedAt || b.createdAt);
            return dateB - dateA;
        });
        
        const latestVAPICall = vapiCalls[0];
        const oldestVAPICall = vapiCalls[vapiCalls.length - 1];
        
        console.log('\nLatest call in VAPI:');
        console.log(`  Call ID: ${latestVAPICall.id}`);
        console.log(`  Started: ${latestVAPICall.startedAt || 'N/A'}`);
        console.log(`  Created: ${latestVAPICall.createdAt}`);
        console.log(`  Date: ${new Date(latestVAPICall.startedAt || latestVAPICall.createdAt).toLocaleString()}`);
        
        console.log('\nOldest call in VAPI:');
        console.log(`  Call ID: ${oldestVAPICall.id}`);
        console.log(`  Date: ${new Date(oldestVAPICall.startedAt || oldestVAPICall.createdAt).toLocaleString()}`);
        
        // Calculate new calls since last Airtable sync
        if (lastAirtableCall) {
            const lastSyncDate = new Date(lastAirtableCall.startedAt || lastAirtableCall.createdAt);
            const newCalls = vapiCalls.filter(call => {
                const callDate = new Date(call.startedAt || call.createdAt);
                return callDate > lastSyncDate;
            });
            
            console.log('\n📈 Synchronization Analysis:');
            console.log(`  New calls since last sync: ${newCalls.length}`);
            
            if (newCalls.length > 0) {
                const dateRange = {
                    from: new Date(newCalls[newCalls.length - 1].startedAt || newCalls[newCalls.length - 1].createdAt),
                    to: new Date(newCalls[0].startedAt || newCalls[0].createdAt)
                };
                console.log(`  Date range of new calls:`);
                console.log(`    From: ${dateRange.from.toLocaleString()}`);
                console.log(`    To: ${dateRange.to.toLocaleString()}`);
                
                // Save new calls to file for inspection
                const outputPath = path.join(__dirname, '../../data/processed/new_calls_to_sync.json');
                fs.writeFileSync(outputPath, JSON.stringify(newCalls, null, 2));
                console.log(`\n💾 New calls saved to: ${outputPath}`);
            }
        }
        
        // Check if we have the raw data file from September 3rd
        const rawDataPath = path.join(__dirname, '../../data/raw/vapi_raw_calls_2025-09-03.json');
        if (fs.existsSync(rawDataPath)) {
            const rawData = JSON.parse(fs.readFileSync(rawDataPath, 'utf8'));
            console.log(`\n📁 Raw data file from 2025-09-03: ${rawData.length} calls`);
            
            if (rawData.length !== vapiCalls.length) {
                console.log(`⚠️  Discrepancy detected:`);
                console.log(`    Raw file: ${rawData.length} calls`);
                console.log(`    Current API: ${vapiCalls.length} calls`);
                console.log(`    Difference: ${Math.abs(rawData.length - vapiCalls.length)} calls`);
            }
        }
    }
    
    return {
        airtable: lastAirtableCall,
        vapi: {
            total: vapiCalls.length,
            calls: vapiCalls
        }
    };
}

// Run if called directly
if (require.main === module) {
    checkSyncStatus()
        .then(result => {
            console.log('\n✅ Analysis complete!');
        })
        .catch(error => {
            console.error('\n❌ Analysis failed:', error);
            process.exit(1);
        });
}

module.exports = { checkSyncStatus };