#!/usr/bin/env node
/**
 * DATA AGGREGATOR - VAPI Assistant Data Processing
 *
 * PURPOSE: Groups VAPI calls by assistant and calculates performance metrics
 * USAGE: node src/data_aggregator.js
 * INPUT: ../vapi_collection/results/latest_calls.json
 * OUTPUT: ../results/aggregated_data_TIMESTAMP.json
 *
 * AUTHOR: VAPI Team
 * CREATED: 2025-09-17
 * VERSION: 2.0.0 (see ../history.txt)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createLogger } = require('../../shared/logger');

const logger = createLogger('DATA_AGGREGATOR');

// CONFIGURATION
const CONFIG = {
    INPUT: {
        VAPI_CALLS: '../../vapi_collection/results/2025-09-17T09-51-00_vapi_calls_2025-01-01_to_2025-09-17_cost-0.03.json',
        QCI_RESULTS: '../../qci_analysis/results/latest_qci_full_calls.json',
        FALLBACK_CALLS: '../../../data/raw/vapi_filtered_calls_2025-09-17T09-23-36-349.json'
    },
    OUTPUT: {
        DIR: '../results',
        FILE_PREFIX: 'aggregated_data'
    },
    OPTIONS: {
        MIN_CALLS_FOR_ANALYSIS: 5,
        EXTRACT_SAMPLE_CALLS: true,
        MAX_SAMPLE_CALLS: 30
    }
};

class DataAggregator {
    constructor() {
        this.assistants = new Map();
        this.stats = {
            startTime: Date.now(),
            totalCalls: 0,
            assistantsFound: 0,
            callsWithQCI: 0
        };
    }

    async loadInputData() {
        logger.info('Loading input data...');

        // Try to load VAPI calls
        let callsData = this.loadCallsFile(CONFIG.INPUT.VAPI_CALLS) ||
                       this.loadCallsFile(CONFIG.INPUT.FALLBACK_CALLS);

        if (!callsData) {
            throw new Error('No VAPI calls data found');
        }

        // Try to load QCI results
        const qciData = this.loadCallsFile(CONFIG.INPUT.QCI_RESULTS);

        this.stats.totalCalls = callsData.length;
        logger.success(`Loaded ${this.stats.totalCalls} calls`);

        if (qciData) {
            this.stats.callsWithQCI = qciData.length;
            logger.success(`Loaded ${this.stats.callsWithQCI} QCI results`);
        }

        return { callsData, qciData };
    }

    loadCallsFile(relativePath) {
        try {
            const fullPath = path.resolve(__dirname, relativePath);
            logger.info(`Trying to load: ${fullPath}`);
            if (!fs.existsSync(fullPath)) {
                logger.warning(`File not found: ${fullPath}`);
                return null;
            }

            const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
            return Array.isArray(data) ? data : data.calls || data.data || [];
        } catch (error) {
            logger.warning(`Failed to load ${relativePath}: ${error.message}`);
            return null;
        }
    }

    aggregateAssistantData(callsData, qciData = null) {
        logger.info('Aggregating assistant data...');

        // Create QCI lookup map
        const qciMap = new Map();
        if (qciData) {
            qciData.forEach(call => {
                if (call.call_id) {
                    qciMap.set(call.call_id, call);
                }
            });
        }

        // Process each call
        callsData.forEach(call => {
            const assistantId = call.assistantId || call.assistant_id;
            if (!assistantId) return;

            // Initialize assistant if not exists
            if (!this.assistants.has(assistantId)) {
                this.assistants.set(assistantId, {
                    id: assistantId,
                    name: this.extractAssistantName(call),
                    prompt: this.extractPrompt(call),
                    calls: [],
                    qci_scores: [],
                    performance: {}
                });
            }

            const assistant = this.assistants.get(assistantId);

            // Add call data
            const callData = {
                id: call.id,
                duration: call.duration || 0,
                cost: call.cost || 0,
                transcript: this.extractTranscript(call),
                timestamp: call.createdAt || call.created_at
            };

            // Add QCI data if available
            const qciResult = qciMap.get(call.id);
            if (qciResult) {
                callData.qci_total_score = qciResult.qci_total_score;
                callData.dynamics_total = qciResult.dynamics_total;
                callData.objections_total = qciResult.objections_total;
                callData.brand_total = qciResult.brand_total;
                callData.outcome_total = qciResult.outcome_total;

                assistant.qci_scores.push({
                    total: qciResult.qci_total_score,
                    dynamics: qciResult.dynamics_total,
                    objections: qciResult.objections_total,
                    brand: qciResult.brand_total,
                    outcome: qciResult.outcome_total
                });
            }

            assistant.calls.push(callData);
        });

        this.stats.assistantsFound = this.assistants.size;
        logger.success(`Found ${this.stats.assistantsFound} unique assistants`);
    }

    extractAssistantName(call) {
        // Try various sources for assistant name
        if (call.assistant?.name) return call.assistant.name;
        if (call.assistantName) return call.assistantName;
        if (call.assistant_name) return call.assistant_name;

        // Fallback to short ID format if no name found
        if (call.assistantId) {
            return `Assistant ${call.assistantId.split('-')[0]}`;
        }

        return 'Unknown Assistant';
    }

    extractPrompt(call) {
        if (call.assistant?.model?.messages) {
            const systemMessage = call.assistant.model.messages.find(m => m.role === 'system');
            return systemMessage?.content || '';
        }
        return call.prompt || call.assistant_prompt || '';
    }

    extractTranscript(call) {
        if (call.messages && Array.isArray(call.messages)) {
            return call.messages
                .filter(m => m.role !== 'system')  // Skip system messages
                .map(m => `${m.role}: ${m.message || m.content || 'undefined'}`)
                .join('\n');
        }
        return call.transcript || '';
    }

    calculatePerformanceMetrics() {
        logger.info('Calculating performance metrics...');

        this.assistants.forEach((assistant, assistantId) => {
            const calls = assistant.calls;
            const qciScores = assistant.qci_scores;

            // Basic metrics
            assistant.performance = {
                total_calls: calls.length,
                avg_duration: this.average(calls.map(c => c.duration)),
                total_cost: calls.reduce((sum, c) => sum + (c.cost || 0), 0),
                avg_cost: this.average(calls.map(c => c.cost))
            };

            // QCI metrics if available
            if (qciScores.length > 0) {
                assistant.performance.avg_qci = this.average(qciScores.map(s => s.total));
                assistant.performance.avg_dynamics = this.average(qciScores.map(s => s.dynamics));
                assistant.performance.avg_objections = this.average(qciScores.map(s => s.objections));
                assistant.performance.avg_brand = this.average(qciScores.map(s => s.brand));
                assistant.performance.avg_outcome = this.average(qciScores.map(s => s.outcome));

                // Calculate success rate (QCI > 50)
                const successfulCalls = qciScores.filter(s => s.total > 50).length;
                assistant.performance.success_rate = (successfulCalls / qciScores.length) * 100;
            }

            // Extract sample calls for analysis
            if (CONFIG.OPTIONS.EXTRACT_SAMPLE_CALLS) {
                assistant.sample_calls = this.extractSampleCalls(calls, qciScores);
            }
        });
    }

    average(numbers) {
        const validNumbers = numbers.filter(n => typeof n === 'number' && !isNaN(n));
        return validNumbers.length > 0 ?
               validNumbers.reduce((sum, n) => sum + n, 0) / validNumbers.length : 0;
    }

    extractSampleCalls(calls, qciScores) {
        // If we have QCI scores, use them for intelligent sampling
        if (qciScores.length > 0) {
            const callsWithQCI = calls
                .map((call, index) => ({
                    ...call,
                    qci_score: qciScores[index]?.total || 0
                }))
                .filter(call => call.qci_score > 0)
                .sort((a, b) => b.qci_score - a.qci_score);

            const samples = [];
            if (callsWithQCI.length > 0) {
                samples.push(callsWithQCI[0]); // Best

                if (callsWithQCI.length > 2) {
                    const middleIndex = Math.floor(callsWithQCI.length / 2);
                    samples.push(callsWithQCI[middleIndex]); // Middle
                }

                if (callsWithQCI.length > 1) {
                    samples.push(callsWithQCI[callsWithQCI.length - 1]); // Worst
                }
            }
            return samples.slice(0, CONFIG.OPTIONS.MAX_SAMPLE_CALLS);
        }

        // Fallback: Random sampling when no QCI data available
        if (calls.length === 0) return [];

        const shuffled = [...calls].sort(() => 0.5 - Math.random());
        const sampleCount = Math.min(CONFIG.OPTIONS.MAX_SAMPLE_CALLS, calls.length);

        logger.info(`No QCI data available, using random sampling: ${sampleCount} calls`);
        return shuffled.slice(0, sampleCount);
    }

    filterAssistants() {
        const filteredAssistants = new Map();

        this.assistants.forEach((assistant, assistantId) => {
            if (assistant.calls.length >= CONFIG.OPTIONS.MIN_CALLS_FOR_ANALYSIS) {
                filteredAssistants.set(assistantId, assistant);
            } else {
                logger.warning(`Skipping ${assistant.name}: only ${assistant.calls.length} calls`);
            }
        });

        this.assistants = filteredAssistants;
        logger.success(`${this.assistants.size} assistants meet analysis criteria`);
    }

    generateReport() {
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
                total_calls: this.stats.totalCalls,
                assistants_analyzed: this.assistants.size,
                calls_with_qci: this.stats.callsWithQCI,
                processing_time: ((Date.now() - this.stats.startTime) / 1000).toFixed(1) + 's'
            },
            assistants: Array.from(this.assistants.values())
        };

        fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

        logger.success('Data aggregation complete!');
        logger.info(`📊 Total calls processed: ${this.stats.totalCalls}`);
        logger.info(`🤖 Assistants analyzed: ${this.assistants.size}`);
        logger.timing(((Date.now() - this.stats.startTime) / 1000).toFixed(1), 'seconds');
        logger.success(`📁 Results saved: ${outputPath}`);

        return outputPath;
    }
}

// MAIN EXECUTION
async function main() {
    try {
        const aggregator = new DataAggregator();

        const { callsData, qciData } = await aggregator.loadInputData();
        aggregator.aggregateAssistantData(callsData, qciData);
        aggregator.calculatePerformanceMetrics();
        aggregator.filterAssistants();

        return aggregator.generateReport();
    } catch (error) {
        logger.error(`Data aggregation failed: ${error.message}`);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = DataAggregator;