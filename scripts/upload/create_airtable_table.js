require('dotenv').config();

console.log('📋 AIRTABLE TABLE SETUP INSTRUCTIONS');
console.log('=====================================\n');

console.log('Since Airtable doesn\'t allow programmatic table creation via API,');
console.log('you need to manually create the table structure in Airtable.\n');

console.log('🌐 Go to your Airtable base:');
console.log(`   https://airtable.com/${process.env.AIRTABLE_BASE_ID}\n`);

console.log('📝 Create a new table or modify the existing one with these fields:\n');

const fields = [
    { name: 'Call ID', type: 'Single line text' },
    { name: 'Phone', type: 'Single line text' },
    { name: 'Cost', type: 'Currency' },
    { name: 'Duration (seconds)', type: 'Number' },
    { name: 'Duration (formatted)', type: 'Single line text' },
    { name: 'Type', type: 'Single line text' },
    { name: 'Status', type: 'Single select', options: ['ended', 'in-progress', 'failed'] },
    { name: 'End Reason', type: 'Single line text' },
    { name: 'Created At', type: 'Date and time' },
    { name: 'Started At', type: 'Date and time' },
    { name: 'Ended At', type: 'Date and time' },
    { name: 'Updated At', type: 'Date and time' },
    { name: 'Assistant ID', type: 'Single line text' },
    { name: 'Customer ID', type: 'Single line text' },
    { name: 'Phone Number ID', type: 'Single line text' },
    { name: 'Organization ID', type: 'Single line text' },
    { name: 'Has Transcript', type: 'Checkbox' },
    { name: 'Transcript', type: 'Long text' },
    { name: 'Summary', type: 'Long text' },
    { name: 'Recording URL', type: 'URL' },
    { name: 'Stereo Recording URL', type: 'URL' },
    { name: 'STT Cost', type: 'Currency' },
    { name: 'LLM Cost', type: 'Currency' },
    { name: 'TTS Cost', type: 'Currency' },
    { name: 'VAPI Cost', type: 'Currency' },
    { name: 'Chat Cost', type: 'Currency' },
    { name: 'Analysis Cost', type: 'Currency' },
    { name: 'LLM Prompt Tokens', type: 'Number' },
    { name: 'LLM Completion Tokens', type: 'Number' },
    { name: 'TTS Characters', type: 'Number' },
    { name: 'Messages Count', type: 'Number' },
    { name: 'First Message', type: 'Long text' },
    { name: 'Last Message', type: 'Long text' }
];

fields.forEach((field, index) => {
    console.log(`${(index + 1).toString().padStart(2, ' ')}. Field: "${field.name}"`);
    console.log(`    Type: ${field.type}`);
    if (field.options) {
        console.log(`    Options: ${field.options.join(', ')}`);
    }
    console.log('');
});

console.log('🎯 QUICK SETUP TIPS:');
console.log('1. You can copy-paste field names exactly as shown above');
console.log('2. For "Single select" fields, add the options shown');
console.log('3. Currency fields should use USD ($)');
console.log('4. Date fields should include time');
console.log('5. URL fields will automatically validate links\n');

console.log('💡 ALTERNATIVE: Use the Airtable Web Interface');
console.log('1. Go to your base');
console.log('2. Create a new table called "VAPI Calls"');
console.log('3. Add all the fields listed above');
console.log('4. Come back and run the test upload\n');

console.log('⚡ FAST OPTION: CSV Import');
console.log('You can also create a CSV with headers and import it to create the table structure automatically.');

// Create a sample CSV with headers
const csvHeaders = fields.map(field => `"${field.name}"`).join(',');
const sampleDataPath = require('path').join(__dirname, '../../data/airtable_template.csv');

require('fs').writeFileSync(sampleDataPath, csvHeaders + '\n"sample","sample",0,0,"0:00","outboundPhoneCall","ended","","","","","","","","","","false","","","","",0,0,0,0,0,0,0,0,0,0,"",""');

console.log(`\n📄 Sample CSV created: ${sampleDataPath}`);
console.log('You can import this CSV to Airtable to create the table structure automatically.\n');

console.log('✅ Once you\'ve created the table structure, run:');
console.log('   node scripts/upload/test_airtable_upload.js');