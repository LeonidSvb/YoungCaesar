require('dotenv').config();

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID;

async function getAirtableSample() {
    try {
        console.log('📊 Getting sample record from Airtable...');
        
        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?maxRecords=1`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.error('Airtable API error:', response.status, await response.text());
            return null;
        }

        const data = await response.json();
        
        if (data.records && data.records.length > 0) {
            const record = data.records[0];
            
            console.log('\n✅ Sample record structure:');
            console.log('=====================================');
            console.log('Record ID:', record.id);
            console.log('\nFields:');
            
            // Show all field names and their types/sample values
            const fields = record.fields;
            Object.keys(fields).forEach(fieldName => {
                const value = fields[fieldName];
                const type = typeof value;
                const preview = type === 'string' && value.length > 50 ? 
                    value.substring(0, 47) + '...' : value;
                
                console.log(`  ${fieldName}: (${type}) ${preview}`);
            });
            
            console.log('\n📋 All field names:');
            console.log(Object.keys(fields).map(f => `"${f}"`).join(', '));
            
            return {
                recordId: record.id,
                fields: fields,
                fieldNames: Object.keys(fields)
            };
        } else {
            console.log('❌ No records found in Airtable');
            return null;
        }
    } catch (error) {
        console.error('Error fetching from Airtable:', error);
        return null;
    }
}

if (require.main === module) {
    getAirtableSample()
        .then(result => {
            if (result) {
                console.log('\n✅ Format check complete!');
            }
        })
        .catch(error => {
            console.error('\n❌ Format check failed:', error);
            process.exit(1);
        });
}

module.exports = { getAirtableSample };