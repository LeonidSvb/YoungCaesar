const AirtableClient = require('./api/airtable_client');
const Logger = require('./utils/logger');

const logger = new Logger('airtable_setup.log');

async function setupQCIFields() {
    try {
        logger.info('Setting up QCI fields in Airtable...');
        
        const airtable = new AirtableClient();
        
        // Поля которые нужно добавить в VAPI_Calls таблицу
        const qciFields = [
            { name: 'QCI Overall Score', type: 'number', options: { precision: 0 } },
            { name: 'Approach Quality', type: 'number', options: { precision: 0 } },
            { name: 'Engagement Level', type: 'number', options: { precision: 0 } },
            { name: 'Information Gathering', type: 'number', options: { precision: 0 } },
            { name: 'Call Outcome Score', type: 'number', options: { precision: 0 } },
            { 
                name: 'Call Classification', 
                type: 'singleSelect', 
                options: { 
                    choices: [
                        { name: 'hot_lead', color: 'redBright' },
                        { name: 'warm_lead', color: 'orangeBright' },
                        { name: 'cold_lead', color: 'blueBright' },
                        { name: 'callback_requested', color: 'yellowBright' },
                        { name: 'not_decision_maker', color: 'grayBright' },
                        { name: 'invalid', color: 'purpleBright' }
                    ]
                }
            },
            { name: 'Coaching Tips', type: 'multilineText' },
            { name: 'Key Insights', type: 'multilineText' },
            { name: 'Next Actions', type: 'multilineText' },
            { 
                name: 'Call Sentiment', 
                type: 'singleSelect',
                options: {
                    choices: [
                        { name: 'positive', color: 'greenBright' },
                        { name: 'neutral', color: 'yellowBright' },
                        { name: 'negative', color: 'redBright' }
                    ]
                }
            },
            { name: 'Talk Time Ratio', type: 'singleLineText' },
            { name: 'Improvement Areas', type: 'multilineText' },
            { name: 'Auto Analyzed', type: 'checkbox' },
            { name: 'Analysis Date', type: 'dateTime', options: { dateFormat: { name: 'iso' } } }
        ];

        logger.info('✅ QCI Fields setup completed!');
        logger.info('📋 Fields to add manually in Airtable:');
        
        qciFields.forEach(field => {
            console.log(`• ${field.name} (${field.type})`);
        });

        logger.info('\n🔧 NEXT STEPS:');
        logger.info('1. Go to Airtable → VAPI_Calls table');
        logger.info('2. Add the fields listed above');
        logger.info('3. Import the N8N workflows');
        logger.info('4. Configure VAPI webhook');
        logger.info('5. Test with a real call');

        return qciFields;

    } catch (error) {
        logger.error('Failed to setup QCI fields', error);
        throw error;
    }
}

// Проверка существующих полей
async function checkExistingFields() {
    try {
        const airtable = new AirtableClient();
        const existingRecords = await airtable.getAllRecords('VAPI_Calls');
        
        if (existingRecords.length > 0) {
            const sampleRecord = existingRecords[0];
            const existingFields = Object.keys(sampleRecord.fields);
            
            logger.info('📊 Existing fields in VAPI_Calls table:');
            existingFields.forEach(field => {
                console.log(`• ${field}`);
            });

            const qciFieldsExists = existingFields.some(field => 
                field.includes('QCI') || field.includes('Coaching') || field.includes('Classification')
            );

            if (qciFieldsExists) {
                logger.success('✅ Some QCI fields already exist!');
            } else {
                logger.warning('⚠️  No QCI fields found - you need to add them manually');
            }
        }

    } catch (error) {
        logger.error('Failed to check existing fields', error);
    }
}

// Command line usage
if (require.main === module) {
    const command = process.argv[2] || 'setup';
    
    if (command === 'check') {
        checkExistingFields()
            .then(() => {
                console.log('✅ Field check completed');
                process.exit(0);
            })
            .catch(error => {
                console.error('❌ Field check failed:', error.message);
                process.exit(1);
            });
    } else {
        setupQCIFields()
            .then(() => {
                console.log('✅ Setup guide completed');
                process.exit(0);
            })
            .catch(error => {
                console.error('❌ Setup failed:', error.message);
                process.exit(1);
            });
    }
}

module.exports = { setupQCIFields, checkExistingFields };