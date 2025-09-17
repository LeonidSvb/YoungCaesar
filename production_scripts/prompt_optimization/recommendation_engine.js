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
        // Path to correlation analysis results
        CORRELATIONS_FILE: 'results/prompt_performance_correlations_latest.json',

        // Path to aggregated assistant data
        ASSISTANT_DATA_FILE: 'results/assistant_aggregated_data_latest.json',

        // Minimum expected QCI improvement for recommendations
        MIN_IMPROVEMENT_TARGET: 15
    },

    // 🤖 OPENAI API SETTINGS
    OPENAI: {
        // Use best model for highest quality recommendations
        MODEL: "gpt-4o",
        TEMPERATURE: 0.1,
        MAX_TOKENS: 4000
    },

    // 🎯 RECOMMENDATION SETTINGS
    RECOMMENDATIONS: {
        // Maximum number of recommendations per assistant
        MAX_RECOMMENDATIONS_PER_ASSISTANT: 5,

        // Include A/B testing suggestions?
        INCLUDE_AB_TESTING_PLANS: true,

        // Generate complete optimized prompts?
        GENERATE_OPTIMIZED_PROMPTS: true,

        // Include implementation priority levels?
        INCLUDE_PRIORITY_LEVELS: true
    },

    // 📊 OUTPUT SETTINGS
    OUTPUT: {
        RESULTS_DIR: 'results',
        VERBOSE: true,
        GENERATE_SUMMARY_REPORT: true
    }
};

// ============================================================
// MAIN SCRIPT - NO NEED TO CHANGE BELOW
// ============================================================

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

class RecommendationEngine {
    constructor() {
        this.assistants = [];
        this.correlations = {};
        this.recommendations = {};
        this.optimizedPrompts = {};
        this.stats = {
            startTime: Date.now(),
            totalCost: 0,
            recommendationsGenerated: 0,
            promptsOptimized: 0
        };
    }

    async loadData() {
        // Load correlation analysis
        const correlationsPath = path.resolve(__dirname, CONFIG.INPUT.CORRELATIONS_FILE);
        if (!fs.existsSync(correlationsPath)) {
            throw new Error(`Correlations file not found: ${correlationsPath}`);
        }
        const correlationsData = JSON.parse(fs.readFileSync(correlationsPath, 'utf8'));
        this.correlations = correlationsData.correlations;

        // Load assistant data
        const assistantPath = path.resolve(__dirname, CONFIG.INPUT.ASSISTANT_DATA_FILE);
        if (!fs.existsSync(assistantPath)) {
            throw new Error(`Assistant data file not found: ${assistantPath}`);
        }
        const assistantData = JSON.parse(fs.readFileSync(assistantPath, 'utf8'));
        this.assistants = assistantData.assistants;

        if (CONFIG.OUTPUT.VERBOSE) {
            console.log(`📊 Loaded data for ${this.assistants.length} assistants`);
            console.log(`🔍 Loaded correlations for ${Object.keys(this.correlations).length} analyses`);
        }
    }

    async generateRecommendations(assistant) {
        const correlation = this.correlations[assistant.id];
        if (!correlation) {
            console.log(`⚠️ No correlation data for ${assistant.name}, skipping`);
            return null;
        }

        const prompt = `
# VAPI ASSISTANT PROMPT OPTIMIZATION TASK

You are an expert in optimizing conversational AI prompts for sales calls. Your task is to generate specific, actionable recommendations to improve this assistant's performance.

## CURRENT ASSISTANT PERFORMANCE:
**Name:** ${assistant.name}
**Current QCI Score:** ${assistant.performance.avg_qci}/100
**Performance Breakdown:**
- Dynamics: ${assistant.performance.avg_dynamics}/30 (conversation flow, engagement)
- Objections: ${assistant.performance.avg_objections}/20 (handling objections, compliance)
- Brand: ${assistant.performance.avg_brand}/20 (brand consistency, messaging)
- Outcome: ${assistant.performance.avg_outcome}/30 (goal achievement, call completion)

**Success Rate:** ${assistant.performance.success_rate}%
**Total Calls Analyzed:** ${assistant.performance.total_calls}

## PERFORMANCE ANALYSIS INSIGHTS:
${JSON.stringify(correlation.analysis, null, 2)}

## OPTIMIZATION GOAL:
Target QCI improvement: +${CONFIG.INPUT.MIN_IMPROVEMENT_TARGET} points (to ${assistant.performance.avg_qci + CONFIG.INPUT.MIN_IMPROVEMENT_TARGET}/100)

## CURRENT PROMPT:
\`\`\`
${assistant.prompt}
\`\`\`

## TASK REQUIREMENTS:

Generate a comprehensive optimization plan with the following JSON structure:

\`\`\`json
{
  "executive_summary": {
    "current_performance": "brief assessment",
    "primary_weaknesses": ["weakness1", "weakness2"],
    "improvement_potential": "expected QCI gain",
    "implementation_complexity": "low/medium/high"
  },
  "priority_recommendations": [
    {
      "priority": "high/medium/low",
      "category": "dynamics/objections/brand/outcome",
      "issue": "specific problem identified",
      "recommendation": "detailed action to take",
      "prompt_section": "which part of prompt to modify",
      "expected_improvement": "predicted QCI gain in this category",
      "implementation": {
        "difficulty": "easy/moderate/complex",
        "specific_changes": "exact text modifications",
        "testing_approach": "how to measure success"
      }
    }
  ],
  "optimized_prompt_sections": [
    {
      "section_name": "introduction/identity/tasks/objections/flow/brand",
      "current_text": "existing text from prompt",
      "optimized_text": "improved version",
      "rationale": "why this is better",
      "expected_impact": "what performance gain this should provide"
    }
  ],
  "ab_testing_plan": {
    "test_scenarios": [
      {
        "test_name": "descriptive name",
        "variable_to_test": "what specific change to test",
        "version_a": "current approach",
        "version_b": "optimized approach",
        "success_metrics": ["metric1", "metric2"],
        "minimum_sample_size": "recommended number of calls"
      }
    ]
  },
  "success_metrics": {
    "primary_kpis": ["main metrics to track"],
    "target_improvements": {
      "qci_total": "target score",
      "dynamics": "target score",
      "objections": "target score",
      "brand": "target score",
      "outcome": "target score"
    },
    "timeline": "expected time to see improvements"
  }
}
\`\`\`

## SPECIAL REQUIREMENTS:

1. **Be Specific**: Provide exact text changes, not general advice
2. **Focus on Data**: Base recommendations on the actual performance analysis provided
3. **Prioritize Impact**: Focus on changes that will yield the highest QCI improvements
4. **Consider Context**: This is for Young Caesar's industrial manufacturing cold calling
5. **Be Actionable**: Every recommendation must be implementable immediately

Focus on the biggest performance gaps and provide concrete solutions.
`;

        try {
            const response = await openai.chat.completions.create({
                model: CONFIG.OPENAI.MODEL,
                messages: [{ role: "user", content: prompt }],
                temperature: CONFIG.OPENAI.TEMPERATURE,
                max_tokens: CONFIG.OPENAI.MAX_TOKENS
            });

            this.stats.totalCost += this.calculateCost(response.usage);
            this.stats.recommendationsGenerated++;

            let jsonContent = response.choices[0].message.content.trim();
            if (jsonContent.includes('```json')) {
                jsonContent = jsonContent.replace(/```json\s*/g, '').replace(/\s*```/g, '').trim();
            }

            return JSON.parse(jsonContent);

        } catch (error) {
            console.error(`❌ Failed to generate recommendations for ${assistant.name}:`, error.message);
            return null;
        }
    }

    async generateOptimizedPrompt(assistant, recommendations) {
        if (!CONFIG.RECOMMENDATIONS.GENERATE_OPTIMIZED_PROMPTS) return null;

        const prompt = `
# COMPLETE PROMPT OPTIMIZATION TASK

Based on the analysis and recommendations provided, create a complete optimized version of this assistant's prompt.

## ORIGINAL PROMPT:
\`\`\`
${assistant.prompt}
\`\`\`

## OPTIMIZATION RECOMMENDATIONS:
${JSON.stringify(recommendations.priority_recommendations, null, 2)}

## OPTIMIZED SECTIONS:
${JSON.stringify(recommendations.optimized_prompt_sections, null, 2)}

## TASK:
Create a complete, optimized prompt that incorporates all the high and medium priority recommendations. The optimized prompt should:

1. Maintain the original structure and Young Caesar branding
2. Implement all specific improvements identified
3. Improve conversation dynamics, objection handling, brand consistency, and outcome achievement
4. Be ready for immediate deployment

Provide the response in this JSON format:

\`\`\`json
{
  "optimized_prompt": "complete optimized prompt text here",
  "key_changes_made": [
    {
      "section": "section modified",
      "change": "what was changed",
      "rationale": "why this improves performance"
    }
  ],
  "deployment_notes": {
    "testing_recommendations": "how to test this prompt",
    "rollout_strategy": "suggested deployment approach",
    "success_metrics": "what to measure"
  }
}
\`\`\`

Focus on creating a prompt that will achieve the target QCI improvement of +${CONFIG.INPUT.MIN_IMPROVEMENT_TARGET} points.
`;

        try {
            const response = await openai.chat.completions.create({
                model: CONFIG.OPENAI.MODEL,
                messages: [{ role: "user", content: prompt }],
                temperature: CONFIG.OPENAI.TEMPERATURE,
                max_tokens: CONFIG.OPENAI.MAX_TOKENS
            });

            this.stats.totalCost += this.calculateCost(response.usage);
            this.stats.promptsOptimized++;

            let jsonContent = response.choices[0].message.content.trim();
            if (jsonContent.includes('```json')) {
                jsonContent = jsonContent.replace(/```json\s*/g, '').replace(/\s*```/g, '').trim();
            }

            return JSON.parse(jsonContent);

        } catch (error) {
            console.error(`❌ Failed to generate optimized prompt for ${assistant.name}:`, error.message);
            return null;
        }
    }

    generateSummaryReport() {
        if (!CONFIG.OUTPUT.GENERATE_SUMMARY_REPORT) return null;

        const assistantSummaries = this.assistants.map(assistant => {
            const recommendations = this.recommendations[assistant.id];
            if (!recommendations) return null;

            return {
                name: assistant.name,
                current_qci: assistant.performance.avg_qci,
                target_qci: assistant.performance.avg_qci + CONFIG.INPUT.MIN_IMPROVEMENT_TARGET,
                primary_weaknesses: recommendations.executive_summary?.primary_weaknesses || [],
                high_priority_recommendations: recommendations.priority_recommendations?.filter(r => r.priority === 'high').length || 0,
                implementation_complexity: recommendations.executive_summary?.implementation_complexity || 'unknown'
            };
        }).filter(summary => summary !== null);

        return {
            overview: {
                total_assistants: this.assistants.length,
                assistants_with_recommendations: assistantSummaries.length,
                avg_current_qci: assistantSummaries.reduce((sum, a) => sum + a.current_qci, 0) / assistantSummaries.length,
                avg_target_qci: assistantSummaries.reduce((sum, a) => sum + a.target_qci, 0) / assistantSummaries.length
            },
            assistant_summaries: assistantSummaries.sort((a, b) => a.current_qci - b.current_qci),
            next_steps: [
                "Review high-priority recommendations for lowest-performing assistants",
                "Implement A/B testing plans for critical improvements",
                "Deploy optimized prompts in test environment",
                "Monitor QCI scores for 1-2 weeks after implementation",
                "Scale successful improvements to other assistants"
            ]
        };
    }

    calculateCost(usage) {
        // GPT-4o pricing: $2.50/1M input, $10.00/1M output
        const inputCost = (usage.prompt_tokens / 1000000) * 2.50;
        const outputCost = (usage.completion_tokens / 1000000) * 10.00;
        return inputCost + outputCost;
    }

    async saveResults() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const filename = `optimization_recommendations_${timestamp}.json`;
        const filepath = path.join(__dirname, CONFIG.OUTPUT.RESULTS_DIR, filename);

        if (!fs.existsSync(path.join(__dirname, CONFIG.OUTPUT.RESULTS_DIR))) {
            fs.mkdirSync(path.join(__dirname, CONFIG.OUTPUT.RESULTS_DIR), { recursive: true });
        }

        const totalTime = (Date.now() - this.stats.startTime) / 1000;
        const summaryReport = this.generateSummaryReport();

        const outputData = {
            metadata: {
                generated_at: new Date().toISOString(),
                processing_time: `${totalTime.toFixed(1)}s`,
                total_cost: `$${this.stats.totalCost.toFixed(4)}`,
                recommendations_generated: this.stats.recommendationsGenerated,
                prompts_optimized: this.stats.promptsOptimized,
                config: CONFIG
            },
            summary_report: summaryReport,
            recommendations: this.recommendations,
            optimized_prompts: this.optimizedPrompts
        };

        fs.writeFileSync(filepath, JSON.stringify(outputData, null, 2));

        console.log(`\n🎉 OPTIMIZATION RECOMMENDATIONS COMPLETE`);
        console.log(`🚀 Generated recommendations for: ${this.stats.recommendationsGenerated} assistants`);
        console.log(`📝 Optimized prompts created: ${this.stats.promptsOptimized}`);
        console.log(`💰 Total cost: $${this.stats.totalCost.toFixed(4)}`);
        console.log(`⏱️ Processing time: ${totalTime.toFixed(1)}s`);
        console.log(`📁 Results: ${filename}`);

        if (summaryReport) {
            console.log(`\n📊 SUMMARY:`);
            console.log(`📈 Average current QCI: ${summaryReport.overview.avg_current_qci.toFixed(1)}/100`);
            console.log(`🎯 Average target QCI: ${summaryReport.overview.avg_target_qci.toFixed(1)}/100`);
            console.log(`📋 Potential improvement: +${(summaryReport.overview.avg_target_qci - summaryReport.overview.avg_current_qci).toFixed(1)} points`);
        }

        return filepath;
    }
}

async function main() {
    const engine = new RecommendationEngine();

    try {
        console.log('🚀 Starting recommendation engine...\n');

        // Load all data
        await engine.loadData();

        // Generate recommendations for each assistant
        console.log('🎯 Generating optimization recommendations...');
        for (let i = 0; i < engine.assistants.length; i++) {
            const assistant = engine.assistants[i];

            if (CONFIG.OUTPUT.VERBOSE) {
                console.log(`📋 Processing ${assistant.name} (${i + 1}/${engine.assistants.length})`);
            }

            // Generate recommendations
            const recommendations = await engine.generateRecommendations(assistant);
            if (recommendations) {
                engine.recommendations[assistant.id] = {
                    assistant_name: assistant.name,
                    current_performance: assistant.performance,
                    ...recommendations
                };

                // Generate optimized prompt if requested
                if (CONFIG.RECOMMENDATIONS.GENERATE_OPTIMIZED_PROMPTS) {
                    const optimizedPrompt = await engine.generateOptimizedPrompt(assistant, recommendations);
                    if (optimizedPrompt) {
                        engine.optimizedPrompts[assistant.id] = {
                            assistant_name: assistant.name,
                            ...optimizedPrompt
                        };
                    }
                }
            }

            // Rate limiting delay
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Save all results
        const resultFile = await engine.saveResults();
        console.log(`\n📍 Results saved to: ${resultFile}`);

    } catch (error) {
        console.error('❌ Recommendation engine failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = RecommendationEngine;