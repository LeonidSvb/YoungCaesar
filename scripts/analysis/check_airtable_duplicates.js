require('dotenv').config();
const Airtable = require('airtable');
const fs = require('fs');
const path = require('path');

// Configure Airtable
const base = new Airtable({
    apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE_ID);

const table = base(process.env.AIRTABLE_TABLE_ID);

class DuplicateChecker {
    constructor() {
        this.allRecords = [];
        this.duplicates = [];
        this.callIdCounts = {};
    }

    // Get all records from Airtable
    async getAllRecords() {
        console.log('📊 Fetching all records from Airtable...');
        
        try {
            this.allRecords = await table.select({
                fields: ['Call ID', 'Created At', 'Phone', 'Assistant Name', 'Duration (seconds)']
            }).all();

            console.log(`✅ Retrieved ${this.allRecords.length} records from Airtable`);
            return this.allRecords;
        } catch (error) {
            console.error('❌ Error fetching records:', error);
            throw error;
        }
    }

    // Check for duplicate Call IDs
    checkDuplicates() {
        console.log('🔍 Checking for duplicate Call IDs...');
        
        // Count occurrences of each Call ID
        this.allRecords.forEach(record => {
            const callId = record.fields['Call ID'];
            if (callId) {
                if (!this.callIdCounts[callId]) {
                    this.callIdCounts[callId] = [];
                }
                this.callIdCounts[callId].push({
                    recordId: record.id,
                    createdAt: record.fields['Created At'],
                    phone: record.fields['Phone'],
                    assistant: record.fields['Assistant Name'],
                    duration: record.fields['Duration (seconds)']
                });
            }
        });

        // Find duplicates
        Object.entries(this.callIdCounts).forEach(([callId, records]) => {
            if (records.length > 1) {
                this.duplicates.push({
                    callId,
                    count: records.length,
                    records
                });
            }
        });

        return this.duplicates;
    }

    // Display duplicate analysis
    displayResults() {
        console.log('\n📋 DUPLICATE ANALYSIS RESULTS');
        console.log('================================');
        
        if (this.duplicates.length === 0) {
            console.log('✅ No duplicates found! All Call IDs are unique.');
            console.log(`📊 Total unique Call IDs: ${Object.keys(this.callIdCounts).length}`);
            console.log(`📊 Total records: ${this.allRecords.length}`);
            return;
        }

        console.log(`❌ Found ${this.duplicates.length} duplicate Call IDs:`);
        console.log(`📊 Total records: ${this.allRecords.length}`);
        console.log(`📊 Unique Call IDs: ${Object.keys(this.callIdCounts).length}`);
        
        this.duplicates.forEach((duplicate, index) => {
            console.log(`\n${index + 1}. Call ID: ${duplicate.callId} (${duplicate.count} copies)`);
            duplicate.records.forEach((record, i) => {
                console.log(`   ${i + 1}. Record ${record.recordId}`);
                console.log(`      Created: ${record.createdAt}`);
                console.log(`      Phone: ${record.phone}`);
                console.log(`      Assistant: ${record.assistant}`);
                console.log(`      Duration: ${record.duration}s`);
            });
        });
    }

    // Generate duplicate removal suggestions
    generateRemovalPlan() {
        if (this.duplicates.length === 0) {
            console.log('\n✅ No cleanup needed - no duplicates found!');
            return;
        }

        console.log('\n🗑️  DUPLICATE REMOVAL PLAN');
        console.log('===========================');
        
        const recordsToDelete = [];
        
        this.duplicates.forEach(duplicate => {
            // Keep the first record (oldest), mark others for deletion
            const recordsToKeep = duplicate.records.slice(0, 1);
            const recordsToRemove = duplicate.records.slice(1);
            
            recordsToRemove.forEach(record => {
                recordsToDelete.push(record.recordId);
            });
            
            console.log(`Call ID ${duplicate.callId}:`);
            console.log(`  ✅ Keep: ${recordsToKeep[0].recordId} (${recordsToKeep[0].createdAt})`);
            recordsToRemove.forEach(record => {
                console.log(`  ❌ Delete: ${record.recordId} (${record.createdAt})`);
            });
        });

        console.log(`\n📊 Summary:`);
        console.log(`  Records to keep: ${this.allRecords.length - recordsToDelete.length}`);
        console.log(`  Records to delete: ${recordsToDelete.length}`);

        return recordsToDelete;
    }

    // Save duplicate report
    saveDuplicateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            totalRecords: this.allRecords.length,
            uniqueCallIds: Object.keys(this.callIdCounts).length,
            duplicatesFound: this.duplicates.length,
            duplicates: this.duplicates,
            summary: {
                hasDuplicates: this.duplicates.length > 0,
                duplicateCallIds: this.duplicates.map(d => d.callId),
                recordsToCleanup: this.duplicates.reduce((sum, d) => sum + (d.count - 1), 0)
            }
        };

        const reportPath = path.join(__dirname, '../../data/processed/airtable_duplicate_report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        console.log(`\n💾 Duplicate report saved to: ${reportPath}`);
        return reportPath;
    }
}

// Main execution
async function checkAirtableDuplicates() {
    const checker = new DuplicateChecker();
    
    try {
        // Get all records
        await checker.getAllRecords();
        
        // Check for duplicates
        const duplicates = checker.checkDuplicates();
        
        // Display results
        checker.displayResults();
        
        // Generate removal plan
        checker.generateRemovalPlan();
        
        // Save report
        checker.saveDuplicateReport();
        
        return {
            success: true,
            duplicatesFound: duplicates.length > 0,
            duplicateCount: duplicates.length,
            totalRecords: checker.allRecords.length
        };
        
    } catch (error) {
        console.error('💥 Duplicate check failed:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

if (require.main === module) {
    checkAirtableDuplicates()
        .then(result => {
            if (result.success && result.duplicatesFound) {
                console.log('\n⚠️  DUPLICATES FOUND - Manual cleanup recommended');
                process.exit(1);
            } else if (result.success) {
                console.log('\n✅ All clear - no duplicates detected');
                process.exit(0);
            } else {
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('Script failed:', error);
            process.exit(1);
        });
}

module.exports = { checkAirtableDuplicates };