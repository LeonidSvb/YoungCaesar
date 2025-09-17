require('dotenv').config({ path: '../../.env' });
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

const CONFIG = {
    INPUT_FILE: '../vapi_collection/results/2025-09-17T09-51-00_vapi_calls_2025-01-01_to_2025-09-17_cost-0.03.json',

    CONCURRENT_REQUESTS: 20,        // Maximum parallel requests
    BATCH_SIZE: 50,                 // Calls per batch
    REQUESTS_PER_MINUTE: 400,       // 80% of OpenAI Tier 1 limit (500 RPM)
    TOKENS_PER_MINUTE: 160000,      // 80% of OpenAI Tier 1 limit (200K TPM)

    MODEL: "gpt-4o-mini",
    TEMPERATURE: 0.1,
    MAX_TOKENS: 1500,               // Reduced for speed

    SAVE_PROGRESS_EVERY: 50,        // Save progress after each batch
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 2000,

    OUTPUT_DIR: 'results',
    VERBOSE: false                  // Reduced logging for speed
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

class OptimizedQCIAnalyzer {
    constructor() {
        this.results = [];
        this.stats = {
            processed: 0,
            failed: 0,
            skipped: 0,
            totalCost: 0,
            startTime: Date.now(),
            requestsThisMinute: 0,
            tokensThisMinute: 0,
            lastMinuteReset: Date.now()
        };
        this.activeRequests = 0;
        this.requestQueue = [];
    }

    async loadCallData(testLimit = null) {
        const inputPath = path.resolve(__dirname, CONFIG.INPUT_FILE);
        const allCalls = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

        let validCalls = allCalls
            .filter(call => call.transcript && call.transcript.length > 100)
            .sort((a, b) => (b.transcript?.length || 0) - (a.transcript?.length || 0));

        if (testLimit) {
            validCalls = validCalls.slice(0, testLimit);
        }

        console.log(`🎯 Loaded ${validCalls.length} calls with transcripts for analysis`);
        return validCalls;
    }

    async rateLimitCheck() {
        const now = Date.now();
        if (now - this.stats.lastMinuteReset > 60000) {
            this.stats.requestsThisMinute = 0;
            this.stats.tokensThisMinute = 0;
            this.stats.lastMinuteReset = now;
        }

        if (this.stats.requestsThisMinute >= CONFIG.REQUESTS_PER_MINUTE) {
            const waitTime = 60000 - (now - this.stats.lastMinuteReset);
            if (waitTime > 0) {
                console.log(`⏸️ Rate limit pause: ${Math.ceil(waitTime/1000)}s`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                this.stats.requestsThisMinute = 0;
                this.stats.tokensThisMinute = 0;
                this.stats.lastMinuteReset = Date.now();
            }
        }
    }

    async analyzeCall(callData, retryCount = 0) {
        try {
            await this.rateLimitCheck();

            this.activeRequests++;
            this.stats.requestsThisMinute++;

            const prompt = this.buildPrompt(callData);
            const response = await openai.chat.completions.create({
                model: CONFIG.MODEL,
                messages: [{ role: "user", content: prompt }],
                temperature: CONFIG.TEMPERATURE,
                max_tokens: CONFIG.MAX_TOKENS
            });

            this.activeRequests--;
            this.stats.tokensThisMinute += response.usage.total_tokens;
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
            this.activeRequests--;

            if (retryCount < CONFIG.RETRY_ATTEMPTS) {
                console.log(`🔄 Retry ${retryCount + 1}/${CONFIG.RETRY_ATTEMPTS} for call ${callData.id.substring(0, 8)}`);
                await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * (retryCount + 1)));
                return this.analyzeCall(callData, retryCount + 1);
            }

            console.log(`❌ Failed call ${callData.id.substring(0, 8)}: ${error.message}`);
            this.stats.failed++;
            return null;
        }
    }

    async processBatch(calls) {
        const promises = calls.map(call => this.analyzeCall(call));
        const results = await Promise.all(promises);

        const validResults = results.filter(r => r !== null);
        this.results.push(...validResults);
        this.stats.processed += validResults.length;

        return validResults;
    }

    async analyzeAllCalls(calls) {
        console.log(`🚀 Starting optimized analysis of ${calls.length} calls`);
        console.log(`⚡ Concurrency: ${CONFIG.CONCURRENT_REQUESTS} | Batch size: ${CONFIG.BATCH_SIZE}`);

        for (let i = 0; i < calls.length; i += CONFIG.BATCH_SIZE) {
            const batch = calls.slice(i, i + CONFIG.BATCH_SIZE);
            const batchNum = Math.floor(i / CONFIG.BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(calls.length / CONFIG.BATCH_SIZE);

            console.log(`📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} calls)`);

            const batchResults = await this.processBatch(batch);

            const avgQCI = batchResults.reduce((sum, r) => sum + r.qci_total, 0) / batchResults.length;
            console.log(`✅ Batch ${batchNum} complete: Avg QCI ${avgQCI.toFixed(1)}, Cost $${this.stats.totalCost.toFixed(4)}`);

            if (i + CONFIG.BATCH_SIZE < calls.length && batchNum % (CONFIG.SAVE_PROGRESS_EVERY / CONFIG.BATCH_SIZE) === 0) {
                this.saveProgress();
            }

            if (i + CONFIG.BATCH_SIZE < calls.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    buildPrompt(callData) {
        return `Analyze this VAPI call transcript for Quality Call Index (QCI) scoring.

Transcript: "${callData.transcript}"

Provide JSON response with QCI scores (0-100 scale):
{
  "qci_total_score": 0-100,
  "dynamics_total": 0-30,
  "objections_total": 0-20,
  "brand_total": 0-20,
  "outcome_total": 0-30,
  "evidence": {
    "agent_talk_ratio": "observed ratio",
    "brand_mentions": ["quotes"],
    "outcomes": ["meeting/callback/etc"]
  },
  "coaching_tips": ["tip1", "tip2", "tip3"]
}

Scoring criteria:
- Dynamics (30): Talk ratio (35-55% optimal), response time, dead air penalties
- Objections (20): Recognition speed, compliance time, alternatives offered
- Brand (20): Early brand mention (<10s), consistency, language match
- Outcome (30): Meeting booked (15pts), warm lead (10pts), callback (6pts), info sent (4pts)`;
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
        const filename = `qci_progress_${timestamp}.json`;
        const filepath = path.join(__dirname, CONFIG.OUTPUT_DIR, filename);

        const data = {
            config: CONFIG,
            stats: this.stats,
            results: this.results,
            timestamp: new Date().toISOString()
        };

        fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
        console.log(`💾 Progress saved: ${this.stats.processed} calls analyzed`);
    }

    saveFinalResults() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const filename = `qci_optimized_analysis_${timestamp}.json`;
        const filepath = path.join(__dirname, CONFIG.OUTPUT_DIR, filename);

        const totalTime = (Date.now() - this.stats.startTime) / 1000;
        const avgQCI = this.results.reduce((sum, r) => sum + r.qci_total, 0) / this.results.length;

        const finalStats = {
            ...this.stats,
            totalTime,
            avgTimePerCall: totalTime / this.stats.processed,
            avgCostPerCall: this.stats.totalCost / this.stats.processed,
            avgQCI: avgQCI,
            projectedCostFor1000: (this.stats.totalCost / this.stats.processed) * 1000
        };

        const data = {
            config: CONFIG,
            stats: finalStats,
            results: this.results,
            summary: {
                total_calls: this.stats.processed,
                avg_qci: avgQCI.toFixed(1),
                pass_rate: (this.results.filter(r => r.status === 'pass').length / this.results.length * 100).toFixed(1),
                total_cost: this.stats.totalCost.toFixed(4),
                total_time: `${Math.floor(totalTime / 60)}m ${Math.floor(totalTime % 60)}s`
            }
        };

        fs.writeFileSync(filepath, JSON.stringify(data, null, 2));

        console.log(`\n🎉 OPTIMIZED QCI ANALYSIS COMPLETE`);
        console.log(`📊 Analyzed: ${this.stats.processed} calls`);
        console.log(`⭐ Average QCI: ${avgQCI.toFixed(1)}/100`);
        console.log(`💰 Total cost: $${this.stats.totalCost.toFixed(4)}`);
        console.log(`⏱️ Total time: ${Math.floor(totalTime / 60)}m ${Math.floor(totalTime % 60)}s`);
        console.log(`📁 Results saved: ${filename}`);

        return filepath;
    }
}

async function main() {
    const analyzer = new OptimizedQCIAnalyzer();
    const testMode = process.argv.includes('--test-100');

    try {
        if (!fs.existsSync(path.join(__dirname, CONFIG.OUTPUT_DIR))) {
            fs.mkdirSync(path.join(__dirname, CONFIG.OUTPUT_DIR), { recursive: true });
        }

        const calls = await analyzer.loadCallData(testMode ? 100 : null);
        await analyzer.analyzeAllCalls(calls);
        analyzer.saveFinalResults();

    } catch (error) {
        console.error('❌ Analysis failed:', error.message);
        analyzer.saveProgress();
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = OptimizedQCIAnalyzer;