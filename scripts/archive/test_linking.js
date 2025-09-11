require('dotenv').config();

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const CALLS_TABLE_ID = 'tblvXZt2zkkanjGdE'; // Calls - raw data
const CLIENTS_TABLE_ID = 'tblYp2tPaY7Hoz9Pe'; // CLIENTS_MASTER

class LinkingDebugger {
    constructor() {
        this.batchSize = 10;
    }

    async debugLinking() {
        console.log('🐛 DEBUGGING LINKING ISSUE');
        console.log('===========================\n');

        // Step 1: Check calls table structure
        console.log('1. 📋 Checking calls table structure...');
        const callsMetaUrl = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`;
        
        const metaResponse = await fetch(callsMetaUrl, {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const metaData = await metaResponse.json();
        const callsTable = metaData.tables.find(t => t.id === CALLS_TABLE_ID);
        
        console.log('📊 Calls table fields:');
        callsTable.fields.forEach(field => {
            console.log(`   - ${field.name} (${field.type})`);
            if (field.name === 'Client') {
                console.log(`     ✅ Client field found!`);
                if (field.options && field.options.linkedTableId) {
                    console.log(`     🔗 Linked to table: ${field.options.linkedTableId}`);
                    if (field.options.linkedTableId === CLIENTS_TABLE_ID) {
                        console.log(`     ✅ Correctly linked to CLIENTS_MASTER`);
                    } else {
                        console.log(`     ❌ Linked to wrong table!`);
                    }
                }
            }
        });

        // Step 2: Check sample calls records
        console.log('\n2. 🔍 Checking sample calls records...');
        const callsSampleUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${CALLS_TABLE_ID}?maxRecords=10`;
        
        const callsSampleResponse = await fetch(callsSampleUrl, {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const callsSampleData = await callsSampleResponse.json();
        
        console.log('📊 Sample calls data:');
        callsSampleData.records.forEach((record, index) => {
            const customerId = record.fields['Customer ID'];
            const clientField = record.fields['Client'];
            
            console.log(`   Call ${index + 1}:`);
            console.log(`     Customer ID: ${customerId ? customerId.substring(0, 8) + '...' : 'None'}`);
            console.log(`     Client field: ${clientField ? `[${clientField.length} links]` : 'EMPTY'}`);
        });

        // Step 3: Check clients table
        console.log('\n3. 📋 Checking CLIENTS_MASTER...');
        const clientsUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${CLIENTS_TABLE_ID}`;
        
        const clientsResponse = await fetch(clientsUrl, {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const clientsData = await clientsResponse.json();
        
        console.log(`📊 CLIENTS_MASTER has ${clientsData.records.length} records`);
        
        const clientsWithVAPI = clientsData.records.filter(r => r.fields['VAPI_ID']);
        console.log(`🆔 Clients with VAPI_ID: ${clientsWithVAPI.length}`);

        // Step 4: Test manual linking
        console.log('\n4. 🧪 Testing manual linking...');
        
        if (clientsWithVAPI.length > 0) {
            const testClient = clientsWithVAPI[0];
            const testVapiId = testClient.fields['VAPI_ID'];
            
            console.log(`   Test client: ${testClient.fields['Name']}`);
            console.log(`   VAPI ID: ${testVapiId}`);
            
            // Find calls for this client
            const testCallsUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${CALLS_TABLE_ID}?filterByFormula={Customer ID}="${testVapiId}"`;
            
            const testCallsResponse = await fetch(testCallsUrl, {
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            const testCallsData = await testCallsResponse.json();
            
            console.log(`   Found ${testCallsData.records.length} matching calls`);
            
            if (testCallsData.records.length > 0) {
                const testCall = testCallsData.records[0];
                console.log(`   Test call ID: ${testCall.fields['Call ID']}`);
                console.log(`   Customer ID: ${testCall.fields['Customer ID']}`);
                console.log(`   Current Client field: ${testCall.fields['Client'] ? 'HAS LINK' : 'EMPTY'}`);
                
                return {
                    clientRecordId: testClient.id,
                    callRecordId: testCall.id,
                    vapiId: testVapiId,
                    callId: testCall.fields['Call ID']
                };
            }
        }
        
        return null;
    }

    async testSingleLink(testData) {
        console.log('\n5. 🔧 Testing single link update...');
        
        if (!testData) {
            console.log('❌ No test data available');
            return;
        }

        try {
            const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${CALLS_TABLE_ID}`;
            
            const updateData = {
                records: [
                    {
                        id: testData.callRecordId,
                        fields: {
                            'Client': [testData.clientRecordId]
                        }
                    }
                ]
            };

            console.log('📤 Attempting single link update...');
            console.log(`   Call record: ${testData.callRecordId}`);
            console.log(`   Client record: ${testData.clientRecordId}`);

            const response = await fetch(updateUrl, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.log(`❌ Update failed: ${response.status}`);
                console.log(`Error: ${errorText}`);
                return false;
            }

            const result = await response.json();
            console.log('✅ Single link update successful!');
            
            // Verify the link
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const verifyUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${CALLS_TABLE_ID}/${testData.callRecordId}`;
            
            const verifyResponse = await fetch(verifyUrl, {
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            const verifyData = await verifyResponse.json();
            
            if (verifyData.fields['Client'] && verifyData.fields['Client'].length > 0) {
                console.log('✅ Link verified successfully!');
                console.log('🔗 Two-way linking should now work');
                return true;
            } else {
                console.log('❌ Link verification failed');
                return false;
            }

        } catch (error) {
            console.log(`❌ Single link test failed: ${error.message}`);
            return false;
        }
    }

    async clearAllLinks() {
        console.log('\n🗑️  CLEARING ALL EXISTING LINKS...');
        
        const callsUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${CALLS_TABLE_ID}?filterByFormula=NOT({Client}="")`;
        
        const response = await fetch(callsUrl, {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        
        console.log(`Found ${data.records.length} calls with existing links`);
        
        if (data.records.length === 0) {
            console.log('✅ No links to clear');
            return;
        }

        // Clear in batches
        for (let i = 0; i < data.records.length; i += this.batchSize) {
            const batch = data.records.slice(i, i + this.batchSize);
            
            const clearData = {
                records: batch.map(record => ({
                    id: record.id,
                    fields: {
                        'Client': null
                    }
                }))
            };

            const clearResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${CALLS_TABLE_ID}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(clearData)
            });

            if (clearResponse.ok) {
                console.log(`✅ Cleared batch ${Math.floor(i / this.batchSize) + 1}`);
            } else {
                console.log(`❌ Failed to clear batch ${Math.floor(i / this.batchSize) + 1}`);
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log('🗑️  All links cleared');
    }

    async fullDiagnostic() {
        try {
            const testData = await this.debugLinking();
            
            if (testData) {
                const linkWorked = await this.testSingleLink(testData);
                
                if (linkWorked) {
                    console.log('\n🎉 DIAGNOSIS COMPLETE');
                    console.log('====================');
                    console.log('✅ Linking mechanism works correctly');
                    console.log('💡 Problem was likely in batch processing');
                    console.log('🚀 Ready to run full linking process');
                } else {
                    console.log('\n❌ LINKING ISSUE FOUND');
                    console.log('=====================');
                    console.log('💡 Check Client field configuration in Airtable');
                    console.log('🔧 May need to recreate Client field');
                }
            } else {
                console.log('\n⚠️  NO TEST DATA');
                console.log('================');
                console.log('💡 Need to add clients first before linking');
            }
            
        } catch (error) {
            console.error('💥 Diagnostic failed:', error.message);
        }
    }
}

// CLI interface
if (require.main === module) {
    const linkDebugger = new LinkingDebugger();
    const command = process.argv[2];

    switch (command) {
        case 'debug':
            linkDebugger.fullDiagnostic();
            break;
        case 'clear':
            linkDebugger.clearAllLinks();
            break;
        case 'test':
            linkDebugger.debugLinking().then(testData => {
                if (testData) linkDebugger.testSingleLink(testData);
            });
            break;
        default:
            console.log('Usage:');
            console.log('  node test_linking.js debug - Full diagnostic');
            console.log('  node test_linking.js test  - Test single link');
            console.log('  node test_linking.js clear - Clear all links');
    }
}

module.exports = LinkingDebugger;