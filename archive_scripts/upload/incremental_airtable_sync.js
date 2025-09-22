const fs = require('fs');
const path = require('path');
require('dotenv').config();

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID;

const SYNC_STATE_FILE = path.join(__dirname, '../../data/processed/airtable_sync_state.json');
const ASSISTANT_MAPPING_FILE = path.join(__dirname, '../../data/processed/assistant_mapping.json');

// Load assistant name mapping
function loadAssistantMapping() {
    try {
        if (fs.existsSync(ASSISTANT_MAPPING_FILE)) {
            return JSON.parse(fs.readFileSync(ASSISTANT_MAPPING_FILE, 'utf8'));
        }
    } catch (error) {
        console.log('Could not load assistant mapping, will use IDs');
    }
    return {};
}

// Load sync state
function loadSyncState() {
    try {
        if (fs.existsSync(SYNC_STATE_FILE)) {
            return JSON.parse(fs.readFileSync(SYNC_STATE_FILE, 'utf8'));
        }
    } catch (error) {
        console.log('No previous sync state found');
    }
    return {
        lastSyncDate: null,
        lastCallId: null,
        totalSynced: 0,
        syncHistory: []
    };
}

// Save sync state
function saveSyncState(state) {
    fs.writeFileSync(SYNC_STATE_FILE, JSON.stringify(state, null, 2));
}

// Get last call date from Airtable
async function getLastCallFromAirtable() {
    try {
        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?maxRecords=1&sort[0][field]=Started%20At&sort[0][direction]=desc`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.error('Failed to fetch from Airtable:', response.status);
            return null;
        }

        const data = await response.json();
        if (data.records && data.records.length > 0) {
            const lastRecord = data.records[0].fields;
            return {
                callId: lastRecord['Call ID'],
                startedAt: lastRecord['Started At'],
                endedAt: lastRecord['Ended At']
            };
        }
        return null;
    } catch (error) {
        console.error('Error fetching last call from Airtable:', error);
        return null;
    }
}

// Get new calls from VAPI after a specific date
async function getNewCallsFromVAPI(afterDate = null) {
    try {
        console.log('\n📞 Fetching calls from VAPI API...');
        
        const response = await fetch('https://api.vapi.ai/call', {
            headers: {
                'Authorization': `Bearer ${VAPI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`VAPI API error: ${response.status}`);
        }

        const allCalls = await response.json();
        console.log(`Total calls in VAPI: ${allCalls.length}`);

        if (!afterDate) {
            return allCalls;
        }

        // Filter calls after the specified date
        const afterTimestamp = new Date(afterDate).getTime();
        const newCalls = allCalls.filter(call => {
            const callTimestamp = new Date(call.startedAt || call.createdAt).getTime();
            return callTimestamp > afterTimestamp;
        });

        console.log(`New calls since ${afterDate}: ${newCalls.length}`);
        return newCalls;
    } catch (error) {
        console.error('Error fetching from VAPI:', error);
        return [];
    }
}

// Format call for Airtable
function formatCallForAirtable(call, assistantMapping) {
    const assistantName = assistantMapping[call.assistantId] || call.assistantId || 'Unknown';
    
    // Calculate duration
    let duration = 0;
    if (call.startedAt && call.endedAt) {
        duration = Math.round((new Date(call.endedAt) - new Date(call.startedAt)) / 1000);
    }

    // Get audio URL
    let audioUrl = '';
    if (call.recordingUrl) {
        audioUrl = call.recordingUrl;
    } else if (call.artifact && call.artifact.recordingUrl) {
        audioUrl = call.artifact.recordingUrl;
    }

    // Get transcript
    let transcript = '';
    if (call.transcript) {
        transcript = call.transcript;
    } else if (call.artifact && call.artifact.transcript) {
        transcript = call.artifact.transcript;
    } else if (call.messages && Array.isArray(call.messages)) {
        transcript = call.messages
            .filter(m => m.message)
            .map(m => `${m.role}: ${m.message}`)
            .join('\n');
    }

    return {
        fields: {
            'Call ID': call.id,
            'Assistant': assistantName,
            'Phone Number': call.customer?.number || call.phoneNumber || '',
            'Started At': call.startedAt || call.createdAt,
            'Ended At': call.endedAt || '',
            'Duration (seconds)': duration,
            'Status': call.status || 'unknown',
            'End Reason': call.endedReason || '',
            'Cost': call.cost?.total || call.cost || 0,
            'Transcript': transcript || 'No transcript available',
            'Recording URL': audioUrl,
            'Call Type': call.type || 'unknown',
            'Customer Name': call.customer?.name || '',
            'Customer Email': call.customer?.email || '',
            'Language': call.language || 'en',
            'Voicemail': call.endedReason === 'voicemail' ? 'Yes' : 'No',
            'Summary': call.summary || '',
            'Analysis': call.analysis ? JSON.stringify(call.analysis) : '',
            'Transport': call.transport ? JSON.stringify(call.transport) : '',
            'Messages Count': call.messages?.length || 0,
            'Created At': call.createdAt,
            'Updated At': call.updatedAt || call.createdAt
        }
    };
}

// Upload calls to Airtable in batches
async function uploadToAirtable(calls, assistantMapping) {
    const BATCH_SIZE = 10;
    let uploaded = 0;
    let failed = 0;
    const failedCalls = [];

    for (let i = 0; i < calls.length; i += BATCH_SIZE) {
        const batch = calls.slice(i, i + BATCH_SIZE);
        const records = batch.map(call => formatCallForAirtable(call, assistantMapping));

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
                console.error(`Batch ${i/BATCH_SIZE + 1} failed:`, error);
                failed += batch.length;
                failedCalls.push(...batch);
            } else {
                uploaded += batch.length;
                console.log(`✅ Uploaded batch ${i/BATCH_SIZE + 1}: ${batch.length} calls`);
            }

            // Rate limiting - Airtable allows 5 requests per second
            await new Promise(resolve => setTimeout(resolve, 250));
        } catch (error) {
            console.error(`Error uploading batch ${i/BATCH_SIZE + 1}:`, error.message);
            failed += batch.length;
            failedCalls.push(...batch);
        }
    }

    return { uploaded, failed, failedCalls };
}

// Main sync function
async function syncVAPIToAirtable() {
    console.log('🔄 Starting VAPI to Airtable incremental sync...\n');

    const syncState = loadSyncState();
    const assistantMapping = loadAssistantMapping();

    // Get last call from Airtable
    console.log('📊 Checking last call in Airtable...');
    const lastAirtableCall = await getLastCallFromAirtable();
    
    let afterDate = null;
    if (lastAirtableCall) {
        afterDate = lastAirtableCall.endedAt || lastAirtableCall.startedAt;
        console.log(`Last call in Airtable: ${lastAirtableCall.callId}`);
        console.log(`Last call date: ${afterDate}`);
    } else if (syncState.lastSyncDate) {
        afterDate = syncState.lastSyncDate;
        console.log(`Using last sync date from state: ${afterDate}`);
    } else {
        console.log('No previous sync found, will sync all calls');
    }

    // Get new calls from VAPI
    const newCalls = await getNewCallsFromVAPI(afterDate);
    
    if (newCalls.length === 0) {
        console.log('\n✨ No new calls to sync!');
        return;
    }

    console.log(`\n📤 Uploading ${newCalls.length} new calls to Airtable...`);
    
    // Upload to Airtable
    const result = await uploadToAirtable(newCalls, assistantMapping);
    
    // Update sync state
    const now = new Date().toISOString();
    syncState.lastSyncDate = now;
    syncState.totalSynced += result.uploaded;
    syncState.syncHistory.push({
        date: now,
        uploaded: result.uploaded,
        failed: result.failed,
        total: newCalls.length
    });
    
    // Keep only last 100 sync history entries
    if (syncState.syncHistory.length > 100) {
        syncState.syncHistory = syncState.syncHistory.slice(-100);
    }
    
    saveSyncState(syncState);

    // Save failed calls if any
    if (result.failedCalls.length > 0) {
        const failedFile = path.join(__dirname, '../../data/processed/failed_sync_calls.json');
        fs.writeFileSync(failedFile, JSON.stringify(result.failedCalls, null, 2));
        console.log(`\n⚠️ ${result.failed} calls failed to upload. See: ${failedFile}`);
    }

    // Summary
    console.log('\n📊 Sync Summary:');
    console.log(`✅ Successfully uploaded: ${result.uploaded} calls`);
    console.log(`❌ Failed: ${result.failed} calls`);
    console.log(`📈 Total synced all-time: ${syncState.totalSynced} calls`);
    console.log(`🕐 Last sync: ${now}`);
    
    return {
        uploaded: result.uploaded,
        failed: result.failed,
        total: newCalls.length
    };
}

// Run if called directly
if (require.main === module) {
    syncVAPIToAirtable()
        .then(result => {
            if (result) {
                console.log('\n✅ Sync completed successfully!');
                process.exit(0);
            }
        })
        .catch(error => {
            console.error('\n❌ Sync failed:', error);
            process.exit(1);
        });
}

module.exports = { syncVAPIToAirtable };