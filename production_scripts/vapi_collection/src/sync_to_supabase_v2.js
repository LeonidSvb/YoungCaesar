/**
 * VAPI to Supabase Synchronization Script
 *
 * Syncs call data from VAPI API to Supabase database with support for:
 * - Full sync: All historical data from START_DATE
 * - Incremental sync: Last 24 hours with overlap
 * - Auto mode: Automatically chooses full or incremental based on existing data
 *
 * Usage:
 *   node sync_to_supabase_v2.js [--mode=auto|full|incremental]
 *
 * Examples:
 *   node sync_to_supabase_v2.js                     # Auto mode (default)
 *   node sync_to_supabase_v2.js --mode=full         # Full sync from 2025-01-01
 *   node sync_to_supabase_v2.js --mode=incremental  # Last 24h only
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
const { createClient } = require('@supabase/supabase-js');
const VapiClient = require('../../shared/api/vapi_client');
const { Logger, createRun, updateRun } = require('../../../lib/logger');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

function parseCliArgs() {
  const args = process.argv.slice(2);
  const modeArg = args.find(arg => arg.startsWith('--mode='));
  const mode = modeArg ? modeArg.split('=')[1] : 'auto';

  if (!['auto', 'full', 'incremental'].includes(mode)) {
    console.error(`Invalid mode: ${mode}. Use --mode=auto, --mode=full, or --mode=incremental`);
    process.exit(1);
  }

  return { SYNC_MODE: mode };
}

const DEFAULT_CONFIG = {
  SYNC_MODE: 'auto',
  BATCH_SIZE: 100,
  START_DATE: '2025-01-01',
  END_DATE: new Date().toISOString().split('T')[0],
  VERBOSE: true
};

class VapiSupabaseSync {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    this.vapi = new VapiClient();
    this.startTime = Date.now();
    this.runId = null;
    this.logger = null;
    this.stats = {
      calls_fetched: 0,
      calls_inserted: 0,
      calls_updated: 0,
      assistants_synced: 0,
      prompts_versioned: 0,
      errors: 0
    };
  }

  async initLogger() {
    // Создать run в базе
    const run = await createRun('vapi-sync', SUPABASE_URL, SUPABASE_KEY, 'manual');
    this.runId = run.id;
    this.logger = new Logger(run.id, SUPABASE_URL, SUPABASE_KEY);

    await this.logger.info('START', 'Starting VAPI → Supabase synchronization');
    return run;
  }

  async getLastSyncPoint() {
    if (this.config.SYNC_MODE === 'full') {
      await this.logger.info('MODE', 'Full sync mode (--mode=full)');
      return {
        mode: 'full',
        startDate: this.config.START_DATE,
        endDate: this.config.END_DATE
      };
    }

    if (this.config.SYNC_MODE === 'incremental') {
      const { data: lastRun, error } = await this.supabase
        .from('runs')
        .select('finished_at')
        .eq('script_name', 'vapi-sync')
        .eq('status', 'success')
        .order('finished_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !lastRun || !lastRun.finished_at) {
        await this.logger.error('MODE', 'Incremental mode requires previous successful run. Run --mode=full first.');
        throw new Error('No previous successful sync found. Run with --mode=full first to initialize.');
      }

      const lastSyncTime = new Date(lastRun.finished_at);
      const OVERLAP_HOURS = 2;
      const startDate = new Date(lastSyncTime.getTime() - OVERLAP_HOURS * 60 * 60 * 1000);

      await this.logger.info('MODE', `Incremental sync mode: syncing from last successful run`, {
        last_sync: lastSyncTime.toISOString(),
        overlap_hours: OVERLAP_HOURS,
        sync_from: startDate.toISOString()
      });

      return {
        mode: 'incremental',
        startDate: startDate.toISOString().split('T')[0],
        endDate: this.config.END_DATE
      };
    }

    try {
      const { data: lastRun, error } = await this.supabase
        .from('runs')
        .select('finished_at')
        .eq('script_name', 'vapi-sync')
        .eq('status', 'success')
        .order('finished_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !lastRun || !lastRun.finished_at) {
        await this.logger.info('MODE', 'Auto mode: no previous sync found, using full sync');
        return {
          mode: 'full',
          startDate: this.config.START_DATE,
          endDate: this.config.END_DATE
        };
      }

      const lastSyncTime = new Date(lastRun.finished_at);
      const OVERLAP_HOURS = 2;
      const startDate = new Date(lastSyncTime.getTime() - OVERLAP_HOURS * 60 * 60 * 1000);

      await this.logger.info('MODE', `Auto mode: using incremental sync from last successful run`, {
        last_sync: lastSyncTime.toISOString(),
        overlap_hours: OVERLAP_HOURS,
        sync_from: startDate.toISOString()
      });

      return {
        mode: 'incremental',
        startDate: startDate.toISOString().split('T')[0],
        endDate: this.config.END_DATE
      };
    } catch (error) {
      await this.logger.error('MODE', 'Auto mode failed, falling back to full sync', { error: error.message });
      return {
        mode: 'full',
        startDate: this.config.START_DATE,
        endDate: this.config.END_DATE
      };
    }
  }

  async fetchVapiCalls(startDate, endDate) {
    await this.logger.info('FETCH', `Fetching calls from VAPI API (${startDate} to ${endDate})...`);

    const startISO = `${startDate}T00:00:00.000Z`;
    const endISO = `${endDate}T23:59:59.999Z`;

    const calls = await this.vapi.getAllCalls(startISO, endISO);

    this.stats.calls_fetched = calls.length;
    await this.logger.info('FETCH', `Fetched ${calls.length} calls from VAPI`, { count: calls.length });

    return calls;
  }

  async fetchVapiAssistants() {
    await this.logger.info('FETCH', 'Fetching assistants from VAPI API...');

    const assistants = await this.vapi.getAssistants();
    await this.logger.info('FETCH', `Fetched ${assistants.length} assistants`, { count: assistants.length });

    return assistants;
  }

  transformCall(call) {
    return {
      id: call.id,
      assistant_id: call.assistantId || null,
      customer_id: call.customerId || null,
      status: call.status || null,
      ended_reason: call.endedReason || null,
      created_at: call.createdAt || null,
      started_at: call.startedAt || null,
      ended_at: call.endedAt || null,
      duration_seconds: call.startedAt && call.endedAt
        ? Math.round((new Date(call.endedAt) - new Date(call.startedAt)) / 1000)
        : null,
      transcript: call.transcript || null,
      cost: call.cost || 0,
      customer_phone_number: call.customer?.number || null,
      recording_url: call.recordingUrl || null,
      vapi_success_evaluation: call.analysis?.successEvaluation || null,
      raw_json: call,
      synced_at: new Date().toISOString()
    };
  }

  transformAssistant(assistant) {
    return {
      assistant_id: assistant.id,
      name: assistant.name || null,
      model: assistant.model?.model || null,
      voice: assistant.voice ? JSON.stringify(assistant.voice) : null,
      prompt: assistant.model?.messages?.find(m => m.role === 'system')?.content || null,
      raw_json: assistant,
      synced_at: new Date().toISOString(),
      updated_at: assistant.updatedAt || assistant.createdAt || null
    };
  }

  async syncCalls(calls) {
    if (calls.length === 0) {
      await this.logger.info('SAVE', 'No calls to sync - skipping');
      return;
    }

    await this.logger.info('SAVE', `Analyzing ${calls.length} calls from VAPI...`);

    // Получить существующие ID
    const { data: existingRecords } = await this.supabase
      .from('vapi_calls_raw')
      .select('id')
      .in('id', calls.map(c => c.id));

    const existingIds = new Set(existingRecords?.map(r => r.id) || []);
    const transformed = calls.map(c => this.transformCall(c));

    const newCalls = transformed.filter(c => !existingIds.has(c.id));
    const existingCalls = transformed.filter(c => existingIds.has(c.id));

    await this.logger.info('SAVE', `Analysis complete: ${newCalls.length} new, ${existingCalls.length} existing`, {
      total_fetched: calls.length,
      new_calls: newCalls.length,
      existing_calls: existingCalls.length
    });

    if (newCalls.length === 0 && existingCalls.length === 0) {
      await this.logger.info('SAVE', 'No calls to process');
      return;
    }

    let inserted = 0;
    let updated = 0;
    let errors = 0;

    // Батчами сохранять
    for (let i = 0; i < transformed.length; i += this.config.BATCH_SIZE) {
      const batch = transformed.slice(i, i + this.config.BATCH_SIZE);
      const batchNum = Math.floor(i / this.config.BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(transformed.length / this.config.BATCH_SIZE);

      const batchInserts = batch.filter(c => !existingIds.has(c.id)).length;
      const batchUpdates = batch.length - batchInserts;

      const { error } = await this.supabase
        .from('vapi_calls_raw')
        .upsert(batch, {
          onConflict: 'id',
          ignoreDuplicates: false
        });

      if (error) {
        await this.logger.error('SAVE', `Batch ${batchNum}/${totalBatches} FAILED`, {
          error: error.message,
          batch_size: batch.length
        });
        errors += batch.length;
      } else {
        inserted += batchInserts;
        updated += batchUpdates;

        const batchType = batchInserts > 0 && batchUpdates > 0 ? 'mixed' :
                          batchInserts > 0 ? 'insert' :
                          'update';

        await this.logger.info('SAVE', `Batch ${batchNum}/${totalBatches} (${batchType})`, {
          new: batchInserts,
          updated: batchUpdates
        });
      }

      // Небольшая пауза между батчами
      if (i + this.config.BATCH_SIZE < transformed.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    this.stats.calls_inserted = inserted;
    this.stats.calls_updated = updated;
    this.stats.errors += errors;

    await this.logger.info('SAVE', `Sync complete: ${inserted} new calls added, ${updated} calls updated`, {
      new_calls: inserted,
      updated_calls: updated,
      failed: errors
    });
  }

  async syncAssistants(assistants) {
    await this.logger.info('SAVE', `Syncing ${assistants.length} assistants...`);

    const transformed = assistants.map(a => this.transformAssistant(a));

    const { error } = await this.supabase
      .from('vapi_assistants')
      .upsert(transformed, {
        onConflict: 'assistant_id',
        ignoreDuplicates: false
      });

    if (error) {
      await this.logger.error('SAVE', 'Assistants sync FAILED', { error: error.message });
      this.stats.errors += assistants.length;
    } else {
      this.stats.assistants_synced = assistants.length;
      await this.logger.info('SAVE', `Assistants synced successfully`, { count: assistants.length });
    }

    // Проверить изменения промптов
    await this.detectPromptChanges(assistants);
  }

  async detectPromptChanges(assistants) {
    await this.logger.info('PROCESS', 'Detecting prompt changes...');

    for (const assistant of assistants) {
      try {
        const currentPrompt = assistant.model?.messages?.find(m => m.role === 'system')?.content || '';

        const { data: lastVersion } = await this.supabase
          .from('vapi_assistant_prompt_history')
          .select('prompt, version_number')
          .eq('assistant_id', assistant.id)
          .order('version_number', { ascending: false })
          .limit(1)
          .single();

        if (!lastVersion || lastVersion.prompt !== currentPrompt) {
          const { data: versionData } = await this.supabase
            .rpc('get_next_prompt_version', { p_assistant_id: assistant.id });

          const nextVersion = versionData || 1;

          await this.supabase
            .from('vapi_assistant_prompt_history')
            .insert({
              assistant_id: assistant.id,
              prompt: currentPrompt,
              model: assistant.model?.model || null,
              voice: assistant.voice || null,
              version_number: nextVersion,
              changed_at: assistant.updatedAt || assistant.createdAt || new Date().toISOString(),
              raw_json: assistant
            });

          this.stats.prompts_versioned++;
          await this.logger.info('PROCESS', `Prompt version ${nextVersion} saved for ${assistant.name}`);
        }
      } catch (error) {
        await this.logger.warning('PROCESS', `Could not version prompt for ${assistant.id}`, {
          error: error.message
        });
      }
    }

    await this.logger.info('PROCESS', `Prompt versioning complete`, {
      new_versions: this.stats.prompts_versioned
    });
  }

  async run() {
    try {
      // 1. Инициализация logger
      await this.initLogger();

      // 2. Определить режим sync
      const syncPoint = await this.getLastSyncPoint();
      await this.logger.info('START', `Sync mode: ${syncPoint.mode}`, {
        start_date: syncPoint.startDate,
        end_date: syncPoint.endDate
      });

      // 3. Fetch данных из VAPI
      const [calls, assistants] = await Promise.all([
        this.fetchVapiCalls(syncPoint.startDate, syncPoint.endDate),
        this.fetchVapiAssistants()
      ]);

      // 4. Sync assistants
      await this.syncAssistants(assistants);

      // 5. Sync calls
      if (calls.length > 0) {
        await this.syncCalls(calls);
      } else {
        await this.logger.info('SAVE', 'No new calls to sync');
      }

      // 6. Обновить run статус
      const duration = Date.now() - this.startTime;

      await updateRun(this.runId, {
        status: this.stats.errors === 0 ? 'success' : 'error',
        finished_at: new Date().toISOString(),
        duration_ms: duration,
        records_fetched: this.stats.calls_fetched,
        records_inserted: this.stats.calls_inserted,
        records_updated: this.stats.calls_updated,
        records_failed: this.stats.errors
      }, SUPABASE_URL, SUPABASE_KEY);

      await this.logger.info('END', `Sync completed in ${Math.round(duration / 1000)}s`);

      // 7. Вывести итоги
      console.log('\n' + '='.repeat(60));
      console.log('✅ SYNC COMPLETED');
      console.log('='.repeat(60));
      console.log(`⏱  Duration: ${Math.round(duration / 1000)}s`);
      console.log(`📞 Calls: ${this.stats.calls_inserted} new, ${this.stats.calls_updated} updated`);
      console.log(`🤖 Assistants: ${this.stats.assistants_synced} synced`);
      console.log(`📝 Prompts: ${this.stats.prompts_versioned} versions created`);
      console.log(`❌ Errors: ${this.stats.errors}`);
      console.log('='.repeat(60));
      console.log(`\n📊 Check logs: SELECT * FROM logs WHERE run_id = '${this.runId}';\n`);

      return {
        success: this.stats.errors === 0,
        stats: this.stats,
        duration: Math.round(duration / 1000),
        syncMode: syncPoint.mode,
        runId: this.runId
      };

    } catch (error) {
      await this.logger.error('ERROR', error.message, { stack: error.stack });

      const duration = Date.now() - this.startTime;
      await updateRun(this.runId, {
        status: 'error',
        finished_at: new Date().toISOString(),
        duration_ms: duration,
        error_message: error.message
      }, SUPABASE_URL, SUPABASE_KEY);

      console.error('\n❌ SYNC FAILED:', error.message);
      throw error;
    }
  }
}

async function syncVapiToSupabase(config = {}) {
  const sync = new VapiSupabaseSync(config);
  return await sync.run();
}

if (require.main === module) {
  const cliConfig = parseCliArgs();
  const modeDisplay = cliConfig.SYNC_MODE === 'auto' ? 'auto (incremental if data exists)' : cliConfig.SYNC_MODE;

  console.log(`🚀 Starting VAPI → Supabase sync (mode: ${modeDisplay})...\n`);

  syncVapiToSupabase(cliConfig)
    .then((result) => {
      console.log('\n✅ Ready!');
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('\n❌ Fatal error:', error.message);
      process.exit(1);
    });
}

module.exports = syncVapiToSupabase;
