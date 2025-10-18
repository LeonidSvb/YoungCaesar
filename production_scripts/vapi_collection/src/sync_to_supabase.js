const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');
const VapiClient = require('../../shared/api/vapi_client');
const { createLogger } = require('../../shared/logger');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

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
    this.logger = createLogger('vapi-sync');
    this.stats = {
      calls_fetched: 0,
      calls_inserted: 0,
      calls_updated: 0,
      assistants_synced: 0,
      prompts_versioned: 0,
      errors: 0
    };
  }

  log(message, data = {}) {
    if (this.config.VERBOSE) {
      this.logger.info(message, data);
    }
  }

  async getLastSyncPoint() {
    if (this.config.SYNC_MODE === 'full') {
      return {
        mode: 'full',
        startDate: this.config.START_DATE,
        endDate: this.config.END_DATE
      };
    }

    try {
      const { data, error } = await this.supabase
        .from('vapi_calls_raw')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        const lastDate = new Date(data[0].created_at);
        const startDate = new Date(lastDate.getTime() - 24 * 60 * 60 * 1000);

        return {
          mode: 'incremental',
          startDate: startDate.toISOString().split('T')[0],
          endDate: this.config.END_DATE
        };
      } else {
        return {
          mode: 'full',
          startDate: this.config.START_DATE,
          endDate: this.config.END_DATE
        };
      }
    } catch (error) {
      this.logger.error('Auto-detect failed, using FULL mode', error);
      return {
        mode: 'full',
        startDate: this.config.START_DATE,
        endDate: this.config.END_DATE
      };
    }
  }

  async fetchVapiCalls(startDate, endDate) {
    this.log(`Fetching calls from VAPI (${startDate} to ${endDate})...`);

    const startISO = `${startDate}T00:00:00.000Z`;
    const endISO = `${endDate}T23:59:59.999Z`;

    const calls = await this.vapi.getAllCalls(startISO, endISO);

    this.stats.calls_fetched = calls.length;
    this.log(`Fetched ${calls.length} calls from VAPI (with pagination)`);

    return calls;
  }

  async fetchVapiAssistants() {
    this.log('Fetching assistants from VAPI...');

    const assistants = await this.vapi.getAssistants();
    this.log(`Fetched ${assistants.length} assistants`);

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
    this.log(`Syncing ${calls.length} calls to Supabase...`);

    const { data: existingRecords } = await this.supabase
      .from('vapi_calls_raw')
      .select('id')
      .in('id', calls.map(c => c.id));

    const existingIds = new Set(existingRecords?.map(r => r.id) || []);
    const transformed = calls.map(c => this.transformCall(c));

    let inserted = 0;
    let updated = 0;

    for (let i = 0; i < transformed.length; i += this.config.BATCH_SIZE) {
      const batch = transformed.slice(i, i + this.config.BATCH_SIZE);
      const batchInserts = batch.filter(c => !existingIds.has(c.id)).length;
      const batchUpdates = batch.length - batchInserts;

      const { error } = await this.supabase
        .from('vapi_calls_raw')
        .upsert(batch, {
          onConflict: 'id',
          ignoreDuplicates: false
        });

      if (error) {
        this.logger.error(`Batch ${Math.floor(i / this.config.BATCH_SIZE) + 1} FAILED`, error);
        this.stats.errors += batch.length;
      } else {
        inserted += batchInserts;
        updated += batchUpdates;
      }

      if (i + this.config.BATCH_SIZE < transformed.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    this.stats.calls_inserted = inserted;
    this.stats.calls_updated = updated;
    this.log(`Calls synced: ${inserted} new, ${updated} updated`);
  }

  async syncAssistants(assistants) {
    this.log(`Syncing ${assistants.length} assistants to Supabase...`);

    const transformed = assistants.map(a => this.transformAssistant(a));

    const { error } = await this.supabase
      .from('vapi_assistants')
      .upsert(transformed, {
        onConflict: 'assistant_id',
        ignoreDuplicates: false
      });

    if (error) {
      this.logger.error('Assistants sync FAILED', error);
      this.stats.errors += assistants.length;
    } else{
      this.stats.assistants_synced = assistants.length;
      this.log(`Assistants synced: ${assistants.length}`);
    }

    await this.detectPromptChanges(assistants);
  }

  async detectPromptChanges(assistants) {
    this.log('Detecting prompt changes...');

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
          this.log(`Prompt change detected for ${assistant.name} (v${nextVersion})`);
        }
      } catch (error) {
        this.logger.error(`Error versioning prompt for ${assistant.id}`, error);
      }
    }
  }

  async run() {
    const batchId = randomUUID();
    let logId = null;

    try {
      this.log('='.repeat(60));
      this.log('VAPI → SUPABASE SYNC');
      this.log('='.repeat(60));

      const { data: logData } = await this.supabase
        .from('sync_logs')
        .insert({
          batch_id: batchId,
          object_type: 'full_sync',
          triggered_by: 'manual',
          status: 'in_progress'
        })
        .select('id')
        .single();

      logId = logData?.id;

      const syncPoint = await this.getLastSyncPoint();
      this.log(`Mode: ${syncPoint.mode.toUpperCase()}`);
      this.log(`Range: ${syncPoint.startDate} to ${syncPoint.endDate}`);

      const [calls, assistants] = await Promise.all([
        this.fetchVapiCalls(syncPoint.startDate, syncPoint.endDate),
        this.fetchVapiAssistants()
      ]);

      await this.syncAssistants(assistants);

      if (calls.length > 0) {
        await this.syncCalls(calls);
      } else {
        this.log('No new calls to sync');
      }

      const duration = Math.round((Date.now() - this.startTime) / 1000);

      this.log('\n' + '='.repeat(60));
      this.log('SYNC COMPLETED');
      this.log('='.repeat(60));
      this.log(`Time: ${duration}s`);
      this.log(`Calls: ${this.stats.calls_inserted} new, ${this.stats.calls_updated} updated`);
      this.log(`Assistants: ${this.stats.assistants_synced} synced`);
      this.log(`Prompts: ${this.stats.prompts_versioned} versions created`);
      this.log(`Errors: ${this.stats.errors}`);
      this.log('='.repeat(60));

      if (logId) {
        await this.supabase
          .from('sync_logs')
          .update({
            sync_completed_at: new Date().toISOString(),
            duration_seconds: duration,
            records_fetched: this.stats.calls_fetched,
            records_inserted: this.stats.calls_inserted,
            records_updated: this.stats.calls_updated,
            records_failed: this.stats.errors,
            status: this.stats.errors === 0 ? 'success' : 'partial'
          })
          .eq('id', logId);
      }

      return {
        success: true,
        stats: this.stats,
        duration,
        syncMode: syncPoint.mode
      };

    } catch (error) {
      this.logger.error('SYNC FAILED', error);

      if (logId) {
        await this.supabase
          .from('sync_logs')
          .update({
            sync_completed_at: new Date().toISOString(),
            status: 'failed',
            records_failed: 1
          })
          .eq('id', logId);
      }

      throw error;
    }
  }
}

async function syncVapiToSupabase(config = {}) {
  const sync = new VapiSupabaseSync(config);
  return await sync.run();
}

if (require.main === module) {
  syncVapiToSupabase()
    .then(() => {
      console.log('\nReady!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\nError:', error.message);
      process.exit(1);
    });
}

module.exports = syncVapiToSupabase;
