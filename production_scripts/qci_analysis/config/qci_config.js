const QCI_CONFIG = {
    TEST: {
        batchSize: 5,
        maxConcurrent: 2,
        retryAttempts: 2,
        saveResults: true,
        saveProgress: false,
        verbose: true
    },

    DEFAULT: {
        batchSize: 20,
        maxConcurrent: 5,
        retryAttempts: 3,
        saveResults: true,
        saveProgress: true,
        verbose: true
    },

    MEDIUM: {
        batchSize: 20,
        maxConcurrent: 5,
        retryAttempts: 3,
        saveResults: true,
        saveProgress: true,
        verbose: true
    },

    LARGE: {
        batchSize: 50,
        maxConcurrent: 10,
        retryAttempts: 3,
        saveResults: true,
        saveProgress: true,
        verbose: false,
        useBatchAPI: false
    },

    PRODUCTION: {
        batchSize: 100,
        maxConcurrent: 15,
        retryAttempts: 5,
        saveResults: true,
        saveProgress: true,
        verbose: false,
        useBatchAPI: false
    }
};

const QCI_SCORING = {
    DYNAMICS: {
        MAX_POINTS: 30,
        AGENT_TALK_RATIO: {
            MAX_POINTS: 8,
            TARGET_MIN: 0.35,
            TARGET_MAX: 0.55,
            FALLOFF_MIN: 0.25,
            FALLOFF_MAX: 0.65
        },
        TIME_TO_VALUE: {
            MAX_POINTS: 8,
            TARGET_SECONDS: 20,
            PENALTY_PER_5S: 1
        },
        FIRST_CTA: {
            MAX_POINTS: 8,
            TARGET_SECONDS: 120,
            PENALTY_PER_30S: 2
        },
        DEAD_AIR: {
            MAX_PENALTY: 6,
            THRESHOLD_SECONDS: 3,
            PENALTY_PER_EVENT: 2,
            GRACE_PERIOD: 1
        }
    },

    OBJECTIONS: {
        MAX_POINTS: 20,
        RECOGNIZED_RESISTANCE: {
            MAX_POINTS: 6,
            QUICK_RESPONSE_SECONDS: 5,
            LATE_RESPONSE_SECONDS: 10,
            LATE_SCORE: 3
        },
        TIME_TO_COMPLY: {
            MAX_POINTS: 8,
            TARGET_SECONDS: 10,
            PENALTY_PER_2S: 1,
            GATE_THRESHOLD: 10
        },
        ALTERNATIVE_OFFERED: {
            MAX_POINTS: 6
        }
    },

    BRAND: {
        MAX_POINTS: 20,
        FIRST_BRAND_MENTION: {
            MAX_POINTS: 8,
            TARGET_SECONDS: 10,
            PENALTY_PER_5S: 1,
            GATE_THRESHOLD: 10
        },
        BRAND_VARIANTS: {
            MAX_POINTS: 8,
            PERFECT_CONSISTENCY: 1,
            PENALTY_PER_VARIANT: 4,
            DISTANCE_THRESHOLD: 0.20
        },
        LANGUAGE_MATCH: {
            MAX_POINTS: 4,
            SWITCH_TIME_SECONDS: 15
        }
    },

    OUTCOME: {
        MAX_POINTS: 30,
        OUTCOMES: {
            MEETING_BOOKED: 15,
            WARM_LEAD: 10,
            CALLBACK_SET: 6,
            INFO_SENT: 4,
            NO_OUTCOME: 0
        },
        WRAP_UP: {
            MAX_POINTS: 5
        },
        TOOL_HYGIENE: {
            MAX_POINTS: 10,
            DUPLICATE_WAIT: 4,
            APOLOGY_RATE: 3,
            POST_TOOL_LATENCY: 3,
            LATENCY_THRESHOLD: 2,
            APOLOGY_WINDOW: 60
        }
    }
};

const QCI_THRESHOLDS = {
    PASS: 80,
    REVIEW: 60,
    FAIL: 0
};

module.exports = {
    QCI_CONFIG,
    QCI_SCORING,
    QCI_THRESHOLDS
};