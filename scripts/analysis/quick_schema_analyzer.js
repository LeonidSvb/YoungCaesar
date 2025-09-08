require('dotenv').config();
const Airtable = require('airtable');

class QuickSchemaAnalyzer {
    constructor() {
        this.base = new Airtable({
            apiKey: process.env.AIRTABLE_API_KEY
        }).base(process.env.AIRTABLE_BASE_ID);
        
        this.tables = [
            { id: 'tblvXZt2zkkanjGdE', name: 'Calls - raw data' },
            { id: 'tblVSTLFdPSYjWQ89', name: 'USA Leads' },
            { id: 'tblZ9idb5hYqqSZHf', name: 'ASIA Leads' },
            { id: 'tblhkE3kg4Pitcua6', name: 'EU Leads' },
            { id: 'tblg7fw9sseuGw1pr', name: 'QC Advisor' },
            { id: 'tblDUM9n7SrgvYR1a', name: 'E164' }
        ];
    }

    async getQuickSchema(tableId, tableName) {
        try {
            console.log(`📋 ${tableName}`);
            const table = this.base(tableId);
            const fields = new Set();
            let sampleRecord = null;

            await table.select({
                maxRecords: 1
            }).eachPage((records) => {
                if (records.length > 0) {
                    sampleRecord = records[0];
                    Object.keys(records[0].fields).forEach(field => {
                        fields.add(field);
                    });
                }
            });

            const fieldList = Array.from(fields);
            console.log(`   Fields (${fieldList.length}): ${fieldList.join(', ')}`);
            
            if (sampleRecord) {
                console.log('   Sample data:');
                Object.entries(sampleRecord.fields).forEach(([key, value]) => {
                    const displayValue = typeof value === 'string' && value.length > 50 
                        ? value.substring(0, 50) + '...'
                        : value;
                    console.log(`     ${key}: ${displayValue}`);
                });
            }
            console.log('');

            return fieldList;
        } catch (error) {
            console.error(`❌ Error with ${tableName}:`, error.message);
            return [];
        }
    }

    async analyzeAllSchemas() {
        console.log('🔍 QUICK SCHEMA ANALYSIS');
        console.log('========================\n');

        const allSchemas = {};
        
        for (const table of this.tables) {
            const fields = await this.getQuickSchema(table.id, table.name);
            allSchemas[table.name] = fields;
        }

        // Найти общие поля
        console.log('🔗 POTENTIAL MATCHING FIELDS');
        console.log('=============================');
        
        const callsFields = allSchemas['Calls - raw data'] || [];
        const commonFields = {};

        for (const [tableName, fields] of Object.entries(allSchemas)) {
            if (tableName === 'Calls - raw data') continue;
            
            const matches = [];
            callsFields.forEach(callField => {
                fields.forEach(leadField => {
                    if (callField.toLowerCase().includes('phone') && leadField.toLowerCase().includes('phone')) {
                        matches.push(`${callField} ↔ ${leadField} (phone)`);
                    }
                    if (callField.toLowerCase().includes('id') && leadField.toLowerCase().includes('id')) {
                        matches.push(`${callField} ↔ ${leadField} (id)`);
                    }
                    if (callField.toLowerCase() === leadField.toLowerCase()) {
                        matches.push(`${callField} ↔ ${leadField} (exact)`);
                    }
                    if (callField.toLowerCase().includes('customer') && leadField.toLowerCase().includes('customer')) {
                        matches.push(`${callField} ↔ ${leadField} (customer)`);
                    }
                });
            });

            if (matches.length > 0) {
                console.log(`📊 ${tableName}:`);
                matches.forEach(match => console.log(`   ${match}`));
                console.log('');
            }
        }

        return allSchemas;
    }
}

if (require.main === module) {
    const analyzer = new QuickSchemaAnalyzer();
    analyzer.analyzeAllSchemas().catch(console.error);
}

module.exports = QuickSchemaAnalyzer;