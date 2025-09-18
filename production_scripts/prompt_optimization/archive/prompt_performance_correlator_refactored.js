#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

// ИМПОРТ ЦЕНТРАЛИЗОВАННОГО ЗАГРУЗЧИКА ПРОМПТОВ
const { loadOptimizationPrompt } = require('../../prompts/shared/prompt_loader');

// КОНФИГУРАЦИЯ
const CONFIG = {
    INPUT: {
        ASSISTANT_DATA_FILE: './results/assistant_aggregated_data_latest.json'
    },
    OUTPUT: {
        CORRELATIONS_FILE: './results/prompt_performance_correlations_latest.json',
        VERBOSE: true
    },
    AI: {
        MODEL: 'gpt-4o',
        MAX_TOKENS: 4000,
        TEMPERATURE: 0.1
    }
};

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
        // ЗАГРУЖАЕМ ПРОМПТ ИЗ ЦЕНТРАЛИЗОВАННОЙ ПАПКИ
        const promptTemplate = loadOptimizationPrompt('prompt_structure_analysis');

        // ПОДСТАВЛЯЕМ ПЕРЕМЕННЫЕ
        const prompt = promptTemplate
            .replace('{assistant_name}', assistant.name)
            .replace('{avg_qci}', assistant.performance.avg_qci)
            .replace('{avg_dynamics}', assistant.performance.avg_dynamics)
            .replace('{avg_objections}', assistant.performance.avg_objections)
            .replace('{avg_brand}', assistant.performance.avg_brand)
            .replace('{avg_outcome}', assistant.performance.avg_outcome)
            .replace('{total_calls}', assistant.performance.total_calls)
            .replace('{sample_calls}', this.formatSampleCalls(assistant.sample_calls))
            .replace('{assistant_prompt}', assistant.prompt);

        try {
            const response = await openai.chat.completions.create({
                model: CONFIG.AI.MODEL,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: CONFIG.AI.MAX_TOKENS,
                temperature: CONFIG.AI.TEMPERATURE
            });

            const content = response.choices[0].message.content;
            this.stats.totalCost += this.calculateCost(response.usage);
            this.stats.analysisCount++;

            return this.parseAIResponse(content);
        } catch (error) {
            console.error(`❌ Failed to analyze ${assistant.name}:`, error.message);
            return null;
        }
    }

    formatSampleCalls(sampleCalls) {
        if (!sampleCalls || sampleCalls.length === 0) {
            return "No sample calls available";
        }

        return sampleCalls.map((call, index) => {
            return `**Call ${index + 1} (QCI: ${call.qci_total_score}):**\n${call.transcript_snippet}`;
        }).join('\n\n');
    }

    parseAIResponse(content) {
        try {
            // Очищаем от markdown блоков если есть
            const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) ||
                             content.match(/```\n([\s\S]*?)\n```/) ||
                             [null, content];

            const jsonString = jsonMatch[1] || content;
            return JSON.parse(jsonString.trim());
        } catch (error) {
            console.error('❌ Failed to parse AI response:', error.message);
            console.log('Raw response:', content);
            return null;
        }
    }

    calculateCost(usage) {
        // GPT-4o pricing: $5/1M input, $15/1M output tokens
        const inputCost = (usage.prompt_tokens / 1000000) * 5;
        const outputCost = (usage.completion_tokens / 1000000) * 15;
        return inputCost + outputCost;
    }

    async analyzeCorrelations() {
        console.log('🔍 Starting prompt structure analysis...');

        for (const assistant of this.assistants) {
            if (CONFIG.OUTPUT.VERBOSE) {
                console.log(`📋 Analyzing ${assistant.name}...`);
            }

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
                if (assistant.performance.avg_qci >= 50) {
                    this.patterns.high_performance.push({
                        id: assistant.id,
                        name: assistant.name,
                        qci: assistant.performance.avg_qci,
                        key_strengths: analysis.structural_analysis
                    });
                } else {
                    this.patterns.low_performance.push({
                        id: assistant.id,
                        name: assistant.name,
                        qci: assistant.performance.avg_qci,
                        key_weaknesses: analysis.performance_correlations
                    });
                }
            }

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    async generateReport() {
        const report = {
            metadata: {
                generated_at: new Date().toISOString(),
                assistants_analyzed: this.assistants.length,
                total_cost: this.stats.totalCost.toFixed(4),
                processing_time: ((Date.now() - this.stats.startTime) / 1000).toFixed(1) + 's'
            },
            correlations: this.correlations,
            patterns: this.patterns,
            insights: this.generateKeyInsights()
        };

        // Сохраняем результат
        const outputPath = path.resolve(__dirname, CONFIG.OUTPUT.CORRELATIONS_FILE);
        fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

        console.log(`✅ Analysis complete!`);
        console.log(`📊 Assistants analyzed: ${this.assistants.length}`);
        console.log(`💰 Total cost: $${this.stats.totalCost.toFixed(4)}`);
        console.log(`⏱️ Processing time: ${((Date.now() - this.stats.startTime) / 1000).toFixed(1)}s`);
        console.log(`📁 Results saved: ${outputPath}`);

        return report;
    }

    generateKeyInsights() {
        const insights = [];

        // Анализ высокопроизводительных ассистентов
        if (this.patterns.high_performance.length > 0) {
            insights.push({
                type: 'high_performance_pattern',
                title: 'Common Success Patterns',
                description: `${this.patterns.high_performance.length} high-performing assistants show consistent patterns`,
                assistants: this.patterns.high_performance.map(p => ({ name: p.name, qci: p.qci }))
            });
        }

        // Анализ низкопроизводительных ассистентов
        if (this.patterns.low_performance.length > 0) {
            insights.push({
                type: 'improvement_opportunities',
                title: 'Key Improvement Areas',
                description: `${this.patterns.low_performance.length} assistants need optimization`,
                assistants: this.patterns.low_performance.map(p => ({ name: p.name, qci: p.qci }))
            });
        }

        return insights;
    }
}

// ОСНОВНАЯ ФУНКЦИЯ
async function main() {
    try {
        const correlator = new PromptPerformanceCorrelator();

        await correlator.loadAssistantData();
        await correlator.analyzeCorrelations();
        const report = await correlator.generateReport();

        return report;
    } catch (error) {
        console.error('❌ Error in prompt performance correlation:', error);
        process.exit(1);
    }
}

// ЗАПУСК ЕСЛИ ВЫЗВАН НАПРЯМУЮ
if (require.main === module) {
    main();
}

module.exports = PromptPerformanceCorrelator;