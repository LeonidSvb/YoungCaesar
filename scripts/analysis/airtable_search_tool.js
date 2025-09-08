require('dotenv').config();
const Airtable = require('airtable');

class AirtableSearchTool {
    constructor() {
        this.base = new Airtable({
            apiKey: process.env.AIRTABLE_API_KEY
        }).base(process.env.AIRTABLE_BASE_ID);
        this.targetCallId = '0a2ec1de-f7c8-4047-af0e-1693ef4ff221';
        this.results = {};
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

    async searchInTable(tableId, tableName) {
        try {
            console.log(`🔍 Searching in table: ${tableName} (${tableId})`);
            const table = this.base(tableId);
            let matchCount = 0;
            let totalRecords = 0;

            await table.select({
                pageSize: 100
            }).eachPage((records, fetchNextPage) => {
                records.forEach(record => {
                    totalRecords++;
                    const fields = record.fields;
                    
                    for (const [fieldName, fieldValue] of Object.entries(fields)) {
                        if (fieldValue && typeof fieldValue === 'string' && 
                            fieldValue.includes(this.targetCallId)) {
                            matchCount++;
                            console.log(`   ✅ Found match in field "${fieldName}": ${fieldValue}`);
                            break;
                        }
                    }
                });
                fetchNextPage();
            });

            this.results[tableName] = {
                tableId,
                matches: matchCount,
                totalRecords
            };

            console.log(`   📊 ${tableName}: ${matchCount} matches out of ${totalRecords} records`);
            
        } catch (error) {
            console.error(`❌ Error searching table ${tableName}:`, error.message);
            this.results[tableName] = {
                tableId,
                matches: 0,
                totalRecords: 0,
                error: error.message
            };
        }
    }

    async searchAllTables() {
        try {
            console.log(`🚀 Starting search for Call ID: ${this.targetCallId}`);
            console.log('==========================================\n');

            const tables = await this.getAllTables();
            console.log(`📋 Found ${tables.length} tables in base:\n`);

            tables.forEach(table => {
                console.log(`   - ${table.name} (${table.id})`);
            });
            console.log('');

            for (const table of tables) {
                await this.searchInTable(table.id, table.name);
            }

            this.generateReport();

        } catch (error) {
            console.error('💥 Search process failed:', error.message);
            throw error;
        }
    }

    generateReport() {
        console.log('\n📋 SEARCH RESULTS SUMMARY');
        console.log('==========================');
        console.log(`🎯 Target Call ID: ${this.targetCallId}\n`);

        let totalMatches = 0;
        const tableResults = [];

        for (const [tableName, result] of Object.entries(this.results)) {
            if (result.error) {
                tableResults.push(`❌ ${tableName}: ERROR - ${result.error}`);
            } else {
                totalMatches += result.matches;
                if (result.matches > 0) {
                    tableResults.push(`✅ ${tableName}: ${result.matches} совпадений из ${result.totalRecords} записей`);
                } else {
                    tableResults.push(`⚫ ${tableName}: ${result.matches} совпадений из ${result.totalRecords} записей`);
                }
            }
        }

        tableResults.sort((a, b) => {
            const aMatches = parseInt(a.match(/(\d+) совпадений/)?.[1] || '0');
            const bMatches = parseInt(b.match(/(\d+) совпадений/)?.[1] || '0');
            return bMatches - aMatches;
        });

        tableResults.forEach(result => console.log(result));

        console.log(`\n📊 Общий итог: ${totalMatches} совпадений найдено во всех таблицах`);
        
        if (totalMatches === 0) {
            console.log('❌ Call ID не найден ни в одной таблице');
        }
    }
}

if (require.main === module) {
    const searchTool = new AirtableSearchTool();
    searchTool.searchAllTables().catch(console.error);
}

module.exports = AirtableSearchTool;