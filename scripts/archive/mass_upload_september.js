require('dotenv').config();
const fs = require('fs');
const path = require('path');

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID;

// Load assistant mapping
function loadAssistantMapping() {
    try {
        const mappingPath = path.join(__dirname, '../../data/processed/assistant_mapping.json');
        if (fs.existsSync(mappingPath)) {
            const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
            console.log(`✅ Loaded ${Object.keys(mapping).length} assistant mappings`);
            return mapping;
        }
    } catch (error) {
        console.log('⚠️  Using assistant IDs only');
    }
    return {};
}

// Get all calls from September 2-9 from our collected data
function getAllSeptemberCalls() {
    try {
        const rawDataPath = path.join(__dirname, '../collection/vapi_raw_calls_2025-09-08.json');
        console.log('📁 Reading from:', rawDataPath);
        
        const rawData = fs.readFileSync(rawDataPath, 'utf8');
        const dailyData = JSON.parse(rawData);
        
        console.log(`📊 Daily structure found with ${dailyData.length} days`);
        
        // Get all calls from September 2-9
        const septemberDates = ['2025-09-02', '2025-09-03', '2025-09-04', '2025-09-05', '2025-09-06', '2025-09-07', '2025-09-08', '2025-09-09'];
        let allCalls = [];
        
        septemberDates.forEach(date => {
            const dayData = dailyData.find(day => day.date === date);
            if (dayData && dayData.calls) {
                console.log(`📅 ${date}: ${dayData.calls.length} calls`);
                allCalls = allCalls.concat(dayData.calls);
            } else {
                console.log(`📅 ${date}: 0 calls`);
            }
        });
        
        console.log(`\n📊 Total September calls: ${allCalls.length}`);
        
        // For now, let's upload all September calls since we're seeing discrepancies
        console.log(`📈 All September calls ready for upload: ${allCalls.length}`);
        console.log('⚠️  Note: This may include some duplicates - Airtable will reject calls with existing Call IDs');
        
        return allCalls;
    } catch (error) {
        console.error('Error reading calls:', error);
        return [];
    }
}

// Transform call to Airtable format matching the existing structure
function transformCall(call, assistantMapping) {
    // Get assistant name - handle both string and object formats
    let assistantName = 'Unknown Assistant';
    if (assistantMapping[call.assistantId]) {
        const mapped = assistantMapping[call.assistantId];
        assistantName = typeof mapped === 'string' ? mapped : (mapped.name || 'Unknown Assistant');
    }
    
    // Calculate duration
    let duration = 0;
    let durationFormatted = '0:00';
    if (call.startedAt && call.endedAt) {
        duration = Math.round((new Date(call.endedAt) - new Date(call.startedAt)) / 1000);
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        durationFormatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    // Extract transcript
    let transcript = 'No transcript available';
    let firstMessage = '';
    let lastMessage = '';
    let messagesCount = 0;
    
    if (call.transcript) {
        transcript = call.transcript;
    } else if (call.artifact && call.artifact.transcript) {
        transcript = call.artifact.transcript;
    } else if (call.messages && Array.isArray(call.messages)) {
        messagesCount = call.messages.length;
        transcript = call.messages
            .filter(m => m.message)
            .map(m => `${m.role}: ${m.message}`)
            .join('\n');
        
        if (call.messages.length > 0) {
            firstMessage = call.messages[0].message || '';
            lastMessage = call.messages[call.messages.length - 1].message || '';
        }
    }
    
    // Get costs
    const cost = call.cost || 0;
    const sttCost = call.costs?.stt || 0;
    const llmCost = call.costs?.llm || 0;
    const ttsCost = call.costs?.tts || 0;
    const vapiCost = call.costs?.vapi || 0;
    const chatCost = call.costs?.chat || 0;
    const analysisCost = call.costs?.analysis || 0;
    
    // Get tokens and metrics
    const llmPromptTokens = call.usage?.llm?.promptTokens || 0;
    const llmCompletionTokens = call.usage?.llm?.completionTokens || 0;
    const ttsCharacters = call.usage?.tts?.characters || 0;
    
    // Get phone info
    const phoneProvider = call.transport?.provider || 'twilio';
    const phoneProviderId = call.transport?.callSid || call.phoneCallProviderId || '';
    
    // Get recording URLs
    const recordingUrl = call.artifact?.recordingUrl || call.recordingUrl || '';
    const stereoRecordingUrl = call.artifact?.stereoRecordingUrl || '';
    
    return {
        "Call ID": call.id,
        "Phone": phoneProviderId,
        "Cost": cost,
        "Duration (seconds)": duration,
        "Duration (formatted)": durationFormatted,
        "Type": call.type || 'outboundPhoneCall',
        "Status": call.status || 'unknown',
        "End Reason": call.endedReason || '',
        "Created At": call.createdAt,
        "Started At": call.startedAt || '',
        "Ended At": call.endedAt || '',
        "Updated At": call.updatedAt || call.createdAt,
        "Assistant ID": call.assistantId || '',
        "Assistant Name": assistantName,
        "Customer ID": call.customerId || '',
        "Phone Number ID": call.phoneNumberId || '',
        "Organization ID": call.orgId || '',
        "Phone Provider": phoneProvider,
        "Phone Provider ID": phoneProviderId,
        "Transport": 'pstn',
        "Transcript": transcript,
        "Summary": call.analysis?.summary || call.summary || '',
        "Recording URL": recordingUrl,
        "Stereo Recording URL": stereoRecordingUrl,
        "STT Cost": sttCost,
        "LLM Cost": llmCost,
        "TTS Cost": ttsCost,
        "VAPI Cost": vapiCost,
        "Chat Cost": chatCost,
        "Analysis Cost": analysisCost,
        "LLM Prompt Tokens": llmPromptTokens,
        "LLM Completion Tokens": llmCompletionTokens,
        "TTS Characters": ttsCharacters,
        "Messages Count": messagesCount,
        "First Message": firstMessage,
        "Last Message": lastMessage,
        "Success Evaluation": call.analysis?.evaluation || ''
    };
}

// Upload calls to Airtable in batches
async function uploadInBatches(calls, assistantMapping) {
    const BATCH_SIZE = 10; // Airtable allows max 10 records per batch
    let uploaded = 0;
    let failed = 0;
    const failedCalls = [];
    
    console.log(`\n🚀 Starting batch upload of ${calls.length} calls...`);
    console.log(`📦 Using batch size: ${BATCH_SIZE}`);
    console.log(`📊 Total batches: ${Math.ceil(calls.length / BATCH_SIZE)}`);
    
    for (let i = 0; i < calls.length; i += BATCH_SIZE) {
        const batch = calls.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(calls.length / BATCH_SIZE);
        
        console.log(`\n📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} calls)...`);
        
        const records = batch.map(call => ({
            fields: transformCall(call, assistantMapping)
        }));
        
        try {
            const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ records })
            });
            
            if (!response.ok) {
                const error = await response.text();
                console.error(`❌ Batch ${batchNum} failed:`, error);
                failed += batch.length;
                failedCalls.push(...batch);
            } else {
                const result = await response.json();
                uploaded += result.records.length;
                console.log(`✅ Batch ${batchNum} completed: ${result.records.length} calls uploaded`);
                
                // Show progress
                const progress = Math.round((uploaded / calls.length) * 100);
                console.log(`📈 Progress: ${uploaded}/${calls.length} (${progress}%)`);
            }
            
            // Rate limiting - Airtable allows 5 requests per second
            await new Promise(resolve => setTimeout(resolve, 250));
        } catch (error) {
            console.error(`❌ Batch ${batchNum} error:`, error.message);
            failed += batch.length;
            failedCalls.push(...batch);
        }
    }
    
    return { uploaded, failed, failedCalls };
}

// Main upload function
async function massUploadSeptember() {
    console.log('🚀 Starting mass upload of September calls...\n');
    console.log('Date range: September 2-9, 2025');
    console.log('=====================================\n');
    
    const assistantMapping = loadAssistantMapping();
    const calls = getAllSeptemberCalls();
    
    if (calls.length === 0) {
        console.log('❌ No calls to upload');
        return;
    }
    
    // Show breakdown by date
    const byDate = {};
    calls.forEach(call => {
        const date = (call.createdAt || call.startedAt).split('T')[0];
        byDate[date] = (byDate[date] || 0) + 1;
    });
    
    console.log('\n📊 Breakdown by date:');
    Object.entries(byDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([date, count]) => {
            console.log(`  ${date}: ${count} calls`);
        });
    
    // Start upload
    const result = await uploadInBatches(calls, assistantMapping);
    
    // Save failed calls if any
    if (result.failedCalls.length > 0) {
        const failedFile = path.join(__dirname, '../../data/processed/failed_mass_upload.json');
        fs.writeFileSync(failedFile, JSON.stringify(result.failedCalls, null, 2));
        console.log(`\n💾 ${result.failed} failed calls saved to: ${failedFile}`);
    }
    
    // Final summary
    console.log('\n🎯 FINAL SUMMARY');
    console.log('=====================================');
    console.log(`✅ Successfully uploaded: ${result.uploaded} calls`);
    console.log(`❌ Failed: ${result.failed} calls`);
    console.log(`📈 Success rate: ${((result.uploaded / calls.length) * 100).toFixed(1)}%`);
    
    if (result.uploaded > 0) {
        const totalCost = calls.slice(0, result.uploaded).reduce((sum, call) => sum + (call.cost || 0), 0);
        console.log(`💰 Total cost of uploaded calls: $${totalCost.toFixed(2)}`);
    }
    
    console.log(`\n🔗 Check your Airtable: https://airtable.com/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`);
    
    return result;
}

if (require.main === module) {
    massUploadSeptember()
        .then(result => {
            if (result && result.uploaded > 0) {
                console.log('\n🎉 Mass upload completed!');
                process.exit(0);
            } else {
                console.log('\n❌ Mass upload failed!');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('\n💥 Script failed:', error);
            process.exit(1);
        });
}

module.exports = { massUploadSeptember };