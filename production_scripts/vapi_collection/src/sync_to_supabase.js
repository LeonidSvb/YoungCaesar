require('dotenv').config({ path: '../../../.env' });

// ============================================================
// VAPI TO SUPABASE SYNC - CONFIGURATION SYSTEM
// ============================================================

// DEFAULT CONFIG for terminal usage
const DEFAULT_CONFIG = {
    DATE_RANGE: {
        START_DATE: '2025-03-26',
        END_DATE: '2025-09-26'
    },
    SYNC: {
        MODE: 'auto',            // 'auto', 'incremental', 'full'
        INCLUDE_ALL_CALLS: true,
        MIN_COST: 0,
        AUTO_DETECT: true,       // Auto detect last sync point
        FORCE_FULL: false
    },
    OUTPUT: {
        VERBOSE: true,
        LOG_PROGRESS: true,
        SAVE_RESULTS: true
    },
    PROCESSING: {
        BATCH_SIZE: 50,
        CONCURRENT_REQUESTS: 10,
        RETRY_ATTEMPTS: 3,
        TEST_LIMIT: null         // For testing: limit number of calls
    }
};

// UNIVERSAL CONFIG FUNCTION - Terminal vs API
function getConfig(runtimeParams = null) {
    if (runtimeParams) {
        // RUNTIME MODE (from API/Frontend)
        return {
            DATE_RANGE: {
                START_DATE: runtimeParams.startDate || null, // null = auto-detect
                END_DATE: runtimeParams.endDate || new Date().toISOString().split('T')[0]
            },
            SYNC: {
                MODE: runtimeParams.syncMode || 'auto',
                INCLUDE_ALL_CALLS: runtimeParams.includeAllCalls !== false,
                MIN_COST: runtimeParams.minCost || 0,
                AUTO_DETECT: runtimeParams.autoDetect !== false,
                FORCE_FULL: runtimeParams.forceFull || false
            },
            OUTPUT: {
                VERBOSE: runtimeParams.verbose !== false,
                LOG_PROGRESS: true,
                SAVE_RESULTS: runtimeParams.saveResults !== false
            },
            PROCESSING: {
                BATCH_SIZE: DEFAULT_CONFIG.PROCESSING.BATCH_SIZE,
                CONCURRENT_REQUESTS: DEFAULT_CONFIG.PROCESSING.CONCURRENT_REQUESTS,
                RETRY_ATTEMPTS: DEFAULT_CONFIG.PROCESSING.RETRY_ATTEMPTS,
                TEST_LIMIT: runtimeParams.testLimit || null
            }
        };
    } else {
        // TERMINAL MODE (default config)
        return DEFAULT_CONFIG;
    }
}

// ============================================================
// MAIN SYNC ENGINE
// ============================================================

const { createClient } = require('@supabase/supabase-js');
const VapiClient = require('../../shared/api/vapi_client');

class VapiSupabaseSync {
    constructor(config = null) {
        this.config = config || DEFAULT_CONFIG;
        this.startTime = Date.now();

        // Initialize clients
        this.vapi = new VapiClient();
        this.supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
        );

        // Stats tracking
        this.stats = {
            vapi_calls_fetched: 0,
            supabase_calls_synced: 0,
            skipped: 0,
            errors: 0,
            cost: 0
        };

        // Assistant names and prompts cache
        this.assistantNamesCache = new Map();
        this.assistantNamesLoaded = false;
        this.assistantPromptsCache = new Map();
        this.assistantPromptsLoaded = false;

        this.log('🚀 VAPI → Supabase Sync initialized');
        this.log(`📅 Date range: ${this.config.DATE_RANGE.START_DATE} to ${this.config.DATE_RANGE.END_DATE}`);
    }

    log(message) {
        if (this.config.OUTPUT.VERBOSE) {
            console.log(`[${new Date().toISOString()}] ${message}`);
        }
    }

    async getLastSyncPoint() {
        if (this.config.SYNC.MODE === 'full' || this.config.SYNC.FORCE_FULL) {
            return {
                mode: 'full',
                startDate: this.config.DATE_RANGE.START_DATE,
                endDate: this.config.DATE_RANGE.END_DATE
            };
        }

        try {
            // Get last call from Supabase
            const { data, error } = await this.supabase
                .from('calls')
                .select('created_at, id')
                .order('created_at', { ascending: false })
                .limit(1);

            if (error) throw error;

            if (data && data.length > 0) {
                const lastDate = new Date(data[0].created_at);
                const startDate = new Date(lastDate.getTime() - 24 * 60 * 60 * 1000); // 1 day overlap

                this.log(`🔄 INCREMENTAL mode: Last sync from ${data[0].created_at}`);
                return {
                    mode: 'incremental',
                    startDate: startDate.toISOString().split('T')[0],
                    endDate: this.config.DATE_RANGE.END_DATE,
                    lastId: data[0].id
                };
            } else {
                this.log(`📊 Database empty, switching to FULL mode`);
                return {
                    mode: 'full',
                    startDate: this.config.DATE_RANGE.START_DATE,
                    endDate: this.config.DATE_RANGE.END_DATE
                };
            }
        } catch (error) {
            this.log(`⚠️ Auto-detect failed: ${error.message}, using FULL mode`);
            return {
                mode: 'full',
                startDate: this.config.DATE_RANGE.START_DATE,
                endDate: this.config.DATE_RANGE.END_DATE
            };
        }
    }

    async testConnections() {
        this.log('🔍 Testing connections...');

        // Test VAPI
        try {
            await this.vapi.testConnection();
            this.log('✅ VAPI connection OK');
        } catch (error) {
            throw new Error(`VAPI connection failed: ${error.message}`);
        }

        // Test Supabase
        try {
            const { data, error } = await this.supabase.from('organizations').select('count').limit(1);
            if (error) throw error;
            this.log('✅ Supabase connection OK');
        } catch (error) {
            throw new Error(`Supabase connection failed: ${error.message}`);
        }
    }

    async getLastSyncTime() {
        if (!this.config.SYNC.INCREMENTAL || this.config.SYNC.FORCE_FULL) {
            return null;
        }

        try {
            const { data, error } = await this.supabase
                .from('calls')
                .select('created_at')
                .order('created_at', { ascending: false })
                .limit(1);

            if (error) throw error;

            if (data && data.length > 0) {
                const lastSync = data[0].created_at;
                this.log(`📊 Last sync: ${lastSync}`);
                return lastSync;
            }
        } catch (error) {
            this.log(`⚠️ Could not get last sync time: ${error.message}`);
        }

        return null;
    }

    async loadAssistantNames() {
        if (this.assistantNamesLoaded) {
            return;
        }

        try {
            this.log('🤖 Loading assistant names from VAPI...');
            const assistants = await this.vapi.getAssistants();

            assistants.forEach(assistant => {
                this.assistantNamesCache.set(assistant.id, {
                    name: assistant.name || 'Unnamed Assistant',
                    model: assistant.model?.model || 'Unknown',
                    voice: assistant.voice?.voiceId || 'Unknown'
                });
            });

            this.assistantNamesLoaded = true;
            this.log(`✅ Loaded ${assistants.length} assistant names`);

        } catch (error) {
            this.log(`⚠️ Failed to load assistant names: ${error.message}`);
            // Continue without real names - will use fallback
        }
    }

    async loadAssistantPrompts() {
        if (this.assistantPromptsLoaded) {
            return;
        }

        try {
            this.log('📝 Loading assistant prompts from VAPI...');
            const assistants = await this.vapi.getAssistants();

            for (const assistant of assistants) {
                this.assistantPromptsCache.set(assistant.id, {
                    id: assistant.id,
                    name: assistant.name || 'Unnamed Assistant',
                    prompt: assistant.model?.messages?.[0]?.content || assistant.prompt || '',
                    model: assistant.model?.model || 'unknown',
                    voice: assistant.voice?.provider || 'unknown',
                    updated_at: new Date().toISOString()
                });
            }

            this.assistantPromptsLoaded = true;
            this.log(`✅ Loaded prompts for ${assistants.length} assistants`);
        } catch (error) {
            this.log(`❌ Failed to load assistant prompts: ${error.message}`);
        }
    }

    async syncAssistantPrompts() {
        try {
            await this.loadAssistantPrompts();

            this.log('💾 Syncing assistant prompts to Supabase...');

            const prompts = Array.from(this.assistantPromptsCache.values());
            let syncedCount = 0;

            for (const promptData of prompts) {
                try {
                    const { error } = await this.supabase
                        .from('assistant_prompts')
                        .upsert({
                            assistant_id: promptData.id,
                            name: promptData.name,
                            prompt: promptData.prompt,
                            model: promptData.model,
                            voice_provider: promptData.voice,
                            updated_at: promptData.updated_at
                        }, {
                            onConflict: 'assistant_id'
                        });

                    if (error) {
                        this.log(`❌ Error syncing prompt for ${promptData.name}: ${error.message}`);
                    } else {
                        syncedCount++;
                    }
                } catch (error) {
                    this.log(`❌ Error processing prompt for ${promptData.name}: ${error.message}`);
                }
            }

            this.log(`✅ Synced ${syncedCount}/${prompts.length} assistant prompts`);
            return syncedCount;
        } catch (error) {
            this.log(`❌ Failed to sync assistant prompts: ${error.message}`);
            return 0;
        }
    }

    getAssistantRealName(assistantId) {
        const cached = this.assistantNamesCache.get(assistantId);
        return cached ? cached.name : `Assistant ${assistantId.substring(0, 8)}`;
    }

    async fetchVapiCalls() {
        this.log('📞 Fetching calls from VAPI...');

        const lastSync = await this.getLastSyncTime();
        const startDate = lastSync || this.config.DATE_RANGE.START_DATE;

        try {
            const calls = await this.vapi.getCalls(
                startDate,
                this.config.DATE_RANGE.END_DATE
            );

            this.stats.vapi_calls_fetched = calls.length;
            this.log(`📊 Fetched ${calls.length} calls from VAPI`);

            return calls;
        } catch (error) {
            throw new Error(`Failed to fetch VAPI calls: ${error.message}`);
        }
    }

    async ensureOrganizationExists(orgId) {
        const { data, error } = await this.supabase
            .from('organizations')
            .upsert({
                vapi_org_id: orgId,
                name: `Organization ${orgId.substring(0, 8)}`,
                is_active: true
            }, {
                onConflict: 'vapi_org_id',
                ignoreDuplicates: false
            })
            .select()
            .single();

        if (error) throw error;
        return data.id;
    }

    async ensureAssistantExists(assistantId, organizationId) {
        // Get real name from VAPI API cache
        const realName = this.getAssistantRealName(assistantId);

        const { data, error } = await this.supabase
            .from('assistants')
            .upsert({
                vapi_assistant_id: assistantId,
                organization_id: organizationId,
                name: realName,
                is_active: true
            }, {
                onConflict: 'vapi_assistant_id',
                ignoreDuplicates: false
            })
            .select()
            .single();

        if (error) throw error;
        return data.id;
    }

    async ensurePhoneNumberExists(phoneNumberId, organizationId, phoneNumber) {
        if (!phoneNumberId) return null;

        const { data, error } = await this.supabase
            .from('phone_numbers')
            .upsert({
                vapi_phone_id: phoneNumberId,
                organization_id: organizationId,
                phone_number: phoneNumber,
                is_active: true
            }, {
                onConflict: 'vapi_phone_id',
                ignoreDuplicates: false
            })
            .select()
            .single();

        if (error) throw error;
        return data.id;
    }

    async syncCallsToSupabase(calls) {
        this.log(`💾 Syncing ${calls.length} calls to Supabase...`);

        const batchSize = this.config.PROCESSING.BATCH_SIZE;
        let synced = 0;

        for (let i = 0; i < calls.length; i += batchSize) {
            const batch = calls.slice(i, Math.min(i + batchSize, calls.length));

            try {
                await this.processBatch(batch);
                synced += batch.length;

                this.log(`📦 Synced batch: ${synced}/${calls.length}`);

                // Small delay between batches
                if (i + batchSize < calls.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } catch (error) {
                this.log(`❌ Batch error: ${error.message}`);
                this.stats.errors += batch.length;
            }
        }

        this.stats.supabase_calls_synced = synced;
    }

    async processBatch(callsBatch) {
        const callsToSync = [];

        for (const call of callsBatch) {
            try {
                // Ensure related records exist
                const organizationId = await this.ensureOrganizationExists(call.orgId);
                const assistantId = await this.ensureAssistantExists(call.assistantId, organizationId);

                let phoneNumberId = null;
                if (call.phoneNumberId) {
                    const customerPhone = call.customer?.number || 'unknown';
                    phoneNumberId = await this.ensurePhoneNumberExists(
                        call.phoneNumberId,
                        organizationId,
                        customerPhone
                    );
                }

                // Prepare call data
                const callData = {
                    vapi_call_id: call.id,
                    assistant_id: assistantId,
                    phone_number_id: phoneNumberId,
                    organization_id: organizationId,
                    call_type: call.type || 'outbound',
                    status: call.status || 'ended',
                    ended_reason: call.endedReason,
                    started_at: call.startedAt,
                    ended_at: call.endedAt,
                    transcript: call.transcript,
                    summary: call.summary,
                    recording_url: call.recordingUrl,
                    customer_number: call.customer?.number,
                    customer_info: call.customer || {},
                    cost: call.cost,
                    raw_data: call
                };

                callsToSync.push(callData);

            } catch (error) {
                this.log(`❌ Error processing call ${call.id}: ${error.message}`);
                this.stats.errors++;
            }
        }

        // Batch upsert to Supabase
        if (callsToSync.length > 0) {
            const { data, error } = await this.supabase
                .from('calls')
                .upsert(callsToSync, {
                    onConflict: 'vapi_call_id',
                    ignoreDuplicates: true
                })
                .select('id');

            if (error) {
                throw new Error(`Supabase batch insert failed: ${error.message}`);
            }

            return data?.length || 0;
        }

        return 0;
    }

    async run() {
        try {
            this.log('🚀 Starting VAPI → Supabase sync...');

            // Test connections
            await this.testConnections();

            // Load assistant names from VAPI
            await this.loadAssistantNames();

            // Sync assistant prompts first
            const promptsSynced = await this.syncAssistantPrompts();
            this.stats.prompts_synced = promptsSynced;

            // Fetch calls from VAPI
            const calls = await this.fetchVapiCalls();

            if (calls.length === 0) {
                this.log('✅ No new calls to sync');
                return this.getResults();
            }

            // Sync to Supabase
            await this.syncCallsToSupabase(calls);

            // Report results
            return this.getResults();

        } catch (error) {
            this.log(`❌ Sync failed: ${error.message}`);
            throw error;
        }
    }

    getResults() {
        const duration = (Date.now() - this.startTime) / 1000;

        const results = {
            success: true,
            duration: `${Math.floor(duration / 60)}m ${Math.floor(duration % 60)}s`,
            stats: {
                ...this.stats,
                success_rate: ((this.stats.supabase_calls_synced / this.stats.vapi_calls_fetched) * 100).toFixed(1)
            },
            config_used: this.config
        };

        this.log('\n🎉 SYNC COMPLETE');
        this.log(`📊 VAPI calls fetched: ${this.stats.vapi_calls_fetched}`);
        this.log(`💾 Supabase calls synced: ${this.stats.supabase_calls_synced}`);
        this.log(`❌ Errors: ${this.stats.errors}`);
        this.log(`⏱️ Duration: ${results.duration}`);
        this.log(`✅ Success rate: ${results.stats.success_rate}%`);

        return results;
    }
}

// ============================================================
// CLI EXECUTION & MODULE EXPORT
// ============================================================

// UNIVERSAL SYNC FUNCTION - Terminal vs API
async function syncVapiToSupabase(runtimeParams = null) {
    try {
        const config = getConfig(runtimeParams);
        const sync = new VapiSupabaseSync(config);

        // Auto-detect sync mode if enabled
        if (config.SYNC.MODE === 'auto' && config.SYNC.AUTO_DETECT) {
            const syncPoint = await sync.getLastSyncPoint();

            // Update config with detected dates
            config.DATE_RANGE.START_DATE = syncPoint.startDate;
            config.DATE_RANGE.END_DATE = syncPoint.endDate;

            sync.log(`🎯 AUTO mode detected: ${syncPoint.mode.toUpperCase()} sync`);
            sync.log(`📅 Sync range: ${syncPoint.startDate} to ${syncPoint.endDate}`);
        }

        // Apply test limit if specified
        if (config.PROCESSING.TEST_LIMIT) {
            sync.log(`🧪 TESTING MODE: Limited to ${config.PROCESSING.TEST_LIMIT} calls`);
        }

        const mode = runtimeParams ? '🌐 API MODE' : '💻 TERMINAL MODE';
        sync.log(`Starting sync [${mode}]`);

        const results = await sync.run();

        // Add metadata for API consumers
        return {
            ...results,
            metadata: {
                mode: mode,
                syncType: config.SYNC.MODE,
                dateRange: `${config.DATE_RANGE.START_DATE} to ${config.DATE_RANGE.END_DATE}`,
                testLimit: config.PROCESSING.TEST_LIMIT,
                timestamp: new Date().toISOString()
            }
        };
    } catch (error) {
        const errorResult = {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };

        if (runtimeParams) {
            // API mode - return error object
            return errorResult;
        } else {
            // Terminal mode - log and exit
            console.error('❌ Sync failed:', error.message);
            throw error;
        }
    }
}

// TERMINAL MODE
async function main() {
    try {
        await syncVapiToSupabase();
        process.exit(0);
    } catch (error) {
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

// Export for use in other modules/API
module.exports = syncVapiToSupabase;