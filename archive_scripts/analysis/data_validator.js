require('dotenv').config();
const fs = require('fs');
const path = require('path');

// ============================================================
// CONFIGURATION - DATA VALIDATION TOOLS
// ============================================================

const CONFIG = {
    // Output settings
    OUTPUT_DIR: '../../data/processed',
    SAVE_RESULTS: true,
    VERBOSE: true,

    // Table configurations
    MAIN_CALLS_TABLE: 'tblvXZt2zkkanjGdE',
    CLIENTS_TABLE: 'tblYp2tPaY7Hoz9Pe',

    LEAD_TABLES: {
        'E164_YC': 'tblLmWcITpAZdKhs2',
        'E164_Biesse': 'tblZ0UPX8U6E081yC',
        'USA_Leads': 'tblVSTLFdPSYjWQ89',
        'EU_Leads': 'tblhkE3kg4Pitcua6'
    },

    // Standard fields for validation
    STANDARD_FIELDS: [
        'Name', 'Phone', 'Email', 'Company', 'Market', 'Keywords', 'BDR',
        'Website', 'Call_Status', 'Last_Called', 'Total_Attempts', 'Max_Attempts',
        'Success_Level', 'Meeting_Outcome', 'Next_Step', 'Interest_Level', 'DNC',
        'City', 'State', 'Country', 'Timezone', 'Original_Source', 'Priority'
    ],

    // Analysis limits
    SAMPLE_SIZE: 5,
    MAX_RECORDS_ANALYZE: 100
};

// ============================================================
// DATA VALIDATOR CLASS
// ============================================================

class DataValidator {
    constructor() {
        this.results = {
            syncStatus: {},
            idAnalysis: {},
            fieldAnalysis: {},
            relationships: {},
            validation: {}
        };
    }

    // SYNC STATUS CHECKING
    async checkSyncStatus() {
        console.log('🔄 Checking sync status between VAPI and Airtable...\n');

        const lastAirtableCall = await this.getLastAirtableCall();
        const lastVapiCall = await this.getLastVapiCall();

        const syncAnalysis = {
            lastAirtableCall,
            lastVapiCall,
            status: 'unknown',
            timeDifference: null,
            recommendation: ''
        };

        if (lastAirtableCall && lastVapiCall) {
            const airtableTime = new Date(lastAirtableCall.startedAt);
            const vapiTime = new Date(lastVapiCall.startedAt);
            const diffMinutes = Math.abs(vapiTime - airtableTime) / (1000 * 60);

            syncAnalysis.timeDifference = diffMinutes;

            if (diffMinutes < 30) {
                syncAnalysis.status = 'synced';
                syncAnalysis.recommendation = 'Sync is up to date';
            } else if (diffMinutes < 120) {
                syncAnalysis.status = 'delayed';
                syncAnalysis.recommendation = 'Minor sync delay, check automation';
            } else {
                syncAnalysis.status = 'out_of_sync';
                syncAnalysis.recommendation = 'Major sync issue, investigate immediately';
            }

            console.log(`📞 Last VAPI call: ${lastVapiCall.startedAt} (ID: ${lastVapiCall.callId.slice(0, 8)}...)`);
            console.log(`📊 Last Airtable call: ${lastAirtableCall.startedAt} (ID: ${lastAirtableCall.callId.slice(0, 8)}...)`);
            console.log(`⏱️ Time difference: ${diffMinutes.toFixed(1)} minutes`);
            console.log(`🎯 Status: ${syncAnalysis.status.toUpperCase()}`);
            console.log(`💡 Recommendation: ${syncAnalysis.recommendation}\n`);
        }

        this.results.syncStatus = syncAnalysis;
        return syncAnalysis;
    }

    async getLastAirtableCall() {
        try {
            const url = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}?maxRecords=1&sort[0][field]=Started%20At&sort[0][direction]=desc`;

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) return null;

            const data = await response.json();
            if (data.records && data.records.length > 0) {
                const lastRecord = data.records[0].fields;
                return {
                    callId: lastRecord['Call ID'],
                    startedAt: lastRecord['Started At'],
                    phone: lastRecord['Phone'],
                    assistant: lastRecord['Assistant Name']
                };
            }
        } catch (error) {
            console.error('Error fetching last Airtable call:', error.message);
        }
        return null;
    }

    async getLastVapiCall() {
        try {
            const response = await fetch('https://api.vapi.ai/call?limit=1', {
                headers: {
                    'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) return null;

            const data = await response.json();
            if (data && data.length > 0) {
                const lastCall = data[0];
                return {
                    callId: lastCall.id,
                    startedAt: lastCall.startedAt,
                    phone: lastCall.customer?.number,
                    assistant: lastCall.assistant?.name
                };
            }
        } catch (error) {
            console.error('Error fetching last VAPI call:', error.message);
        }
        return null;
    }

    // DEEP ID ANALYSIS
    async performDeepIdAnalysis() {
        console.log('🔍 Performing deep ID analysis across all tables...\n');

        const analysis = {
            mainTable: await this.analyzeTableIds(CONFIG.MAIN_CALLS_TABLE, 'Calls Table'),
            leadTables: {},
            patterns: {},
            relationships: []
        };

        // Analyze each lead table
        for (const [tableName, tableId] of Object.entries(CONFIG.LEAD_TABLES)) {
            console.log(`Analyzing ${tableName}...`);
            analysis.leadTables[tableName] = await this.analyzeTableIds(tableId, tableName);
        }

        // Find ID patterns
        analysis.patterns = this.findIdPatterns(analysis);

        // Check relationships
        analysis.relationships = await this.checkTableRelationships();

        console.log('🔗 ID Pattern Analysis:');
        Object.entries(analysis.patterns).forEach(([pattern, info]) => {
            console.log(`  ${pattern}: ${info.description} (${info.examples.length} examples)`);
        });

        this.results.idAnalysis = analysis;
        return analysis;
    }

    async analyzeTableIds(tableId, tableName) {
        try {
            const url = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${tableId}?maxRecords=${CONFIG.SAMPLE_SIZE}`;

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                console.error(`Error fetching ${tableName}:`, response.status);
                return null;
            }

            const data = await response.json();
            const records = data.records || [];

            const idFields = [];
            if (records.length > 0) {
                const sampleRecord = records[0].fields;
                Object.keys(sampleRecord).forEach(field => {
                    if (field.toLowerCase().includes('id') ||
                        field.toLowerCase().includes('key') ||
                        typeof sampleRecord[field] === 'string' &&
                        sampleRecord[field].match(/^[a-f0-9-]{30,}$/)) {
                        idFields.push(field);
                    }
                });
            }

            return {
                tableName,
                recordCount: records.length,
                idFields,
                sampleRecords: records.slice(0, 3).map(r => ({ id: r.id, fields: r.fields }))
            };

        } catch (error) {
            console.error(`Error analyzing ${tableName}:`, error.message);
            return null;
        }
    }

    findIdPatterns(analysis) {
        const patterns = {};

        // Analyze ID formats
        const allIdValues = [];

        if (analysis.mainTable) {
            analysis.mainTable.sampleRecords.forEach(record => {
                Object.values(record.fields).forEach(value => {
                    if (typeof value === 'string' && value.match(/^[a-f0-9-]{30,}$/)) {
                        allIdValues.push(value);
                    }
                });
            });
        }

        Object.values(analysis.leadTables).forEach(table => {
            if (table) {
                table.sampleRecords.forEach(record => {
                    Object.values(record.fields).forEach(value => {
                        if (typeof value === 'string' && value.match(/^[a-f0-9-]{30,}$/)) {
                            allIdValues.push(value);
                        }
                    });
                });
            }
        });

        // Categorize patterns
        const uuidPattern = allIdValues.filter(id => id.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/));
        const airtablePattern = allIdValues.filter(id => id.match(/^rec[a-zA-Z0-9]{14}$/));
        const otherPattern = allIdValues.filter(id => !id.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/) && !id.match(/^rec[a-zA-Z0-9]{14}$/));

        if (uuidPattern.length > 0) {
            patterns.uuid = {
                description: 'Standard UUID format (VAPI calls)',
                count: uuidPattern.length,
                examples: uuidPattern.slice(0, 3)
            };
        }

        if (airtablePattern.length > 0) {
            patterns.airtable = {
                description: 'Airtable record IDs',
                count: airtablePattern.length,
                examples: airtablePattern.slice(0, 3)
            };
        }

        if (otherPattern.length > 0) {
            patterns.other = {
                description: 'Other ID formats',
                count: otherPattern.length,
                examples: otherPattern.slice(0, 3)
            };
        }

        return patterns;
    }

    async checkTableRelationships() {
        console.log('🔗 Checking table relationships...\n');

        const relationships = [];

        // Check if calls reference lead tables
        const mainTableData = await this.getSampleTableData(CONFIG.MAIN_CALLS_TABLE);

        for (const [leadTableName, leadTableId] of Object.entries(CONFIG.LEAD_TABLES)) {
            const leadTableData = await this.getSampleTableData(leadTableId);

            if (mainTableData && leadTableData) {
                const relationship = this.findRelationshipBetweenTables(
                    mainTableData,
                    leadTableData,
                    'Calls',
                    leadTableName
                );

                if (relationship.strength > 0) {
                    relationships.push(relationship);
                }
            }
        }

        return relationships;
    }

    async getSampleTableData(tableId) {
        try {
            const url = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${tableId}?maxRecords=${CONFIG.SAMPLE_SIZE}`;

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) return null;

            const data = await response.json();
            return data.records || [];
        } catch (error) {
            console.error(`Error fetching table data:`, error.message);
            return null;
        }
    }

    findRelationshipBetweenTables(table1Data, table2Data, table1Name, table2Name) {
        let commonValues = 0;
        let totalChecked = 0;

        table1Data.forEach(record1 => {
            Object.values(record1.fields).forEach(value1 => {
                if (typeof value1 === 'string' && value1.length > 5) {
                    totalChecked++;

                    table2Data.forEach(record2 => {
                        Object.values(record2.fields).forEach(value2 => {
                            if (value1 === value2) {
                                commonValues++;
                            }
                        });
                    });
                }
            });
        });

        const strength = totalChecked > 0 ? (commonValues / totalChecked) * 100 : 0;

        return {
            table1: table1Name,
            table2: table2Name,
            commonValues,
            totalChecked,
            strength: strength.toFixed(2),
            relationship: strength > 50 ? 'strong' : strength > 20 ? 'moderate' : strength > 0 ? 'weak' : 'none'
        };
    }

    // FIELD ANALYSIS
    async performFieldAnalysis() {
        console.log('📋 Analyzing field structures and standards...\n');

        const clientsTable = await this.getTableFields(CONFIG.CLIENTS_TABLE);
        const analysis = {
            standardFields: CONFIG.STANDARD_FIELDS,
            actualFields: clientsTable ? clientsTable.fields : [],
            compliance: {},
            recommendations: []
        };

        if (clientsTable) {
            const actualFieldNames = clientsTable.fields.map(f => f.name);

            analysis.compliance = {
                missing: CONFIG.STANDARD_FIELDS.filter(field => !actualFieldNames.includes(field)),
                extra: actualFieldNames.filter(field => !CONFIG.STANDARD_FIELDS.includes(field)),
                matching: CONFIG.STANDARD_FIELDS.filter(field => actualFieldNames.includes(field)),
                complianceRate: ((CONFIG.STANDARD_FIELDS.filter(field => actualFieldNames.includes(field)).length / CONFIG.STANDARD_FIELDS.length) * 100).toFixed(2)
            };

            console.log(`📊 Field Compliance: ${analysis.compliance.complianceRate}%`);
            console.log(`✅ Matching fields: ${analysis.compliance.matching.length}`);
            console.log(`❌ Missing fields: ${analysis.compliance.missing.length}`);
            console.log(`➕ Extra fields: ${analysis.compliance.extra.length}`);

            if (analysis.compliance.missing.length > 0) {
                console.log(`\nMissing fields: ${analysis.compliance.missing.join(', ')}`);
                analysis.recommendations.push(`Add missing fields: ${analysis.compliance.missing.join(', ')}`);
            }

            if (analysis.compliance.extra.length > 0) {
                console.log(`\nExtra fields: ${analysis.compliance.extra.join(', ')}`);
                analysis.recommendations.push('Review extra fields for necessity');
            }
        }

        this.results.fieldAnalysis = analysis;
        return analysis;
    }

    async getTableFields(tableId) {
        try {
            const url = `https://api.airtable.com/v0/meta/bases/${process.env.AIRTABLE_BASE_ID}/tables`;

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) return null;

            const data = await response.json();
            const table = data.tables.find(t => t.id === tableId);

            return table || null;
        } catch (error) {
            console.error('Error fetching table fields:', error.message);
            return null;
        }
    }

    // UTILITY METHODS
    async saveResults() {
        if (!CONFIG.SAVE_RESULTS) return;

        const outputDir = path.resolve(__dirname, CONFIG.OUTPUT_DIR);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().slice(0, 19);
        const filename = `data_validation_${timestamp}.json`;
        const filepath = path.join(outputDir, filename);

        fs.writeFileSync(filepath, JSON.stringify(this.results, null, 2));
        console.log(`💾 Validation results saved: ${filename}`);
    }
}

// ============================================================
// CLI INTERFACE
// ============================================================

async function main() {
    console.log('🔍 DATA VALIDATION TOOLS');
    console.log('=========================');
    console.log('1. Check sync status (VAPI ↔ Airtable)');
    console.log('2. Deep ID analysis');
    console.log('3. Field analysis & standards compliance');
    console.log('4. Table relationship analysis');
    console.log('5. Run all validations');
    console.log('');

    const validator = new DataValidator();

    try {
        console.log('Running comprehensive data validation...\n');

        await validator.checkSyncStatus();
        await validator.performDeepIdAnalysis();
        await validator.performFieldAnalysis();

        await validator.saveResults();

        console.log('\n✅ All validations completed successfully!');

    } catch (error) {
        console.error('❌ Validation failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = DataValidator;