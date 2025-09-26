require('dotenv').config();
const AirtableUploader = require('./airtable_uploader');
const fs = require('fs');
const path = require('path');

async function testUpload() {
    try {
        console.log('🧪 Running Airtable upload test...');
        
        // Read the raw calls data
        const dataPath = path.join(__dirname, '../../data/raw/vapi_raw_calls_2025-09-03.json');
        const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        
        // Get first few calls for testing
        let testCalls = [];
        for (const dateEntry of rawData) {
            if (dateEntry.calls && Array.isArray(dateEntry.calls) && dateEntry.calls.length > 0) {
                testCalls = dateEntry.calls.slice(0, 3); // Take first 3 calls
                break;
            }
        }

        if (testCalls.length === 0) {
            console.log('❌ No calls found for testing');
            return;
        }

        console.log(`📊 Testing with ${testCalls.length} calls`);
        
        // Show sample data structure
        console.log('\n📋 Sample call data:');
        console.log('ID:', testCalls[0].id);
        console.log('Cost:', testCalls[0].cost);
        console.log('Duration:', testCalls[0].duration);
        console.log('Type:', testCalls[0].type);
        console.log('Status:', testCalls[0].status);
        console.log('Recording URL:', testCalls[0].recordingUrl ? 'Available' : 'N/A');
        console.log('Transcript:', testCalls[0].transcript ? 'Available' : 'N/A');

        const uploader = new AirtableUploader();
        
        // Transform and upload test calls
        const transformedCalls = testCalls.map(call => uploader.transformCallData(call));
        
        console.log('\n🔄 Uploading test data...');
        await uploader.uploadBatch(transformedCalls);
        
        console.log('✅ Test upload completed successfully!');
        console.log('🌐 Check your Airtable to verify the data was uploaded correctly.');
        console.log('\n💡 If everything looks good, run: node airtable_uploader.js upload');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        
        if (error.message.includes('INVALID_PERMISSIONS')) {
            console.log('\n🔑 Permission Error Solutions:');
            console.log('1. Check that your Airtable API key is correct');
            console.log('2. Ensure the base ID and table ID are correct');
            console.log('3. Make sure you have write permissions to the table');
        }
        
        if (error.message.includes('UNKNOWN_FIELD_NAME')) {
            console.log('\n📝 Field Error Solutions:');
            console.log('1. The Airtable table needs to be created with the correct fields');
            console.log('2. Run the createTable() function first to set up the table structure');
        }
    }
}

testUpload();