require('dotenv').config({ path: '../../.env' });

// ============================================================
// CONFIGURATION - CHANGE ALL SETTINGS HERE
// ============================================================

const CONFIG = {
    // 🔍 INPUT FILTERS - Which calls to analyze
    INPUT: {
        // Minimum transcript length to analyze (characters)
        MIN_TRANSCRIPT_LENGTH: 100
    },

    // 🧪 TESTING MODE - Start small, then scale up
    TESTING: {
        // Enable test mode? (true = analyze few calls, false = analyze ALL calls)
        ENABLED: false,

        // How many calls to test with (sorted by longest first)
        BATCH_SIZE: 50,

        // Test specific call ID (leave empty for longest calls)
        SPECIFIC_CALL_ID: ""
    },

    // 🤖 OPENAI API SETTINGS
    OPENAI: {
        // Model to use for analysis
        MODEL: "gpt-4o-mini",

        // Temperature (0 = deterministic, 1 = creative)
        TEMPERATURE: 0.1,

        // Maximum response tokens
        MAX_TOKENS: 2000
    },

    // ⚡ PERFORMANCE SETTINGS
    PROCESSING: {
        // How many calls to analyze simultaneously
        CONCURRENCY: 15,

        // Delay between batches (milliseconds)
        BATCH_DELAY: 1000,

        // Retry failed calls how many times?
        RETRY_ATTEMPTS: 2,

        // Delay before retry (milliseconds)
        RETRY_DELAY: 3000
    },

    // 📊 OUTPUT SETTINGS
    OUTPUT: {
        // Show detailed progress in console?
        VERBOSE: true,

        // Save JSON artifact for GitHub Actions
        SAVE_ARTIFACT: process.env.GITHUB_ACTIONS === 'true'
    }
};

// ============================================================
// MAIN SCRIPT - Direct Supabase Integration
// ============================================================

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');
const { createRun, updateRun, Logger } = require('../../lib/logger');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

class QCIAnalyzer {
    constructor() {
        this.supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        this.logger = null;
        this.runId = null;
        this.results = [];
        this.stats = {
            processed: 0,
            failed: 0,
            totalCost: 0,
            startTime: Date.now(),
            errors: []
        };
    }

    async initLogger() {
        const run = await createRun(
            'qci-analysis',
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY,
            process.env.GITHUB_ACTIONS ? 'github-actions' : 'manual'
        );

        this.runId = run.id;
        this.logger = new Logger(
            run.id,
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        await this.logger.info('START', 'QCI Analysis started');
        return run;
    }

    async loadPromptFromSupabase() {
        await this.logger.info('LOAD', 'Loading QCI prompt from database');

        const { data: framework, error } = await this.supabase
            .from('qci_frameworks')
            .select('id, prompt_template, model_config')
            .eq('name', 'QCI Standard')
            .eq('is_active', true)
            .single();

        if (error) {
            throw new Error(`Failed to load QCI framework: ${error.message}`);
        }

        await this.logger.info('LOAD', 'QCI framework loaded successfully');
        this.frameworkId = framework.id;
        return framework;
    }

    async fetchCallsFromSupabase() {
        await this.logger.info('FETCH', 'Fetching calls from VIEW vapi_calls_needing_qci');

        // Use VIEW instead of manual filtering - much more efficient
        const { data: calls, error } = await this.supabase
            .from('vapi_calls_needing_qci')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            throw new Error(`Failed to fetch calls: ${error.message}`);
        }

        await this.logger.info('FETCH', `Found ${calls.length} calls needing QCI analysis`);

        // Apply testing filters
        if (CONFIG.TESTING.ENABLED) {
            if (CONFIG.TESTING.SPECIFIC_CALL_ID) {
                const filtered = calls.filter(c => c.id === CONFIG.TESTING.SPECIFIC_CALL_ID);
                await this.logger.info('TEST', `Testing specific call: ${CONFIG.TESTING.SPECIFIC_CALL_ID.substring(0,8)}`);
                return filtered;
            } else {
                const limited = calls.slice(0, CONFIG.TESTING.BATCH_SIZE);
                await this.logger.info('TEST', `Test mode: analyzing ${limited.length} longest calls`);
                return limited;
            }
        }

        return calls;
    }

    async analyzeCall(callData, promptTemplate, retryCount = 0) {
        try {
            // Prepare prompt with transcript
            const prompt = promptTemplate.replace('{transcript}', callData.transcript);

            const response = await openai.chat.completions.create({
                model: CONFIG.OPENAI.MODEL,
                messages: [{ role: "user", content: prompt }],
                temperature: CONFIG.OPENAI.TEMPERATURE,
                max_tokens: CONFIG.OPENAI.MAX_TOKENS
            });

            const cost = this.calculateCost(response.usage);
            this.stats.totalCost += cost;

            // Clean any markdown formatting
            let jsonContent = response.choices[0].message.content.trim();
            if (jsonContent.includes('```json')) {
                jsonContent = jsonContent.replace(/```json\s*/g, '').replace(/\s*```/g, '').trim();
            }

            const analysis = JSON.parse(jsonContent);

            return {
                call_id: callData.id,
                assistant_id: callData.assistant_id,
                transcript_length: callData.transcript.length,
                total_score: analysis.qci_total_score || 0,
                dynamics_score: analysis.dynamics_total || 0,
                objections_score: analysis.objections_total || 0,
                brand_score: analysis.brand_total || 0,
                outcome_score: analysis.outcome_total || 0,
                coaching_tips: analysis.coaching_tips || [],
                key_issues: analysis.evidence || {},
                call_classification: this.determineClassification(analysis.qci_total_score || 0),
                analysis_model: CONFIG.OPENAI.MODEL,
                analysis_cost: cost,
                analyzed_at: new Date().toISOString(),
                full_analysis: analysis
            };

        } catch (error) {
            if (retryCount < CONFIG.PROCESSING.RETRY_ATTEMPTS) {
                await this.logger.info('RETRY', `Retrying call ${callData.id.substring(0, 8)} (attempt ${retryCount + 1})`);
                await new Promise(resolve => setTimeout(resolve, CONFIG.PROCESSING.RETRY_DELAY * (retryCount + 1)));
                return this.analyzeCall(callData, promptTemplate, retryCount + 1);
            }

            await this.logger.error('ANALYZE', `Failed to analyze call ${callData.id.substring(0, 8)}: ${error.message}`);
            this.stats.failed++;
            this.stats.errors.push({ id: callData.id, error: error.message });
            return null;
        }
    }

    async saveResultToSupabase(result) {
        try {
            const { error } = await this.supabase
                .from('qci_analyses')
                .upsert({
                    call_id: result.call_id,
                    framework_id: this.frameworkId,
                    total_score: result.total_score,
                    dynamics_score: result.dynamics_score,
                    objections_score: result.objections_score,
                    brand_score: result.brand_score,
                    outcome_score: result.outcome_score,
                    coaching_tips: result.coaching_tips,
                    key_issues: result.key_issues,
                    call_classification: result.call_classification,
                    analysis_model: result.analysis_model,
                    analysis_cost: result.analysis_cost,
                    analyzed_at: result.analyzed_at
                }, {
                    onConflict: 'call_id,framework_id',
                    ignoreDuplicates: false
                });

            if (error) {
                throw error;
            }

            this.stats.processed++;
            await this.logger.info('SAVE', `Saved QCI for call ${result.call_id.substring(0, 8)}`, {
                qci_score: result.total_score
            });

        } catch (error) {
            await this.logger.error('SAVE', `Failed to save QCI: ${error.message}`);
            this.stats.failed++;
            this.stats.errors.push({ id: result.call_id, error: error.message });
        }
    }

    async processBatch(calls, promptTemplate) {
        await this.logger.info('PROCESS', `Processing ${calls.length} calls in batches`, {
            concurrency: CONFIG.PROCESSING.CONCURRENCY
        });

        for (let i = 0; i < calls.length; i += CONFIG.PROCESSING.CONCURRENCY) {
            const chunk = calls.slice(i, Math.min(i + CONFIG.PROCESSING.CONCURRENCY, calls.length));
            const chunkPromises = chunk.map(call => this.analyzeCall(call, promptTemplate));
            const chunkResults = await Promise.all(chunkPromises);

            // Save results to Supabase immediately
            for (const result of chunkResults) {
                if (result) {
                    await this.saveResultToSupabase(result);
                    this.results.push(result);
                }
            }

            await this.logger.info('PROGRESS', `Processed ${Math.min(i + CONFIG.PROCESSING.CONCURRENCY, calls.length)}/${calls.length} calls`);

            if (i + CONFIG.PROCESSING.CONCURRENCY < calls.length) {
                await new Promise(resolve => setTimeout(resolve, CONFIG.PROCESSING.BATCH_DELAY));
            }
        }

        return this.results;
    }

    calculateCost(usage) {
        const inputCost = (usage.prompt_tokens / 1000000) * 0.15;
        const outputCost = (usage.completion_tokens / 1000000) * 0.60;
        return inputCost + outputCost;
    }

    determineClassification(score) {
        if (score >= 80) return 'excellent';
        if (score >= 60) return 'good';
        if (score >= 40) return 'needs_improvement';
        return 'poor';
    }

    async saveArtifact() {
        if (!CONFIG.OUTPUT.SAVE_ARTIFACT) {
            return;
        }

        try {
            const resultsDir = path.join(__dirname, 'results');
            if (!fs.existsSync(resultsDir)) {
                fs.mkdirSync(resultsDir, { recursive: true });
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
            const filename = `qci_analysis_${timestamp}.json`;
            const filepath = path.join(resultsDir, filename);

            const totalTime = (Date.now() - this.stats.startTime) / 1000;
            const avgQCI = this.results.length > 0
                ? this.results.reduce((sum, r) => sum + r.total_score, 0) / this.results.length
                : 0;

            const artifact = {
                run_id: this.runId,
                timestamp: new Date().toISOString(),
                config: CONFIG,
                stats: {
                    ...this.stats,
                    totalTime,
                    avgQCI: avgQCI.toFixed(1),
                    successRate: ((this.stats.processed / (this.stats.processed + this.stats.failed)) * 100).toFixed(1)
                },
                results: this.results.map(r => ({
                    call_id: r.call_id,
                    total_score: r.total_score,
                    classification: r.call_classification,
                    cost: r.analysis_cost
                }))
            };

            fs.writeFileSync(filepath, JSON.stringify(artifact, null, 2));
            await this.logger.info('ARTIFACT', `Results saved to ${filename}`);

            // Also save as latest.json
            const latestPath = path.join(resultsDir, 'qci_latest.json');
            fs.writeFileSync(latestPath, JSON.stringify(artifact, null, 2));

        } catch (error) {
            await this.logger.error('ARTIFACT', `Failed to save artifact: ${error.message}`);
        }
    }

    async run() {
        try {
            // 1. Initialize logger
            await this.initLogger();

            // 2. Load prompt from database
            const framework = await this.loadPromptFromSupabase();

            // 3. Fetch calls from Supabase
            const calls = await this.fetchCallsFromSupabase();

            if (calls.length === 0) {
                await this.logger.info('END', 'No calls to analyze');
                await updateRun(this.runId, {
                    status: 'success',
                    finished_at: new Date().toISOString(),
                    duration_ms: Date.now() - this.stats.startTime,
                    calls_analyzed: 0
                }, process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
                return;
            }

            // 4. Process batch
            await this.processBatch(calls, framework.prompt_template);

            // 5. Save artifact for GitHub Actions
            await this.saveArtifact();

            // 6. Update run with success
            const duration = Date.now() - this.stats.startTime;
            const avgQCI = this.results.length > 0
                ? this.results.reduce((sum, r) => sum + r.total_score, 0) / this.results.length
                : 0;

            await updateRun(this.runId, {
                status: 'success',
                finished_at: new Date().toISOString(),
                duration_ms: duration,
                calls_analyzed: this.stats.processed,
                api_cost: this.stats.totalCost,
                metadata: {
                    failed: this.stats.failed,
                    avg_qci: parseFloat(avgQCI.toFixed(1)),
                    analyzed_call_ids: this.results.map(r => r.call_id)
                }
            }, process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

            await this.logger.info('END', 'QCI Analysis completed successfully', {
                analyzed: this.stats.processed,
                failed: this.stats.failed,
                avg_qci: parseFloat(avgQCI.toFixed(1)),
                total_cost: parseFloat(this.stats.totalCost.toFixed(4)),
                duration_sec: Math.round(duration / 1000)
            });

            // Display summary
            console.log('\n' + '='.repeat(60));
            console.log('✅ QCI ANALYSIS COMPLETED');
            console.log('='.repeat(60));
            console.log(`📊 Analyzed: ${this.stats.processed} calls`);
            console.log(`❌ Failed: ${this.stats.failed} calls`);
            console.log(`🎯 Average QCI: ${avgQCI.toFixed(1)}`);
            console.log(`💰 Total Cost: $${this.stats.totalCost.toFixed(4)}`);
            console.log(`⏱  Duration: ${Math.round(duration / 1000)}s`);
            console.log('='.repeat(60));

        } catch (error) {
            await this.logger.error('ERROR', error.message, { stack: error.stack });

            await updateRun(this.runId, {
                status: 'error',
                finished_at: new Date().toISOString(),
                duration_ms: Date.now() - this.stats.startTime,
                error_message: error.message
            }, process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

            console.error('\n❌ QCI ANALYSIS FAILED:', error.message);
            throw error;
        }
    }
}

async function main() {
    const analyzer = new QCIAnalyzer();
    await analyzer.run();
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = QCIAnalyzer;
