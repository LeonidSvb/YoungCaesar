require('dotenv').config();
const Airtable = require('airtable');

class TableRelationshipAnalyzer {
    constructor() {
        this.base = new Airtable({
            apiKey: process.env.AIRTABLE_API_KEY
        }).base(process.env.AIRTABLE_BASE_ID);
        
        this.mainTableId = 'tblvXZt2zkkanjGdE'; // Calls - raw data
        this.leadTables = [
            { id: 'tblVSTLFdPSYjWQ89', name: 'USA Leads' },
            { id: 'tblZ9idb5hYqqSZHf', name: 'ASIA Leads' },
            { id: 'tblhkE3kg4Pitcua6', name: 'EU Leads' },
            { id: 'tblg7fw9sseuGw1pr', name: 'QC Advisor' },
            { id: 'tblDUM9n7SrgvYR1a', name: 'E164' },
            { id: 'tblQHqGuiemDM4rof', name: 'E164.QCAdvisor' },
            { id: 'tblZ0UPX8U6E081yC', name: 'E164.Biesse' },
            { id: 'tblQvINW9Gr83ogfc', name: 'E164.QC Advisor' },
            { id: 'tblLmWcITpAZdKhs2', name: 'E164.YC' },
            { id: 'tblSaRXL7WavaZ1sK', name: 'E164.Biesse copy' }
        ];
        
        this.callsData = [];
        this.leadsData = {};
        this.matchResults = {};
    }

    async getTableSchema(tableId, tableName) {
        try {
            console.log(`🔍 Analyzing schema for: ${tableName}`);
            const table = this.base(tableId);
            let fields = new Set();
            let sampleData = {};

            await table.select({
                maxRecords: 5
            }).eachPage((records) => {
                records.forEach(record => {
                    Object.keys(record.fields).forEach(fieldName => {
                        fields.add(fieldName);
                        if (!sampleData[fieldName] && record.fields[fieldName]) {
                            sampleData[fieldName] = record.fields[fieldName];
                        }
                    });
                });
            });

            return {
                fields: Array.from(fields),
                sampleData
            };
        } catch (error) {
            console.error(`❌ Error analyzing ${tableName}:`, error.message);
            return { fields: [], sampleData: {} };
        }
    }

    async getCallsData() {
        console.log('📞 Loading Calls - raw data...');
        const table = this.base(this.mainTableId);
        
        await table.select({
            maxRecords: 100 // Берем больше для анализа
        }).eachPage((records) => {
            records.forEach(record => {
                this.callsData.push({
                    id: record.id,
                    fields: record.fields
                });
            });
        });
        
        console.log(`✅ Loaded ${this.callsData.length} call records`);
        return this.callsData;
    }

    async getLeadsData(tableId, tableName, maxRecords = 50) {
        console.log(`👥 Loading ${tableName}...`);
        const table = this.base(tableId);
        const leads = [];
        
        try {
            await table.select({
                maxRecords
            }).eachPage((records) => {
                records.forEach(record => {
                    leads.push({
                        id: record.id,
                        fields: record.fields
                    });
                });
            });
            
            console.log(`✅ Loaded ${leads.length} records from ${tableName}`);
            this.leadsData[tableName] = leads;
            return leads;
        } catch (error) {
            console.error(`❌ Error loading ${tableName}:`, error.message);
            this.leadsData[tableName] = [];
            return [];
        }
    }

    findMatches(callsFields, leadsFields, tableName) {
        const matches = {};
        
        // Проверяем каждое поле из вызовов против полей лидов
        for (const [callField, callValue] of Object.entries(callsFields)) {
            if (!callValue || typeof callValue !== 'string') continue;
            
            for (const [leadField, leadValue] of Object.entries(leadsFields)) {
                if (!leadValue || typeof leadValue !== 'string') continue;
                
                // Точное совпадение
                if (callValue === leadValue) {
                    const key = `${callField} -> ${leadField}`;
                    if (!matches[key]) matches[key] = 0;
                    matches[key]++;
                }
                
                // Частичное совпадение для телефонов и ID
                if (this.isPartialMatch(callValue, leadValue)) {
                    const key = `${callField} -> ${leadField} (partial)`;
                    if (!matches[key]) matches[key] = 0;
                    matches[key]++;
                }
            }
        }
        
        return matches;
    }

    isPartialMatch(value1, value2) {
        // Проверка для телефонных номеров и ID
        if (value1.length > 8 && value2.length > 8) {
            // Убираем специальные символы для телефонов
            const clean1 = value1.replace(/[^\w]/g, '');
            const clean2 = value2.replace(/[^\w]/g, '');
            
            if (clean1.length > 8 && clean2.length > 8) {
                // Проверяем содержится ли одно в другом
                return clean1.includes(clean2) || clean2.includes(clean1);
            }
        }
        return false;
    }

    async analyzeRelationships() {
        try {
            console.log('🚀 Starting relationship analysis...');
            console.log('=====================================\n');

            // Сначала анализируем схемы всех таблиц
            console.log('📋 SCHEMA ANALYSIS');
            console.log('==================');
            
            const callsSchema = await this.getTableSchema(this.mainTableId, 'Calls - raw data');
            console.log(`📞 Calls - raw data fields (${callsSchema.fields.length}):`, callsSchema.fields.join(', '));
            console.log('Sample data:', JSON.stringify(callsSchema.sampleData, null, 2).slice(0, 200) + '...\n');

            for (const leadTable of this.leadTables) {
                const schema = await this.getTableSchema(leadTable.id, leadTable.name);
                console.log(`👥 ${leadTable.name} fields (${schema.fields.length}):`, schema.fields.join(', '));
                if (Object.keys(schema.sampleData).length > 0) {
                    console.log('Sample data:', JSON.stringify(schema.sampleData, null, 2).slice(0, 200) + '...');
                }
                console.log('');
            }

            // Загружаем данные
            console.log('\n📊 DATA LOADING');
            console.log('================');
            await this.getCallsData();

            for (const leadTable of this.leadTables) {
                await this.getLeadsData(leadTable.id, leadTable.name, 50);
            }

            // Анализируем совпадения
            console.log('\n🔍 MATCHING ANALYSIS');
            console.log('=====================');

            for (const leadTable of this.leadTables) {
                const tableName = leadTable.name;
                const leads = this.leadsData[tableName];
                
                if (!leads || leads.length === 0) {
                    console.log(`⚠️  No data for ${tableName}, skipping...`);
                    continue;
                }

                console.log(`\n🔍 Analyzing matches with ${tableName}...`);
                let totalMatches = 0;
                const fieldMatches = {};

                // Проверяем каждый вызов против каждого лида
                this.callsData.forEach(call => {
                    leads.forEach(lead => {
                        const matches = this.findMatches(call.fields, lead.fields, tableName);
                        
                        for (const [matchType, count] of Object.entries(matches)) {
                            if (!fieldMatches[matchType]) fieldMatches[matchType] = 0;
                            fieldMatches[matchType] += count;
                            totalMatches += count;
                        }
                    });
                });

                this.matchResults[tableName] = {
                    totalMatches,
                    fieldMatches,
                    recordsAnalyzed: leads.length
                };

                if (totalMatches > 0) {
                    console.log(`✅ Found ${totalMatches} total matches in ${tableName}:`);
                    Object.entries(fieldMatches)
                        .sort(([,a], [,b]) => b - a)
                        .forEach(([field, count]) => {
                            console.log(`   - ${field}: ${count} matches`);
                        });
                } else {
                    console.log(`⚫ No matches found in ${tableName}`);
                }
            }

            this.generateSummaryReport();

        } catch (error) {
            console.error('💥 Analysis failed:', error.message);
            throw error;
        }
    }

    generateSummaryReport() {
        console.log('\n📋 RELATIONSHIP ANALYSIS SUMMARY');
        console.log('=================================');
        
        const tablesWithMatches = [];
        const tablesWithoutMatches = [];
        
        for (const [tableName, results] of Object.entries(this.matchResults)) {
            if (results.totalMatches > 0) {
                tablesWithMatches.push({
                    name: tableName,
                    matches: results.totalMatches,
                    fields: Object.keys(results.fieldMatches).length,
                    records: results.recordsAnalyzed
                });
            } else {
                tablesWithoutMatches.push({
                    name: tableName,
                    records: results.recordsAnalyzed
                });
            }
        }

        tablesWithMatches.sort((a, b) => b.matches - a.matches);

        console.log('\n✅ TABLES WITH MATCHES:');
        console.log('========================');
        tablesWithMatches.forEach(table => {
            console.log(`📊 ${table.name}: ${table.matches} совпадений по ${table.fields} полям из ${table.records} записей`);
        });

        console.log('\n⚫ TABLES WITHOUT MATCHES:');
        console.log('==========================');
        tablesWithoutMatches.forEach(table => {
            console.log(`📊 ${table.name}: 0 совпадений из ${table.records} записей`);
        });

        console.log('\n🎯 RECOMMENDED MATCHING FIELDS:');
        console.log('===============================');
        
        const allFieldMatches = {};
        for (const results of Object.values(this.matchResults)) {
            for (const [field, count] of Object.entries(results.fieldMatches)) {
                if (!allFieldMatches[field]) allFieldMatches[field] = 0;
                allFieldMatches[field] += count;
            }
        }

        const sortedFields = Object.entries(allFieldMatches)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);

        if (sortedFields.length > 0) {
            sortedFields.forEach(([field, count]) => {
                console.log(`🔗 ${field}: ${count} total matches across all tables`);
            });
        } else {
            console.log('❌ No matching fields found across any tables');
        }

        const totalTables = Object.keys(this.matchResults).length;
        const matchingTables = tablesWithMatches.length;
        console.log(`\n📈 Overall: ${matchingTables}/${totalTables} tables have matches with Calls data`);
    }
}

if (require.main === module) {
    const analyzer = new TableRelationshipAnalyzer();
    analyzer.analyzeRelationships().catch(console.error);
}

module.exports = TableRelationshipAnalyzer;