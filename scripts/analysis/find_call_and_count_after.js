require('dotenv').config();
const fs = require('fs');
const path = require('path');

const VAPI_API_KEY = process.env.VAPI_API_KEY;

async function searchInRawFiles(targetCallId) {
    // Check both data/raw and scripts/collection directories
    const searchDirs = [
        path.join(__dirname, '../../data/raw'),
        path.join(__dirname, '../collection')
    ];
    
    let allFiles = [];
    
    for (const dir of searchDirs) {
        if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir).filter(f => f.includes('vapi_raw_calls'));
            allFiles = allFiles.concat(files.map(f => ({ file: f, dir })));
        }
    }
    
    console.log(`🔍 Searching for call ${targetCallId} in raw files...`);
    
    for (const fileInfo of allFiles) {
        const filePath = path.join(fileInfo.dir, fileInfo.file);
        console.log(`\n📁 Checking ${fileInfo.file} in ${fileInfo.dir}...`);
        
        try {
            const rawData = fs.readFileSync(filePath, 'utf8');
            const calls = JSON.parse(rawData);
            
            console.log(`  - Contains ${calls.length} calls`);
            
            const targetCall = calls.find(call => call.id === targetCallId);
            if (targetCall) {
                console.log(`✅ Found call ${targetCallId} in ${fileInfo.file}!`);
                console.log(`  - Created: ${targetCall.createdAt}`);
                console.log(`  - Started: ${targetCall.startedAt || 'N/A'}`);
                console.log(`  - Status: ${targetCall.status}`);
                
                // Sort calls by creation time
                const sortedCalls = calls.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                
                // Find the index of our target call
                const targetIndex = sortedCalls.findIndex(call => call.id === targetCallId);
                
                console.log(`  - Position in sorted array: ${targetIndex + 1}/${calls.length}`);
                
                // Count calls after this one
                const callsAfter = sortedCalls.slice(targetIndex + 1);
                console.log(`  - Calls after this one in file: ${callsAfter.length}`);
                
                if (callsAfter.length > 0) {
                    console.log(`  - Next call after: ${callsAfter[0].id}`);
                    console.log(`  - Next call date: ${callsAfter[0].createdAt}`);
                    console.log(`  - Last call in file: ${callsAfter[callsAfter.length - 1].id}`);
                    console.log(`  - Last call date: ${callsAfter[callsAfter.length - 1].createdAt}`);
                }
                
                return {
                    found: true,
                    call: targetCall,
                    file: fileInfo.file,
                    totalInFile: calls.length,
                    positionInFile: targetIndex + 1,
                    callsAfterInFile: callsAfter.length,
                    allCallsAfter: callsAfter,
                    allCalls: sortedCalls
                };
            }
        } catch (error) {
            console.error(`❌ Error reading ${fileInfo.file}:`, error.message);
        }
    }
    
    return { found: false };
}

async function getCallsAfterDate(afterDate) {
    try {
        console.log(`\n📞 Getting all calls after ${afterDate} via API...`);
        
        const url = `https://api.vapi.ai/call?createdAtGt=${afterDate}&limit=1000`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${VAPI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.error(`API error: ${response.status}`);
            return [];
        }

        const calls = await response.json();
        console.log(`✅ API returned ${calls.length} calls after ${afterDate}`);
        
        return calls || [];
    } catch (error) {
        console.error('Error fetching from API:', error);
        return [];
    }
}

async function findCallAndCountAfter(targetCallId) {
    console.log(`🎯 Searching for call: ${targetCallId}`);
    console.log('=====================================\n');
    
    // First search in local files
    const searchResult = await searchInRawFiles(targetCallId);
    
    if (!searchResult.found) {
        console.log('❌ Call not found in local files');
        return;
    }
    
    const targetCall = searchResult.call;
    const targetDate = targetCall.createdAt;
    
    console.log('\n🔍 Analysis Results:');
    console.log('=====================================');
    console.log(`📞 Target call: ${targetCallId}`);
    console.log(`📅 Created: ${targetDate}`);
    console.log(`📁 Found in: ${searchResult.file}`);
    console.log(`📊 Position: ${searchResult.positionInFile}/${searchResult.totalInFile}`);
    console.log(`🔢 Calls after in file: ${searchResult.callsAfterInFile}`);
    
    // Get calls after this date from API
    const apiCallsAfter = await getCallsAfterDate(targetDate);
    
    // Also check in the collected data
    const allCallsAfter = searchResult.allCallsAfter;
    
    console.log('\n📈 Summary:');
    console.log('=====================================');
    console.log(`📁 Local data - calls after: ${allCallsAfter.length}`);
    console.log(`🌐 API - calls after: ${apiCallsAfter.length}`);
    
    if (allCallsAfter.length > 0) {
        console.log(`\n📋 Date range of calls after ${targetCallId}:`);
        console.log(`  From: ${allCallsAfter[0].createdAt}`);
        console.log(`  To: ${allCallsAfter[allCallsAfter.length - 1].createdAt}`);
        
        // Group by date
        const byDate = {};
        allCallsAfter.forEach(call => {
            const date = call.createdAt.split('T')[0];
            byDate[date] = (byDate[date] || 0) + 1;
        });
        
        console.log('\n📊 Breakdown by date:');
        Object.entries(byDate)
            .sort(([a], [b]) => a.localeCompare(b))
            .forEach(([date, count]) => {
                console.log(`  ${date}: ${count} calls`);
            });
    }
    
    // Compare with API results
    if (apiCallsAfter.length !== allCallsAfter.length) {
        console.log(`\n⚠️  Discrepancy detected:`);
        console.log(`  Local file: ${allCallsAfter.length} calls`);
        console.log(`  API: ${apiCallsAfter.length} calls`);
        console.log(`  Difference: ${Math.abs(apiCallsAfter.length - allCallsAfter.length)} calls`);
    } else {
        console.log(`\n✅ Data consistency verified: ${allCallsAfter.length} calls`);
    }
    
    return {
        targetCall,
        callsAfterLocal: allCallsAfter.length,
        callsAfterAPI: apiCallsAfter.length,
        dateRange: allCallsAfter.length > 0 ? {
            from: allCallsAfter[0].createdAt,
            to: allCallsAfter[allCallsAfter.length - 1].createdAt
        } : null,
        breakdown: allCallsAfter.length > 0 ? (() => {
            const byDate = {};
            allCallsAfter.forEach(call => {
                const date = call.createdAt.split('T')[0];
                byDate[date] = (byDate[date] || 0) + 1;
            });
            return byDate;
        })() : {}
    };
}

// Run if called directly
if (require.main === module) {
    const targetCallId = process.argv[2] || '8fc39f3b-54b6-468d-ac32-abca268fd799';
    
    findCallAndCountAfter(targetCallId)
        .then(result => {
            if (result) {
                console.log('\n🎯 Final Answer:');
                console.log('=====================================');
                console.log(`📞 Calls after ${targetCallId}: ${result.callsAfterLocal} (local) / ${result.callsAfterAPI} (API)`);
            }
        })
        .catch(error => {
            console.error('\n❌ Search failed:', error);
            process.exit(1);
        });
}

module.exports = { findCallAndCountAfter };