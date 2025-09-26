require('dotenv').config();

// CLIENT TABLE CONSOLIDATION PLAN - Following CLAUDE.md principles

class ClientsTablePlanner {
    constructor() {
        // All lead tables from analysis
        this.leadTables = {
            'USA_Leads': { id: 'tblVSTLFdPSYjWQ89', records: '~500' },
            'EU_Leads': { id: 'tblhkE3kg4Pitcua6', records: '~800' },
            'ASIA_Leads': { id: 'tblZ9idb5hYqqSZHf', records: '~300' },
            'QC_Advisor': { id: 'tblg7fw9sseuGw1pr', records: '~400' },
            'OEM_Table': { id: 'tbleWG18EdYCz7V1m', records: '~600' },
            'E164_Biesse': { id: 'tblZ0UPX8U6E081yC', records: '~627' },
            'E164_QC': { id: 'tblQvINW9Gr83ogfc', records: '~500' },
            'E164_YC': { id: 'tblLmWcITpAZdKhs2', records: '~400' }
        };
        
        this.estimatedTotalRecords = 4127;
        this.expectedDeduplicatedRecords = 2500; // After removing duplicates by phone/email
    }

    // STEP 1: Analyze common fields across all lead tables
    analyzeCommonFields() {
        console.log('STEP 1: ANALYZING COMMON FIELDS');
        console.log('================================\n');
        
        // From previous analysis, these are the common fields
        const fieldMapping = {
            // Core Identity
            'Name': ['Name', 'Person First name + Person Last name'],
            'Phone': ['Number', 'Person Phone', 'Phone'],
            'Email': ['EMAIL', 'Person Email'],
            'Company': ['Company', 'WEBSITE/CO.', 'WEBSITE'],
            
            // Business Context  
            'Market': ['MARKET', 'Country'],
            'Keywords': ['KEYWORD', 'KEYWORDS'],
            'BDR': ['BDR'],
            'Website': ['WEBSITE', 'WEBSITE/CO.'],
            
            // Call Management
            'Call_Status': ['Call Status'],
            'Last_Called': ['Last Called', 'Last Call'],
            'Attempts': ['Attempts', 'Calls'],
            'Max_Attempts': ['MaxAttempts'],
            
            // Location
            'City': ['City'],
            'State': ['State'],
            'Country': ['Country'],
            'Timezone_ID': ['TimeZoneID'],
            'Timezone_Name': ['TimeZoneName'],
            
            // CRM Fields
            'Success': ['Success'],
            'Meeting_Outcome': ['Meeting Outcome'],
            'Next_Step': ['Next Step'],
            'Interest_Level': ['Interest Level'],
            'DNC': ['DNC'],
            
            // Technical
            'VAPI_ID': ['VAPIiD'],
            'Priority': ['Priorirty', 'Priority'],
            'Weight': ['Weight'],
            'Lock': ['Lock'],
            
            // Dates
            'Created_At': ['createdAt'],
            'Updated_At': ['updatedAt']
        };
        
        console.log('UNIFIED FIELD STRUCTURE:');
        Object.keys(fieldMapping).forEach(unifiedField => {
            const sources = fieldMapping[unifiedField];
            console.log(`${unifiedField.padEnd(20)} <- ${sources.join(', ')}`);
        });
        
        return fieldMapping;
    }

    // STEP 2: Design final table schema
    designUnifiedSchema() {
        console.log('\n\nSTEP 2: UNIFIED CLIENTS TABLE SCHEMA');
        console.log('=====================================\n');
        
        const schema = {
            tableName: 'CLIENTS_MASTER',
            description: 'Unified table combining all leads/prospects from 8 different tables',
            
            fields: [
                // CORE IDENTITY (Required)
                { name: 'Name', type: 'singleLineText', required: true },
                { name: 'Phone', type: 'phoneNumber', required: true, unique: true },
                { name: 'Email', type: 'email', required: false },
                { name: 'Company', type: 'singleLineText', required: false },
                
                // BUSINESS CONTEXT
                { name: 'Market', type: 'singleSelect', options: ['USA', 'EU', 'ASIA', 'Global'] },
                { name: 'Keywords', type: 'multilineText', description: 'Business keywords/interests' },
                { name: 'BDR', type: 'singleLineText', description: 'Business Development Rep' },
                { name: 'Website', type: 'url', required: false },
                
                // CALL MANAGEMENT
                { name: 'Call_Status', type: 'singleSelect', options: ['Not Called', 'Called', 'Scheduled', 'Completed', 'DNC'] },
                { name: 'Last_Called', type: 'dateTime', required: false },
                { name: 'Total_Attempts', type: 'number', defaultValue: 0 },
                { name: 'Max_Attempts', type: 'number', defaultValue: 3 },
                
                // RESULTS TRACKING
                { name: 'Success_Level', type: 'singleSelect', options: ['None', 'Low', 'Medium', 'High', 'Converted'] },
                { name: 'Meeting_Outcome', type: 'singleLineText', required: false },
                { name: 'Next_Step', type: 'singleLineText', required: false },
                { name: 'Interest_Level', type: 'rating', max: 5 },
                { name: 'DNC', type: 'checkbox', defaultValue: false },
                
                // LOCATION
                { name: 'City', type: 'singleLineText', required: false },
                { name: 'State', type: 'singleLineText', required: false },
                { name: 'Country', type: 'singleSelect', options: ['USA', 'Canada', 'UK', 'Germany', 'France', 'Italy', 'China', 'Japan', 'Other'] },
                { name: 'Timezone', type: 'singleLineText', required: false },
                
                // TECHNICAL & CRM
                { name: 'Original_Source', type: 'singleSelect', options: ['USA_Leads', 'EU_Leads', 'ASIA_Leads', 'QC_Advisor', 'OEM_Table', 'E164_Biesse', 'E164_QC', 'E164_YC'] },
                { name: 'VAPI_ID', type: 'singleLineText', required: false },
                { name: 'Priority', type: 'singleSelect', options: ['Low', 'Medium', 'High', 'Urgent'] },
                { name: 'Weight', type: 'number', defaultValue: 1 },
                
                // RELATIONSHIPS
                { name: 'Related_Calls', type: 'multipleRecordLinks', linkedTable: 'Calls - raw data' },
                
                // TIMESTAMPS
                { name: 'Created_At', type: 'dateTime', defaultValue: 'now' },
                { name: 'Updated_At', type: 'dateTime', defaultValue: 'now' },
                { name: 'Last_Activity', type: 'dateTime', required: false }
            ],
            
            views: [
                { name: 'All Clients', type: 'grid' },
                { name: 'Not Called', filter: 'Call_Status = "Not Called"' },
                { name: 'High Priority', filter: 'Priority = "High" OR Priority = "Urgent"' },
                { name: 'By Market', groupBy: 'Market' },
                { name: 'Recent Activity', sortBy: 'Last_Activity DESC' },
                { name: 'Successful Calls', filter: 'Success_Level != "None"' }
            ]
        };
        
        console.log(`TABLE: ${schema.tableName}`);
        console.log(`DESCRIPTION: ${schema.description}`);
        console.log(`TOTAL FIELDS: ${schema.fields.length}`);
        console.log(`ESTIMATED RECORDS: ~${this.expectedDeduplicatedRecords}`);
        
        console.log('\nFIELD BREAKDOWN:');
        schema.fields.forEach((field, index) => {
            const required = field.required ? ' [REQUIRED]' : '';
            const unique = field.unique ? ' [UNIQUE]' : '';
            console.log(`${(index + 1).toString().padStart(2)}. ${field.name.padEnd(20)} (${field.type})${required}${unique}`);
        });
        
        return schema;
    }

    // STEP 3: Generate JSON template
    generateJSONTemplate(schema) {
        console.log('\n\nSTEP 3: JSON TEMPLATE FOR AIRTABLE');
        console.log('===================================\n');
        
        // Airtable field type mapping
        const airtableFieldTypes = {
            'singleLineText': 'singleLineText',
            'multilineText': 'multilineText', 
            'phoneNumber': 'phoneNumber',
            'email': 'email',
            'url': 'url',
            'singleSelect': 'singleSelect',
            'number': 'number',
            'checkbox': 'checkbox',
            'dateTime': 'dateTime',
            'rating': 'rating',
            'multipleRecordLinks': 'multipleRecordLinks'
        };
        
        const template = {
            name: schema.tableName,
            description: schema.description,
            fields: schema.fields.map(field => {
                const airtableField = {
                    name: field.name,
                    type: airtableFieldTypes[field.type] || 'singleLineText'
                };
                
                // Add options for select fields
                if (field.options) {
                    airtableField.options = {
                        choices: field.options.map(option => ({ name: option }))
                    };
                }
                
                // Add linked table info
                if (field.type === 'multipleRecordLinks') {
                    airtableField.options = {
                        linkedTableId: 'tblvXZt2zkkanjGdE' // Your calls table ID
                    };
                }
                
                return airtableField;
            })
        };
        
        const jsonPath = './data/migration_backups/clients_table_template.json';
        const fs = require('fs');
        const path = require('path');
        
        // Ensure directory exists
        const dir = path.dirname(jsonPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(jsonPath, JSON.stringify(template, null, 2));
        
        console.log(`JSON Template saved to: ${jsonPath}`);
        console.log(`File size: ${(fs.statSync(jsonPath).size / 1024).toFixed(1)} KB`);
        
        return template;
    }

    // STEP 4: Generate test data
    generateTestData() {
        console.log('\n\nSTEP 4: TEST DATA GENERATION');
        console.log('=============================\n');
        
        const testRecords = [
            {
                "Name": "John Smith",
                "Phone": "+1-555-0101", 
                "Email": "john.smith@company.com",
                "Company": "Tech Solutions Inc",
                "Market": "USA",
                "Keywords": "CRM software, automation",
                "BDR": "Sarah Johnson",
                "Website": "https://techsolutions.com",
                "Call_Status": "Not Called",
                "Total_Attempts": 0,
                "Max_Attempts": 3,
                "Success_Level": "None",
                "Interest_Level": 3,
                "City": "San Francisco",
                "State": "CA", 
                "Country": "USA",
                "Original_Source": "USA_Leads",
                "Priority": "High",
                "Weight": 5
            },
            {
                "Name": "Maria Garcia",
                "Phone": "+34-91-123-4567",
                "Email": "m.garcia@eurotech.es", 
                "Company": "EuroTech Solutions",
                "Market": "EU",
                "Keywords": "manufacturing automation",
                "BDR": "Mike Johnson",
                "Website": "https://eurotech.es",
                "Call_Status": "Called",
                "Total_Attempts": 2,
                "Max_Attempts": 5,
                "Success_Level": "Medium", 
                "Meeting_Outcome": "Interested, follow up needed",
                "Next_Step": "Send proposal",
                "Interest_Level": 4,
                "City": "Madrid",
                "Country": "Spain",
                "Original_Source": "EU_Leads",
                "Priority": "High",
                "Weight": 4
            },
            {
                "Name": "Chen Wei",
                "Phone": "+86-10-8765-4321",
                "Email": "chen.wei@asiamanuf.cn",
                "Company": "Asia Manufacturing Co",
                "Market": "ASIA", 
                "Keywords": "precision machining, quality control",
                "BDR": "Lisa Zhang",
                "Call_Status": "Scheduled",
                "Total_Attempts": 1,
                "Max_Attempts": 3,
                "Success_Level": "Low",
                "Interest_Level": 2,
                "City": "Beijing",
                "Country": "China",
                "Original_Source": "ASIA_Leads", 
                "Priority": "Medium",
                "Weight": 3
            }
        ];
        
        const testDataPath = './data/migration_backups/clients_test_data.json';
        const fs = require('fs');
        
        fs.writeFileSync(testDataPath, JSON.stringify(testRecords, null, 2));
        
        console.log(`TEST DATA: ${testRecords.length} sample records`);
        console.log(`Saved to: ${testDataPath}`);
        console.log('These records represent data from USA, EU, and ASIA sources');
        
        return testRecords;
    }

    // STEP 5: Migration strategy
    createMigrationStrategy() {
        console.log('\n\nSTEP 5: MIGRATION STRATEGY');
        console.log('===========================\n');
        
        const strategy = {
            phase1: {
                name: 'TABLE CREATION',
                steps: [
                    '1. Create CLIENTS_MASTER table in Airtable',
                    '2. Upload JSON template to define structure', 
                    '3. Test with 3 sample records',
                    '4. Verify all fields work correctly'
                ],
                time: '15 minutes',
                risk: 'Low'
            },
            phase2: {
                name: 'DATA EXTRACTION', 
                steps: [
                    '1. Export all 8 lead tables to CSV/JSON',
                    '2. Clean and deduplicate by phone number',
                    '3. Map fields to unified schema',
                    '4. Validate data quality'
                ],
                time: '45 minutes',
                risk: 'Medium'
            },
            phase3: {
                name: 'DATA IMPORT',
                steps: [
                    '1. Import cleaned data in batches of 100',
                    '2. Monitor for errors and duplicates', 
                    '3. Verify record counts match expectations',
                    '4. Test linking with calls table'
                ],
                time: '30 minutes',
                risk: 'Medium'
            },
            phase4: {
                name: 'LINKING SETUP',
                steps: [
                    '1. Create phone number matching logic',
                    '2. Link existing calls to clients',
                    '3. Test call history display',
                    '4. Verify relationship integrity'
                ],
                time: '20 minutes', 
                risk: 'Low'
            }
        };
        
        Object.keys(strategy).forEach(phase => {
            const p = strategy[phase];
            console.log(`${phase.toUpperCase()}: ${p.name} (${p.time}, Risk: ${p.risk})`);
            p.steps.forEach(step => console.log(`  ${step}`));
            console.log('');
        });
        
        console.log('TOTAL TIME: ~110 minutes');
        console.log('EXPECTED RESULT: ~2,500 unified client records with call linking');
        
        return strategy;
    }
}

// MAIN EXECUTION
async function createClientsTablePlan() {
    const planner = new ClientsTablePlanner();
    
    try {
        const fieldMapping = planner.analyzeCommonFields();
        const schema = planner.designUnifiedSchema();
        const jsonTemplate = planner.generateJSONTemplate(schema);
        const testData = planner.generateTestData(); 
        const strategy = planner.createMigrationStrategy();
        
        console.log('\n\nNEXT STEPS:');
        console.log('===========');
        console.log('1. Review the JSON template and test data files');
        console.log('2. Create CLIENTS_MASTER table in Airtable manually');
        console.log('3. Import test data to verify structure');
        console.log('4. Run full migration script when ready');
        console.log('\nFiles created:');
        console.log('- ./data/migration_backups/clients_table_template.json');
        console.log('- ./data/migration_backups/clients_test_data.json');
        
    } catch (error) {
        console.error('Error creating clients table plan:', error.message);
    }
}

if (require.main === module) {
    createClientsTablePlan();
}

module.exports = ClientsTablePlanner;