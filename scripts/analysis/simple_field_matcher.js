require('dotenv').config();
const fs = require('fs');
const path = require('path');

class SimpleFieldMatcher {
    constructor() {
        this.callSample = null;
        this.leadTables = [
            { id: 'tblVSTLFdPSYjWQ89', name: 'USA Leads' },
            { id: 'tblZ9idb5hYqqSZHf', name: 'ASIA Leads' },
            { id: 'tblhkE3kg4Pitcua6', name: 'EU Leads' },
            { id: 'tblg7fw9sseuGw1pr', name: 'QC Advisor' },
            { id: 'tblDUM9n7SrgvYR1a', name: 'E164' }
        ];
    }

    loadCallSample() {
        console.log('📞 Loading call data structure...');
        
        try {
            const dataPath = path.join(__dirname, '../../data/raw/vapi_raw_calls_2025-09-03.json');
            const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
            
            // Найти первый не пустой call
            for (const dateEntry of rawData) {
                if (dateEntry.calls && dateEntry.calls.length > 0) {
                    this.callSample = dateEntry.calls[0];
                    break;
                }
            }

            if (this.callSample) {
                console.log('✅ Found sample call with these fields:');
                Object.keys(this.callSample).forEach(field => {
                    const value = this.callSample[field];
                    const displayValue = typeof value === 'string' && value.length > 50 
                        ? value.substring(0, 50) + '...'
                        : value;
                    console.log(`   ${field}: ${displayValue}`);
                });
                
                console.log('\n🎯 Call ID для тестирования:', this.callSample.id);
                
                return this.callSample;
            } else {
                throw new Error('No call data found');
            }
        } catch (error) {
            console.error('❌ Error loading call data:', error.message);
            return null;
        }
    }

    async getLeadTableSample(tableId, tableName) {
        try {
            console.log(`\n📋 Checking ${tableName}...`);
            
            const response = await fetch(`https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${tableId}?maxRecords=3`, {
                headers: {
                    'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.records && data.records.length > 0) {
                const sample = data.records[0];
                console.log(`✅ ${tableName} fields:`, Object.keys(sample.fields).join(', '));
                
                // Показать образцы данных
                console.log('   Sample data:');
                Object.entries(sample.fields).slice(0, 5).forEach(([key, value]) => {
                    const displayValue = typeof value === 'string' && value.length > 30 
                        ? value.substring(0, 30) + '...'
                        : value;
                    console.log(`     ${key}: ${displayValue}`);
                });
                
                return {
                    tableName,
                    fields: Object.keys(sample.fields),
                    sampleData: sample.fields,
                    recordCount: data.records.length
                };
            } else {
                console.log(`⚠️  ${tableName} is empty`);
                return { tableName, fields: [], sampleData: {}, recordCount: 0 };
            }
        } catch (error) {
            console.error(`❌ Error with ${tableName}:`, error.message);
            return { tableName, fields: [], sampleData: {}, recordCount: 0, error: error.message };
        }
    }

    findPotentialMatches(callFields, leadFields, leadSampleData) {
        const matches = [];
        
        callFields.forEach(callField => {
            const callValue = this.callSample[callField];
            
            leadFields.forEach(leadField => {
                const leadValue = leadSampleData[leadField];
                
                // Проверки на потенциальные совпадения
                if (this.isPotentialMatch(callField, callValue, leadField, leadValue)) {
                    matches.push({
                        callField,
                        leadField,
                        callValue,
                        leadValue,
                        matchType: this.getMatchType(callField, leadField, callValue, leadValue)
                    });
                }
            });
        });
        
        return matches;
    }

    isPotentialMatch(callField, callValue, leadField, leadValue) {
        const callFieldLower = callField.toLowerCase();
        const leadFieldLower = leadField.toLowerCase();
        
        // ID поля
        if (callFieldLower.includes('id') && leadFieldLower.includes('id')) {
            return true;
        }
        
        // Phone поля
        if (callFieldLower.includes('phone') && leadFieldLower.includes('phone')) {
            return true;
        }
        
        // Customer поля
        if (callFieldLower.includes('customer') && leadFieldLower.includes('customer')) {
            return true;
        }
        
        // Email поля
        if (callFieldLower.includes('email') && leadFieldLower.includes('email')) {
            return true;
        }
        
        // Org поля
        if (callFieldLower.includes('org') && leadFieldLower.includes('org')) {
            return true;
        }
        
        // Точные совпадения названий
        if (callFieldLower === leadFieldLower) {
            return true;
        }
        
        // Значения, если оба существуют и не слишком короткие
        if (callValue && leadValue && 
            typeof callValue === 'string' && typeof leadValue === 'string' &&
            callValue.length > 5 && leadValue.length > 5) {
            
            if (callValue === leadValue) {
                return true;
            }
            
            // Частичные совпадения для длинных строк
            if (callValue.length > 10 && leadValue.length > 10) {
                if (callValue.includes(leadValue) || leadValue.includes(callValue)) {
                    return true;
                }
            }
        }
        
        return false;
    }

    getMatchType(callField, leadField, callValue, leadValue) {
        if (callField.toLowerCase() === leadField.toLowerCase()) {
            return 'exact_field_name';
        }
        if (callValue === leadValue) {
            return 'exact_value';
        }
        if (callField.toLowerCase().includes('id') && leadField.toLowerCase().includes('id')) {
            return 'id_field';
        }
        if (callField.toLowerCase().includes('phone') && leadField.toLowerCase().includes('phone')) {
            return 'phone_field';
        }
        if (callValue && leadValue && (callValue.includes(leadValue) || leadValue.includes(callValue))) {
            return 'partial_value';
        }
        return 'field_similarity';
    }

    async analyzeAllRelationships() {
        console.log('🚀 SIMPLIFIED FIELD MATCHING ANALYSIS');
        console.log('======================================\n');

        // Загружаем образец вызова
        if (!this.loadCallSample()) {
            return;
        }

        const callFields = Object.keys(this.callSample);
        console.log(`\n📊 Call data has ${callFields.length} fields to match against\n`);

        const allMatches = {};
        
        // Проверяем каждую таблицу лидов
        for (const table of this.leadTables) {
            const leadData = await this.getLeadTableSample(table.id, table.name);
            
            if (leadData.fields.length > 0) {
                const matches = this.findPotentialMatches(callFields, leadData.fields, leadData.sampleData);
                
                if (matches.length > 0) {
                    allMatches[table.name] = matches;
                    console.log(`\n🔗 Potential matches with ${table.name}:`);
                    matches.forEach(match => {
                        console.log(`   ${match.callField} ↔ ${match.leadField} (${match.matchType})`);
                        if (match.callValue && match.leadValue) {
                            console.log(`     Values: "${match.callValue}" | "${match.leadValue}"`);
                        }
                    });
                } else {
                    console.log(`\n⚫ No potential matches with ${table.name}`);
                }
            }
        }

        this.generateRecommendations(allMatches);
    }

    generateRecommendations(allMatches) {
        console.log('\n📋 FIELD MATCHING RECOMMENDATIONS');
        console.log('==================================\n');

        const fieldPriority = {};
        let totalTables = 0;
        let tablesWithMatches = 0;

        for (const [tableName, matches] of Object.entries(allMatches)) {
            totalTables++;
            if (matches.length > 0) {
                tablesWithMatches++;
                
                matches.forEach(match => {
                    const key = `${match.callField} → ${match.leadField}`;
                    if (!fieldPriority[key]) {
                        fieldPriority[key] = {
                            count: 0,
                            matchType: match.matchType,
                            tables: []
                        };
                    }
                    fieldPriority[key].count++;
                    fieldPriority[key].tables.push(tableName);
                });
            }
        }

        console.log(`📊 Summary: ${tablesWithMatches}/${this.leadTables.length} lead tables have potential matches\n`);

        if (Object.keys(fieldPriority).length > 0) {
            console.log('🎯 TOP RECOMMENDED MATCHING FIELDS:');
            console.log('====================================');

            const sortedFields = Object.entries(fieldPriority)
                .sort(([,a], [,b]) => b.count - a.count)
                .slice(0, 10);

            sortedFields.forEach(([fieldPair, data], index) => {
                console.log(`${index + 1}. ${fieldPair}`);
                console.log(`   Match Type: ${data.matchType}`);
                console.log(`   Tables: ${data.tables.join(', ')} (${data.count} tables)`);
                console.log('');
            });

            console.log('🔧 SUGGESTED IMPLEMENTATION PLAN:');
            console.log('===================================');
            console.log('1. Start with ID fields (Call ID, Customer ID, Org ID)');
            console.log('2. Try phone number matching (normalize formats first)');
            console.log('3. Use exact field name matches');
            console.log('4. Test partial value matching for long strings');
            console.log('5. Create lookup tables for assistant/customer mapping');

        } else {
            console.log('❌ No potential matching fields found across any tables');
            console.log('💡 Consider:');
            console.log('   - Different field naming conventions');
            console.log('   - Data normalization needs');
            console.log('   - Indirect relationships through other tables');
        }
    }
}

if (require.main === module) {
    const matcher = new SimpleFieldMatcher();
    matcher.analyzeAllRelationships().catch(console.error);
}

module.exports = SimpleFieldMatcher;