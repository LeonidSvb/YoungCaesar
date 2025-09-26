require('dotenv').config({ path: '../../.env' });

// ============================================================
// VAPI TO SUPABASE SYNC - CONFIGURATION
// ============================================================

const CONFIG = {
    // 📅 DATE RANGE - Последние 6 месяцев
    DATE_RANGE: {
        START_DATE: '2025-03-26', // 6 месяцев назад
        END_DATE: '2025-09-26',   // сегодня
    },

    // 🎯 SYNC SETTINGS - Грузим ВСЕ без ограничений
    SYNC: {
        // Include ALL calls (даже 0-секундные)
        INCLUDE_ALL_CALLS: true,

        // Minimum call cost (0 = включаем все)
        MIN_COST: 0,

        // Sync modes
        INCREMENTAL: false, // Полная синхронизация
        FORCE_FULL: true,  // Принудительная полная синхронизация
    },

    // 📊 OUTPUT SETTINGS
    OUTPUT: {
        VERBOSE: true,
        LOG_PROGRESS: true,
        SAVE_RESULTS: true
    },

    // ⚡ PERFORMANCE
    PROCESSING: {
        BATCH_SIZE: 50,
        CONCURRENT_REQUESTS: 10,
        RETRY_ATTEMPTS: 3
    }
};

// ============================================================
// MAIN SYNC ENGINE
// ============================================================

const { createClient } = require('@supabase/supabase-js');
const VapiClient = require('../../scripts/api/vapi_client');

class VapiSupabaseSync {
    constructor(options = {}) {
        this.config = { ...CONFIG, ...options };
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

        // Assistant names cache
        this.assistantNamesCache = new Map();
        this.assistantNamesLoaded = false;

        this.log('🚀 VAPI → Supabase Sync initialized');
        this.log(`📅 Date range: ${this.config.DATE_RANGE.START_DATE} to ${this.config.DATE_RANGE.END_DATE}`);
    }

    log(message) {
        if (this.config.OUTPUT.VERBOSE) {
            console.log(`[${new Date().toISOString()}] ${message}`);
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

async function main() {
    const sync = new VapiSupabaseSync();

    try {
        const results = await sync.run();
        process.exit(0);
    } catch (error) {
        console.error('❌ Sync failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

// Export for use in other modules/API
module.exports = { VapiSupabaseSync, CONFIG };