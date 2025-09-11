require('dotenv').config();

const https = require('https');

const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_ID = process.env.AIRTABLE_TABLE_ID;

console.log('🔍 GETTING ALL FIELDS FROM AIRTABLE (INCLUDING EMPTY)');
console.log('==================================================\n');

// Method 1: Get table schema using Airtable Meta API
function getTableSchema() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.airtable.com',
            port: 443,
            path: `/v0/meta/bases/${BASE_ID}/tables`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve(JSON.parse(data));
                } else {
                    reject(new Error(`Meta API failed: ${res.statusCode} - ${data}`));
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

// Method 2: Get sample records and extract all field names
function getSampleRecords() {
    return new Promise((resolve, reject) => {
        const timestamp = Date.now();
        const options = {
            hostname: 'api.airtable.com',
            port: 443,
            path: `/v0/${BASE_ID}/${TABLE_ID}?maxRecords=10&_t=${timestamp}`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve(JSON.parse(data));
                } else {
                    reject(new Error(`Records API failed: ${res.statusCode} - ${data}`));
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

async function analyzeAllFields() {
    try {
        console.log('📊 METHOD 1: Using Meta API...');
        
        try {
            const metaData = await getTableSchema();
            const targetTable = metaData.tables.find(table => table.id === TABLE_ID);
            
            if (targetTable) {
                console.log(`✅ Found table: ${targetTable.name}`);
                console.log(`📋 Total fields from Meta API: ${targetTable.fields.length}\n`);
                
                console.log('ALL FIELDS (from Meta API):');
                console.log('===========================');
                
                targetTable.fields.forEach((field, i) => {
                    console.log(`${(i+1).toString().padStart(3)}. ${field.name} (${field.type})`);
                });
                
                // Check for QCI fields specifically
                console.log('\n🎯 QCI-RELATED FIELDS:');
                console.log('=======================');
                
                const qciFields = targetTable.fields.filter(field => {
                    const name = field.name.toLowerCase();
                    return name.includes('qci') || 
                           name.includes('agent') || 
                           name.includes('coaching') ||
                           name.includes('classification') ||
                           name.includes('objection') ||
                           name.includes('compliance') ||
                           name.includes('brand') ||
                           name.includes('meeting') ||
                           name.includes('evidence') ||
                           name.includes('dead') ||
                           name.includes('cta') ||
                           name.includes('time') ||
                           name.includes('alternative') ||
                           name.includes('language') ||
                           name.includes('tips');
                });
                
                if (qciFields.length > 0) {
                    qciFields.forEach(field => {
                        console.log(`✅ ${field.name} (${field.type})`);
                    });
                } else {
                    console.log('❌ No QCI fields found in Meta API');
                }
                
            } else {
                throw new Error('Table not found in Meta API');
            }
        } catch (metaError) {
            console.log(`❌ Meta API failed: ${metaError.message}`);
            console.log('📊 METHOD 2: Using Records API...');
        }
        
        // Method 2: Records API
        const recordsData = await getSampleRecords();
        
        if (recordsData.records && recordsData.records.length > 0) {
            // Collect all field names from all records
            const allFields = new Set();
            
            recordsData.records.forEach(record => {
                Object.keys(record.fields).forEach(fieldName => {
                    allFields.add(fieldName);
                });
            });
            
            const fieldList = Array.from(allFields).sort();
            
            console.log('\n📊 METHOD 2 RESULTS:');
            console.log('====================');
            console.log(`📋 Total fields from Records: ${fieldList.length}\n`);
            
            console.log('ALL FIELDS (from Records):');
            console.log('===========================');
            
            fieldList.forEach((field, i) => {
                console.log(`${(i+1).toString().padStart(3)}. ${field}`);
            });
            
            // Check QCI fields in records
            console.log('\n🎯 QCI-RELATED FIELDS (from Records):');
            console.log('======================================');
            
            const qciFieldsFromRecords = fieldList.filter(field => {
                const name = field.toLowerCase();
                return name.includes('qci') || 
                       name.includes('agent') || 
                       name.includes('coaching') ||
                       name.includes('classification') ||
                       name.includes('objection') ||
                       name.includes('compliance') ||
                       name.includes('brand') ||
                       name.includes('meeting') ||
                       name.includes('evidence') ||
                       name.includes('dead') ||
                       name.includes('cta') ||
                       name.includes('time') ||
                       name.includes('alternative') ||
                       name.includes('language') ||
                       name.includes('tips');
            });
            
            if (qciFieldsFromRecords.length > 0) {
                qciFieldsFromRecords.forEach(field => {
                    console.log(`✅ ${field}`);
                });
                
                console.log(`\n🎉 FOUND ${qciFieldsFromRecords.length} QCI FIELDS!`);
                
            } else {
                console.log('❌ No QCI fields found in Records API');
                console.log('\n🔍 SEARCHING FOR SIMILAR FIELDS...');
                
                const similarFields = fieldList.filter(field => {
                    const name = field.toLowerCase();
                    return name.includes('score') || 
                           name.includes('ratio') || 
                           name.includes('call') ||
                           name.includes('analysis');
                });
                
                if (similarFields.length > 0) {
                    console.log('Similar fields found:');
                    similarFields.forEach(field => console.log(`- ${field}`));
                } else {
                    console.log('No similar fields found either.');
                }
            }
            
        } else {
            console.log('❌ No records found to analyze fields');
        }
        
    } catch (error) {
        console.error('❌ Error analyzing fields:', error.message);
    }
}

analyzeAllFields();