require('dotenv').config();
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

// ============================================================
// CONFIGURATION - OPTIMIZED FOR MAXIMUM QUALITY
// ============================================================

const CONFIG = {
    // INPUT DATA
    INPUT_FILE: '../vapi_collection/results/2025-09-17T09-51-00_vapi_calls_2025-01-01_to_2025-09-17_cost-0.03.json',

    // TEST SETTINGS
    TEST_CALLS_COUNT: 20,

    // OPENAI SETTINGS - COST OPTIMIZED
    MODEL: "gpt-4o-mini",               // Cost-optimized model for scaling
    TEMPERATURE: 0.1,                   // Lower temperature for consistency
    MAX_TOKENS: 2000,                   // Reduced tokens for cost efficiency

    // REAL LEXICON FROM DATA
    BRAND_NAME: "Young Caesar",
    AGENT_NAMES: ["Alex", "Avery Martinez", "Amelia Smith", "Ella Thomas", "Clara Flores"],

    // OUTPUT
    OUTPUT_DIR: 'results',
    SAVE_RESULTS: true,
    VERBOSE: true
};

// ============================================================
// MAIN AI-POWERED QCI ANALYZER
// ============================================================

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

class AIQCIAnalyzer {
    constructor() {
        this.results = [];
        this.stats = {
            processed: 0,
            failed: 0,
            totalCost: 0,
            startTime: Date.now(),
            qualityMetrics: {
                avgTokensUsed: 0,
                avgProcessingTime: 0,
                scoringConsistency: []
            }
        };
    }

    async runAnalysis() {
        console.log(`🧠 Starting AI-powered QCI analysis on ${CONFIG.TEST_CALLS_COUNT} calls`);
        console.log(`🎯 Model: ${CONFIG.MODEL} | Temperature: ${CONFIG.TEMPERATURE}`);
        console.log(`🏆 Goal: Maximum quality analysis with full AI scoring\n`);

        // Load test calls
        const testCalls = await this.loadTestCalls();

        // Process each call
        for (let i = 0; i < testCalls.length; i++) {
            const call = testCalls[i];
            console.log(`⚡ Analyzing call ${i+1}/${testCalls.length}: ${call.id.slice(0, 8)}...`);

            try {
                const result = await this.analyzeCallWithAI(call);
                this.results.push(result);
                this.stats.processed++;

                console.log(`   📊 QCI: ${result.qci_total}/100 (${result.status})`);
                console.log(`   🎯 Breakdown: D:${result.dynamics} | O:${result.objections} | B:${result.brand} | Out:${result.outcome}`);
                console.log(`   💰 Cost: $${result.cost.toFixed(4)} | ⏱️ ${result.processing_time.toFixed(1)}s`);

            } catch (error) {
                console.log(`   ❌ Failed: ${error.message}`);
                this.stats.failed++;
            }
        }

        // Save and analyze results
        await this.saveResults();
        this.printDetailedAnalysis();
        this.generateQualityReport();

        return this.results;
    }

    async loadTestCalls() {
        const inputPath = path.resolve(__dirname, CONFIG.INPUT_FILE);
        const rawData = fs.readFileSync(inputPath, 'utf8');
        const allCalls = JSON.parse(rawData);

        // Select diverse calls for better testing
        const validCalls = allCalls
            .filter(call => call.transcript && call.transcript.length > 300)
            .sort((a, b) => b.transcript.length - a.transcript.length) // Start with longest
            .slice(0, CONFIG.TEST_CALLS_COUNT);

        console.log(`📊 Selected ${validCalls.length} high-quality calls for analysis`);
        console.log(`📏 Length range: ${validCalls[validCalls.length-1].transcript.length} - ${validCalls[0].transcript.length} chars`);

        return validCalls;
    }

    async analyzeCallWithAI(callData) {
        const startTime = Date.now();

        // Prepare rich input data for AI
        const inputData = this.prepareRichInput(callData);

        // Get AI analysis
        const prompt = this.buildOptimizedPrompt(inputData);
        const aiResponse = await this.callOpenAI(prompt);

        const processingTime = (Date.now() - startTime) / 1000;
        const cost = this.calculateCost(aiResponse.usage);

        let analysis;
        try {
            analysis = JSON.parse(aiResponse.choices[0].message.content);
        } catch (e) {
            throw new Error('AI returned invalid JSON');
        }

        // Update quality metrics
        this.stats.qualityMetrics.avgTokensUsed += aiResponse.usage.total_tokens;
        this.stats.qualityMetrics.avgProcessingTime += processingTime;
        this.stats.totalCost += cost;

        return {
            call_id: callData.id,
            call_duration: inputData.duration,
            transcript_length: inputData.transcript.length,

            // QCI Scores (calculated by AI)
            qci_total: analysis.qci_total_score || 0,
            status: this.determineStatus(analysis.qci_total_score || 0),

            // Category breakdowns
            dynamics: analysis.dynamics_total || 0,
            objections: analysis.objections_total || 0,
            brand: analysis.brand_total || 0,
            outcome: analysis.outcome_total || 0,

            // Detailed AI analysis
            ai_analysis: analysis,
            evidence: analysis.evidence || {},
            coaching_tips: analysis.coaching_tips || [],

            // Technical metrics
            processing_time: processingTime,
            cost: cost,
            tokens_used: aiResponse.usage.total_tokens,
            model_used: CONFIG.MODEL
        };
    }

    prepareRichInput(callData) {
        // Extract detailed conversation flow
        const messages = callData.messages?.filter(m => m.role === 'bot' || m.role === 'user') || [];

        const conversationFlow = messages.map(msg => ({
            speaker: msg.role === 'bot' ? 'Agent' : 'Client',
            text: msg.message,
            timestamp: msg.secondsFromStart || 0
        }));

        return {
            transcript: callData.transcript,
            conversation_flow: conversationFlow,
            duration: this.calculateDuration(callData),
            call_metadata: {
                started_at: callData.startedAt,
                ended_at: callData.endedAt,
                status: callData.status,
                cost: callData.cost
            }
        };
    }

    calculateDuration(callData) {
        if (callData.startedAt && callData.endedAt) {
            return Math.round((new Date(callData.endedAt) - new Date(callData.startedAt)) / 1000);
        }
        return Math.round(callData.transcript.length / 15); // rough estimate
    }

    buildOptimizedPrompt(inputData) {
        return `You are a world-class call quality expert analyzing sales calls for Young Caesar company.

## Call Data:
**Duration:** ${inputData.duration} seconds
**Brand:** Young Caesar (industrial manufacturer client acquisition)

**Transcript:**
${inputData.transcript}

**Conversation Flow with Timestamps:**
${inputData.conversation_flow.map(msg => `[${msg.timestamp}s] ${msg.speaker}: ${msg.text}`).join('\\n')}

## QCI Scoring Framework (Total: 100 points)

### A) Dynamics (30 points):
- **Agent Talk Ratio (8 pts):** Ideal 35-55% agent talk time
- **Time-To-Value (8 pts):** First value proposition ≤20 seconds
- **First CTA (8 pts):** First call-to-action ≤120 seconds
- **Dead Air Penalty (6 pts):** Deduct for pauses >3 seconds

### B) Objections & Compliance (20 points):
- **Resistance Recognition (6 pts):** Quick acknowledgment of objections
- **Time-To-Comply (8 pts):** Respectful response ≤10 seconds
- **Alternative Offered (6 pts):** Email/callback alternatives

### C) Brand & Language (20 points):
- **Brand Mention (8 pts):** Clear introduction ≤10 seconds
- **Brand Consistency (8 pts):** Consistent company name usage
- **Language Match (4 pts):** Appropriate communication style

### D) Outcome & Hygiene (30 points):
- **Final Outcome (15 pts):** Meeting=15, Lead=10, Callback=6, Info=4, None=0
- **Professionalism (10 pts):** Overall call quality and courtesy
- **Wrap-up (5 pts):** Proper call conclusion

## Task:
Analyze this call with extreme precision and return detailed scoring in JSON format.

Be specific with timing measurements, provide evidence quotes, and include actionable coaching tips.

Return JSON:
\`\`\`json
{
  "qci_total_score": 0,
  "dynamics_total": 0,
  "objections_total": 0,
  "brand_total": 0,
  "outcome_total": 0,

  "detailed_breakdown": {
    "agent_talk_ratio": {"score": 0, "percentage": 0.0, "assessment": ""},
    "time_to_value": {"score": 0, "seconds": 0, "value_statement": ""},
    "first_cta": {"score": 0, "seconds": 0, "cta_statement": ""},
    "dead_air": {"penalty": 0, "events": 0, "details": ""},

    "resistance_recognition": {"score": 0, "response_time": 0, "details": ""},
    "compliance": {"score": 0, "comply_time": 0, "details": ""},
    "alternatives": {"score": 0, "offered": false, "type": ""},

    "brand_mention": {"score": 0, "first_mention_time": 0, "introduction": ""},
    "brand_consistency": {"score": 0, "variants_found": 1, "assessment": ""},
    "language_match": {"score": 0, "appropriate": true, "details": ""},

    "final_outcome": {"score": 0, "outcome_type": "", "evidence": ""},
    "professionalism": {"score": 0, "assessment": "", "strengths": [], "weaknesses": []},
    "wrap_up": {"score": 0, "present": false, "quality": ""}
  },

  "evidence": {
    "strongest_moments": [],
    "improvement_areas": [],
    "key_quotes": []
  },

  "coaching_tips": [
    "Specific actionable feedback based on this call"
  ]
}
\`\`\`

Analyze with maximum precision and provide actionable insights.`;
    }

    async callOpenAI(prompt) {
        return await openai.chat.completions.create({
            model: CONFIG.MODEL,
            temperature: CONFIG.TEMPERATURE,
            max_tokens: CONFIG.MAX_TOKENS,
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: "You are an expert call quality analyst. Provide precise, actionable analysis with specific evidence and measurements."
                },
                {
                    role: "user",
                    content: prompt
                }
            ]
        });
    }

    calculateCost(usage) {
        // GPT-4o-mini pricing
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
        if (!CONFIG.SAVE_RESULTS) return;

        const outputDir = path.join(__dirname, CONFIG.OUTPUT_DIR);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `ai_qci_analysis_${timestamp}.json`;

        const output = {
            config: CONFIG,
            stats: this.getStats(),
            results: this.results,
            quality_report: this.generateQualityMetrics()
        };

        const filepath = path.join(outputDir, filename);
        fs.writeFileSync(filepath, JSON.stringify(output, null, 2));

        console.log(`\\n💾 Results saved to: ${filename}`);
    }

    getStats() {
        const processed = this.stats.processed;
        return {
            ...this.stats,
            totalTime: (Date.now() - this.stats.startTime) / 1000,
            avgCostPerCall: processed > 0 ? this.stats.totalCost / processed : 0,
            avgTokensPerCall: processed > 0 ? this.stats.qualityMetrics.avgTokensUsed / processed : 0,
            avgTimePerCall: processed > 0 ? this.stats.qualityMetrics.avgProcessingTime / processed : 0
        };
    }

    generateQualityMetrics() {
        if (this.results.length === 0) return {};

        const scores = this.results.map(r => r.qci_total);
        const costs = this.results.map(r => r.cost);

        return {
            score_distribution: {
                min: Math.min(...scores),
                max: Math.max(...scores),
                avg: scores.reduce((a, b) => a + b, 0) / scores.length,
                median: scores.sort()[Math.floor(scores.length / 2)]
            },
            cost_analysis: {
                total: costs.reduce((a, b) => a + b, 0),
                avg_per_call: costs.reduce((a, b) => a + b, 0) / costs.length,
                cost_per_1000_calls: (costs.reduce((a, b) => a + b, 0) / costs.length) * 1000
            },
            status_distribution: this.results.reduce((acc, r) => {
                acc[r.status] = (acc[r.status] || 0) + 1;
                return acc;
            }, {})
        };
    }

    printDetailedAnalysis() {
        const stats = this.getStats();
        const quality = this.generateQualityMetrics();

        console.log('\\n========================================');
        console.log('🧠 AI-POWERED QCI ANALYSIS RESULTS');
        console.log('========================================');
        console.log(`Model: ${CONFIG.MODEL} | Temperature: ${CONFIG.TEMPERATURE}`);
        console.log(`Processed: ${stats.processed}/${CONFIG.TEST_CALLS_COUNT} calls`);
        console.log(`Failed: ${stats.failed} calls`);
        console.log(`Total time: ${stats.totalTime.toFixed(1)}s`);
        console.log(`Avg time per call: ${stats.avgTimePerCall.toFixed(1)}s`);
        console.log(`Total cost: $${stats.totalCost.toFixed(4)}`);
        console.log(`Avg cost per call: $${stats.avgCostPerCall.toFixed(4)}`);
        console.log(`Projected cost for 1000 calls: $${quality.cost_analysis?.cost_per_1000_calls.toFixed(2)}`);

        if (quality.score_distribution) {
            console.log('\\n📊 Quality Metrics:');
            console.log(`Score range: ${quality.score_distribution.min}-${quality.score_distribution.max}`);
            console.log(`Average QCI: ${quality.score_distribution.avg.toFixed(1)}/100`);
            console.log(`Distribution: Pass=${quality.status_distribution.pass || 0}, Review=${quality.status_distribution.review || 0}, Fail=${quality.status_distribution.fail || 0}`);
        }

        console.log('========================================');
    }

    generateQualityReport() {
        console.log('\\n🏆 QUALITY ASSESSMENT REPORT');
        console.log('=====================================');

        const quality = this.generateQualityMetrics();
        let qualityScore = 10; // Start with perfect score

        // Assess various quality factors
        if (this.stats.failed > 0) {
            qualityScore -= 2; // Deduct for failures
            console.log(`❌ ${this.stats.failed} failed analyses (-2 points)`);
        }

        if (quality.score_distribution?.avg < 30) {
            qualityScore -= 3; // Very low scores indicate poor prompting
            console.log(`⚠️ Very low average scores (-3 points)`);
        }

        if (this.stats.avgCostPerCall > 0.02) {
            qualityScore -= 1; // Cost efficiency
            console.log(`💰 High cost per call (-1 point)`);
        }

        console.log(`\\n🎯 Current Quality Score: ${qualityScore}/10`);

        if (qualityScore < 10) {
            console.log('\\n🔧 OPTIMIZATION RECOMMENDATIONS:');
            if (this.stats.failed > 0) console.log('- Improve error handling and prompt stability');
            if (quality.score_distribution?.avg < 30) console.log('- Adjust prompt to be less harsh in scoring');
            if (this.stats.avgCostPerCall > 0.02) console.log('- Consider using gpt-4o-mini for cost optimization');
        } else {
            console.log('\\n✅ EXCELLENT! Ready for production scaling.');
        }

        return qualityScore;
    }
}

// ============================================================
// CLI EXECUTION
// ============================================================

async function main() {
    try {
        const analyzer = new AIQCIAnalyzer();
        const results = await analyzer.runAnalysis();

        console.log('\\n✅ AI-powered QCI analysis completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Analysis failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = AIQCIAnalyzer;