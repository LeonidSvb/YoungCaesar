require('dotenv').config();
const Airtable = require('airtable');
const fs = require('fs');
const path = require('path');

// ============================================================
// CONFIGURATION - AIRTABLE MANAGEMENT TOOLS
// ============================================================

const CONFIG = {
    // Main settings
    OUTPUT_DIR: '../../data/processed',
    SAVE_RESULTS: true,
    VERBOSE: true,

    // Search settings
    TARGET_CALL_ID: '0a2ec1de-f7c8-4047-af0e-1693ef4ff221',

    // Analysis settings
    DUPLICATE_FIELDS: ['Call ID', 'Created At', 'Phone', 'Assistant Name', 'Duration (seconds)'],

    // Structure analysis
    SHOW_FIELD_DETAILS: true,
    MAX_SAMPLE_VALUES: 5
};

// ============================================================
// AIRTABLE MANAGER CLASS
// ============================================================

class AirtableManager {
    constructor() {
        this.base = new Airtable({
            apiKey: process.env.AIRTABLE_API_KEY
        }).base(process.env.AIRTABLE_BASE_ID);

        this.results = {};
        this.allRecords = [];
        this.duplicates = [];
        this.callIdCounts = {};
    }

    // SEARCH FUNCTIONALITY
    async searchInAllTables(targetId = CONFIG.TARGET_CALL_ID) {
        console.log(`🔍 Searching for Call ID: ${targetId} across all tables\n`);

        const tables = await this.getAllTables();
        const searchResults = {};

        for (const table of tables) {
            console.log(`Searching in table: ${table.name}...`);
            const records = await this.searchInTable(table.id, targetId);

            if (records.length > 0) {
                searchResults[table.name] = records;
                console.log(`✅ Found ${records.length} records in ${table.name}`);
            } else {
                console.log(`❌ No records found in ${table.name}`);
            }
        }

        this.results.search = searchResults;
        return searchResults;
    }

    async getAllTables() {
        try {
            const response = await fetch(`https://api.airtable.com/v0/meta/bases/${process.env.AIRTABLE_BASE_ID}/tables`, {
                headers: {
                    'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.tables;
        } catch (error) {
            console.error('Error fetching table metadata:', error.message);
            throw error;
        }
    }

    async searchInTable(tableId, callId) {
        try {
            const table = this.base(tableId);
            const records = await table.select({
                filterByFormula: `SEARCH("${callId}", {Call ID})`
            }).all();

            return records.map(record => ({
                id: record.id,
                fields: record.fields,
                createdTime: record._rawJson.createdTime
            }));
        } catch (error) {
            console.error(`Error searching in table ${tableId}:`, error.message);
            return [];
        }
    }

    // STRUCTURE ANALYSIS
    async analyzeStructure() {
        console.log('📊 Analyzing Airtable base structure...\n');

        const tables = await this.getAllTables();

        console.log(`📋 Base ID: ${process.env.AIRTABLE_BASE_ID}`);
        console.log(`📋 Total tables: ${tables.length}\n`);

        const structureAnalysis = {};

        tables.forEach((table, index) => {
            console.log(`${index + 1}. Table: ${table.name} (ID: ${table.id})`);
            console.log(`   Fields: ${table.fields.length}`);

            if (CONFIG.SHOW_FIELD_DETAILS) {
                table.fields.forEach(field => {
                    console.log(`   - ${field.name} (${field.type})`);
                });
            }

            structureAnalysis[table.name] = {
                id: table.id,
                fieldsCount: table.fields.length,
                fields: table.fields.map(f => ({ name: f.name, type: f.type }))
            };

            console.log('');
        });

        this.results.structure = structureAnalysis;
        return structureAnalysis;
    }

    // DUPLICATE CHECKING
    async checkDuplicates() {
        console.log('🔍 Checking for duplicate records...\n');

        await this.getAllRecords();
        this.findDuplicates();
        this.analyzeCallIdDistribution();

        const report = this.generateDuplicateReport();

        if (CONFIG.SAVE_RESULTS) {
            await this.saveDuplicateReport(report);
        }

        return report;
    }

    async getAllRecords() {
        console.log('📊 Fetching all records from main table...');

        try {
            const table = this.base(process.env.AIRTABLE_TABLE_ID);
            this.allRecords = await table.select({
                fields: CONFIG.DUPLICATE_FIELDS
            }).all();

            console.log(`✅ Retrieved ${this.allRecords.length} records`);
            return this.allRecords;
        } catch (error) {
            console.error('Error fetching records:', error.message);
            throw error;
        }
    }

    findDuplicates() {
        console.log('🔍 Analyzing duplicates...');

        this.allRecords.forEach(record => {
            const callId = record.get('Call ID');
            if (callId) {
                this.callIdCounts[callId] = (this.callIdCounts[callId] || 0) + 1;
            }
        });

        const duplicateCallIds = Object.keys(this.callIdCounts).filter(
            callId => this.callIdCounts[callId] > 1
        );

        this.duplicates = this.allRecords.filter(record => {
            const callId = record.get('Call ID');
            return duplicateCallIds.includes(callId);
        });

        console.log(`Found ${duplicateCallIds.length} Call IDs with duplicates`);
        console.log(`Total duplicate records: ${this.duplicates.length}`);
    }

    analyzeCallIdDistribution() {
        const counts = Object.values(this.callIdCounts);
        const distribution = {};

        counts.forEach(count => {
            distribution[count] = (distribution[count] || 0) + 1;
        });

        console.log('\n📊 Call ID Distribution:');
        Object.entries(distribution).forEach(([count, frequency]) => {
            console.log(`  ${count} occurrence(s): ${frequency} Call IDs`);
        });
    }

    generateDuplicateReport() {
        const duplicateCallIds = Object.keys(this.callIdCounts).filter(
            callId => this.callIdCounts[callId] > 1
        );

        const report = {
            summary: {
                totalRecords: this.allRecords.length,
                uniqueCallIds: Object.keys(this.callIdCounts).length,
                duplicateCallIds: duplicateCallIds.length,
                duplicateRecords: this.duplicates.length,
                duplicatePercentage: ((this.duplicates.length / this.allRecords.length) * 100).toFixed(2)
            },
            distribution: {},
            duplicateDetails: []
        };

        // Calculate distribution
        Object.values(this.callIdCounts).forEach(count => {
            report.distribution[count] = (report.distribution[count] || 0) + 1;
        });

        // Get duplicate details
        duplicateCallIds.forEach(callId => {
            const duplicateRecords = this.allRecords.filter(
                record => record.get('Call ID') === callId
            );

            report.duplicateDetails.push({
                callId,
                count: this.callIdCounts[callId],
                records: duplicateRecords.map(record => ({
                    id: record.id,
                    createdAt: record.get('Created At'),
                    phone: record.get('Phone'),
                    assistant: record.get('Assistant Name'),
                    duration: record.get('Duration (seconds)')
                }))
            });
        });

        return report;
    }

    async saveDuplicateReport(report) {
        const outputDir = path.resolve(__dirname, CONFIG.OUTPUT_DIR);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().slice(0, 19);
        const filename = `airtable_duplicate_report_${timestamp}.json`;
        const filepath = path.join(outputDir, filename);

        fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
        console.log(`💾 Duplicate report saved: ${filename}`);
    }

    // FORMAT CHECKING
    async checkFormat() {
        console.log('📋 Checking data format and quality...\n');

        await this.getAllRecords();

        const formatReport = {
            fieldAnalysis: {},
            dataQuality: {
                emptyFields: 0,
                invalidFormats: 0,
                recommendations: []
            }
        };

        CONFIG.DUPLICATE_FIELDS.forEach(fieldName => {
            const values = this.allRecords.map(record => record.get(fieldName)).filter(Boolean);
            const emptyCount = this.allRecords.length - values.length;

            formatReport.fieldAnalysis[fieldName] = {
                totalRecords: this.allRecords.length,
                filledRecords: values.length,
                emptyRecords: emptyCount,
                fillPercentage: ((values.length / this.allRecords.length) * 100).toFixed(2),
                sampleValues: values.slice(0, CONFIG.MAX_SAMPLE_VALUES)
            };

            console.log(`Field: ${fieldName}`);
            console.log(`  Filled: ${values.length}/${this.allRecords.length} (${formatReport.fieldAnalysis[fieldName].fillPercentage}%)`);
            console.log(`  Sample values: ${values.slice(0, 3).join(', ')}`);
            console.log('');
        });

        this.results.format = formatReport;
        return formatReport;
    }

    // RECORD COUNTING
    async countRecords() {
        console.log('📊 Counting records in all tables...\n');

        const tables = await this.getAllTables();
        const counts = {};
        let totalRecords = 0;

        for (const table of tables) {
            try {
                const tableInstance = this.base(table.id);
                const records = await tableInstance.select().all();
                const count = records.length;

                counts[table.name] = count;
                totalRecords += count;

                console.log(`${table.name}: ${count} records`);
            } catch (error) {
                console.error(`Error counting ${table.name}:`, error.message);
                counts[table.name] = 'Error';
            }
        }

        console.log(`\n📋 Total records across all tables: ${totalRecords}`);

        this.results.counts = counts;
        return counts;
    }

    // UTILITY METHODS
    async saveResults() {
        if (!CONFIG.SAVE_RESULTS) return;

        const outputDir = path.resolve(__dirname, CONFIG.OUTPUT_DIR);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().slice(0, 19);
        const filename = `airtable_analysis_${timestamp}.json`;
        const filepath = path.join(outputDir, filename);

        fs.writeFileSync(filepath, JSON.stringify(this.results, null, 2));
        console.log(`💾 Results saved: ${filename}`);
    }
}

// ============================================================
// CLI INTERFACE
// ============================================================

async function main() {
    console.log('🔧 AIRTABLE MANAGEMENT TOOLS');
    console.log('=============================');
    console.log('1. Search for specific Call ID');
    console.log('2. Analyze base structure');
    console.log('3. Check for duplicates');
    console.log('4. Check data format');
    console.log('5. Count records in all tables');
    console.log('6. Run all analyses');
    console.log('');

    // For automated execution, run all by default
    const manager = new AirtableManager();

    try {
        console.log('Running comprehensive Airtable analysis...\n');

        await manager.searchInAllTables();
        await manager.analyzeStructure();
        await manager.checkDuplicates();
        await manager.checkFormat();
        await manager.countRecords();

        await manager.saveResults();

        console.log('\n✅ All analyses completed successfully!');

    } catch (error) {
        console.error('❌ Analysis failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = AirtableManager;