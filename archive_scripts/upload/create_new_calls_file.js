const fs = require('fs');
const path = require('path');

// Create file with only new calls from Sept 4-6
function createNewCallsFile() {
    try {
        const septDataPath = path.join(__dirname, '../collection/vapi_raw_calls_2025-09-08.json');
        const rawData = fs.readFileSync(septDataPath, 'utf8');
        const dailyData = JSON.parse(rawData);
        
        console.log('📊 Analyzing September data...');
        
        const newCalls = [];
        let totalByDate = {};
        
        dailyData.forEach(day => {
            totalByDate[day.date] = day.calls ? day.calls.length : 0;
            
            // Include calls from Sept 4-6 (skip 2nd as it's already in Airtable, 3rd is empty)
            if (['2025-09-04', '2025-09-05', '2025-09-06'].includes(day.date) && day.calls) {
                newCalls.push(...day.calls);
                console.log(`📅 ${day.date}: ${day.calls.length} calls`);
            }
        });
        
        console.log('\nAll September dates:');
        Object.entries(totalByDate).forEach(([date, count]) => {
            console.log(`  ${date}: ${count} calls`);
        });
        
        console.log(`\n📈 Total new calls to upload: ${newCalls.length}`);
        
        if (newCalls.length === 0) {
            console.log('❌ No new calls found');
            return null;
        }
        
        // Create temporary file with new calls in correct format for uploader
        const outputPath = path.join(__dirname, '../collection/new_calls_only.json');
        
        // Group calls by date to match uploader's expected structure
        const callsByDate = {};
        newCalls.forEach(call => {
            const callDate = call.createdAt.split('T')[0]; // Extract date from timestamp
            if (!callsByDate[callDate]) {
                callsByDate[callDate] = [];
            }
            callsByDate[callDate].push(call);
        });
        
        // Format as array of date objects (same as raw data structure)
        const formattedData = Object.entries(callsByDate).map(([date, calls]) => ({
            date: date,
            calls: calls
        })).sort((a, b) => a.date.localeCompare(b.date));
        
        fs.writeFileSync(outputPath, JSON.stringify(formattedData, null, 2));
        
        console.log(`✅ Created file: ${outputPath}`);
        console.log(`📊 File size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(1)} MB`);
        
        return {
            filePath: outputPath,
            count: newCalls.length
        };
        
    } catch (error) {
        console.error('Error:', error);
        return null;
    }
}

if (require.main === module) {
    createNewCallsFile();
}

module.exports = { createNewCallsFile };