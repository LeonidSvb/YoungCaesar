require('dotenv').config({ path: '../../.env' });

// ============================================================
// QCI TO SUPABASE SYNC - CONFIGURATION SYSTEM
// Primary use: WORKFLOW integration after QCI analysis
// ============================================================

// DEFAULT CONFIG for terminal and workflow usage
const DEFAULT_CONFIG = {
    INPUT: {
        // Path to QCI results file (relative to this script)
        QCI_DATA_FILE: 'results/qci_full_calls_with_assistants_latest.json',

        // Filters for QCI data
        MIN_QCI_SCORE: 0,           // Include all QCI scores
        INCLUDE_FAILED: true,       // Include failed analyses
        MIN_TRANSCRIPT_LENGTH: 100  // Match QCI analyzer settings
    },

    SYNC: {
        MODE: 'incremental',        // 'full', 'incremental', 'update_only'
        UPDATE_EXISTING: true,      // Update existing QCI records
        SKIP_ORPHANED_CALLS: false, // Skip calls not in Supabase calls table
        AUTO_MATCH_CALLS: true      // Auto-match calls by call_id
    },

    OUTPUT: {
        VERBOSE: true,              // Detailed logging
        LOG_PROGRESS: true,         // Progress indicators
        SAVE_RESULTS: true,         // Save sync results
        RESULTS_DIR: 'results/sync_logs'
    },

    PROCESSING: {
        BATCH_SIZE: 25,             // Smaller batches (QCI data is heavier)
        CONCURRENT_REQUESTS: 3,     // Conservative concurrency
        RETRY_ATTEMPTS: 3,
        RETRY_DELAY: 2000,
        TEST_LIMIT: null            // For testing: limit number of records
    }
};

// UNIVERSAL CONFIG FUNCTION - Terminal vs API/Workflow
function getConfig(runtimeParams = null) {
    if (runtimeParams) {
        // RUNTIME MODE (from workflow/API)
        return {
            INPUT: {
                QCI_DATA_FILE: runtimeParams.qciDataFile || DEFAULT_CONFIG.INPUT.QCI_DATA_FILE,
                MIN_QCI_SCORE: runtimeParams.minQciScore || DEFAULT_CONFIG.INPUT.MIN_QCI_SCORE,
                INCLUDE_FAILED: runtimeParams.includeFailed !== false,
                MIN_TRANSCRIPT_LENGTH: runtimeParams.minTranscriptLength || DEFAULT_CONFIG.INPUT.MIN_TRANSCRIPT_LENGTH
            },
            SYNC: {
                MODE: runtimeParams.syncMode || DEFAULT_CONFIG.SYNC.MODE,
                UPDATE_EXISTING: runtimeParams.updateExisting !== false,
                SKIP_ORPHANED_CALLS: runtimeParams.skipOrphanedCalls !== false,
                AUTO_MATCH_CALLS: runtimeParams.autoMatchCalls !== false
            },
            OUTPUT: {
                VERBOSE: runtimeParams.verbose !== false,
                LOG_PROGRESS: runtimeParams.logProgress !== false,
                SAVE_RESULTS: runtimeParams.saveResults !== false,
                RESULTS_DIR: DEFAULT_CONFIG.OUTPUT.RESULTS_DIR
            },
            PROCESSING: {
                BATCH_SIZE: DEFAULT_CONFIG.PROCESSING.BATCH_SIZE,
                CONCURRENT_REQUESTS: DEFAULT_CONFIG.PROCESSING.CONCURRENT_REQUESTS,
                RETRY_ATTEMPTS: DEFAULT_CONFIG.PROCESSING.RETRY_ATTEMPTS,
                RETRY_DELAY: DEFAULT_CONFIG.PROCESSING.RETRY_DELAY,
                TEST_LIMIT: runtimeParams.testLimit || null
            }
        };
    } else {
        // TERMINAL MODE (default config)
        return DEFAULT_CONFIG;
    }
}

// ============================================================
// QCI SUPABASE SYNC ENGINE
// ============================================================

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

class QciSupabaseSync {
    constructor(config = null) {
        this.config = config || DEFAULT_CONFIG;
        this.startTime = Date.now();

        // Initialize Supabase client
        this.supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
        );

        // Statistics tracking
        this.stats = {
            qci_records_loaded: 0,
            qci_records_processed: 0,
            qci_records_synced: 0,
            qci_records_updated: 0,
            qci_records_skipped: 0,
            qci_records_failed: 0,
            calls_matched: 0,
            calls_orphaned: 0,
            processing_time: 0,
            errors: []
        };

        // Cache for call lookups
        this.callsCache = new Map();
    }

    log(message, force = false) {
        if (this.config.OUTPUT.VERBOSE || force) {
            const timestamp = new Date().toISOString().substr(11, 8);
            console.log(`[${timestamp}] ${message}`);
        }
    }

    async testConnection() {
        this.log('🔗 Testing Supabase connection...');

        try {
            const { data, error } = await this.supabase
                .from('calls')
                .select('count')
                .limit(1);

            if (error) throw error;

            this.log('✅ Supabase connection successful');
            return true;
        } catch (error) {
            this.log(`❌ Supabase connection failed: ${error.message}`, true);
            return false;
        }
    }

    async loadQciData() {
        const filePath = path.resolve(__dirname, this.config.INPUT.QCI_DATA_FILE);

        if (!fs.existsSync(filePath)) {
            throw new Error(`QCI data file not found: ${filePath}`);
        }

        this.log(`📁 Loading QCI data from: ${path.basename(filePath)}`);

        try {
            const rawData = fs.readFileSync(filePath, 'utf8');
            const qciData = JSON.parse(rawData);

            if (!qciData.results || !Array.isArray(qciData.results)) {
                throw new Error('Invalid QCI data format - missing results array');
            }

            this.stats.qci_records_loaded = qciData.results.length;
            this.log(`📊 Loaded ${qciData.results.length} QCI records`);

            // Apply filters
            const filteredResults = this.applyFilters(qciData.results);
            this.log(`🔍 After filtering: ${filteredResults.length} records`);

            return {
                config: qciData.config,
                stats: qciData.stats,
                results: filteredResults
            };

        } catch (error) {
            throw new Error(`Failed to load QCI data: ${error.message}`);
        }
    }

    applyFilters(qciResults) {
        let filtered = [...qciResults];

        // Filter by minimum QCI score
        if (this.config.INPUT.MIN_QCI_SCORE > 0) {
            const before = filtered.length;
            filtered = filtered.filter(record =>
                (record.qci_total || 0) >= this.config.INPUT.MIN_QCI_SCORE
            );
            this.log(`🎯 MIN_QCI_SCORE filter: ${before} → ${filtered.length} records`);
        }

        // Filter by transcript length
        if (this.config.INPUT.MIN_TRANSCRIPT_LENGTH > 0) {
            const before = filtered.length;
            filtered = filtered.filter(record =>
                (record.transcript_length || 0) >= this.config.INPUT.MIN_TRANSCRIPT_LENGTH
            );
            this.log(`📝 MIN_TRANSCRIPT_LENGTH filter: ${before} → ${filtered.length} records`);
        }

        // Filter failed analyses
        if (!this.config.INPUT.INCLUDE_FAILED) {
            const before = filtered.length;
            filtered = filtered.filter(record => record.status !== 'fail');
            this.log(`❌ INCLUDE_FAILED filter: ${before} → ${filtered.length} records`);
        }

        // Apply test limit
        if (this.config.PROCESSING.TEST_LIMIT && filtered.length > this.config.PROCESSING.TEST_LIMIT) {
            this.log(`🧪 TEST_LIMIT: Limiting to ${this.config.PROCESSING.TEST_LIMIT} records`);
            filtered = filtered.slice(0, this.config.PROCESSING.TEST_LIMIT);
        }

        return filtered;
    }

    async loadCallsCache() {
        this.log('🔄 Loading calls cache from Supabase...');

        try {
            const { data: calls, error } = await this.supabase
                .from('calls')
                .select('id, vapi_call_id');

            if (error) throw error;

            calls.forEach(call => {
                this.callsCache.set(call.vapi_call_id, call.id);
            });

            this.log(`💾 Cached ${calls.length} call mappings`);
            return calls.length;

        } catch (error) {
            throw new Error(`Failed to load calls cache: ${error.message}`);
        }
    }

    getSupabaseCallId(vapiCallId) {
        return this.callsCache.get(vapiCallId) || null;
    }

    async syncQciRecord(qciRecord) {
        const callId = this.getSupabaseCallId(qciRecord.call_id);

        if (!callId) {
            this.stats.calls_orphaned++;
            if (this.config.SYNC.SKIP_ORPHANED_CALLS) {
                this.stats.qci_records_skipped++;
                return { status: 'skipped', reason: 'orphaned_call' };
            }
        } else {
            this.stats.calls_matched++;
        }

        // Prepare QCI analysis data (matching Supabase schema)
        const qciData = {
            call_id: callId,
            qci_total_score: qciRecord.qci_total || 0,
            dynamics_score: qciRecord.dynamics || 0,
            objections_score: qciRecord.objections || 0,
            brand_score: qciRecord.brand || 0,
            outcome_score: qciRecord.outcome || 0,
            status: qciRecord.status || 'unknown',
            analyzed_at: new Date().toISOString()
        };

        try {
            if (this.config.SYNC.MODE === 'incremental' || this.config.SYNC.MODE === 'full') {
                // Upsert QCI analysis
                const { data, error } = await this.supabase
                    .from('qci_analyses')
                    .upsert(qciData, {
                        onConflict: 'call_id',
                        ignoreDuplicates: false
                    })
                    .select()
                    .single();

                if (error) throw error;

                this.stats.qci_records_synced++;
                return { status: 'synced', data };

            } else if (this.config.SYNC.MODE === 'update_only') {
                // Only update existing records
                const { data, error } = await this.supabase
                    .from('qci_analyses')
                    .update(qciData)
                    .eq('call_id', callId)
                    .select()
                    .single();

                if (error) {
                    if (error.code === 'PGRST116') {
                        // No rows updated
                        this.stats.qci_records_skipped++;
                        return { status: 'skipped', reason: 'not_found' };
                    }
                    throw error;
                }

                this.stats.qci_records_updated++;
                return { status: 'updated', data };
            }

        } catch (error) {
            this.stats.qci_records_failed++;
            this.stats.errors.push({
                call_id: qciRecord.call_id,
                error: error.message,
                timestamp: new Date().toISOString()
            });

            return { status: 'failed', error: error.message };
        }
    }

    async syncQciData(qciData) {
        const totalRecords = qciData.results.length;
        this.log(`🚀 Starting QCI sync: ${totalRecords} records`);

        if (totalRecords === 0) {
            this.log('⚠️ No QCI records to sync');
            return this.generateResults();
        }

        // Process in batches
        const batchSize = this.config.PROCESSING.BATCH_SIZE;
        const batches = [];

        for (let i = 0; i < totalRecords; i += batchSize) {
            batches.push(qciData.results.slice(i, i + batchSize));
        }

        this.log(`📦 Processing ${batches.length} batches (${batchSize} records each)`);

        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            const batchNum = i + 1;

            if (this.config.OUTPUT.LOG_PROGRESS) {
                this.log(`📊 Processing batch ${batchNum}/${batches.length} (${batch.length} records)`, true);
            }

            // Process batch with concurrency
            const batchPromises = batch.map(async (record) => {
                let retryCount = 0;

                while (retryCount < this.config.PROCESSING.RETRY_ATTEMPTS) {
                    try {
                        const result = await this.syncQciRecord(record);
                        this.stats.qci_records_processed++;
                        return result;
                    } catch (error) {
                        retryCount++;
                        if (retryCount < this.config.PROCESSING.RETRY_ATTEMPTS) {
                            await new Promise(resolve =>
                                setTimeout(resolve, this.config.PROCESSING.RETRY_DELAY)
                            );
                        } else {
                            this.stats.qci_records_failed++;
                            this.stats.errors.push({
                                call_id: record.call_id,
                                error: error.message,
                                retries: retryCount,
                                timestamp: new Date().toISOString()
                            });
                            return { status: 'failed', error: error.message };
                        }
                    }
                }
            });

            // Wait for batch to complete
            await Promise.all(batchPromises);

            // Short delay between batches
            if (i < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        this.log(`✅ QCI sync completed`);
        return this.generateResults();
    }

    generateResults() {
        this.stats.processing_time = Date.now() - this.startTime;

        const results = {
            success: this.stats.qci_records_failed === 0,
            timestamp: new Date().toISOString(),
            config: this.config,
            stats: this.stats,
            summary: {
                total_loaded: this.stats.qci_records_loaded,
                total_processed: this.stats.qci_records_processed,
                synced: this.stats.qci_records_synced,
                updated: this.stats.qci_records_updated,
                skipped: this.stats.qci_records_skipped,
                failed: this.stats.qci_records_failed,
                success_rate: `${((this.stats.qci_records_processed - this.stats.qci_records_failed) / Math.max(this.stats.qci_records_processed, 1) * 100).toFixed(1)}%`,
                processing_time: `${(this.stats.processing_time / 1000).toFixed(1)}s`,
                calls_matched: this.stats.calls_matched,
                calls_orphaned: this.stats.calls_orphaned
            }
        };

        // Save results if enabled
        if (this.config.OUTPUT.SAVE_RESULTS) {
            this.saveResults(results);
        }

        return results;
    }

    saveResults(results) {
        try {
            const resultsDir = path.resolve(__dirname, this.config.OUTPUT.RESULTS_DIR);

            // Create directory if it doesn't exist
            if (!fs.existsSync(resultsDir)) {
                fs.mkdirSync(resultsDir, { recursive: true });
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substr(0, 19);
            const filename = `qci_sync_results_${timestamp}.json`;
            const filepath = path.join(resultsDir, filename);

            fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
            this.log(`💾 Results saved to: ${filename}`);

        } catch (error) {
            this.log(`⚠️ Failed to save results: ${error.message}`);
        }
    }

    async run() {
        try {
            this.log('🚀 QCI to Supabase Sync Started', true);

            // Test connection
            const connected = await this.testConnection();
            if (!connected) {
                throw new Error('Failed to connect to Supabase');
            }

            // Load QCI data
            const qciData = await this.loadQciData();

            // Load calls cache for matching
            if (this.config.SYNC.AUTO_MATCH_CALLS) {
                await this.loadCallsCache();
            }

            // Sync QCI data
            const results = await this.syncQciData(qciData);

            // Display final results
            this.displayResults(results);

            return results;

        } catch (error) {
            this.log(`❌ QCI sync failed: ${error.message}`, true);
            throw error;
        }
    }

    displayResults(results) {
        this.log('', true);
        this.log('📊 QCI SYNC RESULTS:', true);
        this.log('', true);

        Object.entries(results.summary).forEach(([key, value]) => {
            const label = key.replace(/_/g, ' ').toUpperCase();
            this.log(`   ${label}: ${value}`, true);
        });

        if (this.stats.errors.length > 0) {
            this.log('', true);
            this.log(`⚠️ ERRORS (${this.stats.errors.length}):`, true);
            this.stats.errors.slice(0, 5).forEach(error => {
                this.log(`   Call ${error.call_id}: ${error.error}`, true);
            });
            if (this.stats.errors.length > 5) {
                this.log(`   ... and ${this.stats.errors.length - 5} more errors`, true);
            }
        }

        this.log('', true);
    }
}

// ============================================================
// CLI EXECUTION & MODULE EXPORT
// ============================================================

// Function for workflow integration
async function syncQciToSupabase(runtimeParams = null) {
    const config = getConfig(runtimeParams);
    const sync = new QciSupabaseSync(config);
    return await sync.run();
}

// CLI execution
if (require.main === module) {
    syncQciToSupabase()
        .then(results => {
            process.exit(results.success ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ QCI sync failed:', error.message);
            process.exit(1);
        });
}

// Export for workflow integration
module.exports = {
    QciSupabaseSync,
    syncQciToSupabase,
    getConfig
};