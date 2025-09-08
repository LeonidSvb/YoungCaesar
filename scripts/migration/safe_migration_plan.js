require('dotenv').config();

// SAFE MIGRATION STRATEGY - DO NOT TOUCH EXISTING TABLES

const MAIN_CALLS_TABLE_ID = 'tblvXZt2zkkanjGdE'; // Current calls table with 5,138 records
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const API_KEY = process.env.AIRTABLE_API_KEY;

class SafeMigrationPlanner {
    constructor() {
        this.backupPath = './data/migration_backups/';
        this.newTableStructures = {};
    }

    // PHASE 1: ANALYSIS & BACKUP
    async analyzeCurrentStructure() {
        console.log('🔍 PHASE 1: ANALYZING CURRENT STRUCTURE');
        console.log('=====================================\n');
        
        // Analyze the main calls table
        const url = `https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        const mainTable = data.tables.find(t => t.id === MAIN_CALLS_TABLE_ID);
        
        console.log(`📊 MAIN CALLS TABLE ANALYSIS:`);
        console.log(`   Table Name: ${mainTable.name}`);
        console.log(`   Fields: ${mainTable.fields.length}`);
        console.log(`   Records: ~5,138`);
        
        // Categorize fields
        const fieldCategories = {
            essential: [],    // Must have in clean table
            technical: [],    // Raw technical data - can hide
            analysis: [],     // AI analysis - separate table
            costs: [],        // Cost breakdown - can group
            redundant: []     // Duplicate or unnecessary
        };
        
        mainTable.fields.forEach(field => {
            const name = field.name.toLowerCase();
            
            if (['call id', 'phone', 'status', 'created at', 'assistant name', 'duration (formatted)', 'cost'].some(essential => name.includes(essential.replace(/[()]/g, '')))) {
                fieldCategories.essential.push(field.name);
            } else if (name.includes('cost') && !name.includes('total')) {
                fieldCategories.costs.push(field.name);
            } else if (name.includes('token') || name.includes('character') || name.includes('provider id')) {
                fieldCategories.technical.push(field.name);
            } else if (name.includes('transcript') || name.includes('summary') || name.includes('analysis')) {
                fieldCategories.analysis.push(field.name);
            } else {
                fieldCategories.redundant.push(field.name);
            }
        });
        
        console.log('\n📋 FIELD CATEGORIZATION:');
        Object.keys(fieldCategories).forEach(category => {
            console.log(`\n${category.toUpperCase()} (${fieldCategories[category].length}):`);
            fieldCategories[category].forEach(field => console.log(`  - ${field}`));
        });
        
        return fieldCategories;
    }

    // PHASE 2: BACKUP STRATEGY
    generateBackupPlan() {
        console.log('\n\n🛡️  PHASE 2: BACKUP STRATEGY');
        console.log('============================\n');
        
        const backupPlan = {
            csvExports: [
                'Main Calls Table (all 38 fields)',
                'All Lead Tables (USA, EU, ASIA, etc.)',
                'Assistant configurations',
                'Organization settings'
            ],
            jsonExports: [
                'Complete base schema',
                'Field configurations',
                'Relationship mappings'
            ],
            timeline: '30 minutes',
            storage: './data/migration_backups/',
            rollbackPlan: 'Keep original tables untouched as fallback'
        };
        
        console.log('📦 BACKUP COMPONENTS:');
        console.log('\nCSV Exports:');
        backupPlan.csvExports.forEach(item => console.log(`  ✓ ${item}`));
        
        console.log('\nJSON Exports:');
        backupPlan.jsonExports.forEach(item => console.log(`  ✓ ${item}`));
        
        console.log(`\n⏱️  Estimated time: ${backupPlan.timeline}`);
        console.log(`💾 Storage location: ${backupPlan.storage}`);
        
        return backupPlan;
    }

    // PHASE 3: NEW TABLE DESIGNS
    designCleanTables() {
        console.log('\n\n🎨 PHASE 3: NEW TABLE DESIGNS');
        console.log('==============================\n');
        
        const newTables = {
            'CALLS_CLEAN': {
                purpose: 'Clean calls table for daily use',
                fields: [
                    'Call ID', 'Date', 'Time', 'Assistant', 'Phone', 
                    'Duration', 'Status', 'Cost', 'Recording', 'Summary (100 chars)',
                    'Success', 'End Reason'
                ],
                features: ['Date formulas', 'Proper date fields', 'Links to prospects'],
                records: '~5,138 (copied from original)'
            },
            
            'CALL_DETAILS': {
                purpose: 'Full technical data (linked to CALLS_CLEAN)',
                fields: [
                    'Call ID (Link)', 'Full Transcript', 'Complete Summary',
                    'Cost Breakdown', 'Token Counts', 'Technical IDs', 'Provider Details'
                ],
                features: ['One-to-one link', 'Searchable transcripts'],
                records: '~5,138 (linked)'
            },
            
            'PROSPECTS_MASTER': {
                purpose: 'Unified contacts from all lead tables',
                fields: [
                    'Name', 'Phone', 'Email', 'Company', 'Market', 
                    'Keywords', 'Status', 'Last Called', 'Success Rate'
                ],
                features: ['Deduplicated', 'Market filters', 'Call history links'],
                records: '~2,000-3,000 (merged from 6+ tables)'
            }
        };
        
        Object.keys(newTables).forEach(tableName => {
            const table = newTables[tableName];
            console.log(`📋 ${tableName}:`);
            console.log(`   Purpose: ${table.purpose}`);
            console.log(`   Fields: ${table.fields.length} (vs 38 in original)`);
            console.log(`   Records: ${table.records}`);
            console.log(`   Features: ${table.features.join(', ')}`);
            console.log('');
        });
        
        return newTables;
    }

    // PHASE 4: MIGRATION TIMELINE
    createMigrationTimeline() {
        console.log('\n📅 PHASE 4: MIGRATION TIMELINE');
        console.log('===============================\n');
        
        const timeline = [
            {
                step: 1,
                task: 'BACKUP & EXPORT',
                time: '30 min',
                actions: ['Export all tables to CSV/JSON', 'Verify backups', 'Document current state'],
                risk: 'Low - read-only operations'
            },
            {
                step: 2,
                task: 'CREATE NEW TABLES',
                time: '45 min',
                actions: ['Create CALLS_CLEAN structure', 'Create CALL_DETAILS structure', 'Create PROSPECTS_MASTER structure'],
                risk: 'Low - new tables only'
            },
            {
                step: 3,
                task: 'DATA MIGRATION',
                time: '60 min',
                actions: ['Copy calls data with cleanup', 'Process date fields', 'Link tables together'],
                risk: 'Medium - data processing'
            },
            {
                step: 4,
                task: 'INTERFACE SETUP',
                time: '30 min',
                actions: ['Create dashboard interface', 'Set up filters and views', 'Test functionality'],
                risk: 'Low - interface only'
            },
            {
                step: 5,
                task: 'TESTING & VALIDATION',
                time: '30 min',
                actions: ['Compare record counts', 'Test key workflows', 'Validate data integrity'],
                risk: 'Low - validation only'
            },
            {
                step: 6,
                task: 'HIDE ORIGINAL TABLES',
                time: '5 min',
                actions: ['Hide original tables from main view', 'Keep as backup', 'Update team access'],
                risk: 'Very Low - cosmetic change'
            }
        ];
        
        let totalTime = 0;
        timeline.forEach(phase => {
            console.log(`🔢 STEP ${phase.step}: ${phase.task} (${phase.time})`);
            console.log(`   Actions: ${phase.actions.join(', ')}`);
            console.log(`   Risk Level: ${phase.risk}\n`);
            totalTime += parseInt(phase.time);
        });
        
        console.log(`⏱️  TOTAL ESTIMATED TIME: ${totalTime} minutes (~3.5 hours)`);
        console.log(`🛡️  SAFETY LEVEL: High (original data preserved)`);
        
        return timeline;
    }

    // ROLLBACK PLAN
    generateRollbackPlan() {
        console.log('\n\n🔄 ROLLBACK PLAN');
        console.log('================\n');
        
        const rollbackSteps = [
            '1. Delete new tables (CALLS_CLEAN, CALL_DETAILS, PROSPECTS_MASTER)',
            '2. Unhide original tables',
            '3. Restore original interface if modified',
            '4. No data loss - original tables untouched throughout process'
        ];
        
        console.log('🚨 IF SOMETHING GOES WRONG:');
        rollbackSteps.forEach(step => console.log(`   ${step}`));
        
        console.log('\n✅ SAFETY GUARANTEES:');
        console.log('   - Original tables never modified');
        console.log('   - All original data preserved');
        console.log('   - Can revert in under 5 minutes');
        console.log('   - Zero data loss risk');
        
        return rollbackSteps;
    }
}

// MAIN EXECUTION
async function generateMigrationPlan() {
    const planner = new SafeMigrationPlanner();
    
    try {
        const fieldCategories = await planner.analyzeCurrentStructure();
        const backupPlan = planner.generateBackupPlan();
        const newTables = planner.designCleanTables();
        const timeline = planner.createMigrationTimeline();
        const rollback = planner.generateRollbackPlan();
        
        console.log('\n\n🎯 NEXT STEPS:');
        console.log('==============');
        console.log('1. Review this migration plan');
        console.log('2. Approve the new table structures');
        console.log('3. Run the backup script');
        console.log('4. Execute migration step by step');
        console.log('5. Test new interface and functionality');
        console.log('\n✅ Ready to proceed safely!');
        
    } catch (error) {
        console.error('❌ Error generating migration plan:', error.message);
    }
}

if (require.main === module) {
    generateMigrationPlan();
}

module.exports = SafeMigrationPlanner;