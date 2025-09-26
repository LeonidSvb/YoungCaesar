require('dotenv').config({ path: '../../../.env' });

// ============================================================
// CONFIGURATION SYSTEM - RUNTIME + DEFAULT
// ============================================================

// DEFAULT CONFIG for terminal usage
const DEFAULT_CONFIG = {
    START_DATE: '2025-09-01',
    END_DATE: '2025-09-26',
    FILTERS: {
        MIN_COST: 0
    },
    OUTPUT: {
        SAVE_TO_FILE: true,
        OUTPUT_DIR: 'production_scripts/vapi_collection/results',
        VERBOSE: true
    },
    PROCESSING: {
        LIMIT: null // null = no limit, number = limit for testing
    }
};

// FIXED CONFIG - Never changes, technical settings
const FIXED_CONFIG = {
    BATCH_SIZE: 50,
    CONCURRENT_REQUESTS: 10,
    RETRY_ATTEMPTS: 3,
    API_TIMEOUT: 30000
};

// UNIVERSAL CONFIG FUNCTION - Terminal vs API
function getConfig(runtimeParams = null) {
    if (runtimeParams) {
        // RUNTIME MODE (from API/Frontend)
        return {
            START_DATE: runtimeParams.startDate || DEFAULT_CONFIG.START_DATE,
            END_DATE: runtimeParams.endDate || DEFAULT_CONFIG.END_DATE,
            FILTERS: {
                MIN_COST: runtimeParams.minCost || 0
            },
            OUTPUT: {
                SAVE_TO_FILE: runtimeParams.saveToFile !== false,
                OUTPUT_DIR: DEFAULT_CONFIG.OUTPUT.OUTPUT_DIR,
                VERBOSE: runtimeParams.verbose !== false
            },
            PROCESSING: {
                LIMIT: runtimeParams.limit || null
            },
            ...FIXED_CONFIG
        };
    } else {
        // TERMINAL MODE (default config)
        return {
            ...DEFAULT_CONFIG,
            ...FIXED_CONFIG
        };
    }
}

// ============================================================
// MAIN SCRIPT - NO NEED TO CHANGE BELOW
// ============================================================

const VapiClient = require('../../../scripts/api/vapi_client');
const DataUtils = require('../../../scripts/utils/data_utils');
const Logger = require('../../../scripts/utils/logger');

const logger = new Logger('vapi_collection.log');

function applyFilters(calls, config) {
    let filtered = [...calls];
    const filters = config.FILTERS;

    // Apply cost filter only
    if (filters.MIN_COST > 0) {
        filtered = filtered.filter(call => (call.cost || 0) >= filters.MIN_COST);
    }

    // Apply limit for testing
    if (config.PROCESSING.LIMIT && filtered.length > config.PROCESSING.LIMIT) {
        console.log(`🧪 TESTING MODE: Limiting to ${config.PROCESSING.LIMIT} calls (from ${filtered.length})`);
        filtered = filtered.slice(0, config.PROCESSING.LIMIT);
    }

    return filtered;
}

function generateDailyStats(calls, startDate, endDate, config) {
    const stats = {
        summary: {
            dateRange: `${startDate} to ${endDate}`,
            totalCallsBeforeFilters: 0,
            totalCallsAfterFilters: 0,
            filtersApplied: {},
            filterEfficiency: '0%'
        },
        dailyBreakdown: []
    };

    // Record active filters
    const filters = config.FILTERS;
    if (filters.MIN_COST > 0) stats.summary.filtersApplied.minCost = filters.MIN_COST;
    if (config.PROCESSING.LIMIT) stats.summary.filtersApplied.testLimit = config.PROCESSING.LIMIT;

    // Group calls by date
    const callsByDate = {};
    calls.forEach(call => {
        const date = new Date(call.createdAt).toISOString().split('T')[0];
        if (!callsByDate[date]) {
            callsByDate[date] = [];
        }
        callsByDate[date].push(call);
    });

    // Generate stats for each day
    let currentDate = new Date(startDate);
    const endDateObj = new Date(endDate);

    while (currentDate <= endDateObj) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayCalls = callsByDate[dateStr] || [];
        const filteredCalls = applyFilters(dayCalls, config);

        const dayStats = {
            date: dateStr,
            totalCalls: dayCalls.length,
            filteredCalls: filteredCalls.length,
            removedByFilters: dayCalls.length - filteredCalls.length,
            percentageKept: dayCalls.length > 0
                ? `${Math.round((filteredCalls.length / dayCalls.length) * 100)}%`
                : '0%',
            totalCost: filteredCalls.reduce((sum, call) => sum + (call.cost || 0), 0),
            avgDuration: filteredCalls.length > 0
                ? Math.round(filteredCalls.reduce((sum, call) => sum + (call.duration || 0), 0) / filteredCalls.length)
                : 0
        };

        stats.dailyBreakdown.push(dayStats);
        stats.summary.totalCallsBeforeFilters += dayCalls.length;
        stats.summary.totalCallsAfterFilters += filteredCalls.length;

        currentDate.setDate(currentDate.getDate() + 1);
    }

    // Calculate filter efficiency
    if (stats.summary.totalCallsBeforeFilters > 0) {
        stats.summary.filterEfficiency =
            `${Math.round((stats.summary.totalCallsAfterFilters / stats.summary.totalCallsBeforeFilters) * 100)}%`;
    }

    return stats;
}

async function collectVapiData(runtimeParams = null) {
    try {
        const CONFIG = getConfig(runtimeParams);
        const startDate = CONFIG.START_DATE;
        const endDate = CONFIG.END_DATE;

        const mode = runtimeParams ? '🌐 API MODE' : '💻 TERMINAL MODE';
        logger.info(`Starting VAPI data collection: ${startDate} to ${endDate} [${mode}]`);

        if (CONFIG.OUTPUT.VERBOSE) {
            console.log('\n========================================');
            console.log(`📞 VAPI DATA COLLECTION ${mode}`);
            console.log('========================================');
            console.log(`📅 Period: ${startDate} to ${endDate}`);
            console.log('\n📋 Active Filters:');
            Object.entries(CONFIG.FILTERS).forEach(([key, value]) => {
                if (value !== null && value !== 0) {
                    console.log(`  • ${key}: ${value}`);
                }
            });
            if (CONFIG.PROCESSING.LIMIT) {
                console.log(`  • TESTING LIMIT: ${CONFIG.PROCESSING.LIMIT} calls`);
            }
            console.log('========================================\n');
        }

        const vapiClient = new VapiClient();

        // Collect all calls
        const allCalls = await vapiClient.getAllCalls(
            `${startDate}T00:00:00.000Z`,
            `${endDate}T23:59:59.999Z`
        );

        if (allCalls.length === 0) {
            logger.warning('No calls found in the specified date range');
            return { calls: [], stats: null };
        }

        // Apply filters
        const filteredCalls = applyFilters(allCalls, CONFIG);

        // Generate statistics
        const stats = generateDailyStats(allCalls, startDate, endDate, CONFIG);

        // Save results if enabled
        if (CONFIG.OUTPUT.SAVE_TO_FILE) {
            const now = new Date();
            const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const dateRange = `${startDate}_to_${endDate}`;
            const costFilter = `cost-${CONFIG.FILTERS.MIN_COST}`;

            // Save filtered calls with descriptive filename
            await DataUtils.saveJsonData(
                filteredCalls,
                `${timestamp}_vapi_calls_${dateRange}_${costFilter}.json`,
                CONFIG.OUTPUT.OUTPUT_DIR
            );

            // Save statistics
            await DataUtils.saveJsonData(
                stats,
                `${timestamp}_vapi_stats_${dateRange}_${costFilter}.json`,
                CONFIG.OUTPUT.OUTPUT_DIR
            );

            console.log(`\n✅ Results saved to ${CONFIG.OUTPUT.OUTPUT_DIR}/`);
            console.log(`📊 Files: ${timestamp}_vapi_calls_${dateRange}_${costFilter}.json`);
        }

        // Display results
        if (CONFIG.OUTPUT.VERBOSE) {
            console.log('\n========================================');
            console.log('📊 RESULTS SUMMARY');
            console.log('========================================');
            console.log(`Total calls collected: ${allCalls.length}`);
            console.log(`Calls after filtering: ${filteredCalls.length}`);
            console.log(`Removed by filters: ${allCalls.length - filteredCalls.length}`);
            console.log(`Filter efficiency: ${stats.summary.filterEfficiency}`);
            console.log('\n📈 Daily Breakdown:');
            stats.dailyBreakdown.forEach(day => {
                if (day.totalCalls > 0) {
                    console.log(`  ${day.date}: ${day.totalCalls} total → ${day.filteredCalls} filtered (${day.percentageKept} kept)`);
                }
            });
            console.log('========================================\n');
        }

        return {
            calls: filteredCalls,
            stats: stats
        };

    } catch (error) {
        logger.error('VAPI data collection failed', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    collectVapiData()
        .then(result => {
            console.log(`✅ Collection completed! Found ${result.calls.length} calls matching your filters.`);
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Collection failed:', error.message);
            process.exit(1);
        });
}

module.exports = collectVapiData;