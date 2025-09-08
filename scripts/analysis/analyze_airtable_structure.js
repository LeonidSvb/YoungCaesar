require('dotenv').config();

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

async function analyzeAirtableStructure() {
    try {
        console.log('Analyzing Airtable base structure...\n');
        
        // Get base metadata
        const baseUrl = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`;
        
        const response = await fetch(baseUrl, {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        console.log(`📊 Base ID: ${AIRTABLE_BASE_ID}`);
        console.log(`📋 Total tables: ${data.tables.length}\n`);
        
        // Analyze each table
        data.tables.forEach((table, index) => {
            console.log(`${index + 1}. TABLE: "${table.name}"`);
            console.log(`   ID: ${table.id}`);
            console.log(`   Primary Field: ${table.primaryFieldId}`);
            console.log(`   Fields: ${table.fields.length}`);
            
            // Show field details
            console.log('   Field Structure:');
            table.fields.forEach(field => {
                console.log(`     - ${field.name} (${field.type})`);
                if (field.options && field.options.choices) {
                    console.log(`       Options: ${field.options.choices.map(c => c.name).join(', ')}`);
                }
            });
            
            console.log('');
        });
        
        // Analysis recommendations
        console.log('\n🔍 STRUCTURE ANALYSIS:');
        console.log('=======================');
        
        const mainTable = data.tables.find(t => t.name.toLowerCase().includes('call'));
        if (mainTable) {
            console.log(`✅ Main calls table found: "${mainTable.name}"`);
            console.log(`   Contains ${mainTable.fields.length} fields`);
            
            // Identify potential separation opportunities
            const fieldGroups = {
                core: [],
                customer: [],
                assistant: [],
                cost: [],
                technical: [],
                analysis: []
            };
            
            mainTable.fields.forEach(field => {
                const name = field.name.toLowerCase();
                if (name.includes('customer') || name.includes('phone')) {
                    fieldGroups.customer.push(field.name);
                } else if (name.includes('assistant')) {
                    fieldGroups.assistant.push(field.name);
                } else if (name.includes('cost') || name.includes('token')) {
                    fieldGroups.cost.push(field.name);
                } else if (name.includes('provider') || name.includes('transport') || name.includes('id')) {
                    fieldGroups.technical.push(field.name);
                } else if (name.includes('summary') || name.includes('transcript') || name.includes('analysis')) {
                    fieldGroups.analysis.push(field.name);
                } else {
                    fieldGroups.core.push(field.name);
                }
            });
            
            console.log('\n📈 FIELD GROUPING ANALYSIS:');
            Object.keys(fieldGroups).forEach(group => {
                if (fieldGroups[group].length > 0) {
                    console.log(`\n${group.toUpperCase()} FIELDS (${fieldGroups[group].length}):`);
                    fieldGroups[group].forEach(field => console.log(`  - ${field}`));
                }
            });
        }
        
        // Check for other tables
        const otherTables = data.tables.filter(t => !t.name.toLowerCase().includes('call'));
        if (otherTables.length > 0) {
            console.log(`\n🔗 OTHER TABLES (${otherTables.length}):`);
            otherTables.forEach(table => {
                console.log(`  - ${table.name} (${table.fields.length} fields)`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error analyzing Airtable structure:', error.message);
    }
}

if (require.main === module) {
    analyzeAirtableStructure();
}

module.exports = analyzeAirtableStructure;