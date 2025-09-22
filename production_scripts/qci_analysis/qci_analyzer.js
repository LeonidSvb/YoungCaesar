require('dotenv').config({ path: '../../.env' });

// ============================================================
// CONFIGURATION - CHANGE ALL SETTINGS HERE
// ============================================================

const CONFIG = {
    // 📁 INPUT DATA - Which calls to analyze
    INPUT: {
        // Path to JSON file with call data (from vapi_collection)
        DATA_FILE: '../vapi_collection/results/2025-09-17T09-51-00_vapi_calls_2025-01-01_to_2025-09-17_cost-0.03.json',

        // Minimum transcript length to analyze (characters)
        // 💡 Recommended: 100+ chars = meaningful conversations
        MIN_TRANSCRIPT_LENGTH: 100
    },

    // 🧪 TESTING MODE - Start small, then scale up
    TESTING: {
        // Enable test mode? (true = analyze few calls, false = analyze ALL calls)
        ENABLED: false,

        // How many calls to test with (sorted by longest first)
        // 💡 Start with 10, then 50, then disable testing for full run
        BATCH_SIZE: 50,

        // Test specific call ID (leave empty for longest calls)
        SPECIFIC_CALL_ID: ""
    },

    // 🤖 OPENAI API SETTINGS
    OPENAI: {
        // Model to use for analysis
        // 💰 Cost comparison:
        //   • gpt-4o-mini: $0.15/1M input, $0.60/1M output (cheapest, good quality)
        //   • gpt-4o: $2.50/1M input, $10.00/1M output (expensive, best quality)
        MODEL: "gpt-4o-mini",

        // Temperature (0 = deterministic, 1 = creative)
        // 💡 Keep at 0.1 for consistent scoring
        TEMPERATURE: 0.1,

        // Maximum response tokens
        MAX_TOKENS: 2000
    },

    // ⚡ PERFORMANCE SETTINGS
    PROCESSING: {
        // How many calls to analyze simultaneously
        // 💡 Safe limits:
        //   • Tier 1 OpenAI: 3-5 concurrent
        //   • Tier 2+ OpenAI: 10-50 concurrent
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
        // Where to save results
        RESULTS_DIR: 'results',

        // Show detailed progress in console?
        VERBOSE: true
    }
};

// ============================================================
// MAIN SCRIPT - NO NEED TO CHANGE BELOW
// ============================================================

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const { loadPrompt } = require('../shared/prompt_parser');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

class QCIAnalyzer {
    constructor() {
        this.results = [];
        this.stats = {
            processed: 0,
            failed: 0,
            totalCost: 0,
            startTime: Date.now(),
            errors: []
        };
    }

    async loadCallData() {
        const inputPath = path.resolve(__dirname, CONFIG.INPUT.DATA_FILE);
        const allCalls = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

        let calls = allCalls
            .filter(call => call.transcript && call.transcript.length > CONFIG.INPUT.MIN_TRANSCRIPT_LENGTH)
            .sort((a, b) => (b.transcript?.length || 0) - (a.transcript?.length || 0));

        if (CONFIG.TESTING.ENABLED) {
            if (CONFIG.TESTING.SPECIFIC_CALL_ID) {
                calls = calls.filter(c => c.id === CONFIG.TESTING.SPECIFIC_CALL_ID);
                console.log(`🎯 SPECIFIC CALL TEST: ${CONFIG.TESTING.SPECIFIC_CALL_ID.substring(0,8)}`);
            } else {
                calls = calls.slice(0, CONFIG.TESTING.BATCH_SIZE);
                console.log(`🧪 TEST MODE: Analyzing ${calls.length} longest calls`);
            }
        }

        console.log(`📊 Loaded ${calls.length} calls for analysis`);
        return calls;
    }

    async analyzeCall(callData, retryCount = 0) {
        try {
            // Load prompt from local prompts.md
            const promptsPath = require('path').resolve(__dirname, './prompts.md');
            const prompt = loadPrompt(promptsPath, 'QCI_ANALYSIS_PROMPT', {
                transcript: callData.transcript
            });

            const response = await openai.chat.completions.create({
                model: CONFIG.OPENAI.MODEL,
                messages: [{ role: "user", content: prompt }],
                temperature: CONFIG.OPENAI.TEMPERATURE,
                max_tokens: CONFIG.OPENAI.MAX_TOKENS
            });

            this.stats.totalCost += this.calculateCost(response.usage);

            // Clean any markdown formatting
            let jsonContent = response.choices[0].message.content.trim();
            if (jsonContent.includes('```json')) {
                jsonContent = jsonContent.replace(/```json\s*/g, '').replace(/\s*```/g, '').trim();
            }

            const analysis = JSON.parse(jsonContent);

            return {
                call_id: callData.id,
                assistant_id: callData.assistantId,
                transcript_length: callData.transcript.length,
                qci_total: analysis.qci_total_score || 0,
                dynamics: analysis.dynamics_total || 0,
                objections: analysis.objections_total || 0,
                brand: analysis.brand_total || 0,
                outcome: analysis.outcome_total || 0,
                status: this.determineStatus(analysis.qci_total_score || 0),
                ai_analysis: analysis,
                cost: this.calculateCost(response.usage),
                tokens: response.usage.total_tokens,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            if (retryCount < CONFIG.PROCESSING.RETRY_ATTEMPTS) {
                console.log(`🔄 Retry ${retryCount + 1}/${CONFIG.PROCESSING.RETRY_ATTEMPTS} for ${callData.id.substring(0, 8)}...`);
                await new Promise(resolve => setTimeout(resolve, CONFIG.PROCESSING.RETRY_DELAY * (retryCount + 1)));
                return this.analyzeCall(callData, retryCount + 1);
            }

            console.log(`❌ Failed ${callData.id.substring(0, 8)}: ${error.message}`);
            this.stats.failed++;
            this.stats.errors.push({ id: callData.id, error: error.message });
            return null;
        }
    }

    async processBatch(calls) {
        console.log(`\n🚀 Processing ${calls.length} calls with concurrency ${CONFIG.PROCESSING.CONCURRENCY}...`);

        const results = [];

        for (let i = 0; i < calls.length; i += CONFIG.PROCESSING.CONCURRENCY) {
            const chunk = calls.slice(i, Math.min(i + CONFIG.PROCESSING.CONCURRENCY, calls.length));
            const chunkPromises = chunk.map(call => this.analyzeCall(call));
            const chunkResults = await Promise.all(chunkPromises);

            chunkResults.forEach(result => {
                if (result) {
                    results.push(result);
                    this.stats.processed++;
                    console.log(`✅ ${result.call_id.substring(0, 8)}: QCI ${result.qci_total}/100`);
                }
            });

            console.log(`📊 Progress: ${Math.min(i + CONFIG.PROCESSING.CONCURRENCY, calls.length)}/${calls.length}`);

            if (i + CONFIG.PROCESSING.CONCURRENCY < calls.length) {
                await new Promise(resolve => setTimeout(resolve, CONFIG.PROCESSING.BATCH_DELAY));
            }
        }

        this.results = results;
        return results;
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

    async saveResults() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const mode = CONFIG.TESTING.ENABLED ? `test_${CONFIG.TESTING.BATCH_SIZE}` : 'full';
        const filename = `qci_${mode}_calls_${timestamp}.json`;
        const filepath = path.join(__dirname, CONFIG.OUTPUT.RESULTS_DIR, filename);

        if (!fs.existsSync(path.join(__dirname, CONFIG.OUTPUT.RESULTS_DIR))) {
            fs.mkdirSync(path.join(__dirname, CONFIG.OUTPUT.RESULTS_DIR), { recursive: true });
        }

        const totalTime = (Date.now() - this.stats.startTime) / 1000;
        const avgQCI = this.results.reduce((sum, r) => sum + r.qci_total, 0) / this.results.length;

        const data = {
            config: CONFIG,
            stats: {
                ...this.stats,
                totalTime,
                avgTimePerCall: totalTime / this.stats.processed,
                avgCostPerCall: this.stats.totalCost / this.stats.processed,
                avgQCI: avgQCI,
                successRate: (this.stats.processed / (this.stats.processed + this.stats.failed) * 100).toFixed(1)
            },
            results: this.results,
            summary: {
                total_calls: this.results.length,
                avg_qci: avgQCI.toFixed(1),
                pass_rate: (this.results.filter(r => r.status === 'pass').length / this.results.length * 100).toFixed(1),
                total_cost: this.stats.totalCost.toFixed(4),
                total_time: `${Math.floor(totalTime / 60)}m ${Math.floor(totalTime % 60)}s`
            }
        };

        fs.writeFileSync(filepath, JSON.stringify(data, null, 2));

        console.log(`\n🎉 ANALYSIS COMPLETE`);
        console.log(`📊 Analyzed: ${this.results.length} calls`);
        console.log(`⭐ Average QCI: ${avgQCI.toFixed(1)}/100`);
        console.log(`✅ Success rate: ${data.stats.successRate}%`);
        console.log(`💰 Total cost: $${this.stats.totalCost.toFixed(4)}`);
        console.log(`⏱️ Time: ${data.summary.total_time}`);
        console.log(`📁 Results: ${filename}`);

        // Update latest file link for dashboard
        const latestPath = path.join(__dirname, CONFIG.OUTPUT.RESULTS_DIR, 'qci_full_calls_with_assistants_latest.json');
        fs.writeFileSync(latestPath, JSON.stringify(data, null, 2));
        console.log(`📊 Dashboard link updated: qci_full_calls_with_assistants_latest.json`);

        // Generate dashboards
        const dashboardTemplatePath = path.join(__dirname, 'dashboard', 'qci_dashboard_template.html');
        const dashboardOutputPath = path.join(__dirname, 'dashboard', `qci_dashboard_${timestamp}.html`);

        if (fs.existsSync(dashboardTemplatePath)) {
            // Interactive dashboard (needs local server)
            fs.copyFileSync(dashboardTemplatePath, dashboardOutputPath);
            console.log(`📈 Interactive dashboard: dashboard/qci_dashboard_${timestamp}.html`);
            console.log(`🌐 Local server: http://localhost:8080 (run: node ../../simple_server.js)`);

            // Static dashboard (GitHub Pages ready)
            try {
                const createStaticDashboard = require('./create_static_dashboard');
                createStaticDashboard();
                console.log(`📊 Static dashboard created for GitHub Pages`);
            } catch (error) {
                console.log(`⚠️ Could not create static dashboard: ${error.message}`);
            }
        }

        return filepath;
    }
}

async function main() {
    const analyzer = new QCIAnalyzer();

    try {
        const calls = await analyzer.loadCallData();
        await analyzer.processBatch(calls);
        const resultFile = await analyzer.saveResults();

        console.log(`\n📍 Results saved to: ${resultFile}`);

    } catch (error) {
        console.error('❌ Analysis failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = QCIAnalyzer;