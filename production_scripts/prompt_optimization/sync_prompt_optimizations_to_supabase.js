require('dotenv').config({ path: '../../.env' });

// ============================================================
// PROMPT OPTIMIZATIONS TO SUPABASE SYNC
// Primary use: WORKFLOW integration after prompt optimization analysis
// ============================================================

// DEFAULT CONFIG for terminal and workflow usage
const DEFAULT_CONFIG = {
    INPUT: {
        // Path to recommendations file (latest optimization results)
        RECOMMENDATIONS_FILE: 'results/recommendations_2025-09-22T11-24-53.json',

        // Path to correlations file (structural analysis)
        CORRELATIONS_FILE: 'results/correlations_latest.json',

        // Filters
        MIN_IMPROVEMENT_POTENTIAL: 0,    // Minimum QCI improvement points
        INCLUDE_METADATA: true           // Include analysis metadata
    },

    SYNC: {
        MODE: 'incremental',             // 'full', 'incremental', 'update_only'
        UPDATE_EXISTING: true,           // Update existing optimization records
        SKIP_ORPHANED_ASSISTANTS: false, // Skip assistants not in Supabase
        AUTO_MATCH_ASSISTANTS: true      // Auto-match assistants by vapi_assistant_id
    },

    OUTPUT: {
        VERBOSE: true,                   // Detailed logging
        LOG_PROGRESS: true,              // Progress indicators
        SAVE_RESULTS: true,              // Save sync results
        RESULTS_DIR: 'results/sync_logs'
    },

    PROCESSING: {
        BATCH_SIZE: 10,                  // Batch size for processing
        CONCURRENT_REQUESTS: 2,          // Conservative concurrency
        RETRY_ATTEMPTS: 3,
        RETRY_DELAY: 2000,
        TEST_LIMIT: 10                   // For testing: limit number of records
    }
};

// UNIVERSAL CONFIG FUNCTION - Terminal vs API/Workflow
function getConfig(runtimeParams = null) {
    if (runtimeParams) {
        // RUNTIME MODE (from workflow/API)
        return {
            INPUT: {
                RECOMMENDATIONS_FILE: runtimeParams.recommendationsFile || DEFAULT_CONFIG.INPUT.RECOMMENDATIONS_FILE,
                CORRELATIONS_FILE: runtimeParams.correlationsFile || DEFAULT_CONFIG.INPUT.CORRELATIONS_FILE,
                MIN_IMPROVEMENT_POTENTIAL: runtimeParams.minImprovementPotential || DEFAULT_CONFIG.INPUT.MIN_IMPROVEMENT_POTENTIAL,
                INCLUDE_METADATA: runtimeParams.includeMetadata !== false
            },
            SYNC: {
                MODE: runtimeParams.syncMode || DEFAULT_CONFIG.SYNC.MODE,
                UPDATE_EXISTING: runtimeParams.updateExisting !== false,
                SKIP_ORPHANED_ASSISTANTS: runtimeParams.skipOrphanedAssistants !== false,
                AUTO_MATCH_ASSISTANTS: runtimeParams.autoMatchAssistants !== false
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
// PROMPT OPTIMIZATIONS SUPABASE SYNC ENGINE
// ============================================================

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

class PromptOptimizationsSupabaseSync {
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
            recommendations_loaded: 0,
            correlations_loaded: 0,
            optimizations_processed: 0,
            optimizations_synced: 0,
            optimizations_updated: 0,
            optimizations_skipped: 0,
            optimizations_failed: 0,
            assistants_matched: 0,
            assistants_orphaned: 0,
            processing_time: 0,
            errors: []
        };

        // Cache for assistant lookups
        this.assistantsCache = new Map();
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
                .from('assistants')
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

    async loadOptimizationData() {
        const recommendationsPath = path.resolve(__dirname, this.config.INPUT.RECOMMENDATIONS_FILE);
        const correlationsPath = path.resolve(__dirname, this.config.INPUT.CORRELATIONS_FILE);

        // Load recommendations
        if (!fs.existsSync(recommendationsPath)) {
            throw new Error(`Recommendations file not found: ${recommendationsPath}`);
        }

        this.log(`📁 Loading recommendations from: ${path.basename(recommendationsPath)}`);

        try {
            const recommendationsData = JSON.parse(fs.readFileSync(recommendationsPath, 'utf8'));
            this.stats.recommendations_loaded = Object.keys(recommendationsData.recommendations || {}).length;
            this.log(`📊 Loaded ${this.stats.recommendations_loaded} recommendation records`);

            // Load correlations if available
            let correlationsData = null;
            if (fs.existsSync(correlationsPath)) {
                this.log(`📁 Loading correlations from: ${path.basename(correlationsPath)}`);
                correlationsData = JSON.parse(fs.readFileSync(correlationsPath, 'utf8'));
                this.stats.correlations_loaded = Object.keys(correlationsData.correlations || {}).length;
                this.log(`📊 Loaded ${this.stats.correlations_loaded} correlation records`);
            }

            return {
                recommendations: recommendationsData,
                correlations: correlationsData
            };

        } catch (error) {
            throw new Error(`Failed to load optimization data: ${error.message}`);
        }
    }

    async loadAssistantsCache() {
        this.log('🔄 Loading assistants cache from Supabase...');

        try {
            const { data: assistants, error } = await this.supabase
                .from('assistants')
                .select('id, vapi_assistant_id, name');

            if (error) throw error;

            assistants.forEach(assistant => {
                this.assistantsCache.set(assistant.vapi_assistant_id, {
                    id: assistant.id,
                    name: assistant.name
                });
            });

            this.log(`💾 Cached ${assistants.length} assistant mappings`);
            return assistants.length;

        } catch (error) {
            throw new Error(`Failed to load assistants cache: ${error.message}`);
        }
    }

    getSupabaseAssistantId(vapiAssistantId) {
        const cached = this.assistantsCache.get(vapiAssistantId);
        return cached ? cached.id : null;
    }

    getAssistantName(vapiAssistantId) {
        const cached = this.assistantsCache.get(vapiAssistantId);
        return cached ? cached.name : `Assistant ${vapiAssistantId.substring(0, 8)}`;
    }

    prepareOptimizationRecord(assistantId, recommendationData, correlationData = null) {
        const assistantDbId = this.getSupabaseAssistantId(assistantId);

        if (!assistantDbId) {
            this.stats.assistants_orphaned++;
            if (this.config.SYNC.SKIP_ORPHANED_ASSISTANTS) {
                return null;
            }
        } else {
            this.stats.assistants_matched++;
        }

        // Extract key metrics from recommendation data
        const currentPerformance = recommendationData.current_performance || {};
        const improvementPotential = recommendationData.improvement_potential || {};
        const keyRecommendations = Array.isArray(recommendationData.recommendations) ? recommendationData.recommendations : [];

        // Map to Supabase schema exactly
        const optimizationRecord = {
            assistant_id: assistantDbId,
            current_performance: currentPerformance,
            target_qci: improvementPotential.target_qci || (currentPerformance.avg_qci || 0) + (improvementPotential.qci_points || 0),
            improvement_potential: improvementPotential.qci_points || 0,
            primary_focus_area: improvementPotential.primary_focus || 'general_improvement',
            recommended_prompt: keyRecommendations.length > 0 ? keyRecommendations[0].proposed_change : null,
            hormozi_recommendations: keyRecommendations.map(r => ({
                title: r.title || '',
                change: r.proposed_change || '',
                priority: r.priority || 'medium',
                impact: r.expected_impact || ''
            })),
            implementation_plan: {
                total_recommendations: keyRecommendations.length,
                priority_order: keyRecommendations.map((r, i) => ({ order: i + 1, title: r.title || `Recommendation ${i + 1}` })),
                estimated_time: `${keyRecommendations.length * 15} minutes`,
                analysis_version: '1.0.0'
            },
            ai_model: 'gpt-4',
            analysis_cost: 0.05,
            is_implemented: false,
            raw_recommendations: recommendationData
        };

        return optimizationRecord;
    }

    async syncOptimizationRecord(optimizationRecord) {
        try {
            if (this.config.SYNC.MODE === 'incremental' || this.config.SYNC.MODE === 'full') {
                // Check if record already exists
                const { data: existing, error: checkError } = await this.supabase
                    .from('prompt_optimizations')
                    .select('id')
                    .eq('assistant_id', optimizationRecord.assistant_id)
                    .single();

                if (checkError && checkError.code !== 'PGRST116') {
                    throw checkError;
                }

                if (existing && this.config.SYNC.UPDATE_EXISTING) {
                    // Update existing record
                    const { data, error } = await this.supabase
                        .from('prompt_optimizations')
                        .update(optimizationRecord)
                        .eq('assistant_id', optimizationRecord.assistant_id)
                        .select()
                        .single();

                    if (error) throw error;

                    this.stats.optimizations_updated++;
                    return { status: 'updated', data };

                } else if (existing) {
                    // Record exists but no update requested
                    this.stats.optimizations_skipped++;
                    return { status: 'skipped', reason: 'exists_no_update' };

                } else {
                    // Insert new record
                    const { data, error } = await this.supabase
                        .from('prompt_optimizations')
                        .insert(optimizationRecord)
                        .select()
                        .single();

                    if (error) throw error;

                    this.stats.optimizations_synced++;
                    return { status: 'synced', data };
                }

            } else if (this.config.SYNC.MODE === 'update_only') {
                // Only update existing records
                const { data, error } = await this.supabase
                    .from('prompt_optimizations')
                    .update(optimizationRecord)
                    .eq('assistant_id', optimizationRecord.assistant_id)
                    .select()
                    .single();

                if (error) {
                    if (error.code === 'PGRST116') {
                        // No rows updated
                        this.stats.optimizations_skipped++;
                        return { status: 'skipped', reason: 'not_found' };
                    }
                    throw error;
                }

                this.stats.optimizations_updated++;
                return { status: 'updated', data };
            }

        } catch (error) {
            this.stats.optimizations_failed++;
            this.stats.errors.push({
                assistant_id: optimizationRecord.assistant_id,
                error: error.message,
                timestamp: new Date().toISOString()
            });

            return { status: 'failed', error: error.message };
        }
    }

    async syncOptimizations(optimizationData) {
        const recommendations = optimizationData.recommendations.recommendations || {};
        const correlations = optimizationData.correlations?.correlations || {};

        const assistantIds = Object.keys(recommendations);
        let processedCount = 0;

        // Apply test limit
        const idsToProcess = this.config.PROCESSING.TEST_LIMIT
            ? assistantIds.slice(0, this.config.PROCESSING.TEST_LIMIT)
            : assistantIds;

        this.log(`🚀 Starting optimization sync: ${idsToProcess.length} assistants`);

        if (idsToProcess.length === 0) {
            this.log('⚠️ No optimization records to sync');
            return this.generateResults();
        }

        // Process in batches
        const batchSize = this.config.PROCESSING.BATCH_SIZE;
        const batches = [];

        for (let i = 0; i < idsToProcess.length; i += batchSize) {
            batches.push(idsToProcess.slice(i, i + batchSize));
        }

        this.log(`📦 Processing ${batches.length} batches (${batchSize} records each)`);

        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            const batchNum = i + 1;

            if (this.config.OUTPUT.LOG_PROGRESS) {
                this.log(`📊 Processing batch ${batchNum}/${batches.length} (${batch.length} records)`, true);
            }

            // Process batch with concurrency
            const batchPromises = batch.map(async (assistantId) => {
                const recommendationData = recommendations[assistantId];
                const correlationData = correlations[assistantId];

                // Prepare optimization record
                const optimizationRecord = this.prepareOptimizationRecord(
                    assistantId,
                    recommendationData,
                    correlationData
                );

                if (!optimizationRecord) {
                    this.stats.optimizations_skipped++;
                    return { status: 'skipped', reason: 'orphaned_assistant' };
                }

                // Sync with retry logic
                let retryCount = 0;
                while (retryCount < this.config.PROCESSING.RETRY_ATTEMPTS) {
                    try {
                        const result = await this.syncOptimizationRecord(optimizationRecord);
                        this.stats.optimizations_processed++;
                        return result;
                    } catch (error) {
                        retryCount++;
                        if (retryCount < this.config.PROCESSING.RETRY_ATTEMPTS) {
                            await new Promise(resolve =>
                                setTimeout(resolve, this.config.PROCESSING.RETRY_DELAY)
                            );
                        } else {
                            this.stats.optimizations_failed++;
                            this.stats.errors.push({
                                assistant_id: assistantId,
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

        this.log(`✅ Optimization sync completed`);
        return this.generateResults();
    }

    generateResults() {
        this.stats.processing_time = Date.now() - this.startTime;

        const results = {
            success: this.stats.optimizations_failed === 0,
            timestamp: new Date().toISOString(),
            config: this.config,
            stats: this.stats,
            summary: {
                total_loaded: this.stats.recommendations_loaded,
                total_processed: this.stats.optimizations_processed,
                synced: this.stats.optimizations_synced,
                updated: this.stats.optimizations_updated,
                skipped: this.stats.optimizations_skipped,
                failed: this.stats.optimizations_failed,
                success_rate: `${((this.stats.optimizations_processed - this.stats.optimizations_failed) / Math.max(this.stats.optimizations_processed, 1) * 100).toFixed(1)}%`,
                processing_time: `${(this.stats.processing_time / 1000).toFixed(1)}s`,
                assistants_matched: this.stats.assistants_matched,
                assistants_orphaned: this.stats.assistants_orphaned
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
            const filename = `prompt_optimization_sync_results_${timestamp}.json`;
            const filepath = path.join(resultsDir, filename);

            fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
            this.log(`💾 Results saved to: ${filename}`);

        } catch (error) {
            this.log(`⚠️ Failed to save results: ${error.message}`);
        }
    }

    async run() {
        try {
            this.log('🚀 Prompt Optimizations to Supabase Sync Started', true);

            // Test connection
            const connected = await this.testConnection();
            if (!connected) {
                throw new Error('Failed to connect to Supabase');
            }

            // Load optimization data
            const optimizationData = await this.loadOptimizationData();

            // Load assistants cache for matching
            if (this.config.SYNC.AUTO_MATCH_ASSISTANTS) {
                await this.loadAssistantsCache();
            }

            // Sync optimization data
            const results = await this.syncOptimizations(optimizationData);

            // Display final results
            this.displayResults(results);

            return results;

        } catch (error) {
            this.log(`❌ Prompt optimization sync failed: ${error.message}`, true);
            throw error;
        }
    }

    displayResults(results) {
        this.log('', true);
        this.log('📊 PROMPT OPTIMIZATION SYNC RESULTS:', true);
        this.log('', true);

        Object.entries(results.summary).forEach(([key, value]) => {
            const label = key.replace(/_/g, ' ').toUpperCase();
            this.log(`   ${label}: ${value}`, true);
        });

        if (this.stats.errors.length > 0) {
            this.log('', true);
            this.log(`⚠️ ERRORS (${this.stats.errors.length}):`, true);
            this.stats.errors.slice(0, 5).forEach(error => {
                this.log(`   Assistant ${error.assistant_id}: ${error.error}`, true);
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
async function syncPromptOptimizationsToSupabase(runtimeParams = null) {
    const config = getConfig(runtimeParams);
    const sync = new PromptOptimizationsSupabaseSync(config);
    return await sync.run();
}

// CLI execution
if (require.main === module) {
    syncPromptOptimizationsToSupabase()
        .then(results => {
            process.exit(results.success ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ Prompt optimization sync failed:', error.message);
            process.exit(1);
        });
}

// Export for workflow integration
module.exports = {
    PromptOptimizationsSupabaseSync,
    syncPromptOptimizationsToSupabase,
    getConfig
};