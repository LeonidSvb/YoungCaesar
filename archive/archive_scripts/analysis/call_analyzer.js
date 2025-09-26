require('dotenv').config();
const fs = require('fs');
const path = require('path');

// ============================================================
// CONFIGURATION - CALL ANALYSIS TOOLS
// ============================================================

const CONFIG = {
    // Output settings
    OUTPUT_DIR: '../../data/processed',
    SAVE_RESULTS: true,
    VERBOSE: true,

    // Date filters
    SEPTEMBER_START: '2025-09-01T00:00:00.000Z',
    SEPTEMBER_END: '2025-09-30T23:59:59.999Z',
    DEFAULT_AFTER_DATE: '2025-09-14T00:00:00.000Z',

    // Analysis settings
    SAMPLE_SIZE: 10,
    LONG_CALL_THRESHOLD: 300, // seconds

    // Target call for searching
    TARGET_CALL_ID: '0a2ec1de-f7c8-4047-af0e-1693ef4ff221'
};

// ============================================================
// CALL ANALYZER CLASS
// ============================================================

class CallAnalyzer {
    constructor() {
        this.results = {
            septemberAnalysis: {},
            afterDateCounts: {},
            callSearch: {},
            longCalls: {}
        };
    }

    // SEPTEMBER CALLS ANALYSIS
    async analyzeSeptemberCalls() {
        console.log('📅 Analyzing September 2025 calls...\n');

        const vapiCalls = await this.getVapiCallsInRange(CONFIG.SEPTEMBER_START, CONFIG.SEPTEMBER_END);
        const airtableCalls = await this.getAirtableCallsInRange(CONFIG.SEPTEMBER_START, CONFIG.SEPTEMBER_END);

        const analysis = {
            period: 'September 2025',
            vapi: {
                total: vapiCalls ? vapiCalls.length : 0,
                successful: vapiCalls ? vapiCalls.filter(call => call.status === 'ended').length : 0,
                failed: vapiCalls ? vapiCalls.filter(call => call.status === 'failed').length : 0,
                avgDuration: vapiCalls && vapiCalls.length > 0 ?
                    vapiCalls.reduce((sum, call) => sum + (this.getCallDuration(call) || 0), 0) / vapiCalls.length : 0
            },
            airtable: {
                total: airtableCalls ? airtableCalls.length : 0,
                synced: 0,
                avgDuration: 0
            },
            comparison: {
                syncRate: 0,
                missingInAirtable: 0,
                recommendation: ''
            }
        };

        if (airtableCalls && airtableCalls.length > 0) {
            const airtableDurations = airtableCalls
                .map(call => call.fields['Duration (seconds)'])
                .filter(duration => duration && !isNaN(duration));

            analysis.airtable.avgDuration = airtableDurations.length > 0 ?
                airtableDurations.reduce((sum, duration) => sum + duration, 0) / airtableDurations.length : 0;
        }

        // Calculate sync rate
        if (analysis.vapi.total > 0) {
            analysis.comparison.syncRate = ((analysis.airtable.total / analysis.vapi.total) * 100).toFixed(2);
            analysis.comparison.missingInAirtable = analysis.vapi.total - analysis.airtable.total;

            if (analysis.comparison.syncRate > 95) {
                analysis.comparison.recommendation = 'Excellent sync rate';
            } else if (analysis.comparison.syncRate > 80) {
                analysis.comparison.recommendation = 'Good sync rate, minor gaps';
            } else {
                analysis.comparison.recommendation = 'Poor sync rate, investigate sync issues';
            }
        }

        console.log(`📞 VAPI calls: ${analysis.vapi.total} (${analysis.vapi.successful} successful, ${analysis.vapi.failed} failed)`);
        console.log(`📊 Airtable calls: ${analysis.airtable.total}`);
        console.log(`🔄 Sync rate: ${analysis.comparison.syncRate}%`);
        console.log(`⏱️ Avg duration - VAPI: ${analysis.vapi.avgDuration.toFixed(1)}s, Airtable: ${analysis.airtable.avgDuration.toFixed(1)}s`);
        console.log(`💡 ${analysis.comparison.recommendation}\n`);

        this.results.septemberAnalysis = analysis;
        return analysis;
    }

    async getVapiCallsInRange(startDate, endDate) {
        try {
            const url = `https://api.vapi.ai/call?createdAtGte=${encodeURIComponent(startDate)}&createdAtLte=${encodeURIComponent(endDate)}&limit=1000`;

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                console.error('VAPI API error:', response.status);
                return null;
            }

            const calls = await response.json();
            return Array.isArray(calls) ? calls : [];
        } catch (error) {
            console.error('Error fetching VAPI calls:', error.message);
            return null;
        }
    }

    async getAirtableCallsInRange(startDate, endDate) {
        try {
            const formula = `AND(
                IS_AFTER({Started At}, '${startDate.split('T')[0]}'),
                IS_BEFORE({Started At}, '${endDate.split('T')[0]}')
            )`;

            const url = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=1000`;

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                console.error('Airtable API error:', response.status);
                return null;
            }

            const data = await response.json();
            return data.records || [];
        } catch (error) {
            console.error('Error fetching Airtable calls:', error.message);
            return null;
        }
    }

    getCallDuration(call) {
        if (call.startedAt && call.endedAt) {
            return Math.round((new Date(call.endedAt) - new Date(call.startedAt)) / 1000);
        }
        return null;
    }

    // COUNT CALLS AFTER DATE
    async countCallsAfterDate(afterDate = CONFIG.DEFAULT_AFTER_DATE) {
        console.log(`📊 Counting calls after ${afterDate.split('T')[0]}...\n`);

        const vapiCalls = await this.getVapiCallsAfterDate(afterDate);
        const airtableCalls = await this.getAirtableCallsAfterDate(afterDate);

        const analysis = {
            cutoffDate: afterDate.split('T')[0],
            vapi: {
                total: vapiCalls ? vapiCalls.length : 0,
                byStatus: this.groupCallsByStatus(vapiCalls),
                byDay: this.groupCallsByDay(vapiCalls)
            },
            airtable: {
                total: airtableCalls ? airtableCalls.length : 0,
                byDay: this.groupAirtableCallsByDay(airtableCalls)
            },
            dailyComparison: {}
        };

        // Create daily comparison
        const allDays = new Set([
            ...Object.keys(analysis.vapi.byDay),
            ...Object.keys(analysis.airtable.byDay)
        ]);

        allDays.forEach(day => {
            analysis.dailyComparison[day] = {
                vapi: analysis.vapi.byDay[day] || 0,
                airtable: analysis.airtable.byDay[day] || 0,
                syncRate: 0
            };

            if (analysis.dailyComparison[day].vapi > 0) {
                analysis.dailyComparison[day].syncRate =
                    ((analysis.dailyComparison[day].airtable / analysis.dailyComparison[day].vapi) * 100).toFixed(1);
            }
        });

        console.log(`📞 Total VAPI calls: ${analysis.vapi.total}`);
        console.log(`📊 Total Airtable calls: ${analysis.airtable.total}`);
        console.log('\n📅 Daily breakdown:');

        Object.entries(analysis.dailyComparison)
            .sort()
            .forEach(([day, stats]) => {
                console.log(`  ${day}: VAPI=${stats.vapi}, Airtable=${stats.airtable} (${stats.syncRate}% sync)`);
            });

        console.log('\n📈 Status breakdown (VAPI):');
        Object.entries(analysis.vapi.byStatus).forEach(([status, count]) => {
            console.log(`  ${status}: ${count} calls`);
        });

        this.results.afterDateCounts = analysis;
        return analysis;
    }

    async getVapiCallsAfterDate(afterDate) {
        try {
            const url = `https://api.vapi.ai/call?createdAtGte=${encodeURIComponent(afterDate)}&limit=1000`;

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) return null;

            const calls = await response.json();
            return Array.isArray(calls) ? calls : [];
        } catch (error) {
            console.error('Error fetching VAPI calls after date:', error.message);
            return null;
        }
    }

    async getAirtableCallsAfterDate(afterDate) {
        try {
            const formula = `IS_AFTER({Started At}, '${afterDate.split('T')[0]}')`;
            const url = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=1000`;

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) return null;

            const data = await response.json();
            return data.records || [];
        } catch (error) {
            console.error('Error fetching Airtable calls after date:', error.message);
            return null;
        }
    }

    groupCallsByStatus(calls) {
        if (!calls) return {};

        return calls.reduce((groups, call) => {
            const status = call.status || 'unknown';
            groups[status] = (groups[status] || 0) + 1;
            return groups;
        }, {});
    }

    groupCallsByDay(calls) {
        if (!calls) return {};

        return calls.reduce((groups, call) => {
            const day = call.createdAt ? call.createdAt.split('T')[0] : 'unknown';
            groups[day] = (groups[day] || 0) + 1;
            return groups;
        }, {});
    }

    groupAirtableCallsByDay(calls) {
        if (!calls) return {};

        return calls.reduce((groups, call) => {
            const startedAt = call.fields['Started At'];
            const day = startedAt ? startedAt.split('T')[0] : 'unknown';
            groups[day] = (groups[day] || 0) + 1;
            return groups;
        }, {});
    }

    // FIND AND COUNT AFTER SPECIFIC CALL
    async findCallAndCountAfter(targetCallId = CONFIG.TARGET_CALL_ID) {
        console.log(`🎯 Finding call ${targetCallId.slice(0, 8)}... and counting calls after it...\n`);

        const targetCall = await this.findSpecificCall(targetCallId);

        if (!targetCall) {
            console.log('❌ Target call not found');
            return { found: false };
        }

        console.log('✅ Target call found!');
        console.log(`📞 Call ID: ${targetCall.id}`);
        console.log(`📅 Started: ${targetCall.startedAt}`);
        console.log(`⏱️ Duration: ${this.getCallDuration(targetCall) || 'Unknown'} seconds`);
        console.log(`📋 Status: ${targetCall.status}\n`);

        // Count calls after this one
        const callsAfter = await this.countCallsAfterDate(targetCall.startedAt);

        const analysis = {
            found: true,
            targetCall: {
                id: targetCall.id,
                startedAt: targetCall.startedAt,
                duration: this.getCallDuration(targetCall),
                status: targetCall.status,
                phone: targetCall.customer?.number,
                assistant: targetCall.assistant?.name
            },
            callsAfter: callsAfter
        };

        this.results.callSearch = analysis;
        return analysis;
    }

    async findSpecificCall(callId) {
        try {
            const response = await fetch(`https://api.vapi.ai/call/${callId}`, {
                headers: {
                    'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    console.log('Call not found in VAPI');
                } else {
                    console.error('VAPI API error:', response.status);
                }
                return null;
            }

            return await response.json();
        } catch (error) {
            console.error('Error finding specific call:', error.message);
            return null;
        }
    }

    // ANALYZE LONG CALLS
    async analyzeLongCalls() {
        console.log(`🕐 Analyzing calls longer than ${CONFIG.LONG_CALL_THRESHOLD} seconds...\n`);

        const recentCalls = await this.getVapiCallsAfterDate(CONFIG.DEFAULT_AFTER_DATE);

        if (!recentCalls) {
            console.log('❌ Could not fetch recent calls');
            return null;
        }

        const longCalls = recentCalls
            .filter(call => {
                const duration = this.getCallDuration(call);
                return duration && duration > CONFIG.LONG_CALL_THRESHOLD;
            })
            .sort((a, b) => this.getCallDuration(b) - this.getCallDuration(a))
            .slice(0, 10);

        const analysis = {
            threshold: CONFIG.LONG_CALL_THRESHOLD,
            totalCallsAnalyzed: recentCalls.length,
            longCallsFound: longCalls.length,
            percentage: ((longCalls.length / recentCalls.length) * 100).toFixed(2),
            longestCall: longCalls[0] ? {
                id: longCalls[0].id,
                duration: this.getCallDuration(longCalls[0]),
                startedAt: longCalls[0].startedAt,
                status: longCalls[0].status
            } : null,
            averageDuration: longCalls.length > 0 ?
                longCalls.reduce((sum, call) => sum + this.getCallDuration(call), 0) / longCalls.length : 0,
            longCalls: longCalls.slice(0, 5).map(call => ({
                id: call.id,
                duration: this.getCallDuration(call),
                startedAt: call.startedAt,
                status: call.status,
                phone: call.customer?.number
            }))
        };

        console.log(`📊 Found ${analysis.longCallsFound} long calls out of ${analysis.totalCallsAnalyzed} total (${analysis.percentage}%)`);

        if (analysis.longestCall) {
            console.log(`🏆 Longest call: ${analysis.longestCall.duration}s (${analysis.longestCall.id.slice(0, 8)}...)`);
            console.log(`📊 Average long call duration: ${analysis.averageDuration.toFixed(1)}s`);

            console.log('\n🕐 Top long calls:');
            analysis.longCalls.forEach((call, index) => {
                console.log(`  ${index + 1}. ${call.duration}s - ${call.id.slice(0, 8)}... (${call.status})`);
            });
        }

        this.results.longCalls = analysis;
        return analysis;
    }

    // UTILITY METHODS
    async saveResults() {
        if (!CONFIG.SAVE_RESULTS) return;

        const outputDir = path.resolve(__dirname, CONFIG.OUTPUT_DIR);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().slice(0, 19);
        const filename = `call_analysis_${timestamp}.json`;
        const filepath = path.join(outputDir, filename);

        fs.writeFileSync(filepath, JSON.stringify(this.results, null, 2));
        console.log(`💾 Analysis results saved: ${filename}`);
    }
}

// ============================================================
// CLI INTERFACE
// ============================================================

async function main() {
    console.log('📞 CALL ANALYSIS TOOLS');
    console.log('=======================');
    console.log('1. Analyze September calls');
    console.log('2. Count calls after specific date');
    console.log('3. Find specific call and count after');
    console.log('4. Analyze long calls');
    console.log('5. Run all analyses');
    console.log('');

    const analyzer = new CallAnalyzer();

    try {
        console.log('Running comprehensive call analysis...\n');

        await analyzer.analyzeSeptemberCalls();
        await analyzer.countCallsAfterDate();
        await analyzer.findCallAndCountAfter();
        await analyzer.analyzeLongCalls();

        await analyzer.saveResults();

        console.log('\n✅ All call analyses completed successfully!');

    } catch (error) {
        console.error('❌ Analysis failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = CallAnalyzer;