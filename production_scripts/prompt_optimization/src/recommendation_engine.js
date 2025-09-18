#!/usr/bin/env node
/**
 * RECOMMENDATION ENGINE - AI-Powered Prompt Optimization
 *
 * PURPOSE: Generates specific optimization recommendations and improved prompts
 * USAGE: node src/recommendation_engine.js
 * INPUT: ../results/correlations_latest.json
 * OUTPUT: ../results/recommendations_TIMESTAMP.json
 *
 * AUTHOR: VAPI Team
 * CREATED: 2025-09-17
 * VERSION: 2.0.0 (see ../history.txt)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const { createLogger } = require('../../shared/logger');
const { loadPrompt } = require('../../shared/prompt_parser');

const logger = createLogger('RECOMMENDATIONS');

// CONFIGURATION
const CONFIG = {
    INPUT: {
        CORRELATIONS_DATA: '../results/correlations_latest.json'
    },
    OUTPUT: {
        DIR: '../results',
        FILE_PREFIX: 'recommendations'
    },
    AI: {
        MODEL: 'gpt-4o',
        MAX_TOKENS: 6000,
        TEMPERATURE: 0.2
    },
    OPTIONS: {
        TARGET_QCI_IMPROVEMENT: 15,
        FOCUS_ON_HIGH_IMPACT: true
    }
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

class RecommendationEngine {
    constructor() {
        this.correlations = {};
        this.recommendations = {};
        this.stats = {
            startTime: Date.now(),
            totalCost: 0,
            recommendationsGenerated: 0
        };
    }

    async loadCorrelationData() {
        logger.info('Loading correlation analysis data...');

        const dataPath = path.resolve(__dirname, CONFIG.INPUT.CORRELATIONS_DATA);
        if (!fs.existsSync(dataPath)) {
            throw new Error(`Correlation data not found: ${dataPath}`);
        }

        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        this.correlations = data.correlations || {};

        logger.success(`Loaded correlation data for ${Object.keys(this.correlations).length} assistants`);
        return this.correlations;
    }

    async generateRecommendations(assistantId, correlationData) {
        logger.progress(`Generating recommendations for ${correlationData.name}...`);

        try {
            // Calculate target QCI
            const currentQCI = correlationData.performance.avg_qci || 0;
            const targetQCI = Math.min(100, currentQCI + CONFIG.OPTIONS.TARGET_QCI_IMPROVEMENT);

            // Load prompt template from prompts.md
            const promptsPath = path.resolve(__dirname, '../prompts.md');
            const prompt = loadPrompt(promptsPath, 'RECOMMENDATION_GENERATION', {
                assistant_name: correlationData.name,
                avg_qci: currentQCI,
                total_calls: correlationData.performance.total_calls,
                avg_dynamics: correlationData.performance.avg_dynamics || 0,
                avg_objections: correlationData.performance.avg_objections || 0,
                avg_brand: correlationData.performance.avg_brand || 0,
                avg_outcome: correlationData.performance.avg_outcome || 0,
                correlation_analysis: JSON.stringify(correlationData.structural_analysis, null, 2),
                current_prompt: this.getAssistantPrompt(assistantId),
                current_qci: currentQCI,
                target_qci: targetQCI,
                improvement_points: CONFIG.OPTIONS.TARGET_QCI_IMPROVEMENT
            });

            const response = await openai.chat.completions.create({
                model: CONFIG.AI.MODEL,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: CONFIG.AI.MAX_TOKENS,
                temperature: CONFIG.AI.TEMPERATURE
            });

            const content = response.choices[0].message.content;
            this.updateCostStats(response.usage);

            return this.parseRecommendationResponse(content);

        } catch (error) {
            logger.error(`Recommendation generation failed for ${correlationData.name}: ${error.message}`);
            return null;
        }
    }

    getAssistantPrompt(assistantId) {
        // In a real implementation, this would fetch the current prompt
        // For now, return a placeholder
        return this.correlations[assistantId]?.current_prompt || 'Prompt not available';
    }

    parseRecommendationResponse(content) {
        try {
            // Clean response - remove markdown blocks if present
            const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) ||
                             content.match(/```\n([\s\S]*?)\n```/) ||
                             [null, content];

            const jsonString = jsonMatch[1] || content;
            return JSON.parse(jsonString.trim());

        } catch (error) {
            logger.warning('Failed to parse recommendation response, attempting extraction...');

            // Try to extract JSON from the response
            const jsonStartIndex = content.indexOf('{');
            const jsonEndIndex = content.lastIndexOf('}');

            if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
                try {
                    const extractedJson = content.substring(jsonStartIndex, jsonEndIndex + 1);
                    return JSON.parse(extractedJson);
                } catch (fallbackError) {
                    logger.error('Fallback JSON parsing failed');
                }
            }

            return {
                error: 'Failed to parse AI response',
                raw_response: content.substring(0, 500)
            };
        }
    }

    updateCostStats(usage) {
        // GPT-4o pricing: $5/1M input, $15/1M output tokens
        const inputCost = (usage.prompt_tokens / 1000000) * 5;
        const outputCost = (usage.completion_tokens / 1000000) * 15;
        this.stats.totalCost += inputCost + outputCost;
        this.stats.recommendationsGenerated++;
    }

    async generateAllRecommendations() {
        logger.info('Generating optimization recommendations...');

        for (const [assistantId, correlationData] of Object.entries(this.correlations)) {
            const recommendations = await this.generateRecommendations(assistantId, correlationData);

            if (recommendations && !recommendations.error) {
                this.recommendations[assistantId] = {
                    assistant_name: correlationData.name,
                    current_performance: correlationData.performance,
                    recommendations: recommendations,
                    generated_at: new Date().toISOString()
                };

                logger.success(`✅ Recommendations generated for ${correlationData.name}`);
            } else {
                logger.error(`❌ Failed to generate recommendations for ${correlationData.name}`);
            }

            // Rate limiting
            await this.sleep(1500);
        }
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    generateExecutiveSummary() {
        logger.info('Generating executive summary...');

        const assistantCount = Object.keys(this.recommendations).length;
        const totalImprovementPotential = assistantCount * CONFIG.OPTIONS.TARGET_QCI_IMPROVEMENT;

        const highPriorityIssues = [];
        const quickWins = [];

        Object.values(this.recommendations).forEach(rec => {
            if (rec.recommendations.priority_recommendations) {
                rec.recommendations.priority_recommendations.forEach(item => {
                    if (item.priority === 'HIGH') {
                        highPriorityIssues.push({
                            assistant: rec.assistant_name,
                            issue: item.title,
                            impact: item.expected_impact
                        });
                    }

                    if (item.implementation === 'Easy') {
                        quickWins.push({
                            assistant: rec.assistant_name,
                            action: item.title,
                            impact: item.expected_impact
                        });
                    }
                });
            }
        });

        return {
            overview: {
                assistants_optimized: assistantCount,
                total_improvement_potential: `+${totalImprovementPotential} QCI points`,
                high_priority_issues: highPriorityIssues.length,
                quick_wins_available: quickWins.length
            },
            high_priority_issues: highPriorityIssues.slice(0, 5),
            quick_wins: quickWins.slice(0, 5),
            next_steps: [
                'Review high-priority recommendations',
                'Implement quick wins first',
                'Set up A/B testing framework',
                'Monitor QCI improvements weekly'
            ]
        };
    }

    async generateReport() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const outputFile = `${CONFIG.OUTPUT.FILE_PREFIX}_${timestamp}.json`;
        const outputPath = path.resolve(__dirname, CONFIG.OUTPUT.DIR, outputFile);

        // Ensure output directory exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const executiveSummary = this.generateExecutiveSummary();

        const report = {
            metadata: {
                generated_at: new Date().toISOString(),
                assistants_processed: Object.keys(this.correlations).length,
                recommendations_generated: this.stats.recommendationsGenerated,
                total_cost: this.stats.totalCost.toFixed(4),
                processing_time: ((Date.now() - this.stats.startTime) / 1000).toFixed(1) + 's',
                ai_model: CONFIG.AI.MODEL,
                target_improvement: `+${CONFIG.OPTIONS.TARGET_QCI_IMPROVEMENT} QCI points`
            },
            executive_summary: executiveSummary,
            recommendations: this.recommendations
        };

        fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

        logger.success('Recommendations generation complete!');
        logger.info(`📊 Assistants processed: ${Object.keys(this.correlations).length}`);
        logger.info(`✅ Recommendations generated: ${this.stats.recommendationsGenerated}`);
        logger.cost(this.stats.totalCost);
        logger.timing(((Date.now() - this.stats.startTime) / 1000).toFixed(1), 'seconds');
        logger.success(`📁 Results saved: ${outputPath}`);

        return outputPath;
    }
}

// MAIN EXECUTION
async function main() {
    try {
        const engine = new RecommendationEngine();

        await engine.loadCorrelationData();
        await engine.generateAllRecommendations();

        return await engine.generateReport();
    } catch (error) {
        logger.error(`Recommendation generation failed: ${error.message}`);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = RecommendationEngine;