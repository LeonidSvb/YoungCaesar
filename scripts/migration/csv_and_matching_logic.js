require('dotenv').config();
const fs = require('fs');
const path = require('path');

class CSVMatchingPlanner {
    constructor() {
        this.backupPath = './data/migration_backups/';
    }

    // ANALYSIS: Matching options between calls and clients
    analyzeMatchingOptions() {
        console.log('🔍 MATCHING LOGIC ANALYSIS');
        console.log('=========================\n');
        
        const matchingOptions = {
            option1: {
                name: 'BY PHONE NUMBER',
                pros: [
                    'Most logical - phone is what connects call to person',
                    'Both tables have phone field',  
                    'Handles multiple calls to same person',
                    'Natural business logic'
                ],
                cons: [
                    'Phone formats might differ (+1-555-123 vs +15551234567)',
                    'Potential formatting issues',
                    'Need normalization logic'
                ],
                reliability: '85%',
                implementation: 'Medium complexity'
            },
            
            option2: {
                name: 'BY CALL ID',
                pros: [
                    'Unique identifier',
                    'No duplicates possible',
                    'Clean one-to-one relationship'
                ],
                cons: [
                    'Call ID exists only AFTER call is made',
                    'Cannot link prospects who were not called yet',
                    'Prospects without calls would be orphaned',
                    'Breaks business logic (prospect -> call, not call -> prospect)'
                ],
                reliability: '100% for existing calls only',
                implementation: 'Easy but limited'
            },
            
            option3: {
                name: 'BY EMAIL',
                pros: [
                    'Usually unique',
                    'Clean format',
                    'Good secondary identifier'
                ],
                cons: [
                    'Not all prospects have email',
                    'Not all calls have email data', 
                    'People can have multiple emails',
                    'Less reliable than phone'
                ],
                reliability: '60%',
                implementation: 'Easy but incomplete'
            },
            
            option4: {
                name: 'HYBRID: PHONE + EMAIL + NAME',
                pros: [
                    'Highest accuracy',
                    'Handles edge cases',
                    'Fallback matching',
                    'Most comprehensive'
                ],
                cons: [
                    'Complex logic',
                    'Need fuzzy matching',
                    'More prone to errors in implementation'
                ],
                reliability: '95%',
                implementation: 'High complexity'
            }
        };
        
        Object.keys(matchingOptions).forEach(key => {
            const option = matchingOptions[key];
            console.log(`${key.toUpperCase()}: ${option.name}`);
            console.log(`Reliability: ${option.reliability}`);
            console.log(`Implementation: ${option.implementation}`);
            console.log('PROS:');
            option.pros.forEach(pro => console.log(`  + ${pro}`));
            console.log('CONS:');
            option.cons.forEach(con => console.log(`  - ${con}`));
            console.log('');
        });
        
        return matchingOptions;
    }

    // RECOMMENDATION: Best matching strategy
    recommendMatchingStrategy() {
        console.log('💡 RECOMMENDED MATCHING STRATEGY');
        console.log('=================================\n');
        
        const strategy = {
            primary: 'PHONE NUMBER (normalized)',
            reasoning: [
                'Phone is the actual connection point for calls',
                'Both tables have phone data',
                'Handles one-to-many relationship (one client, many calls)',
                'Business logic: Client exists, then gets called'
            ],
            
            implementation: {
                step1: 'Normalize all phone numbers to E.164 format (+1234567890)',
                step2: 'Clean phone data in both tables',
                step3: 'Create lookup field in calls table pointing to clients',
                step4: 'Add fallback matching by email for edge cases'
            },
            
            phoneNormalization: {
                from: ['+1-555-123-4567', '(555) 123-4567', '555.123.4567', '5551234567'],
                to: '+15551234567',
                logic: 'Remove all non-digits, add country code if missing, format as E.164'
            },
            
            linkingLogic: [
                '1. CLIENTS_MASTER table gets created first',
                '2. Add "Phone_Normalized" field to both tables',
                '3. Calls table gets "Client" link field',
                '4. Script matches calls to clients by normalized phone',
                '5. Unmatched calls create new client records automatically'
            ]
        };
        
        console.log(`PRIMARY STRATEGY: ${strategy.primary}`);
        console.log('\nREASONING:');
        strategy.reasoning.forEach(reason => console.log(`  ✓ ${reason}`));
        
        console.log('\nPHONE NORMALIZATION EXAMPLES:');
        strategy.phoneNormalization.from.forEach(example => {
            console.log(`  "${example}" → "${strategy.phoneNormalization.to}"`);
        });
        
        console.log('\nIMPLEMENTATION STEPS:');
        Object.keys(strategy.implementation).forEach(step => {
            console.log(`  ${step}: ${strategy.implementation[step]}`);
        });
        
        console.log('\nLINKING FLOW:');
        strategy.linkingLogic.forEach(step => console.log(`  ${step}`));
        
        return strategy;
    }

    // CREATE CSV TEMPLATE
    createCSVTemplate() {
        console.log('\n📄 CSV TEMPLATE GENERATION');
        console.log('===========================\n');
        
        const csvHeaders = [
            'Name',
            'Phone',
            'Phone_Normalized',
            'Email', 
            'Company',
            'Market',
            'Keywords',
            'BDR',
            'Website',
            'Call_Status',
            'Last_Called',
            'Total_Attempts',
            'Max_Attempts', 
            'Success_Level',
            'Meeting_Outcome',
            'Next_Step',
            'Interest_Level',
            'DNC',
            'City',
            'State',
            'Country',
            'Timezone',
            'Original_Source',
            'VAPI_ID',
            'Priority',
            'Weight',
            'Created_At',
            'Updated_At',
            'Notes'
        ];
        
        console.log(`CSV STRUCTURE: ${csvHeaders.length} columns`);
        csvHeaders.forEach((header, index) => {
            console.log(`${(index + 1).toString().padStart(2)}. ${header}`);
        });
        
        return csvHeaders;
    }

    // GENERATE CSV TEST DATA
    generateCSVTestData(headers) {
        console.log('\n📊 CSV TEST DATA');
        console.log('=================\n');
        
        const testRows = [
            {
                'Name': 'John Smith',
                'Phone': '+1-555-0101',
                'Phone_Normalized': '+15550101',
                'Email': 'john.smith@company.com',
                'Company': 'Tech Solutions Inc',
                'Market': 'USA',
                'Keywords': 'CRM software, automation',
                'BDR': 'Sarah Johnson',
                'Website': 'https://techsolutions.com',
                'Call_Status': 'Not Called',
                'Last_Called': '',
                'Total_Attempts': '0',
                'Max_Attempts': '3',
                'Success_Level': 'None',
                'Meeting_Outcome': '',
                'Next_Step': '',
                'Interest_Level': '3',
                'DNC': 'FALSE',
                'City': 'San Francisco',
                'State': 'CA',
                'Country': 'USA',
                'Timezone': 'America/Los_Angeles',
                'Original_Source': 'USA_Leads',
                'VAPI_ID': '',
                'Priority': 'High',
                'Weight': '5',
                'Created_At': '2025-01-01T00:00:00Z',
                'Updated_At': '2025-01-01T00:00:00Z',
                'Notes': 'High-value prospect from trade show'
            },
            {
                'Name': 'Maria Garcia',
                'Phone': '+34-91-123-4567',
                'Phone_Normalized': '+34911234567',
                'Email': 'm.garcia@eurotech.es',
                'Company': 'EuroTech Solutions',
                'Market': 'EU',
                'Keywords': 'manufacturing automation',
                'BDR': 'Mike Johnson', 
                'Website': 'https://eurotech.es',
                'Call_Status': 'Called',
                'Last_Called': '2025-01-15T10:30:00Z',
                'Total_Attempts': '2',
                'Max_Attempts': '5',
                'Success_Level': 'Medium',
                'Meeting_Outcome': 'Interested, follow up needed',
                'Next_Step': 'Send proposal',
                'Interest_Level': '4',
                'DNC': 'FALSE',
                'City': 'Madrid',
                'State': '',
                'Country': 'Spain',
                'Timezone': 'Europe/Madrid',
                'Original_Source': 'EU_Leads',
                'VAPI_ID': 'vapi-eu-001',
                'Priority': 'High',
                'Weight': '4',
                'Created_At': '2025-01-01T00:00:00Z',
                'Updated_At': '2025-01-15T10:30:00Z',
                'Notes': 'Spoke with decision maker, very positive response'
            },
            {
                'Name': 'Chen Wei',
                'Phone': '+86-10-8765-4321',
                'Phone_Normalized': '+861087654321',
                'Email': 'chen.wei@asiamanuf.cn',
                'Company': 'Asia Manufacturing Co',
                'Market': 'ASIA',
                'Keywords': 'precision machining, quality control',
                'BDR': 'Lisa Zhang',
                'Website': '',
                'Call_Status': 'Scheduled',
                'Last_Called': '2025-01-10T03:00:00Z',
                'Total_Attempts': '1',
                'Max_Attempts': '3',
                'Success_Level': 'Low',
                'Meeting_Outcome': '',
                'Next_Step': 'Technical demo scheduled',
                'Interest_Level': '2',
                'DNC': 'FALSE',
                'City': 'Beijing',
                'State': '',
                'Country': 'China',
                'Timezone': 'Asia/Shanghai',
                'Original_Source': 'ASIA_Leads',
                'VAPI_ID': '',
                'Priority': 'Medium',
                'Weight': '3',
                'Created_At': '2025-01-01T00:00:00Z',
                'Updated_At': '2025-01-10T03:00:00Z',
                'Notes': 'Language barrier, arranged translator for next call'
            }
        ];
        
        // Convert to CSV format
        const csvContent = [
            headers.join(','),
            ...testRows.map(row => 
                headers.map(header => {
                    const value = row[header] || '';
                    // Escape commas and quotes in CSV
                    return value.includes(',') || value.includes('"') ? 
                           `"${value.replace(/"/g, '""')}"` : value;
                }).join(',')
            )
        ].join('\n');
        
        const csvPath = path.join(this.backupPath, 'clients_test_data.csv');
        
        // Ensure directory exists
        if (!fs.existsSync(this.backupPath)) {
            fs.mkdirSync(this.backupPath, { recursive: true });
        }
        
        fs.writeFileSync(csvPath, csvContent);
        
        console.log(`✅ CSV TEST DATA CREATED`);
        console.log(`📁 File: ${csvPath}`);
        console.log(`📊 Records: ${testRows.length}`);
        console.log(`📋 Columns: ${headers.length}`);
        console.log(`💾 Size: ${(fs.statSync(csvPath).size / 1024).toFixed(1)} KB`);
        
        // Show sample of CSV content
        console.log('\n📋 CSV PREVIEW:');
        csvContent.split('\n').slice(0, 4).forEach((line, index) => {
            if (index === 0) console.log(`HEADERS: ${line.substring(0, 60)}...`);
            else console.log(`ROW ${index}: ${line.substring(0, 60)}...`);
        });
        
        return { csvPath, testRows };
    }

    // PHONE NORMALIZATION FUNCTION
    generatePhoneNormalizationScript() {
        console.log('\n🔧 PHONE NORMALIZATION SCRIPT');
        console.log('==============================\n');
        
        const normalizationScript = `
// Phone number normalization function
function normalizePhone(phone) {
    if (!phone) return '';
    
    // Remove all non-digit characters except +
    let cleaned = phone.replace(/[^+\\d]/g, '');
    
    // Handle different formats
    if (cleaned.startsWith('+')) {
        return cleaned; // Already in international format
    } else if (cleaned.startsWith('1') && cleaned.length === 11) {
        return '+' + cleaned; // US number with country code
    } else if (cleaned.length === 10) {
        return '+1' + cleaned; // US number without country code
    } else if (cleaned.length > 7) {
        // International number without +, assume it's correct
        return '+' + cleaned;
    }
    
    return phone; // Return original if can't normalize
}

// Test examples:
console.log(normalizePhone('+1-555-123-4567')); // +15551234567
console.log(normalizePhone('(555) 123-4567'));  // +15551234567  
console.log(normalizePhone('555.123.4567'));    // +15551234567
console.log(normalizePhone('34911234567'));     // +34911234567
`;
        
        const scriptPath = path.join(this.backupPath, 'phone_normalization.js');
        fs.writeFileSync(scriptPath, normalizationScript);
        
        console.log(`✅ NORMALIZATION SCRIPT CREATED: ${scriptPath}`);
        console.log('This script will be used to clean phone data before linking');
        
        return scriptPath;
    }
}

// MAIN EXECUTION
async function createCSVAndMatchingPlan() {
    const planner = new CSVMatchingPlanner();
    
    try {
        const matchingOptions = planner.analyzeMatchingOptions();
        const strategy = planner.recommendMatchingStrategy();
        const headers = planner.createCSVTemplate();
        const csvData = planner.generateCSVTestData(headers);
        const scriptPath = planner.generatePhoneNormalizationScript();
        
        console.log('\n🎯 SUMMARY & NEXT STEPS');
        console.log('=======================');
        console.log('1. ✅ Matching strategy: PHONE NUMBER (normalized)');
        console.log('2. ✅ CSV template and test data created');
        console.log('3. ✅ Phone normalization script ready');
        console.log('\nFILES CREATED:');
        console.log(`📄 CSV test data: ${csvData.csvPath}`);
        console.log(`🔧 Normalization script: ${scriptPath}`);
        console.log('\nNEXT ACTIONS:');
        console.log('1. Import CSV test data into new CLIENTS_MASTER table');
        console.log('2. Test phone normalization');
        console.log('3. Create lookup field linking to calls table');
        console.log('4. Run full migration when ready');
        
    } catch (error) {
        console.error('❌ Error creating CSV and matching plan:', error.message);
    }
}

if (require.main === module) {
    createCSVAndMatchingPlan();
}

module.exports = CSVMatchingPlanner;