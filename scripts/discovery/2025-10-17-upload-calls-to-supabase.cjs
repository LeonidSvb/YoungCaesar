require('dotenv').config({ path: '../../.env' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const { randomUUID } = require('crypto');

// Supabase клиент
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Конфигурация
const CONFIG = {
  INPUT_FILE: 'production_scripts/vapi_collection/results/2025-09-17T09-51-00_vapi_calls_2025-01-01_to_2025-09-17_cost-0.03.json',
  BATCH_SIZE: 100,
  DRY_RUN: false // true = не загружать, только показать что будет
};

// Функция трансформации VAPI call → Supabase row
function transformCall(call) {
  return {
    // Primary fields
    id: call.id,
    assistant_id: call.assistantId || null,
    customer_id: call.customerId || null,
    org_id: call.orgId || null,

    // Call info
    type: call.type || null,
    status: call.status || null,
    ended_reason: call.endedReason || null,

    // Timestamps
    created_at: call.createdAt || null,
    started_at: call.startedAt || null,
    ended_at: call.endedAt || null,

    // Duration (вычисляем если есть)
    duration_seconds: call.startedAt && call.endedAt
      ? Math.round((new Date(call.endedAt) - new Date(call.startedAt)) / 1000)
      : null,

    // Content
    transcript: call.transcript || null,
    summary: call.summary || null,

    // Customer
    customer_phone_number: call.customer?.number || null,

    // Cost
    cost: call.cost || 0,

    // Recordings
    recording_url: call.recordingUrl || null,
    stereo_recording_url: call.stereoRecordingUrl || null,

    // Provider info
    phone_number_id: call.phoneNumberId || null,
    phone_call_provider: call.phoneCallProvider || null,
    phone_call_transport: call.phoneCallTransport || null,

    // VAPI analysis
    vapi_summary: call.analysis?.summary || null,
    vapi_success_evaluation: call.analysis?.successEvaluation || null,

    // FULL RAW DATA (весь объект!)
    raw_json: call,

    // Sync metadata
    synced_at: new Date().toISOString()
  };
}

async function uploadCalls() {
  console.log('='.repeat(60));
  console.log('📤 ЗАГРУЗКА VAPI ЗВОНКОВ В SUPABASE');
  console.log('='.repeat(60));

  // Создаём batch_id для sync_logs
  const batchId = randomUUID();
  const startTime = Date.now();

  // Начинаем sync log
  const { data: logData } = await supabase
    .from('sync_logs')
    .insert({
      batch_id: batchId,
      object_type: 'calls',
      triggered_by: 'manual',
      status: 'in_progress'
    })
    .select('id')
    .single();

  const logId = logData.id;
  console.log(`\n📋 Sync batch ID: ${batchId}`);
  console.log(`📋 Log ID: ${logId}\n`);

  // Читаем данные
  console.log(`📂 Читаем файл: ${CONFIG.INPUT_FILE}`);
  const calls = JSON.parse(fs.readFileSync(CONFIG.INPUT_FILE, 'utf8'));
  console.log(`✅ Загружено: ${calls.length} звонков\n`);

  // Проверяем существующие IDs (чтобы не дублировать)
  console.log('🔍 Проверяем существующие записи...');
  const allIds = calls.map(c => c.id);
  const { data: existingRecords } = await supabase
    .from('vapi_calls_raw')
    .select('id')
    .in('id', allIds);

  const existingIds = new Set(existingRecords?.map(r => r.id) || []);
  console.log(`📊 Уже в базе: ${existingIds.size} звонков`);
  console.log(`📊 Новых для загрузки: ${calls.length - existingIds.size}\n`);

  // Трансформируем
  const transformed = calls.map(transformCall);

  // Статистика
  let inserted = 0;
  let updated = 0;
  let failed = 0;

  if (CONFIG.DRY_RUN) {
    console.log('🧪 DRY RUN MODE - не загружаем, только показываем:');
    console.log('\nПример трансформированной записи:');
    console.log(JSON.stringify(transformed[0], null, 2).substring(0, 500) + '...');
    return;
  }

  // Загружаем батчами
  console.log(`⏳ Начинаем загрузку батчами по ${CONFIG.BATCH_SIZE}...\n`);

  for (let i = 0; i < transformed.length; i += CONFIG.BATCH_SIZE) {
    const batch = transformed.slice(i, i + CONFIG.BATCH_SIZE);
    const batchNum = Math.floor(i / CONFIG.BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(transformed.length / CONFIG.BATCH_SIZE);

    // Считаем новые vs updates
    const batchInserts = batch.filter(c => !existingIds.has(c.id)).length;
    const batchUpdates = batch.length - batchInserts;

    process.stdout.write(`📦 Batch ${batchNum}/${totalBatches} (${batch.length} records, ${batchInserts} new, ${batchUpdates} updates)... `);

    // Upsert (insert + update)
    const { error } = await supabase
      .from('vapi_calls_raw')
      .upsert(batch, {
        onConflict: 'id',
        ignoreDuplicates: false
      });

    if (error) {
      console.log(`❌ FAILED`);
      console.error('Error:', error.message);
      failed += batch.length;
    } else {
      console.log(`✅ OK`);
      inserted += batchInserts;
      updated += batchUpdates;
    }

    // Небольшая задержка между батчами (чтобы не перегрузить Supabase)
    if (i + CONFIG.BATCH_SIZE < transformed.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Финальная статистика
  const duration = Math.round((Date.now() - startTime) / 1000);

  console.log('\n' + '='.repeat(60));
  console.log('✅ ЗАГРУЗКА ЗАВЕРШЕНА');
  console.log('='.repeat(60));
  console.log(`⏱️  Время: ${duration}s`);
  console.log(`📊 Всего обработано: ${calls.length}`);
  console.log(`✅ Новых вставлено: ${inserted}`);
  console.log(`🔄 Обновлено: ${updated}`);
  console.log(`❌ Ошибок: ${failed}`);
  console.log(`📈 Success rate: ${Math.round(((inserted + updated) / calls.length) * 100)}%`);
  console.log('='.repeat(60));

  // Обновляем sync log
  await supabase
    .from('sync_logs')
    .update({
      sync_completed_at: new Date().toISOString(),
      duration_seconds: duration,
      records_fetched: calls.length,
      records_inserted: inserted,
      records_updated: updated,
      records_failed: failed,
      status: failed === 0 ? 'success' : 'partial'
    })
    .eq('id', logId);

  console.log(`\n📋 Sync log обновлён (ID: ${logId})`);
}

// Запуск
uploadCalls()
  .then(() => {
    console.log('\n✅ Готово!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Ошибка:', error.message);
    process.exit(1);
  });
