const fs = require('fs').promises;
const path = require('path');

class DataUtils {
    static async saveJsonData(data, fileName, folder = 'data/processed') {
        try {
            const filePath = path.join(process.cwd(), folder, fileName);
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, JSON.stringify(data, null, 2));
            console.log(`✅ Saved ${fileName} (${Array.isArray(data) ? data.length : Object.keys(data).length} items)`);
            return filePath;
        } catch (error) {
            console.error(`❌ Error saving ${fileName}: ${error.message}`);
            throw error;
        }
    }

    static async loadJsonData(fileName, folder = 'data/processed') {
        try {
            const filePath = path.join(process.cwd(), folder, fileName);
            const data = await fs.readFile(filePath, 'utf8');
            const parsed = JSON.parse(data);
            console.log(`✅ Loaded ${fileName} (${Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length} items)`);
            return parsed;
        } catch (error) {
            console.error(`❌ Error loading ${fileName}: ${error.message}`);
            return null;
        }
    }

    static formatDate(dateStr) {
        if (!dateStr) return 'N/A';
        try {
            const date = new Date(dateStr);
            return date.toISOString().split('T')[0];
        } catch (error) {
            return 'Invalid Date';
        }
    }

    static addDays(dateStr, days) {
        const date = new Date(dateStr);
        date.setDate(date.getDate() + days);
        return date.toISOString().split('T')[0];
    }

    static cleanPhoneNumber(phone) {
        if (!phone) return 'N/A';
        return phone.toString().replace(/\D/g, '');
    }

    static validateCallData(call) {
        const required = ['id', 'createdAt'];
        const missing = required.filter(field => !call[field]);
        
        return {
            isValid: missing.length === 0,
            missing: missing
        };
    }

    static generateTimestamp() {
        return new Date().toISOString().replace(/[:.]/g, '-').slice(0, -1);
    }

    static async createBackup(sourceFile, backupFolder = 'data/migration_backups') {
        try {
            const timestamp = this.generateTimestamp();
            const fileName = path.basename(sourceFile);
            const backupFileName = `${timestamp}_${fileName}`;
            const backupPath = path.join(process.cwd(), backupFolder, backupFileName);
            
            await fs.mkdir(path.dirname(backupPath), { recursive: true });
            await fs.copyFile(sourceFile, backupPath);
            
            console.log(`✅ Backup created: ${backupFileName}`);
            return backupPath;
        } catch (error) {
            console.error(`❌ Backup failed: ${error.message}`);
            throw error;
        }
    }

    static splitArray(array, batchSize) {
        const batches = [];
        for (let i = 0; i < array.length; i += batchSize) {
            batches.push(array.slice(i, i + batchSize));
        }
        return batches;
    }

    static async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static logProgress(current, total, operation = 'Processing') {
        const percentage = Math.round((current / total) * 100);
        const progressBar = '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));
        console.log(`\r${operation}: [${progressBar}] ${percentage}% (${current}/${total})`);
    }

    static async findLatestFile(folder, pattern) {
        try {
            const files = await fs.readdir(folder);
            const matchingFiles = files.filter(file => file.includes(pattern));
            
            if (matchingFiles.length === 0) {
                return null;
            }

            matchingFiles.sort((a, b) => {
                const statsA = fs.stat(path.join(folder, a));
                const statsB = fs.stat(path.join(folder, b));
                return statsB.mtime - statsA.mtime;
            });

            return path.join(folder, matchingFiles[0]);
        } catch (error) {
            console.error(`❌ Error finding latest file: ${error.message}`);
            return null;
        }
    }

    static summarizeResults(results) {
        const summary = {
            total: results.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            errors: results.filter(r => r.error).map(r => r.error)
        };

        console.log(`\n📊 Summary:`);
        console.log(`   Total: ${summary.total}`);
        console.log(`   Successful: ${summary.successful}`);
        console.log(`   Failed: ${summary.failed}`);
        
        if (summary.errors.length > 0) {
            console.log(`   Errors: ${summary.errors.slice(0, 3).join(', ')}${summary.errors.length > 3 ? '...' : ''}`);
        }

        return summary;
    }
}

module.exports = DataUtils;