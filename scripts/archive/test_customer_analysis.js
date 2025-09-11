require('dotenv').config();

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const CALLS_TABLE_ID = 'tblvXZt2zkkanjGdE'; // Calls - raw data
const CLIENTS_TABLE_ID = 'tblYp2tPaY7Hoz9Pe'; // Your new CLIENTS_MASTER table

class CustomerAnalyzer {
    constructor() {
        this.leadTables = {
            'E164_YC': 'tblLmWcITpAZdKhs2',
            'E164_Biesse': 'tblZ0UPX8U6E081yC',
        };
    }

    async analyzeCustomerIDs() {
        console.log('🔍 CUSTOMER ID ANALYSIS');
        console.log('========================\n');

        // Get sample calls data
        console.log('📊 Analyzing calls table...');
        const callsUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${CALLS_TABLE_ID}?maxRecords=100`;
        
        const callsResponse = await fetch(callsUrl, {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const callsData = await callsResponse.json();
        
        console.log(`📋 Analyzing ${callsData.records.length} call records`);
        
        // Analyze Customer ID patterns
        const customerIdAnalysis = {};
        const phoneToCustomerMap = {};
        const customerIdCounts = {};
        
        callsData.records.forEach(record => {
            const fields = record.fields;
            const customerId = fields['Customer ID'];
            const phone = fields['Phone'];
            const callId = fields['Call ID'];
            
            if (customerId) {
                // Count calls per customer ID
                customerIdCounts[customerId] = (customerIdCounts[customerId] || 0) + 1;
                
                // Map phone to customer ID
                if (phone) {
                    if (!phoneToCustomerMap[phone]) {
                        phoneToCustomerMap[phone] = [];
                    }
                    phoneToCustomerMap[phone].push({
                        customerId,
                        callId,
                        assistantName: fields['Assistant Name'],
                        status: fields['Status'],
                        createdAt: fields['Created At']
                    });
                }
                
                if (!customerIdAnalysis[customerId]) {
                    customerIdAnalysis[customerId] = {
                        calls: [],
                        phone: phone,
                        assistantName: fields['Assistant Name']
                    };
                }
                
                customerIdAnalysis[customerId].calls.push({
                    callId,
                    phone,
                    status: fields['Status'],
                    createdAt: fields['Created At'],
                    cost: fields['Cost']
                });
            }
        });

        // Find customers with multiple calls
        const multipleCallCustomers = Object.keys(customerIdCounts)
            .filter(customerId => customerIdCounts[customerId] > 1)
            .map(customerId => ({
                customerId,
                callCount: customerIdCounts[customerId],
                details: customerIdAnalysis[customerId]
            }))
            .sort((a, b) => b.callCount - a.callCount);

        console.log(`\n📊 CUSTOMER ID STATISTICS:`);
        console.log(`Total unique Customer IDs: ${Object.keys(customerIdCounts).length}`);
        console.log(`Customers with multiple calls: ${multipleCallCustomers.length}`);
        console.log(`Total call records analyzed: ${callsData.records.length}`);
        
        // Show top customers with multiple calls
        console.log(`\n🔄 TOP CUSTOMERS WITH MULTIPLE CALLS:`);
        multipleCallCustomers.slice(0, 10).forEach((customer, index) => {
            console.log(`${index + 1}. Customer ID: ${customer.customerId.substring(0, 8)}...`);
            console.log(`   Calls: ${customer.callCount}`);
            console.log(`   Phone: ${customer.details.phone}`);
            console.log(`   Assistant: ${customer.details.assistantName}`);
            console.log('   Call details:');
            customer.details.calls.forEach((call, i) => {
                console.log(`     ${i + 1}. ${call.createdAt} - ${call.status} - $${call.cost || 0}`);
            });
            console.log('');
        });

        // Analyze phone number patterns
        const phonesWithMultipleCalls = Object.keys(phoneToCustomerMap)
            .filter(phone => phoneToCustomerMap[phone].length > 1)
            .map(phone => ({
                phone,
                calls: phoneToCustomerMap[phone]
            }));

        console.log(`📞 PHONE NUMBER ANALYSIS:`);
        console.log(`Phones with multiple calls: ${phonesWithMultipleCalls.length}`);
        
        phonesWithMultipleCalls.slice(0, 5).forEach((phoneGroup, index) => {
            console.log(`${index + 1}. Phone: ${phoneGroup.phone}`);
            console.log(`   Calls: ${phoneGroup.calls.length}`);
            phoneGroup.calls.forEach((call, i) => {
                console.log(`     ${i + 1}. Customer ID: ${call.customerId.substring(0, 8)}... - ${call.createdAt}`);
            });
            console.log('');
        });

        return {
            customerIdAnalysis,
            multipleCallCustomers,
            phoneToCustomerMap,
            phonesWithMultipleCalls
        };
    }

    async testMigration50Leads() {
        console.log('\n\n🧪 TEST MIGRATION: 50 LEADS');
        console.log('=============================\n');

        // Get 50 leads from one table
        const testTableId = this.leadTables['E164_YC'];
        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${testTableId}?maxRecords=50`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const leadsData = await response.json();
        console.log(`📊 Got ${leadsData.records.length} leads for testing`);

        // Transform leads
        const transformedLeads = leadsData.records.map((record, index) => {
            const fields = record.fields;
            
            return {
                fields: {
                    'Name': fields['Name'] || `Test Lead ${index + 1}`,
                    'Phone': fields['Number'] || `+1-555-${String(index + 1).padStart(4, '0')}`,
                    'Email': fields['EMAIL'] || `test${index + 1}@example.com`,
                    'Company': fields['WEBSITE'] || `Company ${index + 1}`,
                    'Market': 'TEST',
                    'Keywords': fields['KEYWORD'] || 'test keywords',
                    'BDR': fields['BDR'] || 'Test BDR',
                    'Call_Status': fields['Call Status'] || 'Not Called',
                    'VAPI_ID': fields['VAPIiD'] || `test-vapi-${index + 1}`,
                    'Priority': fields['Priority'] || 'Medium',
                    'City': fields['City'] || 'Test City',
                    'Country': fields['Country'] || 'TEST'
                }
            };
        });

        // Upload test batch
        const uploadUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${CLIENTS_TABLE_ID}`;
        
        // Split into batches of 10
        const batchSize = 10;
        let uploaded = 0;
        
        for (let i = 0; i < transformedLeads.length; i += batchSize) {
            const batch = transformedLeads.slice(i, i + batchSize);
            
            try {
                const uploadResponse = await fetch(uploadUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ records: batch })
                });

                if (!uploadResponse.ok) {
                    throw new Error(`HTTP error! status: ${uploadResponse.status}`);
                }

                const result = await uploadResponse.json();
                uploaded += batch.length;
                
                console.log(`✅ Uploaded batch ${Math.floor(i / batchSize) + 1}: ${batch.length} records (Total: ${uploaded})`);
                
                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`❌ Failed to upload batch:`, error.message);
                break;
            }
        }

        console.log(`\n🎉 TEST MIGRATION COMPLETED!`);
        console.log(`✅ Successfully uploaded: ${uploaded} test records`);
        
        return { uploaded, transformedLeads };
    }

    async checkVAPIIDMatching(customerAnalysis) {
        console.log('\n\n🔗 VAPI ID MATCHING ANALYSIS');
        console.log('==============================\n');

        // Get some leads with VAPI IDs
        const testTableId = this.leadTables['E164_YC'];
        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${testTableId}?maxRecords=20`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const leadsData = await response.json();
        
        // Extract VAPI IDs from leads
        const leadVAPIIds = new Set();
        leadsData.records.forEach(record => {
            const vapiId = record.fields.VAPIiD;
            if (vapiId) leadVAPIIds.add(vapiId);
        });

        // Get Customer IDs from calls
        const callsUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${CALLS_TABLE_ID}?maxRecords=100`;
        const callsResponse = await fetch(callsUrl, {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const callsData = await callsResponse.json();
        const callCustomerIds = new Set();
        callsData.records.forEach(record => {
            const customerId = record.fields['Customer ID'];
            if (customerId) callCustomerIds.add(customerId);
        });

        console.log(`📊 VAPI ID COMPARISON:`);
        console.log(`VAPI IDs in leads: ${leadVAPIIds.size}`);
        console.log(`Customer IDs in calls: ${callCustomerIds.size}`);

        // Check for overlaps
        const overlaps = [...leadVAPIIds].filter(id => callCustomerIds.has(id));
        console.log(`🔄 Overlapping IDs: ${overlaps.length}`);
        
        if (overlaps.length > 0) {
            console.log(`✅ MATCHING CONFIRMED! Found ${overlaps.length} VAPI IDs that match Customer IDs`);
            console.log('Sample matches:');
            overlaps.slice(0, 5).forEach((id, index) => {
                console.log(`  ${index + 1}. ${id.substring(0, 8)}...`);
            });
        } else {
            console.log(`❌ NO MATCHES FOUND - need to investigate field mapping`);
        }

        return {
            leadVAPIIds: Array.from(leadVAPIIds),
            callCustomerIds: Array.from(callCustomerIds),
            overlaps
        };
    }

    async runFullAnalysis() {
        try {
            const customerAnalysis = await this.analyzeCustomerIDs();
            const migrationResult = await this.testMigration50Leads();
            const matchingAnalysis = await this.checkVAPIIDMatching(customerAnalysis);
            
            console.log('\n📋 ANALYSIS SUMMARY');
            console.log('===================');
            console.log(`✅ Customer ID analysis: ${Object.keys(customerAnalysis.customerIdAnalysis).length} unique customers found`);
            console.log(`✅ Test migration: ${migrationResult.uploaded} leads uploaded`);
            console.log(`✅ VAPI ID matching: ${matchingAnalysis.overlaps.length} potential links found`);
            
            if (matchingAnalysis.overlaps.length > 0) {
                console.log('\n🎯 RECOMMENDATION: Use Customer ID = VAPI ID matching');
                console.log('This will properly link clients to their call history');
            } else {
                console.log('\n💡 RECOMMENDATION: Use phone number matching as fallback');
                console.log('VAPI ID matching may need field name adjustments');
            }
            
        } catch (error) {
            console.error('❌ Analysis failed:', error.message);
        }
    }
}

if (require.main === module) {
    const analyzer = new CustomerAnalyzer();
    analyzer.runFullAnalysis();
}

module.exports = CustomerAnalyzer;