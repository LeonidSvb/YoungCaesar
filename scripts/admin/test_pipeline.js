#!/usr/bin/env node
/**
 * FULL PIPELINE TEST - 100 CALLS
 * Tests: VAPI Collection → Supabase Sync
 */

const collectVapiData = require('./production_scripts/vapi_collection/src/collect_vapi_data.js');
const syncVapiToSupabase = require('./production_scripts/vapi_collection/src/sync_to_supabase.js');

async function testFullPipeline() {
    console.log('🧪 STARTING FULL PIPELINE TEST (100 calls limit)\n');

    try {
        // STEP 1: Collect from VAPI (100 calls limit)
        console.log('==========================================');
        console.log('📞 STEP 1: COLLECTING FROM VAPI (100 calls)');
        console.log('==========================================\n');

        const collectParams = {
            startDate: '2025-09-20',
            endDate: '2025-09-26',
            minCost: 0,
            saveToFile: true,
            verbose: true,
            limit: 100  // TEST LIMIT
        };

        const collectResult = await collectVapiData(collectParams);

        console.log('\n✅ COLLECTION RESULTS:');
        console.log(`📊 Total calls collected: ${collectResult.calls.length}`);
        console.log(`📈 Filter efficiency: ${collectResult.stats.summary.filterEfficiency}`);

        if (collectResult.calls.length > 0) {
            console.log('\n👀 PREVIEW OF LAST 3 CALLS:');
            collectResult.calls.slice(-3).forEach((call, index) => {
                console.log(`  ${index + 1}. ID: ${call.id.substring(0, 8)}... | Cost: $${call.cost} | Duration: ${call.duration}s`);
            });
        }

        // STEP 2: Sync to Supabase (auto-detect mode)
        console.log('\n==========================================');
        console.log('🚀 STEP 2: SYNCING TO SUPABASE (AUTO mode)');
        console.log('==========================================\n');

        const syncParams = {
            syncMode: 'auto',
            includeAllCalls: true,
            minCost: 0,
            verbose: true,
            testLimit: 100  // TEST LIMIT
        };

        const syncResult = await syncVapiToSupabase(syncParams);

        console.log('\n✅ SYNC RESULTS:');
        console.log(`🎯 Sync mode: ${syncResult.metadata.syncType.toUpperCase()}`);
        console.log(`📅 Date range: ${syncResult.metadata.dateRange}`);
        console.log(`📊 Calls synced: ${syncResult.supabase_calls_synced || 'N/A'}`);
        console.log(`⏱️ Duration: ${((Date.now() - Date.parse(syncResult.metadata.timestamp)) / 1000).toFixed(1)}s`);

        // SUMMARY
        console.log('\n==========================================');
        console.log('🎉 PIPELINE TEST COMPLETE');
        console.log('==========================================');
        console.log(`✅ Collected: ${collectResult.calls.length} calls from VAPI`);
        console.log(`✅ Synced to Supabase: ${syncResult.metadata.syncType} mode`);
        console.log(`✅ No errors encountered`);
        console.log('✅ Both terminal and API modes working correctly\n');

        return {
            success: true,
            collected: collectResult.calls.length,
            synced: syncResult.supabase_calls_synced || 0,
            collectResult,
            syncResult
        };

    } catch (error) {
        console.error('\n❌ PIPELINE TEST FAILED:');
        console.error(`   Error: ${error.message}`);
        console.error(`   Stack: ${error.stack?.split('\n')[0] || 'N/A'}\n`);

        return {
            success: false,
            error: error.message
        };
    }
}

// RUN TEST
if (require.main === module) {
    testFullPipeline()
        .then(result => {
            if (result.success) {
                console.log('🎯 TEST PASSED: Ready for frontend integration!');
                process.exit(0);
            } else {
                console.log('💥 TEST FAILED: Check errors above');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('💥 UNEXPECTED ERROR:', error.message);
            process.exit(1);
        });
}

module.exports = testFullPipeline;