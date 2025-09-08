require('dotenv').config();

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

// Deep analysis of ID structures and relationships
class DeepIDAnalyzer {
    constructor() {
        this.mainCallsTableId = 'tblvXZt2zkkanjGdE'; // Calls - raw data
        this.leadTables = {
            'E164_YC': 'tblLmWcITpAZdKhs2',
            'E164_Biesse': 'tblZ0UPX8U6E081yC', 
            'USA_Leads': 'tblVSTLFdPSYjWQ89',
            'EU_Leads': 'tblhkE3kg4Pitcua6'
        };
    }

    // Get sample data from each table to analyze ID patterns
    async getSampleData(tableId, tableName, limit = 5) {
        try {
            const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}?maxRecords=${limit}`;
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} for ${tableName}`);
            }

            const data = await response.json();
            return {
                tableName,
                tableId,
                records: data.records,
                fieldNames: data.records.length > 0 ? Object.keys(data.records[0].fields) : []
            };
        } catch (error) {
            console.error(`❌ Error fetching ${tableName}:`, error.message);
            return { tableName, tableId, records: [], fieldNames: [] };
        }
    }

    // Analyze ID patterns in calls table  
    async analyzeCallsTableIDs() {
        console.log('🔍 CALLS TABLE ID ANALYSIS');
        console.log('===========================\n');

        const callsData = await this.getSampleData(this.mainCallsTableId, 'Calls - raw data', 10);
        
        if (callsData.records.length === 0) {
            console.log('❌ Could not fetch calls data');
            return;
        }

        console.log(`📊 Sample size: ${callsData.records.length} records`);
        console.log(`📋 Total fields: ${callsData.fieldNames.length}`);
        
        // Find all ID-related fields
        const idFields = callsData.fieldNames.filter(field => 
            field.toLowerCase().includes('id') || 
            field.toLowerCase().includes('vapi') ||
            field.toLowerCase().includes('call') && field.toLowerCase().includes('id')
        );
        
        console.log(`\n🆔 ID-RELATED FIELDS (${idFields.length}):`);
        idFields.forEach(field => console.log(`  - ${field}`));

        // Analyze sample values for each ID field
        console.log('\n📋 ID FIELD ANALYSIS:');
        console.log('======================');
        
        idFields.forEach(field => {
            console.log(`\n${field}:`);
            callsData.records.forEach((record, index) => {
                const value = record.fields[field];
                if (value) {
                    console.log(`  Record ${index + 1}: ${value}`);
                } else {
                    console.log(`  Record ${index + 1}: [EMPTY]`);
                }
            });
        });

        return { callsData, idFields };
    }

    // Analyze lead tables for VAPI IDs and connections
    async analyzeLeadTableIDs() {
        console.log('\n\n🔍 LEAD TABLES ID ANALYSIS');
        console.log('===========================\n');

        const leadAnalysis = {};
        
        for (const [tableName, tableId] of Object.entries(this.leadTables)) {
            console.log(`📊 ANALYZING: ${tableName}`);
            console.log('------------------------');
            
            const leadData = await this.getSampleData(tableId, tableName, 5);
            leadAnalysis[tableName] = leadData;
            
            if (leadData.records.length === 0) {
                console.log('❌ No data available\n');
                continue;
            }

            // Find ID and connection fields
            const connectionFields = leadData.fieldNames.filter(field => {
                const lower = field.toLowerCase();
                return lower.includes('id') || 
                       lower.includes('vapi') || 
                       lower.includes('call') ||
                       lower.includes('link') ||
                       lower.includes('related');
            });

            console.log(`🔗 CONNECTION FIELDS: ${connectionFields.join(', ')}`);
            
            // Show sample values
            connectionFields.forEach(field => {
                console.log(`\n${field}:`);
                leadData.records.slice(0, 3).forEach((record, index) => {
                    const value = record.fields[field];
                    if (value) {
                        // Handle different value types
                        if (Array.isArray(value)) {
                            console.log(`  Record ${index + 1}: [${value.length} links] ${value.slice(0, 2).join(', ')}${value.length > 2 ? '...' : ''}`);
                        } else {
                            console.log(`  Record ${index + 1}: ${value}`);
                        }
                    } else {
                        console.log(`  Record ${index + 1}: [EMPTY]`);
                    }
                });
            });
            console.log('');

            await new Promise(resolve => setTimeout(resolve, 300)); // Rate limiting
        }

        return leadAnalysis;
    }

    // Find patterns and relationships
    analyzeIDPatterns(callsAnalysis, leadAnalysis) {
        console.log('\n🧩 ID PATTERN ANALYSIS');
        console.log('=======================\n');

        const patterns = {
            vapiIDs: {
                inCalls: [],
                inLeads: {},
                pattern: 'UUID format (8-4-4-4-12 characters)'
            },
            phoneConnections: {
                inCalls: [],
                inLeads: {},
                pattern: 'Phone number matching'  
            },
            directLinks: {
                found: [],
                pattern: 'Airtable record links'
            }
        };

        // Analyze VAPI IDs from calls
        if (callsAnalysis && callsAnalysis.callsData) {
            callsAnalysis.callsData.records.forEach(record => {
                // Look for VAPI-related IDs
                Object.keys(record.fields).forEach(field => {
                    if (field.toLowerCase().includes('vapi') || field.toLowerCase().includes('assistant')) {
                        const value = record.fields[field];
                        if (value && typeof value === 'string' && value.length > 10) {
                            patterns.vapiIDs.inCalls.push({ field, value });
                        }
                    }
                    
                    // Look for phone numbers
                    if (field.toLowerCase().includes('phone')) {
                        const value = record.fields[field];
                        if (value) {
                            patterns.phoneConnections.inCalls.push({ field, value });
                        }
                    }
                });
            });
        }

        // Analyze connections from leads
        Object.keys(leadAnalysis).forEach(tableName => {
            const tableData = leadAnalysis[tableName];
            patterns.vapiIDs.inLeads[tableName] = [];
            patterns.phoneConnections.inLeads[tableName] = [];
            
            tableData.records.forEach(record => {
                Object.keys(record.fields).forEach(field => {
                    const value = record.fields[field];
                    
                    // VAPI IDs
                    if (field.toLowerCase().includes('vapi') && value) {
                        patterns.vapiIDs.inLeads[tableName].push({ field, value });
                    }
                    
                    // Phone/Number fields  
                    if ((field.toLowerCase().includes('phone') || field.toLowerCase().includes('number')) && value) {
                        patterns.phoneConnections.inLeads[tableName].push({ field, value });
                    }
                    
                    // Direct links (array values)
                    if (Array.isArray(value) && value.length > 0) {
                        patterns.directLinks.found.push({
                            table: tableName,
                            field,
                            linkCount: value.length,
                            sample: value[0]
                        });
                    }
                });
            });
        });

        return patterns;
    }

    // Generate recommendations based on analysis
    generateRecommendations(patterns) {
        console.log('💡 MATCHING RECOMMENDATIONS');
        console.log('============================\n');

        const recommendations = [];

        // Check for VAPI ID connections
        const totalVAPIInCalls = patterns.vapiIDs.inCalls.length;
        const totalVAPIInLeads = Object.values(patterns.vapiIDs.inLeads).reduce((sum, arr) => sum + arr.length, 0);
        
        console.log(`📊 VAPI IDs found:`);
        console.log(`   In calls table: ${totalVAPIInCalls}`);
        console.log(`   In lead tables: ${totalVAPIInLeads}`);
        
        if (totalVAPIInCalls > 0 && totalVAPIInLeads > 0) {
            recommendations.push({
                method: 'VAPI ID Matching',
                reliability: '95%',
                reason: 'VAPI IDs found in both calls and leads - direct system connection',
                implementation: 'Medium'
            });
        }

        // Check for phone connections
        const totalPhonesInCalls = patterns.phoneConnections.inCalls.length;
        const totalPhonesInLeads = Object.values(patterns.phoneConnections.inLeads).reduce((sum, arr) => sum + arr.length, 0);
        
        console.log(`\n📞 Phone numbers found:`);
        console.log(`   In calls table: ${totalPhonesInCalls}`);
        console.log(`   In lead tables: ${totalPhonesInLeads}`);
        
        if (totalPhonesInCalls > 0 && totalPhonesInLeads > 0) {
            recommendations.push({
                method: 'Phone Number Matching',
                reliability: '85%', 
                reason: 'Phone numbers available in both - natural business connection',
                implementation: 'Medium (requires normalization)'
            });
        }

        // Check for direct links
        if (patterns.directLinks.found.length > 0) {
            console.log(`\n🔗 Direct links found: ${patterns.directLinks.found.length}`);
            patterns.directLinks.found.forEach(link => {
                console.log(`   ${link.table}.${link.field}: ${link.linkCount} links`);
            });
            
            recommendations.push({
                method: 'Direct Airtable Links',
                reliability: '100%',
                reason: 'Existing Airtable relationships - already connected',
                implementation: 'Easy (already exists)'
            });
        }

        // Generate final recommendation
        console.log('\n🎯 RECOMMENDED STRATEGY:');
        console.log('========================');
        
        if (recommendations.length === 0) {
            console.log('❌ No clear connection patterns found');
            console.log('💡 Fallback: Create connections based on phone number matching');
        } else {
            // Sort by reliability
            const sorted = recommendations.sort((a, b) => {
                const reliabilityA = parseInt(a.reliability);
                const reliabilityB = parseInt(b.reliability);
                return reliabilityB - reliabilityA;
            });
            
            const best = sorted[0];
            console.log(`✅ PRIMARY: ${best.method} (${best.reliability})`);
            console.log(`   Reason: ${best.reason}`);
            console.log(`   Implementation: ${best.implementation}`);
            
            if (sorted.length > 1) {
                console.log(`\n🔄 FALLBACK: ${sorted[1].method} (${sorted[1].reliability})`);
                console.log(`   Reason: ${sorted[1].reason}`);
            }
        }

        return recommendations;
    }

    // Main analysis runner
    async runDeepAnalysis() {
        try {
            console.log('🚀 DEEP ID STRUCTURE ANALYSIS');
            console.log('==============================\n');
            
            const callsAnalysis = await this.analyzeCallsTableIDs();
            const leadAnalysis = await this.analyzeLeadTableIDs();
            const patterns = this.analyzeIDPatterns(callsAnalysis, leadAnalysis);
            
            console.log('\n📋 DISCOVERED PATTERNS:');
            console.log('=======================');
            console.log(`VAPI IDs in calls: ${patterns.vapiIDs.inCalls.length}`);
            console.log(`Phone connections in calls: ${patterns.phoneConnections.inCalls.length}`);
            console.log(`Direct links found: ${patterns.directLinks.found.length}`);
            
            const recommendations = this.generateRecommendations(patterns);
            
            return {
                callsAnalysis,
                leadAnalysis, 
                patterns,
                recommendations
            };
            
        } catch (error) {
            console.error('❌ Deep analysis failed:', error.message);
        }
    }
}

// Execute analysis
if (require.main === module) {
    const analyzer = new DeepIDAnalyzer();
    analyzer.runDeepAnalysis();
}

module.exports = DeepIDAnalyzer;