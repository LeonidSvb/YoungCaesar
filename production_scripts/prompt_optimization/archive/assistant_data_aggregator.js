require('dotenv').config({ path: '../../.env' });
const fs = require('fs');
const path = require('path');

// ============================================================
// CONFIGURATION - CHANGE ALL SETTINGS HERE
// ============================================================

const CONFIG = {
    // 📁 INPUT DATA SOURCES
    INPUT: {
        // Path to VAPI calls data (from vapi_collection)
        CALLS_FILE: '../vapi_collection/results/2025-09-17T09-51-00_vapi_calls_2025-01-01_to_2025-09-17_cost-0.03.json',

        // Path to QCI analysis results (from qci_analysis)
        QCI_FILE: '../qci_analysis/results/qci_full_calls_2025-09-17T12-41-22.json',

        // Path to extracted detailed prompts
        DETAILED_PROMPTS_FILE: 'results/extracted_prompts_2025-09-17T12-35-35.json',

        // Minimum calls per assistant to include in analysis
        MIN_CALLS_PER_ASSISTANT: 5,

        // Target specific assistant for focused analysis
        TARGET_ASSISTANT_ID: '0eddf4db-3bfa-4eb2-8053-082d94aa786d' // YC Assistant | HOT
    },

    // 🎯 PROCESSING SETTINGS
    PROCESSING: {
        // Include sample call transcripts in output?
        INCLUDE_SAMPLE_CALLS: true,

        // How many sample calls per assistant (best and worst)
        SAMPLE_CALLS_COUNT: 3,

        // Include full prompts in output?
        INCLUDE_FULL_PROMPTS: true
    },

    // 📊 OUTPUT SETTINGS
    OUTPUT: {
        // Where to save aggregated data
        RESULTS_DIR: 'results',

        // Show detailed progress in console?
        VERBOSE: true
    }
};

// ============================================================
// MAIN SCRIPT - NO NEED TO CHANGE BELOW
// ============================================================

class AssistantDataAggregator {
    constructor() {
        this.assistants = new Map();
        this.stats = {
            totalCalls: 0,
            totalAssistants: 0,
            processedAssistants: 0,
            startTime: Date.now()
        };
    }

    async loadCallsData() {
        const callsPath = path.resolve(__dirname, CONFIG.INPUT.CALLS_FILE);

        if (!fs.existsSync(callsPath)) {
            throw new Error(`Calls data file not found: ${callsPath}`);
        }

        const calls = JSON.parse(fs.readFileSync(callsPath, 'utf8'));
        this.stats.totalCalls = calls.length;

        if (CONFIG.OUTPUT.VERBOSE) {
            console.log(`📊 Loaded ${calls.length} calls from VAPI data`);
        }

        return calls;
    }

    async loadDetailedPromptsData() {
        const promptsPath = path.resolve(__dirname, CONFIG.INPUT.DETAILED_PROMPTS_FILE);

        if (!fs.existsSync(promptsPath)) {
            if (CONFIG.OUTPUT.VERBOSE) {
                console.log(`⚠️ Detailed prompts file not found: ${promptsPath}`);
            }
            return null;
        }

        const promptsData = JSON.parse(fs.readFileSync(promptsPath, 'utf8'));

        if (CONFIG.OUTPUT.VERBOSE) {
            console.log(`📝 Loaded detailed prompts for ${promptsData.assistants.length} assistants`);
        }

        return promptsData;
    }

    async loadQCIData() {
        const qciPath = path.resolve(__dirname, CONFIG.INPUT.QCI_FILE);

        if (!fs.existsSync(qciPath)) {
            throw new Error(`QCI analysis file not found: ${qciPath}`);
        }

        const qciData = JSON.parse(fs.readFileSync(qciPath, 'utf8'));

        if (CONFIG.OUTPUT.VERBOSE) {
            console.log(`📈 Loaded QCI analysis for ${qciData.results.length} calls`);
        }

        return qciData;
    }

    extractPromptFromCall(call) {
        // Extract system prompt from call messages
        if (call.messages && call.messages.length > 0) {
            const systemMessage = call.messages.find(msg => msg.role === 'system');
            if (systemMessage) {
                return systemMessage.message;
            }
        }
        return null;
    }

    getAssistantName(call, detailedPromptData = null) {
        // First try to get name from detailed prompt data if available
        if (detailedPromptData && detailedPromptData.name) {
            return detailedPromptData.name;
        }

        // Try to extract assistant name from the prompt
        const prompt = this.extractPromptFromCall(call);
        if (prompt) {
            // Look for name patterns in prompt
            const nameMatch = prompt.match(/You are (\w+),/i) || prompt.match(/This is (\w+)\./i);
            if (nameMatch) {
                return nameMatch[1];
            }
        }

        // Fallback to assistantId
        return call.assistantId || 'Unknown';
    }

    aggregateAssistantData(calls, qciResults, detailedPrompts = null) {
        // Create QCI lookup by call_id
        const qciLookup = new Map();
        qciResults.results.forEach(result => {
            qciLookup.set(result.call_id, result);
        });

        // Create detailed prompts lookup by assistant_id
        const promptsLookup = new Map();
        if (detailedPrompts && detailedPrompts.assistants) {
            detailedPrompts.assistants.forEach(assistant => {
                promptsLookup.set(assistant.id, assistant);
            });
        }

        // Group calls by assistant
        calls.forEach(call => {
            const assistantId = call.assistantId;
            const detailedPromptData = promptsLookup.get(assistantId);
            const assistantName = this.getAssistantName(call, detailedPromptData);
            const qciData = qciLookup.get(call.id);

            if (!assistantId) return;

            if (!this.assistants.has(assistantId)) {
                // Use detailed prompt if available, otherwise fallback to call prompt
                const promptToUse = detailedPromptData?.primaryPrompt?.prompt || this.extractPromptFromCall(call);

                this.assistants.set(assistantId, {
                    id: assistantId,
                    name: assistantName,
                    prompt: promptToUse,
                    detailed_prompt_info: detailedPromptData || null,
                    calls: [],
                    qci_scores: [],
                    performance: {
                        total_calls: 0,
                        avg_qci: 0,
                        avg_dynamics: 0,
                        avg_objections: 0,
                        avg_brand: 0,
                        avg_outcome: 0,
                        success_rate: 0,
                        best_call: null,
                        worst_call: null
                    }
                });
            }

            const assistant = this.assistants.get(assistantId);

            // Add call data
            assistant.calls.push({
                id: call.id,
                transcript: call.transcript,
                duration: call.endedAt ? new Date(call.endedAt) - new Date(call.startedAt) : null,
                cost: call.cost,
                outcome: call.analysis?.successEvaluation
            });

            // Add QCI data if available
            if (qciData) {
                assistant.qci_scores.push({
                    call_id: call.id,
                    qci_total: qciData.qci_total,
                    dynamics: qciData.dynamics,
                    objections: qciData.objections,
                    brand: qciData.brand,
                    outcome: qciData.outcome,
                    status: qciData.status
                });
            }
        });

        if (CONFIG.OUTPUT.VERBOSE) {
            console.log(`👥 Found ${this.assistants.size} unique assistants`);
            if (detailedPrompts) {
                const assistantsWithDetailedPrompts = Array.from(this.assistants.values())
                    .filter(a => a.detailed_prompt_info).length;
                console.log(`📝 ${assistantsWithDetailedPrompts} assistants have detailed prompts`);
            }
        }
    }

    calculatePerformanceMetrics() {
        this.assistants.forEach((assistant, assistantId) => {
            const perf = assistant.performance;
            const scores = assistant.qci_scores;

            if (scores.length === 0) return;

            // Basic metrics
            perf.total_calls = scores.length;
            perf.avg_qci = scores.reduce((sum, s) => sum + s.qci_total, 0) / scores.length;
            perf.avg_dynamics = scores.reduce((sum, s) => sum + s.dynamics, 0) / scores.length;
            perf.avg_objections = scores.reduce((sum, s) => sum + s.objections, 0) / scores.length;
            perf.avg_brand = scores.reduce((sum, s) => sum + s.brand, 0) / scores.length;
            perf.avg_outcome = scores.reduce((sum, s) => sum + s.outcome, 0) / scores.length;

            // Success rate (calls with status 'pass' or 'review')
            const successfulCalls = scores.filter(s => s.status === 'pass' || s.status === 'review').length;
            perf.success_rate = (successfulCalls / scores.length) * 100;

            // Best and worst calls
            const sortedByQCI = [...scores].sort((a, b) => b.qci_total - a.qci_total);
            perf.best_call = sortedByQCI[0];
            perf.worst_call = sortedByQCI[sortedByQCI.length - 1];

            // Round numbers
            perf.avg_qci = Math.round(perf.avg_qci * 10) / 10;
            perf.avg_dynamics = Math.round(perf.avg_dynamics * 10) / 10;
            perf.avg_objections = Math.round(perf.avg_objections * 10) / 10;
            perf.avg_brand = Math.round(perf.avg_brand * 10) / 10;
            perf.avg_outcome = Math.round(perf.avg_outcome * 10) / 10;
            perf.success_rate = Math.round(perf.success_rate * 10) / 10;
        });
    }

    filterAssistants() {
        // Filter by target assistant if specified
        if (CONFIG.INPUT.TARGET_ASSISTANT_ID) {
            const targetAssistant = this.assistants.get(CONFIG.INPUT.TARGET_ASSISTANT_ID);
            if (targetAssistant) {
                this.assistants = new Map([[CONFIG.INPUT.TARGET_ASSISTANT_ID, targetAssistant]]);
                this.stats.processedAssistants = 1;
                this.stats.totalAssistants = 1;

                if (CONFIG.OUTPUT.VERBOSE) {
                    console.log(`🎯 Filtering to target assistant: ${targetAssistant.name} (${CONFIG.INPUT.TARGET_ASSISTANT_ID})`);
                    console.log(`📞 Assistant has ${targetAssistant.performance.total_calls} calls with QCI data`);
                }
                return;
            } else {
                if (CONFIG.OUTPUT.VERBOSE) {
                    console.log(`⚠️ Target assistant ${CONFIG.INPUT.TARGET_ASSISTANT_ID} not found`);
                    console.log(`Available assistants: ${Array.from(this.assistants.keys()).join(', ')}`);
                }
            }
        }

        // Remove assistants with too few calls
        const filtered = new Map();

        this.assistants.forEach((assistant, assistantId) => {
            if (assistant.performance.total_calls >= CONFIG.INPUT.MIN_CALLS_PER_ASSISTANT) {
                filtered.set(assistantId, assistant);
                this.stats.processedAssistants++;
            }
        });

        this.assistants = filtered;
        this.stats.totalAssistants = this.assistants.size;

        if (CONFIG.OUTPUT.VERBOSE) {
            console.log(`✅ Kept ${this.stats.processedAssistants} assistants with ${CONFIG.INPUT.MIN_CALLS_PER_ASSISTANT}+ calls`);
        }
    }

    prepareSampleCalls() {
        if (!CONFIG.PROCESSING.INCLUDE_SAMPLE_CALLS) return;

        this.assistants.forEach((assistant, assistantId) => {
            // Get best and worst performing calls with transcripts
            const callsWithTranscripts = assistant.qci_scores
                .map(score => {
                    const call = assistant.calls.find(c => c.id === score.call_id);
                    return { ...score, transcript: call?.transcript };
                })
                .filter(call => call.transcript && call.transcript.length > 100);

            if (callsWithTranscripts.length === 0) return;

            // Sort by QCI score
            callsWithTranscripts.sort((a, b) => b.qci_total - a.qci_total);

            // Take samples
            const sampleCount = Math.min(CONFIG.PROCESSING.SAMPLE_CALLS_COUNT, callsWithTranscripts.length);
            assistant.sample_calls = {
                best: callsWithTranscripts.slice(0, Math.ceil(sampleCount / 2)),
                worst: callsWithTranscripts.slice(-Math.floor(sampleCount / 2))
            };
        });
    }

    async saveResults() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const filename = `assistant_aggregated_data_${timestamp}.json`;
        const filepath = path.join(__dirname, CONFIG.OUTPUT.RESULTS_DIR, filename);

        // Ensure output directory exists
        if (!fs.existsSync(path.join(__dirname, CONFIG.OUTPUT.RESULTS_DIR))) {
            fs.mkdirSync(path.join(__dirname, CONFIG.OUTPUT.RESULTS_DIR), { recursive: true });
        }

        // Prepare output data
        const assistantsArray = Array.from(this.assistants.values());

        // Remove full call arrays if not needed to reduce file size
        if (!CONFIG.PROCESSING.INCLUDE_SAMPLE_CALLS) {
            assistantsArray.forEach(assistant => {
                delete assistant.calls;
                delete assistant.qci_scores;
            });
        } else {
            // Keep only sample calls
            assistantsArray.forEach(assistant => {
                delete assistant.calls;
                delete assistant.qci_scores;
            });
        }

        // Remove full prompts if not needed
        if (!CONFIG.PROCESSING.INCLUDE_FULL_PROMPTS) {
            assistantsArray.forEach(assistant => {
                if (assistant.prompt) {
                    assistant.prompt_preview = assistant.prompt.substring(0, 200) + '...';
                    delete assistant.prompt;
                }
            });
        }

        const totalTime = (Date.now() - this.stats.startTime) / 1000;

        const outputData = {
            metadata: {
                generated_at: new Date().toISOString(),
                processing_time: `${totalTime.toFixed(1)}s`,
                config: CONFIG,
                stats: this.stats
            },
            assistants: assistantsArray.sort((a, b) => b.performance.avg_qci - a.performance.avg_qci)
        };

        fs.writeFileSync(filepath, JSON.stringify(outputData, null, 2));

        // Create latest symlink
        const latestPath = path.join(__dirname, CONFIG.OUTPUT.RESULTS_DIR, 'assistant_aggregated_data_latest.json');
        if (fs.existsSync(latestPath)) {
            fs.unlinkSync(latestPath);
        }
        fs.copyFileSync(filepath, latestPath);

        // Display summary
        console.log(`\n🎉 AGGREGATION COMPLETE`);
        console.log(`👥 Processed: ${this.stats.processedAssistants} assistants`);
        console.log(`📞 Total calls: ${this.stats.totalCalls}`);
        console.log(`⏱️ Processing time: ${totalTime.toFixed(1)}s`);
        console.log(`📁 Results: ${filename}`);

        // Show top performers
        console.log(`\n📊 TOP PERFORMERS:`);
        assistantsArray.slice(0, 3).forEach((assistant, index) => {
            console.log(`${index + 1}. ${assistant.name}: ${assistant.performance.avg_qci}/100 QCI (${assistant.performance.total_calls} calls)`);
        });

        return filepath;
    }
}

async function main() {
    const aggregator = new AssistantDataAggregator();

    try {
        console.log('🚀 Starting assistant data aggregation...\n');

        // Load data
        const calls = await aggregator.loadCallsData();
        const qciData = await aggregator.loadQCIData();
        const detailedPrompts = await aggregator.loadDetailedPromptsData();

        // Process data
        aggregator.aggregateAssistantData(calls, qciData, detailedPrompts);
        aggregator.calculatePerformanceMetrics();
        aggregator.filterAssistants();
        aggregator.prepareSampleCalls();

        // Save results
        const resultFile = await aggregator.saveResults();
        console.log(`\n📍 Results saved to: ${resultFile}`);

    } catch (error) {
        console.error('❌ Aggregation failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = AssistantDataAggregator;