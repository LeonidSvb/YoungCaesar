require('dotenv').config();
const fs = require('fs');
const path = require('path');

// ============================================================
// CONFIGURATION - EDIT HERE
// ============================================================

const CONFIG = {
    // Input file with calls
    INPUT_FILE: '../vapi_collection/results/2025-09-17T09-51-00_vapi_calls_2025-01-01_to_2025-09-17_cost-0.03.json',

    // Output files
    OUTPUT_LEXICON: 'config/lexicons_real.js',
    OUTPUT_ANALYSIS: 'temp/lexicon_analysis.json',

    // Analysis settings
    TOP_CALLS_COUNT: 100,           // Analyze top N longest calls
    MIN_PHRASE_FREQUENCY: 3,        // Minimum times phrase must appear
    MIN_TRANSCRIPT_LENGTH: 100,     // Min chars in transcript to consider

    // Extraction patterns
    PATTERNS: {
        brand_intro: /this is .* from young caesar|calling from young caesar|.* with young caesar/gi,
        value_prop: /help.*manufactur.*|customer acquisition|without.*trade shows?|without.*referrals?/gi,
        cta_phrases: /meeting|schedule|calendar|email|send.*information|call.*back/gi,
        objection_responses: /understand|appreciate|respect.*time|won't.*keep.*you|just.*moment/gi
    }
};

// ============================================================
// MAIN FUNCTIONS
// ============================================================

class LexiconBuilder {
    constructor() {
        this.results = {
            brand_mentions: {},
            value_propositions: {},
            cta_phrases: {},
            objection_responses: {},
            client_objections: {}
        };
    }

    async build() {
        console.log('🚀 Starting lexicon analysis...');
        console.log(`📊 Config: Top ${CONFIG.TOP_CALLS_COUNT} calls, min frequency ${CONFIG.MIN_PHRASE_FREQUENCY}`);

        // Step 1: Load and filter data
        const topCalls = await this.loadTopCalls();
        console.log(`✅ Loaded ${topCalls.length} top calls`);

        // Step 2: Extract patterns from bot messages
        this.extractBotPatterns(topCalls);

        // Step 3: Extract client objections
        this.extractClientPatterns(topCalls);

        // Step 4: Generate lexicon file
        await this.generateLexiconFile();

        // Step 5: Save analysis
        await this.saveAnalysis();

        console.log('✅ Lexicon building completed!');
    }

    async loadTopCalls() {
        console.log('📖 Loading calls data...');

        const inputPath = path.resolve(__dirname, CONFIG.INPUT_FILE);
        const rawData = fs.readFileSync(inputPath, 'utf8');
        const allCalls = JSON.parse(rawData);

        console.log(`📊 Total calls in file: ${allCalls.length}`);

        // Filter and sort by transcript length
        const validCalls = allCalls
            .filter(call => call.transcript && call.transcript.length > CONFIG.MIN_TRANSCRIPT_LENGTH)
            .map(call => ({
                id: call.id,
                transcript: call.transcript,
                messages: call.messages?.filter(m => m.role === 'bot' || m.role === 'user') || [],
                length: call.transcript.length
            }))
            .sort((a, b) => b.length - a.length)
            .slice(0, CONFIG.TOP_CALLS_COUNT);

        console.log(`📈 Filtered to ${validCalls.length} calls with substantial transcripts`);
        if (validCalls.length > 0) {
            console.log(`📏 Length range: ${validCalls[0].length} - ${validCalls[validCalls.length-1].length} chars`);
        }

        return validCalls;
    }

    extractBotPatterns(calls) {
        console.log('🔍 Extracting bot message patterns...');

        const botMessages = [];
        calls.forEach(call => {
            call.messages
                .filter(m => m.role === 'bot' && m.message && m.message.length > 10)
                .forEach(m => botMessages.push(m.message.toLowerCase().trim()));
        });

        console.log(`💬 Found ${botMessages.length} bot messages`);

        // Extract brand introductions
        this.extractPattern(botMessages, CONFIG.PATTERNS.brand_intro, 'brand_mentions',
            'Brand introduction patterns');

        // Extract value propositions
        this.extractPattern(botMessages, CONFIG.PATTERNS.value_prop, 'value_propositions',
            'Value proposition patterns');

        // Extract CTAs
        this.extractPattern(botMessages, CONFIG.PATTERNS.cta_phrases, 'cta_phrases',
            'Call-to-action patterns');

        // Extract objection responses
        this.extractPattern(botMessages, CONFIG.PATTERNS.objection_responses, 'objection_responses',
            'Objection response patterns');
    }

    extractClientPatterns(calls) {
        console.log('🔍 Extracting client objection patterns...');

        const clientMessages = [];
        calls.forEach(call => {
            call.messages
                .filter(m => m.role === 'user' && m.message && m.message.length > 5)
                .forEach(m => clientMessages.push(m.message.toLowerCase().trim()));
        });

        console.log(`💬 Found ${clientMessages.length} client messages`);

        // Common objection patterns
        const objectionPatterns = /not interested|busy|call.*later|remove.*me|stop.*call|no.*thank/gi;
        this.extractPattern(clientMessages, objectionPatterns, 'client_objections',
            'Client objection patterns');
    }

    extractPattern(messages, pattern, category, description) {
        const matches = {};

        messages.forEach(message => {
            const found = message.match(pattern);
            if (found) {
                found.forEach(match => {
                    const clean = match.trim().toLowerCase();
                    if (clean.length > 3) {
                        matches[clean] = (matches[clean] || 0) + 1;
                    }
                });
            }
        });

        // Filter by frequency
        const filtered = Object.entries(matches)
            .filter(([phrase, count]) => count >= CONFIG.MIN_PHRASE_FREQUENCY)
            .sort((a, b) => b[1] - a[1]);

        this.results[category] = filtered;
        console.log(`  ✅ ${description}: ${filtered.length} patterns (${Object.keys(matches).length} total)`);
    }

    async generateLexiconFile() {
        console.log('📝 Generating lexicon file...');

        const lexiconContent = `// Real data-driven lexicon generated from ${CONFIG.TOP_CALLS_COUNT} top calls
// Generated on: ${new Date().toISOString()}

const LEXICONS = {
    // Brand mentions (from real transcripts)
    brand_canonical: "Young Caesar",
    brand_mentions: [
        ${this.results.brand_mentions.map(([phrase]) => `"${phrase}"`).slice(0, 10).join(',\n        ')}
    ],

    // Value propositions (from real calls)
    value: [
        ${this.results.value_propositions.map(([phrase]) => `"${phrase}"`).slice(0, 15).join(',\n        ')}
    ],

    // Call-to-action phrases (from real transcripts)
    cta: [
        ${this.results.cta_phrases.map(([phrase]) => `"${phrase}"`).slice(0, 15).join(',\n        ')}
    ],

    // Objection responses (real agent responses)
    apology: [
        ${this.results.objection_responses.map(([phrase]) => `"${phrase}"`).slice(0, 10).join(',\n        ')}
    ],

    // Client objections (real client messages)
    stop: [
        ${this.results.client_objections.map(([phrase]) => `"${phrase}"`).slice(0, 10).join(',\n        ')}
    ],

    // Wait phrases (manual - need more analysis)
    wait: [
        "one moment", "just a moment", "let me check", "please hold"
    ],

    // Language detection (unchanged)
    language_detection: {
        english: [
            "the", "and", "to", "of", "a", "in", "is", "it", "you", "that"
        ]
    },

    // Outcome patterns (need analysis from successful calls)
    outcomes: {
        meeting_booked: ["meeting scheduled", "calendar invite", "appointment set"],
        warm_lead: ["interested", "sounds good", "tell me more"],
        callback_set: ["call back", "call later", "better time"],
        info_sent: ["sending information", "email sent"]
    }
};

// Helper functions (unchanged)
function findPatternMatch(text, patterns, options = {}) {
    const {
        caseSensitive = false,
        fuzzyMatch = false,
        maxDistance = 1
    } = options;

    const searchText = caseSensitive ? text : text.toLowerCase();

    for (const pattern of patterns) {
        const searchPattern = caseSensitive ? pattern : pattern.toLowerCase();

        if (fuzzyMatch) {
            if (levenshteinDistance(searchText, searchPattern) <= maxDistance) {
                return { found: true, pattern, match: searchText };
            }
        } else {
            if (searchText.includes(searchPattern)) {
                return { found: true, pattern, match: searchPattern };
            }
        }
    }

    return { found: false, pattern: null, match: null };
}

function levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[str2.length][str1.length];
}

module.exports = {
    LEXICONS,
    findPatternMatch,
    levenshteinDistance
};`;

        // Ensure temp directory exists
        const tempDir = path.dirname(path.resolve(__dirname, CONFIG.OUTPUT_ANALYSIS));
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const outputPath = path.resolve(__dirname, CONFIG.OUTPUT_LEXICON);
        fs.writeFileSync(outputPath, lexiconContent);

        console.log(`✅ Lexicon saved to: ${outputPath}`);
    }

    async saveAnalysis() {
        const analysis = {
            timestamp: new Date().toISOString(),
            config: CONFIG,
            stats: {
                brand_mentions: this.results.brand_mentions.length,
                value_propositions: this.results.value_propositions.length,
                cta_phrases: this.results.cta_phrases.length,
                objection_responses: this.results.objection_responses.length,
                client_objections: this.results.client_objections.length
            },
            top_patterns: {
                brand_mentions: this.results.brand_mentions.slice(0, 5),
                value_propositions: this.results.value_propositions.slice(0, 5),
                cta_phrases: this.results.cta_phrases.slice(0, 5),
                objection_responses: this.results.objection_responses.slice(0, 5),
                client_objections: this.results.client_objections.slice(0, 5)
            }
        };

        // Ensure temp directory exists
        const outputPath = path.resolve(__dirname, CONFIG.OUTPUT_ANALYSIS);
        const tempDir = path.dirname(outputPath);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        fs.writeFileSync(outputPath, JSON.stringify(analysis, null, 2));
        console.log(`📊 Analysis saved to: ${outputPath}`);
    }
}

// ============================================================
// CLI EXECUTION
// ============================================================

async function main() {
    try {
        const builder = new LexiconBuilder();
        await builder.build();

        console.log('\n🎯 Summary:');
        console.log('1. Analyzed top 100 longest calls');
        console.log('2. Extracted real phrases from transcripts');
        console.log('3. Generated data-driven lexicon');
        console.log('4. Ready to replace old lexicon');

        console.log('\n✅ Next steps:');
        console.log('1. Review generated lexicon in config/lexicons_real.js');
        console.log('2. Replace old lexicons.js with new version');
        console.log('3. Test QCI analyzer with real lexicon');

    } catch (error) {
        console.error('❌ Lexicon building failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = LexiconBuilder;