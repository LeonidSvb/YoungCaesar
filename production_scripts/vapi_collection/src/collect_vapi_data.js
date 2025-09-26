require('dotenv').config({ path: '../../../.env' });

// ============================================================
// CONFIGURATION - CHANGE ALL SETTINGS HERE
// ============================================================

// DATE RANGE - What period to collect data for
const CONFIG = {
    // Dates (YYYY-MM-DD format) - Проверенные даты
    START_DATE: '2025-09-01',
    END_DATE: '2025-09-26',

    // FILTERS - Грузим все без ограничений
    FILTERS: {
        // Minimum call cost to include (0 = все звонки)
        MIN_COST: 0
    },

    // OUTPUT SETTINGS
    OUTPUT: {
        // Save filtered results to file?
        SAVE_TO_FILE: true,

        // Output directory
        OUTPUT_DIR: 'production_scripts/vapi_collection/results',

        // Show detailed console output?
        VERBOSE: true
    }
};

// ============================================================
// MAIN SCRIPT - NO NEED TO CHANGE BELOW
// ============================================================

const VapiClient = require('../../../scripts/api/vapi_client');
const DataUtils = require('../../../scripts/utils/data_utils');
const Logger = require('../../../scripts/utils/logger');

const logger = new Logger('vapi_collection.log');

function applyFilters(calls) {
    let filtered = [...calls];
    const filters = CONFIG.FILTERS;

    // Apply cost filter only
    if (filters.MIN_COST > 0) {
        filtered = filtered.filter(call => (call.cost || 0) >= filters.MIN_COST);
    }

    return filtered;
}

function generateDailyStats(calls, startDate, endDate) {
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
    const filters = CONFIG.FILTERS;
    if (filters.MIN_COST > 0) stats.summary.filtersApplied.minCost = filters.MIN_COST;

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
        const filteredCalls = applyFilters(dayCalls);

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

async function collectVapiData() {
    try {
        const startDate = CONFIG.START_DATE;
        const endDate = CONFIG.END_DATE;

        logger.info(`Starting VAPI data collection: ${startDate} to ${endDate}`);

        if (CONFIG.OUTPUT.VERBOSE) {
            console.log('\n========================================');
            console.log('📞 VAPI DATA COLLECTION');
            console.log('========================================');
            console.log(`📅 Period: ${startDate} to ${endDate}`);
            console.log('\n📋 Active Filters:');
            Object.entries(CONFIG.FILTERS).forEach(([key, value]) => {
                if (value !== null && value !== 0) {
                    console.log(`  • ${key}: ${value}`);
                }
            });
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
        const filteredCalls = applyFilters(allCalls);

        // Generate statistics
        const stats = generateDailyStats(allCalls, startDate, endDate);

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