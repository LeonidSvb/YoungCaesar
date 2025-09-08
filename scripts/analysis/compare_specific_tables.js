require('dotenv').config();

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

// Table IDs from URLs
const TABLE_1_ID = 'tblvXZt2zkkanjGdE'; // First table
const TABLE_2_ID = 'tblSaRXL7WavaZ1sK'; // Second table (E164.Biesse copy)

async function getAllRecords(tableId) {
    const records = [];
    let offset = '';
    
    while (true) {
        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}?pageSize=100${offset ? `&offset=${offset}` : ''}`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} for table ${tableId}`);
        }

        const data = await response.json();
        records.push(...data.records);
        
        if (!data.offset) break;
        offset = data.offset;
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    return records;
}

async function compareSpecificTables() {
    try {
        console.log('🔍 Comparing specific Airtable tables...\n');
        
        console.log('📊 Fetching data from both tables...');
        const [table1Records, table2Records] = await Promise.all([
            getAllRecords(TABLE_1_ID),
            getAllRecords(TABLE_2_ID)
        ]);
        
        console.log(`📋 Table 1: ${table1Records.length} records`);
        console.log(`📋 Table 2: ${table2Records.length} records\n`);
        
        // Get field names from both tables
        const table1Fields = table1Records.length > 0 ? Object.keys(table1Records[0].fields) : [];
        const table2Fields = table2Records.length > 0 ? Object.keys(table2Records[0].fields) : [];
        
        console.log('🏷️  TABLE 1 FIELDS:');
        table1Fields.forEach(field => console.log(`  - ${field}`));
        
        console.log('\n🏷️  TABLE 2 FIELDS:');
        table2Fields.forEach(field => console.log(`  - ${field}`));
        
        // Find common fields
        const commonFields = table1Fields.filter(field => table2Fields.includes(field));
        console.log(`\n🔗 COMMON FIELDS (${commonFields.length}):`);
        commonFields.forEach(field => console.log(`  - ${field}`));
        
        // Check for potential ID fields
        const potentialIdFields = commonFields.filter(field => 
            field.toLowerCase().includes('id') || 
            field.toLowerCase().includes('call') ||
            field.toLowerCase().includes('vapi') ||
            field.toLowerCase().includes('number') ||
            field.toLowerCase().includes('phone')
        );
        
        console.log(`\n🆔 POTENTIAL ID FIELDS (${potentialIdFields.length}):`);
        potentialIdFields.forEach(field => console.log(`  - ${field}`));
        
        // Compare by each potential ID field
        for (const field of potentialIdFields) {
            console.log(`\n🔍 COMPARING BY FIELD: "${field}"`);
            console.log('==========================================');
            
            // Get values from both tables
            const table1Values = new Set();
            const table2Values = new Set();
            
            table1Records.forEach(record => {
                const value = record.fields[field];
                if (value && value !== '' && value !== 'N/A') {
                    table1Values.add(String(value).trim());
                }
            });
            
            table2Records.forEach(record => {
                const value = record.fields[field];
                if (value && value !== '' && value !== 'N/A') {
                    table2Values.add(String(value).trim());
                }
            });
            
            // Find overlaps
            const overlaps = [...table1Values].filter(value => table2Values.has(value));
            
            console.log(`📊 Table 1 unique values: ${table1Values.size}`);
            console.log(`📊 Table 2 unique values: ${table2Values.size}`);
            console.log(`🔄 Overlapping values: ${overlaps.length}`);
            
            if (overlaps.length > 0) {
                console.log(`\n✅ FOUND ${overlaps.length} MATCHES:`);
                overlaps.slice(0, 10).forEach(value => console.log(`  - ${value}`));
                if (overlaps.length > 10) {
                    console.log(`  ... and ${overlaps.length - 10} more`);
                }
                
                // Calculate overlap percentage
                const overlapPercentage = ((overlaps.length / Math.max(table1Values.size, table2Values.size)) * 100).toFixed(1);
                console.log(`📈 Overlap percentage: ${overlapPercentage}%`);
            } else {
                console.log('❌ No overlaps found for this field');
            }
        }
        
        // Summary
        console.log('\n\n📋 SUMMARY');
        console.log('==================');
        
        let hasOverlaps = false;
        for (const field of potentialIdFields) {
            const table1Values = new Set();
            const table2Values = new Set();
            
            table1Records.forEach(record => {
                const value = record.fields[field];
                if (value && value !== '' && value !== 'N/A') {
                    table1Values.add(String(value).trim());
                }
            });
            
            table2Records.forEach(record => {
                const value = record.fields[field];
                if (value && value !== '' && value !== 'N/A') {
                    table2Values.add(String(value).trim());
                }
            });
            
            const overlaps = [...table1Values].filter(value => table2Values.has(value));
            
            if (overlaps.length > 0) {
                hasOverlaps = true;
                console.log(`✅ "${field}": ${overlaps.length} matches`);
            }
        }
        
        if (!hasOverlaps) {
            console.log('❌ No overlapping data found between the tables');
        }
        
        console.log(`\n🔗 Tables can be safely ${hasOverlaps ? 'merged with deduplication' : 'combined without conflicts'}`);
        
    } catch (error) {
        console.error('❌ Error comparing tables:', error.message);
    }
}

if (require.main === module) {
    compareSpecificTables();
}

module.exports = compareSpecificTables;