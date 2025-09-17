// Real data-driven lexicon generated from 100 top calls
// Generated on: 2025-09-17T10:10:52.112Z

const LEXICONS = {
    // Brand mentions (from real transcripts)
    brand_canonical: "Young Caesar",
    brand_mentions: [
        "this is avery martinez from young caesar",
        "this is amelia smith from young caesar",
        "this is alex calling from young caesar",
        "calling from young caesar",
        "this is ella thomas from young caesar",
        "hi, jake. this is alex with young caesar",
        "this is clara flores from young caesar"
    ],

    // Value propositions (from real calls)
    value: [
        "without trade shows"
    ],

    // Call-to-action phrases (from real transcripts)
    cta: [
        "email",
        "meeting",
        "schedule",
        "calendar",
        "send over some information",
        "send the information"
    ],

    // Objection responses (real agent responses)
    apology: [
        "appreciate",
        "understand",
        "just a moment"
    ],

    // Client objections (real client messages)
    stop: [
        "not interested"
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
};