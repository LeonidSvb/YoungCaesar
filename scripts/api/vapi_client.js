require('dotenv').config();
const fetch = require('node-fetch');

class VapiClient {
    constructor() {
        this.apiKey = process.env.VAPI_API_KEY;
        this.baseUrl = 'https://api.vapi.ai';
        this.maxCallsPerRequest = 100;
    }

    async testConnection() {
        try {
            const response = await fetch(`${this.baseUrl}/call?limit=1`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            return true;
        } catch (error) {
            throw new Error(`VAPI connection failed: ${error.message}`);
        }
    }

    async getAllCalls(startDate, endDate) {
        console.log(`📞 Collecting VAPI calls from ${startDate} to ${endDate}`);
        return await this.getAllCallsRecursive(startDate, endDate);
    }

    // Алиас для совместимости
    async getCalls(startDate, endDate) {
        return await this.getAllCalls(startDate, endDate);
    }

    async getCallsInPeriod(startTime, endTime, limit = 100) {
        try {
            const params = new URLSearchParams({
                createdAtGe: startTime,
                createdAtLt: endTime,
                limit: limit.toString()
            });
            
            const url = `${this.baseUrl}/call?${params}`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            return data;
            
        } catch (error) {
            console.error(`❌ VAPI API Error: ${error.message}`);
            throw error;
        }
    }

    async getAllCallsRecursive(startTime, endTime, depth = 0) {
        const indent = "  ".repeat(depth);
        
        try {
            const calls = await this.getCallsInPeriod(startTime, endTime, this.maxCallsPerRequest);
            
            if (calls.length < this.maxCallsPerRequest) {
                console.log(`${indent}✅ Got ${calls.length} calls`);
                return calls;
                
            } else {
                console.log(`${indent}⚡ Splitting period (${this.maxCallsPerRequest} calls limit reached)`);
                
                const startMs = new Date(startTime).getTime();
                const endMs = new Date(endTime).getTime();
                const middleMs = startMs + (endMs - startMs) / 2;
                const middleTime = new Date(middleMs).toISOString();
                
                const part1 = await this.getAllCallsRecursive(startTime, middleTime, depth + 1);
                const part2 = await this.getAllCallsRecursive(middleTime, endTime, depth + 1);
                
                return [...part1, ...part2];
            }
            
        } catch (error) {
            console.error(`${indent}❌ Error in period ${startTime} - ${endTime}: ${error.message}`);
            return [];
        }
    }

    async getAssistants() {
        try {
            const response = await fetch(`${this.baseUrl}/assistant`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log(`✅ Retrieved ${data.length} assistants`);
            return data;
            
        } catch (error) {
            console.error(`❌ Error getting assistants: ${error.message}`);
            throw error;
        }
    }

    analyzeCallsForDay(calls, date) {
        const stats = {
            date: date,
            totalCalls: calls.length,
            withTranscript: 0,
            withoutTranscript: 0,
            successfulCalls: 0,
            failedCalls: 0,
            duration30Plus: 0,
            duration60Plus: 0,
            duration120Plus: 0,
            totalCost: 0,
            avgDuration: 0,
            assistantBreakdown: {},
            statusBreakdown: {}
        };

        let totalDuration = 0;

        calls.forEach(call => {
            if (call.transcript && call.transcript !== 'N/A') {
                stats.withTranscript++;
            } else {
                stats.withoutTranscript++;
            }

            if (call.status === 'completed') {
                stats.successfulCalls++;
            } else {
                stats.failedCalls++;
            }

            const duration = call.duration || 0;
            totalDuration += duration;

            if (duration >= 30) stats.duration30Plus++;
            if (duration >= 60) stats.duration60Plus++;
            if (duration >= 120) stats.duration120Plus++;

            stats.totalCost += call.cost || 0;

            const assistant = call.assistantId || 'unknown';
            stats.assistantBreakdown[assistant] = (stats.assistantBreakdown[assistant] || 0) + 1;

            const status = call.status || 'unknown';
            stats.statusBreakdown[status] = (stats.statusBreakdown[status] || 0) + 1;
        });

        stats.avgDuration = calls.length > 0 ? Math.round(totalDuration / calls.length) : 0;

        return stats;
    }
}

module.exports = VapiClient;