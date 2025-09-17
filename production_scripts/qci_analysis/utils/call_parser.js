class CallParser {
    static parse(callData) {
        try {
            const parsed = {
                id: this.extractId(callData),
                duration: this.calculateDuration(callData),
                transcript: this.extractTranscript(callData),
                messages: this.extractMessages(callData),
                startTime: this.extractStartTime(callData),
                endTime: this.extractEndTime(callData),
                status: this.extractStatus(callData),
                cost: this.extractCost(callData),
                isValid: false
            };

            parsed.isValid = this.validateCall(parsed);

            return parsed;

        } catch (error) {
            console.error('Error parsing call:', error);
            return {
                id: 'unknown',
                isValid: false,
                error: error.message
            };
        }
    }

    static extractId(callData) {
        return callData.id || callData.callId || 'unknown';
    }

    static calculateDuration(callData) {
        if (callData.duration) return callData.duration;

        if (callData.startedAt && callData.endedAt) {
            const start = new Date(callData.startedAt);
            const end = new Date(callData.endedAt);
            return Math.round((end - start) / 1000);
        }

        const messages = this.extractMessages(callData);
        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            return lastMessage.secondsFromStart || 0;
        }

        return 0;
    }

    static extractTranscript(callData) {
        if (callData.transcript && callData.transcript !== '') {
            return callData.transcript;
        }

        if (callData.artifact?.transcript && callData.artifact.transcript !== '') {
            return callData.artifact.transcript;
        }

        return this.buildTranscriptFromMessages(callData);
    }

    static buildTranscriptFromMessages(callData) {
        const messages = this.extractMessages(callData);

        return messages
            .filter(msg => msg.role === 'bot' || msg.role === 'user')
            .map(msg => {
                const speaker = msg.role === 'bot' ? 'AI' : 'User';
                return `${speaker}: ${msg.message}`;
            })
            .join('\n');
    }

    static extractMessages(callData) {
        let rawMessages = [];

        if (callData.messages && Array.isArray(callData.messages)) {
            rawMessages = callData.messages;
        } else if (callData.artifact?.messages && Array.isArray(callData.artifact.messages)) {
            rawMessages = callData.artifact.messages;
        } else if (callData.conversation && Array.isArray(callData.conversation)) {
            rawMessages = callData.conversation;
        }

        return rawMessages
            .filter(msg => msg.role && msg.message)
            .map((msg, index) => ({
                role: this.normalizeRole(msg.role),
                message: msg.message.trim(),
                time: msg.time || 0,
                endTime: msg.endTime || msg.time || 0,
                duration: msg.duration || 0,
                secondsFromStart: this.calculateSecondsFromStart(msg, index, rawMessages)
            }))
            .filter(msg => msg.message.length > 0);
    }

    static normalizeRole(role) {
        const roleMap = {
            'bot': 'bot',
            'assistant': 'bot',
            'ai': 'bot',
            'agent': 'bot',
            'user': 'user',
            'customer': 'user',
            'client': 'user',
            'human': 'user',
            'system': 'system'
        };

        return roleMap[role.toLowerCase()] || role;
    }

    static calculateSecondsFromStart(msg, index, allMessages) {
        if (msg.secondsFromStart !== undefined && msg.secondsFromStart !== null) {
            return msg.secondsFromStart;
        }

        if (msg.time && allMessages[0]?.time) {
            const startTime = allMessages[0].time;
            return Math.round((msg.time - startTime) / 1000);
        }

        return index * 2;
    }

    static extractStartTime(callData) {
        return callData.startedAt || callData.createdAt || new Date().toISOString();
    }

    static extractEndTime(callData) {
        return callData.endedAt || callData.updatedAt || new Date().toISOString();
    }

    static extractStatus(callData) {
        return callData.status || callData.endedReason || 'unknown';
    }

    static extractCost(callData) {
        if (callData.cost) return callData.cost;
        if (callData.costBreakdown?.total) return callData.costBreakdown.total;
        return 0;
    }

    static validateCall(parsedCall) {
        const validations = [
            parsedCall.id && parsedCall.id !== 'unknown',
            parsedCall.duration > 0,
            parsedCall.transcript && parsedCall.transcript.length > 10,
            parsedCall.messages && parsedCall.messages.length > 0
        ];

        return validations.every(Boolean);
    }

    static getCallInfo(parsedCall) {
        const botMessages = parsedCall.messages.filter(m => m.role === 'bot');
        const userMessages = parsedCall.messages.filter(m => m.role === 'user');

        return {
            id: parsedCall.id,
            duration: parsedCall.duration,
            transcriptLength: parsedCall.transcript.length,
            messageCount: parsedCall.messages.length,
            botMessageCount: botMessages.length,
            userMessageCount: userMessages.length,
            avgMessageLength: parsedCall.messages.length > 0
                ? Math.round(parsedCall.messages.reduce((sum, m) => sum + m.message.length, 0) / parsedCall.messages.length)
                : 0,
            cost: parsedCall.cost,
            isValid: parsedCall.isValid
        };
    }

    static filterValidCalls(calls) {
        const parsed = calls.map(call => this.parse(call));
        const valid = parsed.filter(call => call.isValid);

        console.log(`Parsed ${calls.length} calls, ${valid.length} are valid`);

        return {
            parsed,
            valid,
            invalid: parsed.filter(call => !call.isValid),
            validationRate: valid.length / calls.length
        };
    }

    static getParsingStats(calls) {
        const results = this.filterValidCalls(calls);

        const stats = {
            total: calls.length,
            valid: results.valid.length,
            invalid: results.invalid.length,
            validationRate: `${Math.round(results.validationRate * 100)}%`,
            avgDuration: 0,
            avgTranscriptLength: 0,
            avgMessageCount: 0
        };

        if (results.valid.length > 0) {
            stats.avgDuration = Math.round(
                results.valid.reduce((sum, call) => sum + call.duration, 0) / results.valid.length
            );
            stats.avgTranscriptLength = Math.round(
                results.valid.reduce((sum, call) => sum + call.transcript.length, 0) / results.valid.length
            );
            stats.avgMessageCount = Math.round(
                results.valid.reduce((sum, call) => sum + call.messages.length, 0) / results.valid.length
            );
        }

        return stats;
    }
}

module.exports = CallParser;