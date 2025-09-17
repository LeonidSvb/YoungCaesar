const LEXICONS = {
    cta: [
        "meeting", "schedule", "book", "calendar", "appointment", "demo",
        "call", "discuss", "talk", "connect", "follow up", "follow-up",
        "email", "send", "information", "details", "brochure", "callback",
        "call back", "reach out", "contact", "get back", "touch base"
    ],

    stop: [
        "stop", "not interested", "no thank you", "not thank you", "busy",
        "call later", "call back later", "do not call", "don't call",
        "remove", "take off", "unsubscribe", "no soliciting", "not now",
        "bad time", "can't talk", "in a meeting", "driving", "not available"
    ],

    apology: [
        "sorry", "apologize", "apologies", "I understand", "understand",
        "no problem", "that's okay", "that's fine", "my mistake",
        "I won't keep you", "won't take long", "just a moment",
        "I appreciate", "thank you for", "respect your time"
    ],

    wait: [
        "one moment", "just a moment", "hold on", "please hold",
        "let me check", "checking now", "looking that up",
        "give me a second", "one second", "bear with me",
        "please wait", "hold please"
    ],

    value: [
        "save money", "reduce costs", "cut costs", "lower costs",
        "increase sales", "boost sales", "grow sales", "more revenue",
        "improve efficiency", "streamline", "optimize", "automate",
        "save time", "faster", "quicker", "eliminate waste",
        "competitive advantage", "market share", "ROI", "return on investment",
        "profit", "profitable", "growth", "scale", "productivity",
        "without trade shows", "without referrals", "new customers",
        "acquire customers", "customer acquisition", "lead generation"
    ],

    brand_canonical: "Young Caesar",

    brand_variants: [
        "Young Caesar", "young caesar", "Young Cesar", "young cesar",
        "YC", "Y.C.", "Young C", "Caesar"
    ],

    language_detection: {
        english: [
            "the", "and", "to", "of", "a", "in", "is", "it", "you", "that",
            "he", "was", "for", "on", "are", "as", "with", "his", "they", "i"
        ],
        spanish: [
            "el", "la", "de", "que", "y", "en", "un", "es", "se", "no",
            "te", "lo", "le", "da", "su", "por", "son", "con", "para", "al"
        ],
        french: [
            "le", "de", "et", "à", "un", "il", "être", "et", "en", "avoir",
            "que", "pour", "dans", "ce", "son", "une", "sur", "avec", "ne", "se"
        ]
    },

    outcomes: {
        meeting_booked: [
            "meeting scheduled", "calendar invite", "book a meeting",
            "appointment set", "demo scheduled", "I'll send the invite",
            "meeting booked", "call scheduled", "follow up meeting"
        ],
        warm_lead: [
            "interested", "sounds good", "tell me more", "send information",
            "email me", "call me back", "follow up", "keep in touch",
            "potential", "maybe", "consider", "think about it"
        ],
        callback_set: [
            "call back", "call later", "better time", "when should I call",
            "what time works", "reschedule", "try again"
        ],
        info_sent: [
            "sending information", "email sent", "sending details",
            "brochure sent", "information in your inbox"
        ]
    },

    tools_wait_phrases: [
        "let me check that", "checking our system", "looking that up",
        "pulling up your information", "accessing the database",
        "getting that information", "one moment while I"
    ],

    introduction_patterns: [
        "this is {{BRAND}}", "I'm from {{BRAND}}", "{{NAME}} from {{BRAND}}",
        "calling from {{BRAND}}", "{{NAME}} with {{BRAND}}",
        "I represent {{BRAND}}", "I work with {{BRAND}}"
    ]
};

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

function detectLanguage(text) {
    const words = text.toLowerCase().split(/\s+/).slice(0, 20); // first 20 words

    const scores = {
        english: 0,
        spanish: 0,
        french: 0
    };

    Object.keys(LEXICONS.language_detection).forEach(lang => {
        const stopwords = LEXICONS.language_detection[lang];
        words.forEach(word => {
            if (stopwords.includes(word)) {
                scores[lang]++;
            }
        });
    });

    let maxScore = 0;
    let detectedLang = 'english'; // default

    Object.keys(scores).forEach(lang => {
        if (scores[lang] > maxScore) {
            maxScore = scores[lang];
            detectedLang = lang;
        }
    });

    return {
        language: detectedLang,
        confidence: maxScore / Math.min(words.length, 20),
        scores
    };
}

function normalizeBrandName(brandMention, canonical = LEXICONS.brand_canonical) {
    const normalized = brandMention
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const canonicalNorm = canonical
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const distance = levenshteinDistance(normalized, canonicalNorm);
    const maxLen = Math.max(normalized.length, canonicalNorm.length);
    const similarity = 1 - (distance / maxLen);

    return {
        normalized,
        distance,
        similarity,
        isVariant: similarity < 0.8
    };
}

module.exports = {
    LEXICONS,
    findPatternMatch,
    levenshteinDistance,
    detectLanguage,
    normalizeBrandName
};