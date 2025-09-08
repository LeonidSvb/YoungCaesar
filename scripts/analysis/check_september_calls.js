require('dotenv').config();

const VAPI_API_KEY = process.env.VAPI_API_KEY;

async function getCallsForPeriod(startDate, endDate) {
    try {
        console.log(`\n📞 Fetching calls from ${startDate} to ${endDate}...`);
        
        const url = `https://api.vapi.ai/call?createdAtGt=${startDate}T00:00:00.000Z&createdAtLt=${endDate}T23:59:59.999Z&limit=1000`;
        
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
        return calls || [];
    } catch (error) {
        console.error('Error fetching calls:', error);
        return [];
    }
}

async function checkSeptemberCalls() {
    console.log('🔍 Checking calls from September 2-8, 2025...\n');
    
    // Check each day separately
    const dailyStats = [];
    let totalCalls = 0;
    
    for (let day = 2; day <= 8; day++) {
        const date = `2025-09-${day.toString().padStart(2, '0')}`;
        const nextDate = day === 8 ? '2025-09-09' : `2025-09-${(day + 1).toString().padStart(2, '0')}`;
        
        const calls = await getCallsForPeriod(date, nextDate);
        
        console.log(`📅 ${date}: ${calls.length} calls`);
        
        if (calls.length > 0) {
            // Show some details about the calls
            const successfulCalls = calls.filter(c => c.status === 'ended');
            const withTranscripts = calls.filter(c => c.transcript || (c.messages && c.messages.length > 0));
            const totalCost = calls.reduce((sum, c) => sum + (c.cost || 0), 0);
            
            console.log(`  ✅ Successful: ${successfulCalls.length}`);
            console.log(`  📝 With transcripts: ${withTranscripts.length}`);
            console.log(`  💰 Cost: $${totalCost.toFixed(2)}`);
            
            // Show first and last call times
            const sortedCalls = calls.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            if (sortedCalls.length > 0) {
                console.log(`  ⏰ First call: ${new Date(sortedCalls[0].createdAt).toLocaleTimeString()}`);
                console.log(`  ⏰ Last call: ${new Date(sortedCalls[sortedCalls.length - 1].createdAt).toLocaleTimeString()}`);
            }
        }
        
        totalCalls += calls.length;
        dailyStats.push({
            date,
            count: calls.length,
            calls
        });
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n📊 Summary for September 2-8, 2025:');
    console.log(`Total calls: ${totalCalls}`);
    
    if (totalCalls > 0) {
        // Get all calls for the period in one request for verification
        const allCalls = await getCallsForPeriod('2025-09-02', '2025-09-09');
        console.log(`\n✅ Verification: Direct API call for full period returned ${allCalls.length} calls`);
        
        if (allCalls.length !== totalCalls) {
            console.log(`⚠️  Discrepancy detected: ${Math.abs(allCalls.length - totalCalls)} difference`);
        }
    }
    
    return {
        totalCalls,
        dailyStats
    };
}

// Run if called directly
if (require.main === module) {
    checkSeptemberCalls()
        .then(result => {
            console.log('\n✅ Check complete!');
            if (result.totalCalls > 0) {
                console.log('\n💡 New calls found that need to be synced to Airtable!');
            } else {
                console.log('\n✨ No new calls in this period.');
            }
        })
        .catch(error => {
            console.error('\n❌ Check failed:', error);
            process.exit(1);
        });
}

module.exports = { checkSeptemberCalls };