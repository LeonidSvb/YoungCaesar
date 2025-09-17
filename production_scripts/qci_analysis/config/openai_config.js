const OPENAI_CONFIG = {
    model: "gpt-4o-mini",
    temperature: 0.1,
    maxTokens: 2000,
    frequencyPenalty: 0,
    presencePenalty: 0,

    pricing: {
        input: 0.00015,   // $0.15 per 1M tokens
        output: 0.0006    // $0.60 per 1M tokens
    },

    rateLimiting: {
        requestsPerMinute: 500,
        tokensPerMinute: 200000,
        buffer: 0.8
    },

    retryConfig: {
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2
    }
};

const MODEL_ALTERNATIVES = {
    "gpt-4o-mini": {
        pricing: { input: 0.00015, output: 0.0006 },
        description: "Best balance of cost and quality for QCI analysis"
    },
    "gpt-4o": {
        pricing: { input: 0.005, output: 0.015 },
        description: "Highest quality, ~10x more expensive"
    },
    "gpt-3.5-turbo": {
        pricing: { input: 0.0005, output: 0.0015 },
        description: "Cheapest option, lower quality"
    }
};

const ESTIMATED_TOKENS = {
    input: {
        prompt: 1500,
        transcriptPerMinute: 300,
        messagesPerMessage: 50,
        lexicons: 200
    },
    output: {
        structuredResponse: 800,
        evidence: 400
    }
};

function estimateCallCost(callDurationMinutes, messageCount = 10, model = "gpt-4o-mini") {
    const modelConfig = MODEL_ALTERNATIVES[model] || MODEL_ALTERNATIVES["gpt-4o-mini"];

    const inputTokens =
        ESTIMATED_TOKENS.input.prompt +
        ESTIMATED_TOKENS.input.transcriptPerMinute * callDurationMinutes +
        ESTIMATED_TOKENS.input.messagesPerMessage * messageCount +
        ESTIMATED_TOKENS.input.lexicons;

    const outputTokens =
        ESTIMATED_TOKENS.output.structuredResponse +
        ESTIMATED_TOKENS.output.evidence;

    const inputCost = (inputTokens / 1000000) * modelConfig.pricing.input;
    const outputCost = (outputTokens / 1000000) * modelConfig.pricing.output;

    return {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        inputCost,
        outputCost,
        totalCost: inputCost + outputCost
    };
}

function estimateBatchCost(calls, model = "gpt-4o-mini") {
    const estimates = calls.map(call => {
        const duration = call.duration || 1; // минуты
        const messageCount = call.messages ? call.messages.length : 10;
        return estimateCallCost(duration / 60, messageCount, model);
    });

    return {
        totalCalls: calls.length,
        totalCost: estimates.reduce((sum, est) => sum + est.totalCost, 0),
        averageCostPerCall: estimates.reduce((sum, est) => sum + est.totalCost, 0) / calls.length,
        totalTokens: estimates.reduce((sum, est) => sum + est.totalTokens, 0),
        breakdown: {
            inputTokens: estimates.reduce((sum, est) => sum + est.inputTokens, 0),
            outputTokens: estimates.reduce((sum, est) => sum + est.outputTokens, 0)
        }
    };
}

module.exports = {
    OPENAI_CONFIG,
    MODEL_ALTERNATIVES,
    ESTIMATED_TOKENS,
    estimateCallCost,
    estimateBatchCost
};