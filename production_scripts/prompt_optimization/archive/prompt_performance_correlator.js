require('dotenv').config({ path: '../../.env' });
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

// ============================================================
// CONFIGURATION - CHANGE ALL SETTINGS HERE
// ============================================================

const CONFIG = {
    // 📁 INPUT DATA
    INPUT: {
        // Path to aggregated assistant data (from assistant_data_aggregator)
        ASSISTANT_DATA_FILE: 'results/assistant_aggregated_data_latest.json',

        // Minimum QCI difference to identify as significant pattern
        MIN_QCI_DIFFERENCE: 15
    },

    // 🤖 OPENAI API SETTINGS
    OPENAI: {
        // Model for prompt analysis
        // Use best model for highest quality analysis
        MODEL: "gpt-4o",
        TEMPERATURE: 0.1,
        MAX_TOKENS: 3000
    },

    // 🔍 ANALYSIS SETTINGS
    ANALYSIS: {
        // Focus on specific QCI categories for correlation
        FOCUS_CATEGORIES: ['dynamics', 'objections', 'brand', 'outcome'],

        // Include competitive analysis between assistants?
        INCLUDE_COMPARATIVE_ANALYSIS: true,

        // Analyze successful patterns from high-performers?
        ANALYZE_SUCCESS_PATTERNS: true
    },

    // 📊 OUTPUT SETTINGS
    OUTPUT: {
        RESULTS_DIR: 'results',
        VERBOSE: true,
        INCLUDE_RAW_ANALYSIS: true
    }
};

// ============================================================
// MAIN SCRIPT - NO NEED TO CHANGE BELOW
// ============================================================

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

class PromptPerformanceCorrelator {
    constructor() {
        this.assistants = [];
        this.correlations = {};
        this.patterns = {
            high_performance: [],
            low_performance: [],
            category_specific: {}
        };
        this.stats = {
            startTime: Date.now(),
            totalCost: 0,
            analysisCount: 0
        };
    }

    async loadAssistantData() {
        const dataPath = path.resolve(__dirname, CONFIG.INPUT.ASSISTANT_DATA_FILE);

        if (!fs.existsSync(dataPath)) {
            throw new Error(`Assistant data file not found: ${dataPath}`);
        }

        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        this.assistants = data.assistants;

        if (CONFIG.OUTPUT.VERBOSE) {
            console.log(`📊 Loaded data for ${this.assistants.length} assistants`);
        }

        return this.assistants;
    }

    async analyzePromptStructure(assistant) {
        const prompt = `
# PROMPT STRUCTURE ANALYSIS TASK

You are an expert in analyzing conversational AI prompts for sales calls. Analyze the given assistant prompt and identify specific structural elements and their potential impact on call performance.

## ASSISTANT DATA:
**Name:** ${assistant.name}
**Average QCI Score:** ${assistant.performance.avg_qci}/100
**Performance Breakdown:**
- Dynamics: ${assistant.performance.avg_dynamics}/30
- Objections: ${assistant.performance.avg_objections}/20
- Brand: ${assistant.performance.avg_brand}/20
- Outcome: ${assistant.performance.avg_outcome}/30

**Success Rate:** ${assistant.performance.success_rate}%
**Total Calls:** ${assistant.performance.total_calls}

## PROMPT TO ANALYZE:
\`\`\`
${assistant.prompt}
\`\`\`

## ANALYSIS REQUIREMENTS:

Analyze this prompt and provide a JSON response with the following structure:

\`\`\`json
{
  "prompt_structure": {
    "introduction_section": {
      "present": true/false,
      "quality": "excellent/good/fair/poor",
      "key_elements": ["element1", "element2"],
      "potential_impact_on_dynamics": "explanation"
    },
    "identity_definition": {
      "clarity": "high/medium/low",
      "personality_traits": ["trait1", "trait2"],
      "brand_alignment": "strong/moderate/weak"
    },
    "task_instructions": {
      "specificity": "high/medium/low",
      "actionable_steps": ["step1", "step2"],
      "outcome_focus": "clear/moderate/unclear"
    },
    "objection_handling": {
      "instructions_present": true/false,
      "techniques_mentioned": ["technique1", "technique2"],
      "effectiveness_prediction": "high/medium/low"
    },
    "conversation_flow": {
      "structure_clarity": "high/medium/low",
      "natural_flow_elements": ["element1", "element2"],
      "potential_dynamics_issues": ["issue1", "issue2"]
    },
    "brand_messaging": {
      "company_mention": "prominent/moderate/minimal",
      "value_proposition": "clear/unclear/missing",
      "consistency_level": "high/medium/low"
    }
  },
  "performance_correlations": {
    "likely_strengths": [
      {
        "category": "dynamics/objections/brand/outcome",
        "strength": "specific strength",
        "prompt_section": "which part of prompt",
        "confidence": "high/medium/low"
      }
    ],
    "likely_weaknesses": [
      {
        "category": "dynamics/objections/brand/outcome",
        "weakness": "specific weakness",
        "prompt_section": "which part of prompt",
        "confidence": "high/medium/low"
      }
    ]
  },
  "optimization_opportunities": [
    {
      "category": "dynamics/objections/brand/outcome",
      "current_issue": "what's wrong",
      "suggested_improvement": "specific suggestion",
      "expected_impact": "predicted improvement"
    }
  ]
}
\`\`\`

Focus on correlating prompt elements with the actual performance scores provided. Be specific and actionable in your analysis.
`;

        try {
            const response = await openai.chat.completions.create({
                model: CONFIG.OPENAI.MODEL,
                messages: [{ role: "user", content: prompt }],
                temperature: CONFIG.OPENAI.TEMPERATURE,
                max_tokens: CONFIG.OPENAI.MAX_TOKENS
            });

            this.stats.totalCost += this.calculateCost(response.usage);
            this.stats.analysisCount++;

            let jsonContent = response.choices[0].message.content.trim();
            if (jsonContent.includes('```json')) {
                jsonContent = jsonContent.replace(/```json\s*/g, '').replace(/\s*```/g, '').trim();
            }

            return JSON.parse(jsonContent);

        } catch (error) {
            console.error(`❌ Failed to analyze ${assistant.name}:`, error.message);
            return null;
        }
    }

    async performComparativeAnalysis() {
        if (!CONFIG.ANALYSIS.INCLUDE_COMPARATIVE_ANALYSIS || this.assistants.length < 2) {
            return null;
        }

        // Sort assistants by performance
        const sortedAssistants = [...this.assistants].sort((a, b) =>
            b.performance.avg_qci - a.performance.avg_qci
        );

        const topPerformer = sortedAssistants[0];
        const bottomPerformer = sortedAssistants[sortedAssistants.length - 1];

        const prompt = `
# COMPARATIVE PROMPT ANALYSIS

Compare these two assistant prompts and identify key differences that may explain their performance gap.

## TOP PERFORMER: ${topPerformer.name}
**QCI Score:** ${topPerformer.performance.avg_qci}/100
**Performance:** Dynamics(${topPerformer.performance.avg_dynamics}), Objections(${topPerformer.performance.avg_objections}), Brand(${topPerformer.performance.avg_brand}), Outcome(${topPerformer.performance.avg_outcome})

**Prompt:**
\`\`\`
${topPerformer.prompt}
\`\`\`

## BOTTOM PERFORMER: ${bottomPerformer.name}
**QCI Score:** ${bottomPerformer.performance.avg_qci}/100
**Performance:** Dynamics(${bottomPerformer.performance.avg_dynamics}), Objections(${bottomPerformer.performance.avg_objections}), Brand(${bottomPerformer.performance.avg_brand}), Outcome(${bottomPerformer.performance.avg_outcome})

**Prompt:**
\`\`\`
${bottomPerformer.prompt}
\`\`\`

## ANALYSIS TASK:

Provide a JSON response analyzing the key differences:

\`\`\`json
{
  "performance_gap": {
    "qci_difference": ${topPerformer.performance.avg_qci - bottomPerformer.performance.avg_qci},
    "biggest_category_gaps": [
      {
        "category": "category_name",
        "top_score": number,
        "bottom_score": number,
        "difference": number
      }
    ]
  },
  "key_prompt_differences": [
    {
      "aspect": "what's different",
      "top_performer_approach": "how top does it",
      "bottom_performer_approach": "how bottom does it",
      "likely_impact": "why this matters for performance"
    }
  ],
  "success_factors": [
    {
      "factor": "what top performer does well",
      "evidence": "specific prompt section",
      "category_impact": "which QCI category this helps"
    }
  ],
  "failure_patterns": [
    {
      "pattern": "what bottom performer lacks/does wrong",
      "evidence": "specific prompt section or absence",
      "category_impact": "which QCI category this hurts"
    }
  ]
}
\`\`\`
`;

        try {
            const response = await openai.chat.completions.create({
                model: CONFIG.OPENAI.MODEL,
                messages: [{ role: "user", content: prompt }],
                temperature: CONFIG.OPENAI.TEMPERATURE,
                max_tokens: CONFIG.OPENAI.MAX_TOKENS
            });

            this.stats.totalCost += this.calculateCost(response.usage);

            let jsonContent = response.choices[0].message.content.trim();
            if (jsonContent.includes('```json')) {
                jsonContent = jsonContent.replace(/```json\s*/g, '').replace(/\s*```/g, '').trim();
            }

            return JSON.parse(jsonContent);

        } catch (error) {
            console.error('❌ Comparative analysis failed:', error.message);
            return null;
        }
    }

    identifySuccessPatterns() {
        if (!CONFIG.ANALYSIS.ANALYZE_SUCCESS_PATTERNS) return;

        // Group assistants by performance tier
        const avgQCI = this.assistants.reduce((sum, a) => sum + a.performance.avg_qci, 0) / this.assistants.length;

        this.patterns.high_performance = this.assistants.filter(a => a.performance.avg_qci > avgQCI + 10);
        this.patterns.low_performance = this.assistants.filter(a => a.performance.avg_qci < avgQCI - 10);

        // Analyze category-specific patterns
        CONFIG.ANALYSIS.FOCUS_CATEGORIES.forEach(category => {
            const avgScore = this.assistants.reduce((sum, a) => sum + a.performance[`avg_${category}`], 0) / this.assistants.length;

            this.patterns.category_specific[category] = {
                high_performers: this.assistants.filter(a => a.performance[`avg_${category}`] > avgScore + 3),
                low_performers: this.assistants.filter(a => a.performance[`avg_${category}`] < avgScore - 3),
                average_score: avgScore
            };
        });
    }

    calculateCost(usage) {
        // GPT-4o pricing: $2.50/1M input, $10.00/1M output
        const inputCost = (usage.prompt_tokens / 1000000) * 2.50;
        const outputCost = (usage.completion_tokens / 1000000) * 10.00;
        return inputCost + outputCost;
    }

    async saveResults() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const filename = `prompt_performance_correlations_${timestamp}.json`;
        const filepath = path.join(__dirname, CONFIG.OUTPUT.RESULTS_DIR, filename);

        if (!fs.existsSync(path.join(__dirname, CONFIG.OUTPUT.RESULTS_DIR))) {
            fs.mkdirSync(path.join(__dirname, CONFIG.OUTPUT.RESULTS_DIR), { recursive: true });
        }

        const totalTime = (Date.now() - this.stats.startTime) / 1000;

        const outputData = {
            metadata: {
                generated_at: new Date().toISOString(),
                processing_time: `${totalTime.toFixed(1)}s`,
                total_cost: `$${this.stats.totalCost.toFixed(4)}`,
                analyses_performed: this.stats.analysisCount,
                config: CONFIG
            },
            correlations: this.correlations,
            patterns: this.patterns,
            assistants_analyzed: this.assistants.length
        };

        fs.writeFileSync(filepath, JSON.stringify(outputData, null, 2));

        // Create latest symlink
        const latestPath = path.join(__dirname, CONFIG.OUTPUT.RESULTS_DIR, 'prompt_performance_correlations_latest.json');
        if (fs.existsSync(latestPath)) {
            fs.unlinkSync(latestPath);
        }
        fs.copyFileSync(filepath, latestPath);

        console.log(`\n🎉 CORRELATION ANALYSIS COMPLETE`);
        console.log(`🔍 Analyzed: ${this.stats.analysisCount} assistants`);
        console.log(`💰 Total cost: $${this.stats.totalCost.toFixed(4)}`);
        console.log(`⏱️ Processing time: ${totalTime.toFixed(1)}s`);
        console.log(`📁 Results: ${filename}`);

        return filepath;
    }
}

async function main() {
    const correlator = new PromptPerformanceCorrelator();

    try {
        console.log('🚀 Starting prompt-performance correlation analysis...\n');

        // Load assistant data
        await correlator.loadAssistantData();

        // Identify patterns first
        correlator.identifySuccessPatterns();

        // Analyze each assistant's prompt
        console.log('🔍 Analyzing individual assistant prompts...');
        for (let i = 0; i < correlator.assistants.length; i++) {
            const assistant = correlator.assistants[i];

            if (CONFIG.OUTPUT.VERBOSE) {
                console.log(`📋 Analyzing ${assistant.name} (${i + 1}/${correlator.assistants.length})`);
            }

            const analysis = await correlator.analyzePromptStructure(assistant);
            if (analysis) {
                correlator.correlations[assistant.id] = {
                    assistant_name: assistant.name,
                    performance: assistant.performance,
                    analysis: analysis
                };
            }

            // Small delay to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Perform comparative analysis
        if (CONFIG.ANALYSIS.INCLUDE_COMPARATIVE_ANALYSIS) {
            console.log('🔄 Performing comparative analysis...');
            const comparison = await correlator.performComparativeAnalysis();
            if (comparison) {
                correlator.correlations.comparative_analysis = comparison;
            }
        }

        // Save results
        const resultFile = await correlator.saveResults();
        console.log(`\n📍 Results saved to: ${resultFile}`);

    } catch (error) {
        console.error('❌ Correlation analysis failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = PromptPerformanceCorrelator;