require('dotenv').config();

const fs = require('fs').promises;
const path = require('path');
const OpenAI = require('openai');

const CallParser = require('./utils/call_parser');
const ParallelProcessor = require('./utils/parallel_processor');
const QCICalculator = require('./utils/qci_calculator');
const { QCI_CONFIG } = require('./config/qci_config');
const { OPENAI_CONFIG } = require('./config/openai_config');
const { LEXICONS } = require('./config/lexicons');

const DataUtils = require('../../scripts/utils/data_utils');
const Logger = require('../../scripts/utils/logger');

const logger = new Logger('qci_analysis.log');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

class QCIAnalyzer {
    constructor(config = {}) {
        this.config = {
            ...QCI_CONFIG.DEFAULT,
            ...config
        };

        this.processor = new ParallelProcessor({
            batchSize: this.config.batchSize,
            maxConcurrent: this.config.maxConcurrent,
            retryAttempts: this.config.retryAttempts
        });

        this.stats = {
            processed: 0,
            failed: 0,
            totalCost: 0,
            startTime: Date.now()
        };
    }

    async analyzeCallsFromFile(inputFilePath, outputDir = 'data/processed') {
        try {
            logger.info(`Starting QCI analysis from file: ${inputFilePath}`);

            const rawData = await fs.readFile(inputFilePath, 'utf8');
            const calls = JSON.parse(rawData);

            if (!Array.isArray(calls)) {
                throw new Error('Input file must contain an array of calls');
            }

            logger.info(`Found ${calls.length} calls to analyze`);

            const results = await this.analyzeCalls(calls);

            if (this.config.saveResults) {
                await this.saveResults(results, outputDir);
            }

            this.printSummary(results);

            return results;

        } catch (error) {
            logger.error('QCI analysis failed', error);
            throw error;
        }
    }

    async analyzeCalls(calls) {
        const parsedCalls = calls.map(call => CallParser.parse(call));
        const validCalls = parsedCalls.filter(call => call.isValid);

        logger.info(`${validCalls.length}/${calls.length} calls are valid for analysis`);

        if (validCalls.length === 0) {
            return { results: [], stats: this.stats };
        }

        const results = await this.processor.process(
            validCalls,
            (call) => this.analyzeSingleCall(call),
            {
                onProgress: (processed, total) => {
                    if (processed % 10 === 0) {
                        logger.info(`Progress: ${processed}/${total} calls analyzed`);
                    }
                },
                onError: (error, call) => {
                    logger.error(`Failed to analyze call ${call.id}`, error);
                    this.stats.failed++;
                }
            }
        );

        return {
            results: results.filter(r => r !== null),
            stats: this.getStats()
        };
    }

    async analyzeSingleCall(parsedCall) {
        try {
            const startTime = Date.now();

            const prompt = this.buildPrompt(parsedCall);

            const openaiResponse = await this.callOpenAI(prompt);

            const rawAnalysis = JSON.parse(openaiResponse.choices[0].message.content);

            const qciScores = QCICalculator.calculate(rawAnalysis, LEXICONS);

            const processingTime = (Date.now() - startTime) / 1000;

            this.stats.processed++;
            this.stats.totalCost += this.estimateCallCost(openaiResponse.usage);

            return {
                callId: parsedCall.id,
                timestamp: new Date().toISOString(),
                inputData: {
                    duration: parsedCall.duration,
                    transcriptLength: parsedCall.transcript.length,
                    messageCount: parsedCall.messages.length
                },
                qci: qciScores,
                rawAnalysis: rawAnalysis,
                processingTime: processingTime,
                usage: openaiResponse.usage
            };

        } catch (error) {
            logger.error(`Error analyzing call ${parsedCall.id}`, error);
            this.stats.failed++;
            return null;
        }
    }

    buildPrompt(parsedCall) {
        const promptTemplate = require('fs').readFileSync(path.join(__dirname, 'prompts/qci_prompt.txt'), 'utf8');

        return promptTemplate
            .replace('{{TRANSCRIPT}}', parsedCall.transcript)
            .replace('{{MESSAGES}}', JSON.stringify(parsedCall.messages, null, 2))
            .replace('{{LEXICONS}}', JSON.stringify(LEXICONS, null, 2))
            .replace('{{DURATION}}', parsedCall.duration)
            .replace('{{BRAND_NAME}}', LEXICONS.brand_canonical);
    }

    async callOpenAI(prompt) {
        return await openai.chat.completions.create({
            model: OPENAI_CONFIG.model,
            temperature: OPENAI_CONFIG.temperature,
            max_tokens: OPENAI_CONFIG.maxTokens,
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: "You are a call quality analysis expert. Analyze the provided call transcript and return structured JSON data according to the QCI rubric."
                },
                {
                    role: "user",
                    content: prompt
                }
            ]
        });
    }

    estimateCallCost(usage) {
        const inputCost = (usage.prompt_tokens / 1000000) * OPENAI_CONFIG.pricing.input;
        const outputCost = (usage.completion_tokens / 1000000) * OPENAI_CONFIG.pricing.output;
        return inputCost + outputCost;
    }

    async saveResults(analysisResults, outputDir) {
        try {
            await fs.mkdir(outputDir, { recursive: true });

            const timestamp = DataUtils.generateTimestamp();
            const filename = `qci_analysis_${timestamp}.json`;
            const filepath = path.join(outputDir, filename);

            const output = {
                metadata: {
                    analyzedAt: new Date().toISOString(),
                    totalCalls: analysisResults.results.length,
                    config: this.config,
                    stats: analysisResults.stats
                },
                results: analysisResults.results
            };

            await fs.writeFile(filepath, JSON.stringify(output, null, 2), 'utf8');

            logger.info(`Results saved to: ${filepath}`);
            console.log(`\n✅ Results saved to: ${filepath}`);

            const summaryFilename = `qci_summary_${timestamp}.json`;
            const summaryFilepath = path.join(outputDir, summaryFilename);

            const summary = this.generateSummary(analysisResults.results);
            await fs.writeFile(summaryFilepath, JSON.stringify(summary, null, 2), 'utf8');

            logger.info(`Summary saved to: ${summaryFilepath}`);

        } catch (error) {
            logger.error('Failed to save results', error);
            throw error;
        }
    }

    generateSummary(results) {
        const summary = {
            overview: {
                totalCalls: results.length,
                averageQCI: 0,
                distribution: { fail: 0, review: 0, pass: 0 }
            },
            categoryAverages: {
                dynamics: 0,
                objections: 0,
                brand: 0,
                outcome: 0
            },
            commonIssues: [],
            topPerformers: [],
            recommendations: []
        };

        if (results.length === 0) return summary;

        let totalQCI = 0;
        const qciScores = [];
        const categoryTotals = { dynamics: 0, objections: 0, brand: 0, outcome: 0 };

        results.forEach(result => {
            const qci = result.qci;
            totalQCI += qci.totalScore;
            qciScores.push(qci.totalScore);

            summary.distribution[qci.status]++;

            categoryTotals.dynamics += qci.breakdown.dynamics.total;
            categoryTotals.objections += qci.breakdown.objections.total;
            categoryTotals.brand += qci.breakdown.brand.total;
            categoryTotals.outcome += qci.breakdown.outcome.total;
        });

        summary.overview.averageQCI = Math.round(totalQCI / results.length);

        Object.keys(categoryTotals).forEach(category => {
            summary.categoryAverages[category] = Math.round(categoryTotals[category] / results.length);
        });

        summary.topPerformers = results
            .filter(r => r.qci.totalScore >= 80)
            .sort((a, b) => b.qci.totalScore - a.qci.totalScore)
            .slice(0, 5)
            .map(r => ({
                callId: r.callId,
                score: r.qci.totalScore,
                status: r.qci.status
            }));

        return summary;
    }

    getStats() {
        return {
            ...this.stats,
            processingTimeMinutes: (Date.now() - this.stats.startTime) / 1000 / 60,
            averageCostPerCall: this.stats.processed > 0 ? this.stats.totalCost / this.stats.processed : 0
        };
    }

    printSummary(analysisResults) {
        const stats = analysisResults.stats;
        const results = analysisResults.results;

        console.log('\n========================================');
        console.log('🎯 QCI ANALYSIS COMPLETED');
        console.log('========================================');
        console.log(`📊 Processed: ${stats.processed} calls`);
        console.log(`❌ Failed: ${stats.failed} calls`);
        console.log(`💰 Total cost: $${stats.totalCost.toFixed(4)}`);
        console.log(`⏱️  Processing time: ${stats.processingTimeMinutes.toFixed(1)} minutes`);
        console.log(`💵 Average cost per call: $${stats.averageCostPerCall.toFixed(4)}`);

        if (results.length > 0) {
            const avgScore = results.reduce((sum, r) => sum + r.qci.totalScore, 0) / results.length;
            const distribution = results.reduce((acc, r) => {
                acc[r.qci.status] = (acc[r.qci.status] || 0) + 1;
                return acc;
            }, {});

            console.log('\n📈 QCI Results:');
            console.log(`   Average Score: ${avgScore.toFixed(1)}/100`);
            console.log(`   Pass: ${distribution.pass || 0} calls (≥80)`);
            console.log(`   Review: ${distribution.review || 0} calls (60-79)`);
            console.log(`   Fail: ${distribution.fail || 0} calls (<60)`);
        }

        console.log('========================================\n');
    }
}

async function main() {
    try {
        const args = process.argv.slice(2);

        if (args.length === 0) {
            console.log('Usage: node qci_analyzer.js <input_file> [config_preset]');
            console.log('');
            console.log('Config presets:');
            console.log('  test     - For 10-50 calls (5 batch, 2 concurrent)');
            console.log('  medium   - For 100-500 calls (20 batch, 5 concurrent)');
            console.log('  large    - For 1000+ calls (50 batch, 10 concurrent)');
            console.log('  default  - Medium config (20 batch, 5 concurrent)');
            console.log('');
            console.log('Example:');
            console.log('  node qci_analyzer.js data/raw/vapi_calls.json test');
            process.exit(1);
        }

        const inputFile = args[0];
        const preset = args[1] || 'default';

        if (!await fs.access(inputFile).then(() => true).catch(() => false)) {
            console.error(`❌ Input file not found: ${inputFile}`);
            process.exit(1);
        }

        const config = QCI_CONFIG[preset.toUpperCase()] || QCI_CONFIG.DEFAULT;

        console.log(`🚀 Starting QCI analysis with ${preset} config`);
        console.log(`📁 Input: ${inputFile}`);
        console.log(`⚙️  Config: ${config.batchSize} batch, ${config.maxConcurrent} concurrent\n`);

        const analyzer = new QCIAnalyzer(config);

        const results = await analyzer.analyzeCallsFromFile(inputFile);

        console.log(`✅ Analysis completed successfully!`);
        process.exit(0);

    } catch (error) {
        console.error('❌ QCI Analysis failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = QCIAnalyzer;