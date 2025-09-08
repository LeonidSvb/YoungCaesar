require('dotenv').config();

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID;

async function countAirtableRecords() {
    try {
        console.log('📊 Counting total records in Airtable...\n');
        
        let totalRecords = 0;
        let offset = null;
        let requests = 0;
        const dateBreakdown = {};
        
        do {
            requests++;
            let url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?maxRecords=100&fields[]=Call%20ID&fields[]=Created%20At`;
            
            if (offset) {
                url += `&offset=${offset}`;
            }
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                console.error('Airtable API error:', response.status);
                break;
            }

            const data = await response.json();
            
            if (data.records) {
                totalRecords += data.records.length;
                console.log(`Request ${requests}: +${data.records.length} records (total: ${totalRecords})`);
                
                // Count by date
                data.records.forEach(record => {
                    if (record.fields['Created At']) {
                        const date = record.fields['Created At'].split('T')[0];
                        dateBreakdown[date] = (dateBreakdown[date] || 0) + 1;
                    }
                });
                
                offset = data.offset;
            } else {
                break;
            }
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        } while (offset);
        
        console.log('\n📈 Summary:');
        console.log('=====================================');
        console.log(`📞 Total records in Airtable: ${totalRecords}`);
        console.log(`🔄 API requests made: ${requests}`);
        
        console.log('\n📅 Records by date:');
        Object.entries(dateBreakdown)
            .sort(([a], [b]) => b.localeCompare(a)) // Sort by date descending
            .forEach(([date, count]) => {
                console.log(`  ${date}: ${count} records`);
            });
            
        // Count September records specifically
        const septemberDates = Object.entries(dateBreakdown)
            .filter(([date]) => date.startsWith('2025-09'))
            .reduce((sum, [, count]) => sum + count, 0);
            
        console.log(`\n🎯 September 2025 records: ${septemberDates}`);
        
        return {
            total: totalRecords,
            byDate: dateBreakdown,
            septemberTotal: septemberDates
        };
        
    } catch (error) {
        console.error('Error counting records:', error);
        return null;
    }
}

if (require.main === module) {
    countAirtableRecords()
        .then(result => {
            if (result) {
                console.log('\n✅ Count completed!');
            }
        })
        .catch(error => {
            console.error('\n❌ Count failed:', error);
            process.exit(1);
        });
}

module.exports = { countAirtableRecords };