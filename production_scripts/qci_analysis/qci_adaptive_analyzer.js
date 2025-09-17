require('dotenv').config({ path: '../../.env' });
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

const CONFIG = {
    INPUT_FILE: '../vapi_collection/results/2025-09-17T09-51-00_vapi_calls_2025-01-01_to_2025-09-17_cost-0.03.json',
    ALREADY_ANALYZED_FILE: 'results/ai_qci_analysis_2025-09-17T10-54-58.json',

    // Progressive batch sizes - start small, increase gradually
    BATCH_PROGRESSION: [50, 75, 100],  // TEST MAX SPEED
    INITIAL_CONCURRENT: 50,      // Start with 50 parallel
    MAX_CONCURRENT: 100,         // Maximum we'll try

    MODEL: "gpt-4o-mini",
    TEMPERATURE: 0.1,
    MAX_TOKENS: 1500,

    RETRY_ATTEMPTS: 2,
    RETRY_DELAY: 3000,
    BATCH_DELAY: 2000,          // Delay between batches

    OUTPUT_DIR: 'results',
    VERBOSE: true
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

class AdaptiveQCIAnalyzer {
    constructor() {
        this.results = [];
        this.alreadyAnalyzedIds = new Set();
        this.currentConcurrency = CONFIG.INITIAL_CONCURRENT;
        this.successfulBatches = 0;
        this.failedBatches = 0;
        this.stats = {
            processed: 0,
            failed: 0,
            skipped: 0,
            totalCost: 0,
            startTime: Date.now(),
            errors: []
        };
    }

    async initialize() {
        // Load already analyzed calls
        if (fs.existsSync(path.join(__dirname, CONFIG.ALREADY_ANALYZED_FILE))) {
            const analyzed = JSON.parse(fs.readFileSync(path.join(__dirname, CONFIG.ALREADY_ANALYZED_FILE), 'utf8'));
            analyzed.results.forEach(r => this.alreadyAnalyzedIds.add(r.call_id));
            console.log(`📌 Found ${this.alreadyAnalyzedIds.size} already analyzed calls to skip`);
        }
    }

    async loadCallData() {
        const inputPath = path.resolve(__dirname, CONFIG.INPUT_FILE);
        const allCalls = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

        const validCalls = allCalls
            .filter(call => call.transcript && call.transcript.length > 100)
            .filter(call => !this.alreadyAnalyzedIds.has(call.id))
            .sort((a, b) => (b.transcript?.length || 0) - (a.transcript?.length || 0));

        console.log(`🎯 Loaded ${validCalls.length} NEW calls to analyze (excluding ${this.alreadyAnalyzedIds.size} already done)`);
        return validCalls;
    }

    async analyzeCall(callData, retryCount = 0) {
        try {
            const prompt = this.buildPrompt(callData);
            const response = await openai.chat.completions.create({
                model: CONFIG.MODEL,
                messages: [{ role: "user", content: prompt }],
                temperature: CONFIG.TEMPERATURE,
                max_tokens: CONFIG.MAX_TOKENS
            });

            this.stats.totalCost += this.calculateCost(response.usage);

            const analysis = JSON.parse(response.choices[0].message.content);

            return {
                call_id: callData.id,
                qci_total: analysis.qci_total_score || 0,
                dynamics: analysis.dynamics_total || 0,
                objections: analysis.objections_total || 0,
                brand: analysis.brand_total || 0,
                outcome: analysis.outcome_total || 0,
                status: this.determineStatus(analysis.qci_total_score || 0),
                ai_analysis: analysis,
                cost: this.calculateCost(response.usage),
                tokens: response.usage.total_tokens
            };

        } catch (error) {
            if (retryCount < CONFIG.RETRY_ATTEMPTS) {
                if (CONFIG.VERBOSE) {
                    console.log(`🔄 Retry ${retryCount + 1}/${CONFIG.RETRY_ATTEMPTS} for ${callData.id.substring(0, 8)}...`);
                }
                await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * (retryCount + 1)));
                return this.analyzeCall(callData, retryCount + 1);
            }

            console.log(`❌ Failed ${callData.id.substring(0, 8)}: ${error.message}`);
            this.stats.failed++;
            this.stats.errors.push({ id: callData.id, error: error.message });
            return null;
        }
    }

    async processBatchWithConcurrency(calls, concurrency) {
        console.log(`📦 Processing batch of ${calls.length} calls with concurrency ${concurrency}...`);

        const results = [];
        let errors = 0;

        // Process in chunks based on concurrency
        for (let i = 0; i < calls.length; i += concurrency) {
            const chunk = calls.slice(i, Math.min(i + concurrency, calls.length));
            const chunkPromises = chunk.map(call => this.analyzeCall(call));
            const chunkResults = await Promise.all(chunkPromises);

            chunkResults.forEach(result => {
                if (result) {
                    results.push(result);
                    this.stats.processed++;
                } else {
                    errors++;
                }
            });

            // Small delay between chunks
            if (i + concurrency < calls.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        const success = errors === 0;

        if (success) {
            console.log(`✅ Batch complete: ${results.length} successful, ${errors} errors`);
        } else {
            console.log(`⚠️ Batch complete with errors: ${results.length} successful, ${errors} errors`);
        }

        return { results, success, errors };
    }

    async analyzeWithProgressiveBatches(calls) {
        console.log(`\n🚀 ADAPTIVE ANALYSIS: Starting with ${calls.length} calls`);
        console.log(`📈 Progressive batch sizes: ${CONFIG.BATCH_PROGRESSION.join(', ')}`);

        let currentBatchSize = CONFIG.BATCH_PROGRESSION[0];
        let processedCount = 0;
        let batchIndex = 0;
        let consecutiveSuccesses = 0;

        while (processedCount < calls.length) {
            const batch = calls.slice(processedCount, processedCount + currentBatchSize);

            console.log(`\n--- Batch ${batchIndex + 1} ---`);
            console.log(`📊 Size: ${batch.length} | Concurrency: ${this.currentConcurrency}`);

            const batchResult = await this.processBatchWithConcurrency(batch, this.currentConcurrency);

            this.results.push(...batchResult.results);
            processedCount += batch.length;

            if (batchResult.success) {
                consecutiveSuccesses++;
                this.successfulBatches++;

                // Increase batch size after 2 consecutive successes
                if (consecutiveSuccesses >= 2 && currentBatchSize < CONFIG.BATCH_PROGRESSION[CONFIG.BATCH_PROGRESSION.length - 1]) {
                    const nextSizeIndex = CONFIG.BATCH_PROGRESSION.indexOf(currentBatchSize) + 1;
                    if (nextSizeIndex < CONFIG.BATCH_PROGRESSION.length) {
                        currentBatchSize = CONFIG.BATCH_PROGRESSION[nextSizeIndex];
                        console.log(`⬆️ Increasing batch size to ${currentBatchSize}`);
                    }
                }

                // Increase concurrency gradually
                if (consecutiveSuccesses >= 3 && this.currentConcurrency < CONFIG.MAX_CONCURRENT) {
                    this.currentConcurrency = Math.min(this.currentConcurrency + 2, CONFIG.MAX_CONCURRENT);
                    console.log(`⬆️ Increasing concurrency to ${this.currentConcurrency}`);
                }
            } else {
                consecutiveSuccesses = 0;
                this.failedBatches++;

                // Decrease batch size on failure
                if (currentBatchSize > CONFIG.BATCH_PROGRESSION[0]) {
                    const prevSizeIndex = CONFIG.BATCH_PROGRESSION.indexOf(currentBatchSize) - 1;
                    currentBatchSize = CONFIG.BATCH_PROGRESSION[Math.max(0, prevSizeIndex)];
                    console.log(`⬇️ Reducing batch size to ${currentBatchSize}`);
                }

                // Reduce concurrency on failure
                if (this.currentConcurrency > 1) {
                    this.currentConcurrency = Math.max(1, Math.floor(this.currentConcurrency / 2));
                    console.log(`⬇️ Reducing concurrency to ${this.currentConcurrency}`);
                }
            }

            // Save progress periodically
            if (batchIndex % 5 === 0 && batchIndex > 0) {
                this.saveProgress();
            }

            console.log(`📊 Progress: ${processedCount}/${calls.length} (${(processedCount/calls.length*100).toFixed(1)}%)`);

            // Delay between batches
            if (processedCount < calls.length) {
                await new Promise(resolve => setTimeout(resolve, CONFIG.BATCH_DELAY));
            }

            batchIndex++;
        }
    }

    buildPrompt(callData) {
        return `Analyze this VAPI call transcript for Quality Call Index (QCI) scoring.

Transcript: "${callData.transcript}"

IMPORTANT: Respond ONLY with valid JSON, no explanations or text before/after.

CRITICAL SCORING RULES:
- Brand score MUST be 0 if "Young Caesar" is not mentioned in transcript
- Outcome score MUST reflect actual results (meeting=30, warm=20, callback=15, info=10, none=0)
- Base scores on EVIDENCE found in transcript, not assumptions

Return this exact JSON structure:
{
  "qci_total_score": 0-100,
  "dynamics_total": 0-30,
  "objections_total": 0-20,
  "brand_total": 0-20,
  "outcome_total": 0-30,
  "evidence": {
    "agent_talk_ratio": "X% agent talk time",
    "brand_mentions": ["exact quotes with Young Caesar"],
    "outcomes": ["specific outcome achieved"]
  },
  "coaching_tips": ["specific improvement 1", "specific improvement 2"]
}

STRICT SCORING:
- Dynamics(30): Talk ratio, response time, engagement
- Objections(20): Recognition, handling, compliance
- Brand(20): ONLY if "Young Caesar" mentioned explicitly
- Outcome(30): Concrete results achieved`;
    }

    calculateCost(usage) {
        const inputCost = (usage.prompt_tokens / 1000000) * 0.15;
        const outputCost = (usage.completion_tokens / 1000000) * 0.60;
        return inputCost + outputCost;
    }

    determineStatus(score) {
        if (score >= 80) return 'pass';
        if (score >= 60) return 'review';
        return 'fail';
    }

    saveProgress() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const filename = `qci_adaptive_progress_${timestamp}.json`;
        const filepath = path.join(__dirname, CONFIG.OUTPUT_DIR, filename);

        const data = {
            config: CONFIG,
            stats: this.stats,
            results: this.results,
            adaptiveStats: {
                currentConcurrency: this.currentConcurrency,
                successfulBatches: this.successfulBatches,
                failedBatches: this.failedBatches
            },
            timestamp: new Date().toISOString()
        };

        fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
        console.log(`💾 Progress saved: ${this.stats.processed} calls analyzed`);
    }

    async combineWithPreviousResults() {
        const previousResults = [];

        // Load previous analysis
        if (fs.existsSync(path.join(__dirname, CONFIG.ALREADY_ANALYZED_FILE))) {
            const analyzed = JSON.parse(fs.readFileSync(path.join(__dirname, CONFIG.ALREADY_ANALYZED_FILE), 'utf8'));
            previousResults.push(...analyzed.results);
            console.log(`📌 Loaded ${previousResults.length} previous results`);
        }

        // Combine all results
        const allResults = [...previousResults, ...this.results];
        console.log(`📊 Total analyzed calls: ${allResults.length}`);

        return allResults;
    }

    async saveFinalResults() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const filename = `qci_complete_analysis_${timestamp}.json`;
        const filepath = path.join(__dirname, CONFIG.OUTPUT_DIR, filename);

        const totalTime = (Date.now() - this.stats.startTime) / 1000;
        const allResults = await this.combineWithPreviousResults();
        const avgQCI = allResults.reduce((sum, r) => sum + r.qci_total, 0) / allResults.length;

        const finalStats = {
            ...this.stats,
            totalTime,
            avgTimePerCall: totalTime / this.stats.processed,
            avgCostPerCall: this.stats.totalCost / this.stats.processed,
            avgQCI: avgQCI,
            totalAnalyzed: allResults.length
        };

        const data = {
            config: CONFIG,
            stats: finalStats,
            adaptiveStats: {
                finalConcurrency: this.currentConcurrency,
                successfulBatches: this.successfulBatches,
                failedBatches: this.failedBatches
            },
            results: allResults,
            summary: {
                total_calls: allResults.length,
                new_calls_this_run: this.stats.processed,
                avg_qci: avgQCI.toFixed(1),
                pass_rate: (allResults.filter(r => r.status === 'pass').length / allResults.length * 100).toFixed(1),
                total_cost: this.stats.totalCost.toFixed(4),
                total_time: `${Math.floor(totalTime / 60)}m ${Math.floor(totalTime % 60)}s`
            }
        };

        fs.writeFileSync(filepath, JSON.stringify(data, null, 2));

        console.log(`\n🎉 ADAPTIVE ANALYSIS COMPLETE`);
        console.log(`📊 Total analyzed: ${allResults.length} calls`);
        console.log(`🆕 New this run: ${this.stats.processed} calls`);
        console.log(`⭐ Average QCI: ${avgQCI.toFixed(1)}/100`);
        console.log(`💰 Cost this run: $${this.stats.totalCost.toFixed(4)}`);
        console.log(`⏱️ Time: ${Math.floor(totalTime / 60)}m ${Math.floor(totalTime % 60)}s`);
        console.log(`📁 Complete results: ${filename}`);

        return filepath;
    }
}

async function main() {
    const analyzer = new AdaptiveQCIAnalyzer();

    try {
        if (!fs.existsSync(path.join(__dirname, CONFIG.OUTPUT_DIR))) {
            fs.mkdirSync(path.join(__dirname, CONFIG.OUTPUT_DIR), { recursive: true });
        }

        await analyzer.initialize();
        const calls = await analyzer.loadCallData();

        if (calls.length === 0) {
            console.log('✅ All calls have already been analyzed!');
            return;
        }

        await analyzer.analyzeWithProgressiveBatches(calls);
        await analyzer.saveFinalResults();

    } catch (error) {
        console.error('❌ Analysis failed:', error.message);
        analyzer.saveProgress();
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = AdaptiveQCIAnalyzer;