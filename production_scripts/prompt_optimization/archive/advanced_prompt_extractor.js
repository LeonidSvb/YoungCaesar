require('dotenv').config({ path: '../../.env' });
const fs = require('fs');
const path = require('path');

// ============================================================
// CONFIGURATION - CHANGE ALL SETTINGS HERE
// ============================================================

const CONFIG = {
    // 🔑 VAPI API SETTINGS
    API: {
        BASE_URL: 'https://api.vapi.ai',
        API_KEY: process.env.VAPI_API_KEY,
        TIMEOUT: 30000
    },

    // 📊 EXTRACTION SETTINGS
    EXTRACTION: {
        // How many recent calls to analyze per assistant
        CALLS_PER_ASSISTANT: 5,

        // Only include calls longer than this (seconds)
        MIN_CALL_DURATION: 10,

        // Only analyze calls with system prompts
        REQUIRE_SYSTEM_PROMPT: true,

        // Extract prompts only from specific date range?
        DATE_FILTER: {
            ENABLED: false,
            START_DATE: '2025-01-01',
            END_DATE: '2025-12-31'
        }
    },

    // 🎯 ASSISTANT FILTERING
    FILTERING: {
        // Only extract prompts for specific assistants? (leave empty for all)
        SPECIFIC_ASSISTANT_IDS: [],

        // Exclude assistants with fewer than X calls
        MIN_CALLS_THRESHOLD: 3,

        // Include test/demo assistants?
        INCLUDE_TEST_ASSISTANTS: false
    },

    // 📁 OUTPUT SETTINGS
    OUTPUT: {
        RESULTS_DIR: 'results',
        SAVE_RAW_DATA: true,
        SAVE_PROCESSED_DATA: true,
        VERBOSE: true,

        // Create separate files for each assistant?
        SEPARATE_FILES_PER_ASSISTANT: true
    }
};

// ============================================================
// MAIN SCRIPT - NO NEED TO CHANGE BELOW
// ============================================================

class AdvancedPromptExtractor {
    constructor() {
        this.assistants = new Map();
        this.extractedPrompts = new Map();
        this.stats = {
            startTime: Date.now(),
            assistantsFound: 0,
            assistantsProcessed: 0,
            callsAnalyzed: 0,
            promptsExtracted: 0,
            errors: []
        };
    }

    async makeAPIRequest(endpoint, options = {}) {
        const url = `${CONFIG.API.BASE_URL}${endpoint}`;
        const headers = {
            'Authorization': `Bearer ${CONFIG.API.API_KEY}`,
            'Content-Type': 'application/json',
            ...options.headers
        };

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.API.TIMEOUT);

            const response = await fetch(url, {
                method: options.method || 'GET',
                headers,
                body: options.body ? JSON.stringify(options.body) : undefined,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return data;

        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error(`API request timeout after ${CONFIG.API.TIMEOUT}ms`);
            }
            throw error;
        }
    }

    async getAssistants() {
        if (CONFIG.OUTPUT.VERBOSE) {
            console.log('🔍 Fetching all assistants from VAPI API...');
        }

        try {
            const assistants = await this.makeAPIRequest('/assistant');
            this.stats.assistantsFound = assistants.length;

            if (CONFIG.OUTPUT.VERBOSE) {
                console.log(`✅ Found ${assistants.length} assistants`);
            }

            return assistants;

        } catch (error) {
            console.error('❌ Failed to fetch assistants:', error.message);
            throw error;
        }
    }

    async getCallsForAssistant(assistantId, limit = CONFIG.EXTRACTION.CALLS_PER_ASSISTANT) {
        try {
            // Use existing call data file as fallback if API fails
            const existingDataPath = path.resolve(__dirname, '../vapi_collection/results/2025-09-17T09-51-00_vapi_calls_2025-01-01_to_2025-09-17_cost-0.03.json');

            if (fs.existsSync(existingDataPath)) {
                if (CONFIG.OUTPUT.VERBOSE) {
                    console.log(`  📁 Using existing call data for assistant ${assistantId.substring(0, 8)}`);
                }

                const existingCalls = JSON.parse(fs.readFileSync(existingDataPath, 'utf8'));
                const assistantCalls = existingCalls
                    .filter(call => call.assistantId === assistantId)
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .slice(0, limit);

                if (CONFIG.OUTPUT.VERBOSE) {
                    console.log(`  📞 Found ${assistantCalls.length} calls for assistant ${assistantId.substring(0, 8)}`);
                }

                return assistantCalls;
            }

            // Try API call as primary method
            const params = new URLSearchParams({
                assistantId: assistantId,
                limit: limit.toString()
            });

            const calls = await this.makeAPIRequest(`/call?${params}`);

            if (CONFIG.OUTPUT.VERBOSE) {
                console.log(`  📞 Found ${calls.length} calls for assistant ${assistantId.substring(0, 8)}`);
            }

            return calls;

        } catch (error) {
            // Fallback to existing data
            const existingDataPath = path.resolve(__dirname, '../vapi_collection/results/2025-09-17T09-51-00_vapi_calls_2025-01-01_to_2025-09-17_cost-0.03.json');

            if (fs.existsSync(existingDataPath)) {
                if (CONFIG.OUTPUT.VERBOSE) {
                    console.log(`  ⚠️ API failed, falling back to existing data for ${assistantId.substring(0, 8)}`);
                }

                const existingCalls = JSON.parse(fs.readFileSync(existingDataPath, 'utf8'));
                const assistantCalls = existingCalls
                    .filter(call => call.assistantId === assistantId)
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .slice(0, limit);

                return assistantCalls;
            }

            console.error(`❌ Failed to fetch calls for assistant ${assistantId}:`, error.message);
            this.stats.errors.push({
                assistantId,
                error: error.message,
                type: 'call_fetch_error'
            });
            return [];
        }
    }

    extractPromptFromCall(call) {
        try {
            if (!call.messages || call.messages.length === 0) {
                return null;
            }

            // Find the system message (usually the first one)
            const systemMessage = call.messages.find(msg =>
                msg.role === 'system' &&
                msg.message &&
                msg.message.length > 100 // Must be substantial
            );

            if (!systemMessage) {
                return null;
            }

            return {
                callId: call.id,
                assistantId: call.assistantId,
                prompt: systemMessage.message,
                promptTokens: systemMessage.message.length,
                callDate: call.createdAt,
                callDuration: call.endedAt ?
                    (new Date(call.endedAt) - new Date(call.startedAt)) / 1000 : null,
                callCost: call.cost || 0
            };

        } catch (error) {
            console.error(`❌ Failed to extract prompt from call ${call.id}:`, error.message);
            return null;
        }
    }

    filterCalls(calls) {
        let filtered = calls.filter(call => {
            // Duration filter
            if (CONFIG.EXTRACTION.MIN_CALL_DURATION > 0) {
                const duration = call.endedAt ?
                    (new Date(call.endedAt) - new Date(call.startedAt)) / 1000 : 0;
                if (duration < CONFIG.EXTRACTION.MIN_CALL_DURATION) {
                    return false;
                }
            }

            // Date filter
            if (CONFIG.EXTRACTION.DATE_FILTER.ENABLED) {
                const callDate = new Date(call.createdAt);
                const startDate = new Date(CONFIG.EXTRACTION.DATE_FILTER.START_DATE);
                const endDate = new Date(CONFIG.EXTRACTION.DATE_FILTER.END_DATE);

                if (callDate < startDate || callDate > endDate) {
                    return false;
                }
            }

            // Must have messages if system prompt required
            if (CONFIG.EXTRACTION.REQUIRE_SYSTEM_PROMPT) {
                if (!call.messages || call.messages.length === 0) {
                    return false;
                }

                const hasSystemPrompt = call.messages.some(msg =>
                    msg.role === 'system' && msg.message && msg.message.length > 100
                );

                if (!hasSystemPrompt) {
                    return false;
                }
            }

            return true;
        });

        return filtered;
    }

    async processAssistant(assistant) {
        const assistantId = assistant.id;
        const assistantName = assistant.name || `Assistant_${assistantId.substring(0, 8)}`;

        if (CONFIG.OUTPUT.VERBOSE) {
            console.log(`\n🤖 Processing assistant: ${assistantName}`);
            console.log(`   ID: ${assistantId}`);
        }

        try {
            // Get recent calls for this assistant
            const allCalls = await this.getCallsForAssistant(assistantId);

            if (allCalls.length === 0) {
                if (CONFIG.OUTPUT.VERBOSE) {
                    console.log(`   ⚠️ No calls found for assistant ${assistantName}`);
                }
                return null;
            }

            // Filter calls based on criteria
            const filteredCalls = this.filterCalls(allCalls);

            if (filteredCalls.length < CONFIG.FILTERING.MIN_CALLS_THRESHOLD) {
                if (CONFIG.OUTPUT.VERBOSE) {
                    console.log(`   ⚠️ Assistant ${assistantName} has only ${filteredCalls.length} qualifying calls (min: ${CONFIG.FILTERING.MIN_CALLS_THRESHOLD})`);
                }
                return null;
            }

            // Extract prompts from calls
            const extractedPrompts = [];
            const uniquePrompts = new Set();

            for (const call of filteredCalls) {
                this.stats.callsAnalyzed++;

                const promptData = this.extractPromptFromCall(call);
                if (promptData) {
                    // Check for unique prompts (sometimes assistants have different versions)
                    const promptHash = this.hashPrompt(promptData.prompt);

                    if (!uniquePrompts.has(promptHash)) {
                        uniquePrompts.add(promptHash);
                        extractedPrompts.push(promptData);
                        this.stats.promptsExtracted++;
                    }
                }
            }

            if (extractedPrompts.length === 0) {
                if (CONFIG.OUTPUT.VERBOSE) {
                    console.log(`   ❌ No valid prompts extracted for assistant ${assistantName}`);
                }
                return null;
            }

            // Get the most recent/comprehensive prompt
            const primaryPrompt = extractedPrompts.sort((a, b) =>
                new Date(b.callDate) - new Date(a.callDate)
            )[0];

            const assistantData = {
                id: assistantId,
                name: assistantName,
                totalCalls: allCalls.length,
                qualifyingCalls: filteredCalls.length,
                uniquePrompts: extractedPrompts.length,
                primaryPrompt: primaryPrompt,
                allPrompts: extractedPrompts,
                metadata: {
                    processed_at: new Date().toISOString(),
                    api_assistant_data: assistant
                }
            };

            this.extractedPrompts.set(assistantId, assistantData);
            this.stats.assistantsProcessed++;

            if (CONFIG.OUTPUT.VERBOSE) {
                console.log(`   ✅ Extracted ${extractedPrompts.length} unique prompts`);
                console.log(`   📝 Primary prompt: ${primaryPrompt.promptTokens} characters`);
            }

            return assistantData;

        } catch (error) {
            console.error(`❌ Failed to process assistant ${assistantName}:`, error.message);
            this.stats.errors.push({
                assistantId,
                assistantName,
                error: error.message,
                type: 'assistant_processing_error'
            });
            return null;
        }
    }

    hashPrompt(prompt) {
        // Simple hash function for detecting unique prompts
        let hash = 0;
        for (let i = 0; i < prompt.length; i++) {
            const char = prompt.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }

    async saveResults() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const resultsDir = path.join(__dirname, CONFIG.OUTPUT.RESULTS_DIR);

        // Ensure output directory exists
        if (!fs.existsSync(resultsDir)) {
            fs.mkdirSync(resultsDir, { recursive: true });
        }

        const totalTime = (Date.now() - this.stats.startTime) / 1000;

        // Save main results file
        const mainFilename = `extracted_prompts_${timestamp}.json`;
        const mainFilepath = path.join(resultsDir, mainFilename);

        const mainData = {
            metadata: {
                extracted_at: new Date().toISOString(),
                processing_time: `${totalTime.toFixed(1)}s`,
                config: CONFIG,
                stats: {
                    ...this.stats,
                    totalTime: totalTime
                }
            },
            assistants: Array.from(this.extractedPrompts.values())
        };

        fs.writeFileSync(mainFilepath, JSON.stringify(mainData, null, 2));

        // Save individual assistant files if requested
        if (CONFIG.OUTPUT.SEPARATE_FILES_PER_ASSISTANT) {
            this.extractedPrompts.forEach((assistantData, assistantId) => {
                const filename = `prompt_${assistantData.name.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.json`;
                const filepath = path.join(resultsDir, filename);
                fs.writeFileSync(filepath, JSON.stringify(assistantData, null, 2));
            });
        }

        // Display summary
        console.log(`\n🎉 PROMPT EXTRACTION COMPLETE`);
        console.log(`🤖 Assistants found: ${this.stats.assistantsFound}`);
        console.log(`✅ Assistants processed: ${this.stats.assistantsProcessed}`);
        console.log(`📞 Calls analyzed: ${this.stats.callsAnalyzed}`);
        console.log(`📝 Prompts extracted: ${this.stats.promptsExtracted}`);
        console.log(`⏱️ Processing time: ${totalTime.toFixed(1)}s`);
        console.log(`📁 Main results: ${mainFilename}`);

        if (this.stats.errors.length > 0) {
            console.log(`⚠️ Errors encountered: ${this.stats.errors.length}`);
        }

        return mainFilepath;
    }
}

async function main() {
    const extractor = new AdvancedPromptExtractor();

    try {
        console.log('🚀 Starting advanced prompt extraction...\n');

        // Validate API key
        if (!CONFIG.API.API_KEY) {
            throw new Error('VAPI_API_KEY not found in environment variables');
        }

        // Get all assistants
        const allAssistants = await extractor.getAssistants();

        // Filter assistants if specified
        let assistantsToProcess = allAssistants;

        if (CONFIG.FILTERING.SPECIFIC_ASSISTANT_IDS.length > 0) {
            assistantsToProcess = allAssistants.filter(assistant =>
                CONFIG.FILTERING.SPECIFIC_ASSISTANT_IDS.includes(assistant.id)
            );
            console.log(`🎯 Filtering to ${assistantsToProcess.length} specific assistants`);
        }

        if (!CONFIG.FILTERING.INCLUDE_TEST_ASSISTANTS) {
            const beforeCount = assistantsToProcess.length;
            assistantsToProcess = assistantsToProcess.filter(assistant =>
                !(assistant.name && (
                    assistant.name.toLowerCase().includes('test') ||
                    assistant.name.toLowerCase().includes('demo') ||
                    assistant.name.toLowerCase().includes('trial')
                ))
            );
            const filtered = beforeCount - assistantsToProcess.length;
            if (filtered > 0 && CONFIG.OUTPUT.VERBOSE) {
                console.log(`🚫 Filtered out ${filtered} test/demo assistants`);
            }
        }

        console.log(`📋 Processing ${assistantsToProcess.length} assistants...\n`);

        // Process each assistant
        for (let i = 0; i < assistantsToProcess.length; i++) {
            const assistant = assistantsToProcess[i];

            if (CONFIG.OUTPUT.VERBOSE) {
                console.log(`\n[${i + 1}/${assistantsToProcess.length}]`);
            }

            await extractor.processAssistant(assistant);

            // Small delay to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Save all results
        const resultFile = await extractor.saveResults();
        console.log(`\n📍 Results saved to: ${resultFile}`);

    } catch (error) {
        console.error('❌ Prompt extraction failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = AdvancedPromptExtractor;