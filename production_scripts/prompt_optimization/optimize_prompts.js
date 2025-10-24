require('dotenv').config({ path: '../../.env' });

// ============================================================
// PROMPT OPTIMIZER - Database-Driven (No JSON Files)
// ============================================================

const CONFIG = {
    // Testing
    TESTING: {
        ENABLED: false,  // true = test on 1 assistant
        ASSISTANT_ID: '0eddf4db-3bfa-4eb2-8053-082d94aa786d'  // YC Assistant | HOT
    },

    // Smart sampling strategy
    SAMPLING: {
        TOP_PERCENT: 20,      // Best 20% calls
        BOTTOM_PERCENT: 20,   // Worst 20% calls
        MIDDLE_COUNT: 10,     // 10 middle calls
        MAX_TOTAL: 50         // Don't exceed 50 calls (cost control)
    },

    // OpenAI settings
    OPENAI: {
        MODEL: 'gpt-4o',
        TEMPERATURE: 0.2,
        MAX_TOKENS: 4000
    },

    // Target improvement
    TARGET_QCI_IMPROVEMENT: 15,

    // Output
    OUTPUT: {
        VERBOSE: true,
        SAVE_MARKDOWN: true,   // Save .md file for quick review
        MARKDOWN_DIR: 'results'
    }
};

// ============================================================
// DEPENDENCIES
// ============================================================

const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const { createRun, updateRun, Logger } = require('../../lib/logger');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ============================================================
// MAIN CLASS
// ============================================================

class PromptOptimizer {
    constructor() {
        this.supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        this.logger = null;
        this.runId = null;
        this.stats = {
            processed: 0,
            failed: 0,
            totalCost: 0,
            startTime: Date.now()
        };
    }

    async initLogger() {
        const run = await createRun(
            'prompt-optimization',
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY,
            'manual'
        );

        this.runId = run.id;
        this.logger = new Logger(
            run.id,
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        await this.logger.info('START', 'Prompt optimization started');
        return run;
    }

    // ============================================================
    // STEP 1: Load framework prompt template from DB
    // ============================================================
    async loadFramework() {
        await this.logger.info('LOAD', 'Loading optimization framework from database');

        const { data: framework, error } = await this.supabase
            .from('analysis_frameworks')
            .select('id, name, prompt_template, model_config')
            .eq('framework_type', 'optimization')
            .eq('is_active', true)
            .single();

        if (error) {
            throw new Error(`Failed to load framework: ${error.message}`);
        }

        await this.logger.info('LOAD', `Framework loaded: ${framework.name}`);
        return framework;
    }

    // ============================================================
    // STEP 2: Get assistants for optimization (NO VIEW)
    // ============================================================
    async getAssistantsForOptimization() {
        await this.logger.info('FETCH', 'Fetching assistants for optimization');

        // Direct query - no VIEW needed
        const { data: assistants, error } = await this.supabase.rpc('get_assistants_for_optimization', {
            test_mode: CONFIG.TESTING.ENABLED,
            test_assistant_id: CONFIG.TESTING.ASSISTANT_ID
        });

        if (error) {
            // Fallback: manual query if RPC doesn't exist
            const query = this.supabase
                .from('vapi_assistants')
                .select(`
                    assistant_id,
                    name
                `);

            if (CONFIG.TESTING.ENABLED) {
                query.eq('assistant_id', CONFIG.TESTING.ASSISTANT_ID);
            }

            const { data, error: fallbackError } = await query;

            if (fallbackError) {
                throw new Error(`Failed to fetch assistants: ${fallbackError.message}`);
            }

            return data;
        }

        await this.logger.info('FETCH', `Found ${assistants.length} assistants for optimization`);
        return assistants;
    }

    // ============================================================
    // STEP 3: Get assistant performance data (NO VIEW)
    // ============================================================
    async getAssistantPerformance(assistantId) {
        // Get latest prompt version
        const { data: promptHistory, error: promptError } = await this.supabase
            .from('vapi_assistant_prompt_history')
            .select('version_number, prompt')
            .eq('assistant_id', assistantId)
            .order('version_number', { ascending: false })
            .limit(1)
            .single();

        if (promptError || !promptHistory) {
            throw new Error(`No prompt history for assistant ${assistantId}`);
        }

        // Get QCI metrics (direct JOIN, no VIEW)
        const { data: metrics, error: metricsError } = await this.supabase
            .from('vapi_calls_raw')
            .select(`
                id,
                transcript,
                qci_analyses!inner (
                    total_score,
                    dynamics_score,
                    objections_score,
                    brand_score,
                    outcome_score
                )
            `)
            .eq('assistant_id', assistantId)
            .not('transcript', 'is', null)
            .gte('transcript', 'length', 100);

        if (metricsError) {
            throw new Error(`Failed to fetch metrics: ${metricsError.message}`);
        }

        // Calculate averages
        const callsWithQCI = metrics.filter(m => m.qci_analyses.length > 0);
        const avgQCI = callsWithQCI.length > 0
            ? callsWithQCI.reduce((sum, m) => sum + m.qci_analyses[0].total_score, 0) / callsWithQCI.length
            : 0;

        return {
            assistant_id: assistantId,
            prompt_version: promptHistory.version_number,
            current_prompt: promptHistory.prompt,
            total_calls: metrics.length,
            calls_with_qci: callsWithQCI.length,
            avg_qci: avgQCI,
            avg_dynamics: callsWithQCI.length > 0
                ? callsWithQCI.reduce((sum, m) => sum + m.qci_analyses[0].dynamics_score, 0) / callsWithQCI.length
                : 0,
            avg_objections: callsWithQCI.length > 0
                ? callsWithQCI.reduce((sum, m) => sum + m.qci_analyses[0].objections_score, 0) / callsWithQCI.length
                : 0,
            avg_brand: callsWithQCI.length > 0
                ? callsWithQCI.reduce((sum, m) => sum + m.qci_analyses[0].brand_score, 0) / callsWithQCI.length
                : 0,
            avg_outcome: callsWithQCI.length > 0
                ? callsWithQCI.reduce((sum, m) => sum + m.qci_analyses[0].outcome_score, 0) / callsWithQCI.length
                : 0,
            all_calls: callsWithQCI
        };
    }

    // ============================================================
    // STEP 4: Smart sampling of calls
    // ============================================================
    smartSampleCalls(performance) {
        const calls = performance.all_calls;

        if (calls.length === 0) {
            return [];
        }

        // Sort by QCI score
        const sorted = calls
            .map(c => ({
                call_id: c.id,
                transcript: c.transcript,
                qci_score: c.qci_analyses[0].total_score
            }))
            .sort((a, b) => b.qci_score - a.qci_score);

        const topCount = Math.ceil(sorted.length * (CONFIG.SAMPLING.TOP_PERCENT / 100));
        const bottomCount = Math.ceil(sorted.length * (CONFIG.SAMPLING.BOTTOM_PERCENT / 100));

        const topCalls = sorted.slice(0, topCount);
        const bottomCalls = sorted.slice(-bottomCount);

        // Middle calls
        const middleStart = Math.floor((sorted.length - CONFIG.SAMPLING.MIDDLE_COUNT) / 2);
        const middleCalls = sorted.slice(middleStart, middleStart + CONFIG.SAMPLING.MIDDLE_COUNT);

        // Combine and deduplicate
        const allSamples = [...topCalls, ...middleCalls, ...bottomCalls];
        const unique = Array.from(new Map(allSamples.map(c => [c.call_id, c])).values());

        // Limit to MAX_TOTAL
        const sampled = unique.slice(0, CONFIG.SAMPLING.MAX_TOTAL);

        this.logger.info('SAMPLE', `Sampled ${sampled.length} calls (top: ${topCount}, bottom: ${bottomCount}, middle: ${CONFIG.SAMPLING.MIDDLE_COUNT})`);

        return sampled;
    }

    // ============================================================
    // STEP 5: Generate optimized prompt via OpenAI
    // ============================================================
    async optimizePrompt(assistant, performance, framework, sampleCalls) {
        await this.logger.info('OPTIMIZE', `Optimizing prompt for ${assistant.name}`);

        // Format sample calls for prompt
        const sampleCallsText = sampleCalls
            .map((call, idx) => `Call ${idx + 1} (QCI: ${call.qci_score}):\n${call.transcript.substring(0, 500)}...`)
            .join('\n\n');

        // Replace template variables
        const targetQCI = Math.min(100, performance.avg_qci + CONFIG.TARGET_QCI_IMPROVEMENT);

        const prompt = framework.prompt_template
            .replace(/{assistant_name}/g, assistant.name)
            .replace(/{current_qci}/g, performance.avg_qci.toFixed(1))
            .replace(/{target_qci}/g, targetQCI.toFixed(1))
            .replace(/{calls_analyzed}/g, sampleCalls.length)
            .replace(/{dynamics_score}/g, performance.avg_dynamics.toFixed(1))
            .replace(/{objections_score}/g, performance.avg_objections.toFixed(1))
            .replace(/{brand_score}/g, performance.avg_brand.toFixed(1))
            .replace(/{outcome_score}/g, performance.avg_outcome.toFixed(1))
            .replace(/{sample_calls}/g, sampleCallsText)
            .replace(/{current_prompt}/g, performance.current_prompt);

        try {
            const response = await openai.chat.completions.create({
                model: CONFIG.OPENAI.MODEL,
                messages: [{ role: 'user', content: prompt }],
                temperature: CONFIG.OPENAI.TEMPERATURE,
                max_tokens: CONFIG.OPENAI.MAX_TOKENS
            });

            const cost = this.calculateCost(response.usage);
            this.stats.totalCost += cost;

            // Parse JSON response
            let content = response.choices[0].message.content.trim();
            if (content.includes('```json')) {
                content = content.replace(/```json\s*/g, '').replace(/\s*```/g, '').trim();
            }

            const result = JSON.parse(content);

            return {
                ...result,
                analysis_cost: cost,
                analysis_model: CONFIG.OPENAI.MODEL,
                sample_call_ids: sampleCalls.map(c => c.call_id)
            };

        } catch (error) {
            await this.logger.error('OPTIMIZE', `Failed to optimize: ${error.message}`);
            throw error;
        }
    }

    // ============================================================
    // STEP 6: Save result to database
    // ============================================================
    async saveResult(assistantId, performance, optimization) {
        const { error } = await this.supabase
            .from('prompt_analysis_results')
            .insert({
                assistant_id: assistantId,
                current_prompt: performance.current_prompt,
                proposed_prompt: optimization.proposed_prompt,
                current_qci: performance.avg_qci,
                expected_qci: optimization.expected_qci,
                improvement_delta: optimization.improvement_delta ? parseFloat(optimization.improvement_delta) : CONFIG.TARGET_QCI_IMPROVEMENT,
                top_reasons: optimization.top_reasons || [],
                calls_analyzed: optimization.sample_call_ids.length,
                sample_call_ids: optimization.sample_call_ids,
                framework_used: 'qci',
                analysis_cost: optimization.analysis_cost,
                analysis_model: optimization.analysis_model
            });

        if (error) {
            throw new Error(`Failed to save result: ${error.message}`);
        }

        this.stats.processed++;
        await this.logger.info('SAVE', `Saved optimization result for assistant ${assistantId}`);
    }

    // ============================================================
    // STEP 7: Generate markdown report (optional)
    // ============================================================
    async generateMarkdownReport(assistant, performance, optimization) {
        if (!CONFIG.OUTPUT.SAVE_MARKDOWN) return;

        const markdown = `# Prompt Optimization Report

## Assistant: ${assistant.name}

**Generated:** ${new Date().toISOString()}

---

## Current Performance

- **QCI Score:** ${performance.avg_qci.toFixed(1)} / 100
- **Calls Analyzed:** ${performance.calls_with_qci}
- **Prompt Version:** v${performance.prompt_version}

**Breakdown:**
- Dynamics: ${performance.avg_dynamics.toFixed(1)} / 30
- Objections: ${performance.avg_objections.toFixed(1)} / 20
- Brand: ${performance.avg_brand.toFixed(1)} / 20
- Outcome: ${performance.avg_outcome.toFixed(1)} / 30

---

## Expected Improvement

- **Target QCI:** ${optimization.expected_qci} / 100
- **Improvement:** ${optimization.improvement_delta}

---

## Top Reasons for Changes

${optimization.top_reasons.map((r, i) => `${i + 1}. ${r}`).join('\n')}

---

## Current Prompt

\`\`\`
${performance.current_prompt}
\`\`\`

---

## Proposed Prompt

\`\`\`
${optimization.proposed_prompt}
\`\`\`

---

## Analysis Details

- **Calls Sampled:** ${optimization.sample_call_ids.length}
- **Model:** ${optimization.analysis_model}
- **Cost:** $${optimization.analysis_cost.toFixed(4)}
`;

        const dir = path.resolve(__dirname, CONFIG.OUTPUT.MARKDOWN_DIR);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const filename = `prompt_optimization_${assistantId}_${new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)}.md`;
        const filepath = path.join(dir, filename);

        fs.writeFileSync(filepath, markdown);
        await this.logger.info('REPORT', `Markdown report saved: ${filename}`);
    }

    // ============================================================
    // HELPERS
    // ============================================================
    calculateCost(usage) {
        const inputCost = (usage.prompt_tokens / 1000000) * 5;
        const outputCost = (usage.completion_tokens / 1000000) * 15;
        return inputCost + outputCost;
    }

    // ============================================================
    // MAIN EXECUTION
    // ============================================================
    async run() {
        try {
            await this.initLogger();

            // Load framework
            const framework = await this.loadFramework();

            // Get assistants
            const assistants = await this.getAssistantsForOptimization();

            if (assistants.length === 0) {
                await this.logger.info('END', 'No assistants to optimize');
                return;
            }

            // Process each assistant
            for (const assistant of assistants) {
                try {
                    console.log(`\n${'='.repeat(60)}`);
                    console.log(`Optimizing: ${assistant.name}`);
                    console.log('='.repeat(60));

                    // Get performance data
                    const performance = await this.getAssistantPerformance(assistant.assistant_id);

                    if (performance.calls_with_qci < 10) {
                        console.log(`⚠️  Skipping: only ${performance.calls_with_qci} calls with QCI (need 10+)`);
                        continue;
                    }

                    console.log(`📊 Current QCI: ${performance.avg_qci.toFixed(1)}/100`);
                    console.log(`📞 Calls with QCI: ${performance.calls_with_qci}`);

                    // Smart sampling
                    const sampleCalls = this.smartSampleCalls(performance);

                    // Optimize prompt
                    const optimization = await this.optimizePrompt(assistant, performance, framework, sampleCalls);

                    console.log(`🎯 Target QCI: ${optimization.expected_qci}/100 (${optimization.improvement_delta})`);
                    console.log(`💡 Top reasons:`);
                    optimization.top_reasons.forEach((r, i) => console.log(`   ${i + 1}. ${r}`));

                    // Save to database
                    await this.saveResult(assistant.assistant_id, performance, optimization);

                    // Generate markdown
                    await this.generateMarkdownReport(assistant, performance, optimization);

                    console.log(`✅ Optimization saved to database`);

                } catch (error) {
                    console.error(`❌ Failed to optimize ${assistant.name}:`, error.message);
                    this.stats.failed++;
                }
            }

            // Update run
            const duration = Date.now() - this.stats.startTime;
            await updateRun(this.runId, {
                status: 'success',
                finished_at: new Date().toISOString(),
                duration_ms: duration,
                metadata: {
                    assistants_processed: this.stats.processed,
                    assistants_failed: this.stats.failed,
                    total_cost: this.stats.totalCost
                }
            }, process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

            // Summary
            console.log(`\n${'='.repeat(60)}`);
            console.log('✅ OPTIMIZATION COMPLETE');
            console.log('='.repeat(60));
            console.log(`📊 Processed: ${this.stats.processed} assistants`);
            console.log(`❌ Failed: ${this.stats.failed} assistants`);
            console.log(`💰 Total Cost: $${this.stats.totalCost.toFixed(4)}`);
            console.log(`⏱  Duration: ${Math.round(duration / 1000)}s`);
            console.log('='.repeat(60));

        } catch (error) {
            await this.logger.error('ERROR', error.message);
            console.error('\n❌ OPTIMIZATION FAILED:', error.message);
            throw error;
        }
    }
}

// ============================================================
// CLI EXECUTION
// ============================================================

async function main() {
    const optimizer = new PromptOptimizer();
    await optimizer.run();
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = PromptOptimizer;
