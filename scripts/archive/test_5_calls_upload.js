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
            return JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
        }
    } catch (error) {
        console.log('Using assistant IDs only');
    }
    return {};
}

// Get calls from September 2nd from our collected data
function getTestCalls() {
    try {
        const rawDataPath = path.join(__dirname, '../collection/vapi_raw_calls_2025-09-08.json');
        console.log('📁 Reading from:', rawDataPath);
        
        const rawData = fs.readFileSync(rawDataPath, 'utf8');
        const dailyData = JSON.parse(rawData);
        
        console.log(`📊 Daily structure found with ${dailyData.length} days`);
        
        // Find September 2nd data
        const sept2Data = dailyData.find(day => day.date === '2025-09-02');
        
        if (!sept2Data || !sept2Data.calls) {
            console.log('❌ No September 2nd data found');
            return [];
        }
        
        console.log(`📅 September 2nd total calls: ${sept2Data.calls.length}`);
        
        // Filter calls after our target call time
        const targetDate = '2025-09-02T02:36:46.155Z';
        const callsAfterTarget = sept2Data.calls.filter(call => {
            const callDate = call.createdAt || call.startedAt;
            return callDate > targetDate;
        });
        
        console.log(`📅 September 2nd calls after 02:36:46: ${callsAfterTarget.length}`);
        
        if (callsAfterTarget.length === 0) {
            // If no calls after target time, get first 5 from Sept 2nd for testing
            console.log('⚠️  Using first 5 calls from Sept 2nd for testing');
            return sept2Data.calls.slice(0, 5);
        }
        
        // Take first 5 after target time for testing
        return callsAfterTarget.slice(0, 5);
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

// Upload test calls to Airtable
async function uploadTestCalls() {
    console.log('🧪 Starting test upload of 5 calls...\n');
    
    const assistantMapping = loadAssistantMapping();
    const testCalls = getTestCalls();
    
    if (testCalls.length === 0) {
        console.log('❌ No test calls found');
        return;
    }
    
    console.log(`📋 Test calls found: ${testCalls.length}`);
    testCalls.forEach((call, i) => {
        console.log(`  ${i+1}. ${call.id} - ${call.createdAt}`);
    });
    
    // Transform calls to Airtable format
    const records = testCalls.map(call => ({
        fields: transformCall(call, assistantMapping)
    }));
    
    console.log('\n📤 Uploading to Airtable...');
    
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
            console.error('❌ Upload failed:', error);
            return false;
        }
        
        const result = await response.json();
        console.log(`✅ Successfully uploaded ${result.records.length} test calls!`);
        
        // Show uploaded record IDs
        console.log('\n📋 Uploaded records:');
        result.records.forEach((record, i) => {
            console.log(`  ${i+1}. ${record.id} - ${record.fields['Call ID']}`);
        });
        
        return true;
    } catch (error) {
        console.error('❌ Upload error:', error);
        return false;
    }
}

if (require.main === module) {
    uploadTestCalls()
        .then(success => {
            if (success) {
                console.log('\n🎯 Test upload completed successfully!');
                console.log('Now check Airtable to verify the format matches existing records.');
            } else {
                console.log('\n❌ Test upload failed!');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('\n❌ Script failed:', error);
            process.exit(1);
        });
}

module.exports = { uploadTestCalls };