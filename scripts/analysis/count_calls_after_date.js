require('dotenv').config();

const VAPI_API_KEY = process.env.VAPI_API_KEY;

async function getCallsAfterDate(afterDate) {
    let allCalls = [];
    let page = 1;
    let hasMore = true;
    
    console.log(`📞 Getting all calls after ${afterDate}...`);
    
    while (hasMore) {
        try {
            const url = `https://api.vapi.ai/call?createdAtGt=${afterDate}&limit=100&page=${page}`;
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${VAPI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                console.error(`API error on page ${page}: ${response.status}`);
                break;
            }

            const calls = await response.json();
            
            if (Array.isArray(calls) && calls.length > 0) {
                allCalls.push(...calls);
                console.log(`  Page ${page}: ${calls.length} calls (total: ${allCalls.length})`);
                page++;
                
                if (calls.length < 100) {
                    hasMore = false;
                }
            } else {
                hasMore = false;
            }
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.error(`Error fetching page ${page}:`, error);
            break;
        }
    }
    
    return allCalls;
}

async function countCallsAfterSpecificCall(callId, afterDate) {
    console.log(`🎯 Counting calls after: ${callId}`);
    console.log(`📅 Date threshold: ${afterDate}`);
    console.log('=====================================\n');
    
    const calls = await getCallsAfterDate(afterDate);
    
    console.log('\n📊 Results:');
    console.log('=====================================');
    console.log(`📞 Total calls after ${afterDate}: ${calls.length}`);
    
    if (calls.length > 0) {
        // Sort by creation time
        calls.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        
        console.log(`📅 Date range:`);
        console.log(`  From: ${calls[0].createdAt}`);
        console.log(`  To: ${calls[calls.length - 1].createdAt}`);
        
        // Group by date
        const byDate = {};
        calls.forEach(call => {
            const date = call.createdAt.split('T')[0];
            byDate[date] = (byDate[date] || 0) + 1;
        });
        
        console.log('\n📊 Breakdown by date:');
        Object.entries(byDate)
            .sort(([a], [b]) => a.localeCompare(b))
            .forEach(([date, count]) => {
                console.log(`  ${date}: ${count} calls`);
            });
        
        // Calculate costs and transcripts
        const totalCost = calls.reduce((sum, c) => sum + (c.cost || 0), 0);
        const withTranscripts = calls.filter(c => 
            c.transcript || 
            (c.messages && c.messages.length > 0) ||
            (c.artifact && c.artifact.transcript)
        );
        const successful = calls.filter(c => c.status === 'ended');
        
        console.log('\n💰 Financial Summary:');
        console.log(`  Total cost: $${totalCost.toFixed(2)}`);
        console.log(`  Average per call: $${(totalCost / calls.length).toFixed(4)}`);
        
        console.log('\n📋 Quality Summary:');
        console.log(`  Successful calls: ${successful.length}/${calls.length} (${(successful.length/calls.length*100).toFixed(1)}%)`);
        console.log(`  With transcripts: ${withTranscripts.length}/${calls.length} (${(withTranscripts.length/calls.length*100).toFixed(1)}%)`);
    }
    
    return calls.length;
}

// Main execution
if (require.main === module) {
    // Call ID from Airtable and its date from grep result
    const targetCallId = '8fc39f3b-54b6-468d-ac32-abca268fd799';
    const afterDate = '2025-09-02T02:36:46.155Z';
    
    countCallsAfterSpecificCall(targetCallId, afterDate)
        .then(count => {
            console.log('\n🎯 FINAL ANSWER:');
            console.log('=====================================');
            console.log(`📞 Calls after ${targetCallId}: ${count}`);
            console.log('✅ This is the exact number to sync to Airtable!');
        })
        .catch(error => {
            console.error('\n❌ Count failed:', error);
            process.exit(1);
        });
}

module.exports = { countCallsAfterSpecificCall };