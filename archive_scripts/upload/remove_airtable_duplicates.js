require('dotenv').config();
const Airtable = require('airtable');
const fs = require('fs');
const path = require('path');

// Configure Airtable
const base = new Airtable({
    apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE_ID);

const table = base(process.env.AIRTABLE_TABLE_ID);

class DuplicateRemover {
    constructor() {
        this.batchSize = 10; // Airtable allows max 10 deletions per batch
        this.deletedCount = 0;
        this.failedDeletions = [];
    }

    // Load duplicate report
    loadDuplicateReport() {
        const reportPath = path.join(__dirname, '../../data/processed/airtable_duplicate_report.json');
        
        if (!fs.existsSync(reportPath)) {
            throw new Error('Duplicate report not found. Run check_airtable_duplicates.js first.');
        }

        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        console.log('📄 Loaded duplicate report:');
        console.log(`  - Total records: ${report.totalRecords}`);
        console.log(`  - Unique Call IDs: ${report.uniqueCallIds}`);
        console.log(`  - Duplicates found: ${report.duplicatesFound}`);
        console.log(`  - Records to clean: ${report.summary.recordsToCleanup}`);

        return report;
    }

    // Generate list of record IDs to delete
    getRecordsToDelete(report) {
        const recordsToDelete = [];
        
        report.duplicates.forEach(duplicate => {
            // Keep the first record (oldest), delete the rest
            const recordsToRemove = duplicate.records.slice(1);
            recordsToRemove.forEach(record => {
                recordsToDelete.push(record.recordId);
            });
        });

        return recordsToDelete;
    }

    // Delete batch of records
    async deleteBatch(recordIds) {
        try {
            console.log(`🗑️  Deleting batch of ${recordIds.length} records...`);
            await table.destroy(recordIds);
            this.deletedCount += recordIds.length;
            console.log(`✅ Successfully deleted ${recordIds.length} records`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to delete batch:`, error.message);
            this.failedDeletions.push(...recordIds);
            return false;
        }
    }

    // Delete all duplicate records
    async removeAllDuplicates() {
        try {
            console.log('🚀 Starting duplicate removal process...\n');
            
            // Load duplicate report
            const report = this.loadDuplicateReport();
            
            if (!report.summary.hasDuplicates) {
                console.log('✅ No duplicates found - nothing to delete!');
                return;
            }

            // Get records to delete
            const recordsToDelete = this.getRecordsToDelete(report);
            console.log(`\n📊 Preparing to delete ${recordsToDelete.length} duplicate records\n`);

            // Confirm deletion
            console.log('⚠️  WARNING: This will permanently delete duplicate records!');
            console.log(`   Records to delete: ${recordsToDelete.length}`);
            console.log(`   Records to keep: ${report.totalRecords - recordsToDelete.length}`);
            
            // Auto-proceed with deletion (remove this if you want manual confirmation)
            console.log('\n🟡 Proceeding with automatic deletion...\n');

            // Delete in batches
            for (let i = 0; i < recordsToDelete.length; i += this.batchSize) {
                const batch = recordsToDelete.slice(i, i + this.batchSize);
                
                await this.deleteBatch(batch);
                
                // Progress indicator
                const progress = Math.min(i + this.batchSize, recordsToDelete.length);
                console.log(`📈 Progress: ${progress}/${recordsToDelete.length} records processed`);
                
                // Add delay between batches to respect rate limits
                if (i + this.batchSize < recordsToDelete.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            // Final summary
            console.log('\n📋 CLEANUP SUMMARY');
            console.log('==================');
            console.log(`✅ Successfully deleted: ${this.deletedCount} records`);
            console.log(`❌ Failed deletions: ${this.failedDeletions.length} records`);
            console.log(`📊 Total processed: ${recordsToDelete.length} records`);
            
            const expectedRemaining = report.totalRecords - this.deletedCount;
            console.log(`📊 Expected remaining records: ${expectedRemaining}`);

            if (this.failedDeletions.length > 0) {
                // Save failed deletions for retry
                const failedPath = path.join(__dirname, '../../data/processed/failed_deletions.json');
                fs.writeFileSync(failedPath, JSON.stringify(this.failedDeletions, null, 2));
                console.log(`💾 Failed deletions saved to: ${failedPath}`);
            }

            console.log('\n🎉 Duplicate removal completed!');
            
        } catch (error) {
            console.error('💥 Duplicate removal failed:', error.message);
            throw error;
        }
    }

    // Verify cleanup results
    async verifyCleanup() {
        try {
            console.log('\n🔍 Verifying cleanup results...');
            
            // Re-run duplicate check
            const { checkAirtableDuplicates } = require('../analysis/check_airtable_duplicates.js');
            const result = await checkAirtableDuplicates();
            
            if (result.success && !result.duplicatesFound) {
                console.log('✅ Verification successful - no duplicates remaining!');
                console.log(`📊 Final record count: ${result.totalRecords}`);
            } else if (result.success && result.duplicatesFound) {
                console.log(`⚠️  Warning: ${result.duplicateCount} duplicates still remain`);
            } else {
                console.log('❌ Verification failed');
            }
            
            return result;
        } catch (error) {
            console.error('❌ Verification failed:', error.message);
            return { success: false, error: error.message };
        }
    }
}

// Main execution
async function removeDuplicates() {
    const remover = new DuplicateRemover();
    
    try {
        // Remove duplicates
        await remover.removeAllDuplicates();
        
        // Verify results
        const verification = await remover.verifyCleanup();
        
        return {
            success: true,
            deletedCount: remover.deletedCount,
            failedCount: remover.failedDeletions.length,
            verificationPassed: verification.success && !verification.duplicatesFound
        };
        
    } catch (error) {
        console.error('💥 Script failed:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

if (require.main === module) {
    removeDuplicates()
        .then(result => {
            if (result.success && result.verificationPassed) {
                console.log('\n✅ All duplicates successfully removed!');
                process.exit(0);
            } else if (result.success) {
                console.log('\n⚠️  Removal completed but verification shows issues');
                process.exit(1);
            } else {
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('Script execution failed:', error);
            process.exit(1);
        });
}

module.exports = { removeDuplicates };