require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Extract only new calls from September data and upload via existing uploader
function extractNewSeptemberCalls() {
    try {
        // Read the collected September data
        const septDataPath = path.join(__dirname, '../collection/vapi_raw_calls_2025-09-08.json');
        console.log('📁 Reading September data...');
        
        const rawData = fs.readFileSync(septDataPath, 'utf8');
        const dailyData = JSON.parse(rawData);
        
        // Extract calls from September 3-9 (after our last Airtable call from Sept 2)
        const newCalls = [];
        
        dailyData.forEach(day => {
            const date = day.date;
            
            // Skip September 2nd (already in Airtable) and include 3rd onwards
            if (date >= '2025-09-03' && day.calls && day.calls.length > 0) {
                console.log(`📅 ${date}: ${day.calls.length} calls`);
                newCalls.push(...day.calls);
            }
        });
        
        console.log(`\n📊 Total new calls to upload: ${newCalls.length}`);
        
        if (newCalls.length === 0) {
            console.log('✨ No new calls found to upload');
            return;
        }
        
        // Create a temporary file with just the new calls for the uploader
        const tempFilePath = path.join(__dirname, '../collection/temp_new_calls.json');
        
        // Format in the same structure as the uploader expects
        fs.writeFileSync(tempFilePath, JSON.stringify(newCalls, null, 2));
        console.log(`💾 Created temporary file: ${tempFilePath}`);
        
        return {
            filePath: tempFilePath,
            count: newCalls.length
        };
        
    } catch (error) {
        console.error('Error extracting new calls:', error);
        return null;
    }
}

// Modify the uploader to use our temporary file
function updateUploaderPath() {
    try {
        const uploaderPath = path.join(__dirname, 'airtable_uploader.js');
        let uploaderContent = fs.readFileSync(uploaderPath, 'utf8');
        
        // Find the line that loads the main data file and replace it
        const originalPattern = /vapi_raw_calls_\d{4}-\d{2}-\d{2}\.json/;
        const replacement = 'temp_new_calls.json';
        
        if (uploaderContent.includes('temp_new_calls.json')) {
            console.log('✅ Uploader already configured for temp file');
            return true;
        }
        
        // Backup original uploader
        fs.writeFileSync(uploaderPath + '.backup', uploaderContent);
        
        // Update to use temp file
        uploaderContent = uploaderContent.replace(originalPattern, replacement);
        fs.writeFileSync(uploaderPath, uploaderContent);
        
        console.log('✅ Updated uploader to use temp file');
        return true;
        
    } catch (error) {
        console.error('Error updating uploader:', error);
        return false;
    }
}

// Restore uploader to original state
function restoreUploader() {
    try {
        const uploaderPath = path.join(__dirname, 'airtable_uploader.js');
        const backupPath = uploaderPath + '.backup';
        
        if (fs.existsSync(backupPath)) {
            const backupContent = fs.readFileSync(backupPath, 'utf8');
            fs.writeFileSync(uploaderPath, backupContent);
            fs.unlinkSync(backupPath);
            console.log('✅ Restored original uploader');
        }
    } catch (error) {
        console.error('Error restoring uploader:', error);
    }
}

// Main execution
async function uploadNewSeptemberCalls() {
    console.log('🎯 Uploading only NEW September calls (3-9 Sept)...\n');
    
    // Extract new calls
    const result = extractNewSeptemberCalls();
    if (!result) {
        console.log('❌ Failed to extract new calls');
        return;
    }
    
    if (result.count === 0) {
        console.log('✨ No new calls to upload');
        return;
    }
    
    try {
        // Update uploader configuration
        if (!updateUploaderPath()) {
            console.log('❌ Failed to configure uploader');
            return;
        }
        
        console.log(`\n🚀 Starting upload of ${result.count} new calls...`);
        
        // Run the existing uploader
        const { spawn } = require('child_process');
        
        return new Promise((resolve, reject) => {
            const uploadProcess = spawn('npm', ['run', 'airtable-upload'], {
                stdio: 'inherit',
                shell: true
            });
            
            uploadProcess.on('close', (code) => {
                // Cleanup
                try {
                    fs.unlinkSync(result.filePath);
                    console.log('🗑️ Cleaned up temporary file');
                } catch (e) {}
                
                restoreUploader();
                
                if (code === 0) {
                    console.log('\n✅ Upload completed successfully!');
                    resolve(true);
                } else {
                    console.log('\n❌ Upload failed');
                    reject(new Error('Upload failed'));
                }
            });
            
            uploadProcess.on('error', (error) => {
                restoreUploader();
                reject(error);
            });
        });
        
    } catch (error) {
        restoreUploader();
        console.error('Upload error:', error);
        return false;
    }
}

if (require.main === module) {
    uploadNewSeptemberCalls()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Script failed:', error);
            process.exit(1);
        });
}

module.exports = { uploadNewSeptemberCalls };