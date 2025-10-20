require('dotenv').config();
const { Logger, createRun, updateRun } = require('../lib/logger');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Main sync script for GitHub Actions cron
 * Syncs new VAPI calls to Supabase with detailed logging
 */
async function main() {
  const scriptName = 'vapi-sync';
  const start = Date.now();

  // Create new run
  const run = await createRun(scriptName, SUPABASE_URL, SUPABASE_KEY, 'cron');
  const logger = new Logger(run.id, SUPABASE_URL, SUPABASE_KEY);

  try {
    await logger.info('START', 'Starting VAPI data synchronization');

    // Step 1: Fetch calls from VAPI API
    await logger.info('FETCH', 'Fetching new calls from VAPI API...');

    // Example: Replace with your actual VAPI sync logic
    const mockData = { calls: [] }; // This would be: await vapiClient.getCalls(...)
    const callsCount = mockData.calls.length;

    await logger.info('FETCH', `Fetched ${callsCount} new calls`, { count: callsCount });

    // Step 2: Save to Supabase
    await logger.info('SAVE', 'Saving calls to Supabase...');

    // Simulate processing
    await new Promise(r => setTimeout(r, 1000));

    await logger.info('SAVE', `Saved ${callsCount} calls successfully`, { count: callsCount });

    // Calculate duration
    const duration = Date.now() - start;

    // Update run with success status
    await updateRun(run.id, {
      status: 'success',
      finished_at: new Date().toISOString(),
      duration_ms: duration,
      records_fetched: callsCount,
      records_inserted: callsCount,
      records_updated: 0,
      records_failed: 0,
    }, SUPABASE_URL, SUPABASE_KEY);

    await logger.info('END', `Synchronization completed in ${duration}ms`);

    console.log('\nSynchronization completed successfully!');
    console.log(`Duration: ${duration}ms`);
    console.log(`Calls processed: ${callsCount}`);

  } catch (error) {
    // Log error
    await logger.error('ERROR', error.message, { stack: error.stack });

    // Update run with error status
    await updateRun(run.id, {
      status: 'error',
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - start,
      error_message: error.message,
    }, SUPABASE_URL, SUPABASE_KEY);

    console.error('\nSynchronization failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = main;
