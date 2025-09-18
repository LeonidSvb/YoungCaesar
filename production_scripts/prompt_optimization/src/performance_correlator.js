#!/usr/bin/env node
/**
 * PERFORMANCE CORRELATOR - Prompt-Performance Analysis Engine
 *
 * PURPOSE: Analyzes correlations between prompt structure and QCI performance
 * USAGE: node src/performance_correlator.js
 * INPUT: ../results/aggregated_data_latest.json
 * OUTPUT: ../results/correlations_TIMESTAMP.json
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

const logger = createLogger('CORRELATOR');

// CONFIGURATION
const CONFIG = {
    INPUT: {
        AGGREGATED_DATA: '../results/aggregated_data_latest.json'
    },
    OUTPUT: {
        DIR: '../results',
        FILE_PREFIX: 'correlations'
    },
    AI: {
        MODEL: 'gpt-4o',
        MAX_TOKENS: 4000,
        TEMPERATURE: 0.1
    },
    OPTIONS: {
        BATCH_SIZE: 5,
        ENABLE_BATCH_MODE: false
    }
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

class PerformanceCorrelator {
    constructor() {
        this.assistants = [];
        this.correlations = {};
        this.patterns = {
            high_performance: [],
            low_performance: [],
            insights: []
        };
        this.stats = {
            startTime: Date.now(),
            totalCost: 0,
            analysisCount: 0
        };
    }

    async loadAssistantData() {
        logger.info('Loading assistant data...');

        const dataPath = path.resolve(__dirname, CONFIG.INPUT.AGGREGATED_DATA);
        if (!fs.existsSync(dataPath)) {
            throw new Error(`Aggregated data not found: ${dataPath}`);
        }

        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        this.assistants = data.assistants || [];

        logger.success(`Loaded data for ${this.assistants.length} assistants`);
        return this.assistants;
    }

    async analyzePromptStructure(assistant) {
        logger.progress(`Analyzing ${assistant.name}...`);

        try {
            // Load prompt template from prompts.md
            const promptsPath = path.resolve(__dirname, '../prompts.md');
            const prompt = loadPrompt(promptsPath, 'STRUCTURE_ANALYSIS', {
                assistant_name: assistant.name,
                avg_qci: assistant.performance.avg_qci || 0,
                avg_dynamics: assistant.performance.avg_dynamics || 0,
                avg_objections: assistant.performance.avg_objections || 0,
                avg_brand: assistant.performance.avg_brand || 0,
                avg_outcome: assistant.performance.avg_outcome || 0,
                total_calls: assistant.performance.total_calls,
                sample_calls: this.formatSampleCalls(assistant.sample_calls),
                assistant_prompt: assistant.prompt
            });

            const response = await openai.chat.completions.create({
                model: CONFIG.AI.MODEL,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: CONFIG.AI.MAX_TOKENS,
                temperature: CONFIG.AI.TEMPERATURE
            });

            const content = response.choices[0].message.content;
            this.updateCostStats(response.usage);

            return this.parseAIResponse(content);

        } catch (error) {
            logger.error(`Analysis failed for ${assistant.name}: ${error.message}`);
            return null;
        }
    }

    formatSampleCalls(sampleCalls) {
        if (!sampleCalls || sampleCalls.length === 0) {
            return "No sample calls available";
        }

        return sampleCalls.map((call, index) => {
            const qciScore = call.qci_score || call.qci_total_score || 'N/A';
            const transcript = call.transcript ?
                call.transcript.substring(0, 500) + (call.transcript.length > 500 ? '...' : '') :
                'No transcript available';

            return `**Call ${index + 1} (QCI: ${qciScore}):**\n${transcript}`;
        }).join('\n\n');
    }

    parseAIResponse(content) {
        try {
            // Clean response - remove markdown blocks if present
            const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) ||
                             content.match(/```\n([\s\S]*?)\n```/) ||
                             [null, content];

            const jsonString = jsonMatch[1] || content;
            return JSON.parse(jsonString.trim());

        } catch (error) {
            logger.warning('Failed to parse AI response as JSON, attempting fallback...');

            // Try to extract just the JSON part
            const jsonStartIndex = content.indexOf('{');
            const jsonEndIndex = content.lastIndexOf('}');

            if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
                try {
                    const extractedJson = content.substring(jsonStartIndex, jsonEndIndex + 1);
                    return JSON.parse(extractedJson);
                } catch (fallbackError) {
                    logger.error('Fallback JSON parsing also failed');
                }
            }

            return null;
        }
    }

    updateCostStats(usage) {
        // GPT-4o pricing: $5/1M input, $15/1M output tokens
        const inputCost = (usage.prompt_tokens / 1000000) * 5;
        const outputCost = (usage.completion_tokens / 1000000) * 15;
        this.stats.totalCost += inputCost + outputCost;
        this.stats.analysisCount++;
    }

    async analyzeAllCorrelations() {
        logger.info('Starting prompt correlation analysis...');

        for (const assistant of this.assistants) {
            const analysis = await this.analyzePromptStructure(assistant);

            if (analysis) {
                this.correlations[assistant.id] = {
                    name: assistant.name,
                    performance: assistant.performance,
                    structural_analysis: analysis.structural_analysis,
                    performance_correlations: analysis.performance_correlations,
                    evidence_based_insights: analysis.evidence_based_insights
                };

                // Categorize by performance
                this.categorizeAssistant(assistant, analysis);
            }

            // Rate limiting
            await this.sleep(1000);
        }
    }

    categorizeAssistant(assistant, analysis) {
        const avgQCI = assistant.performance.avg_qci || 0;

        const assistantInfo = {
            id: assistant.id,
            name: assistant.name,
            qci: avgQCI,
            main_strength: analysis.performance_correlations?.key_strength,
            main_weakness: analysis.performance_correlations?.primary_weakness
        };

        if (avgQCI >= 50) {
            this.patterns.high_performance.push(assistantInfo);
        } else {
            this.patterns.low_performance.push(assistantInfo);
        }
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    generateInsights() {
        logger.info('Generating cross-assistant insights...');

        const insights = [];

        // High performers analysis
        if (this.patterns.high_performance.length > 0) {
            insights.push({
                type: 'high_performance_patterns',
                title: 'Common Success Patterns',
                description: `${this.patterns.high_performance.length} high-performing assistants (QCI ≥50)`,
                assistants: this.patterns.high_performance.map(a => ({
                    name: a.name,
                    qci: a.qci,
                    strength: a.main_strength
                }))
            });
        }

        // Low performers analysis
        if (this.patterns.low_performance.length > 0) {
            insights.push({
                type: 'improvement_opportunities',
                title: 'Critical Improvement Areas',
                description: `${this.patterns.low_performance.length} assistants need optimization (QCI <50)`,
                assistants: this.patterns.low_performance.map(a => ({
                    name: a.name,
                    qci: a.qci,
                    weakness: a.main_weakness
                }))
            });
        }

        // Overall patterns
        if (this.assistants.length > 2) {
            const avgQCI = this.assistants.reduce((sum, a) => sum + (a.performance.avg_qci || 0), 0) / this.assistants.length;

            insights.push({
                type: 'overall_performance',
                title: 'Performance Overview',
                description: `Average QCI across all assistants: ${avgQCI.toFixed(1)}`,
                metrics: {
                    total_assistants: this.assistants.length,
                    average_qci: avgQCI,
                    high_performers: this.patterns.high_performance.length,
                    need_improvement: this.patterns.low_performance.length
                }
            });
        }

        this.patterns.insights = insights;
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

        const report = {
            metadata: {
                generated_at: new Date().toISOString(),
                assistants_analyzed: this.assistants.length,
                successful_analyses: this.stats.analysisCount,
                total_cost: this.stats.totalCost.toFixed(4),
                processing_time: ((Date.now() - this.stats.startTime) / 1000).toFixed(1) + 's',
                ai_model: CONFIG.AI.MODEL
            },
            correlations: this.correlations,
            patterns: this.patterns
        };

        fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

        logger.success('Correlation analysis complete!');
        logger.info(`📊 Assistants analyzed: ${this.assistants.length}`);
        logger.info(`✅ Successful analyses: ${this.stats.analysisCount}`);
        logger.cost(this.stats.totalCost);
        logger.timing(((Date.now() - this.stats.startTime) / 1000).toFixed(1), 'seconds');
        logger.success(`📁 Results saved: ${outputPath}`);

        return outputPath;
    }
}

// MAIN EXECUTION
async function main() {
    try {
        const correlator = new PerformanceCorrelator();

        await correlator.loadAssistantData();
        await correlator.analyzeAllCorrelations();
        correlator.generateInsights();

        return await correlator.generateReport();
    } catch (error) {
        logger.error(`Correlation analysis failed: ${error.message}`);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = PerformanceCorrelator;