require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getAllRuns() {
  const { data: runs, error: runError } = await supabase
    .from('runs')
    .select('*')
    .eq('script_name', 'vapi-sync')
    .order('started_at', { ascending: false })
    .limit(10);

  if (runError) {
    console.error('Ошибка получения runs:', runError);
    return;
  }

  console.log('\n' + '='.repeat(100));
  console.log('ВСЕ ЗАПУСКИ СИНХРОНИЗАЦИИ (последние 10)');
  console.log('='.repeat(100));

  if (!runs || runs.length === 0) {
    console.log('Запусков не найдено');
    return;
  }

  runs.forEach((run, i) => {
    const duration = run.duration_ms ? (run.duration_ms / 1000).toFixed(2) + 's' : 'N/A';
    const status = run.status === 'success' ? '✅' : run.status === 'error' ? '❌' : '⏳';
    console.log(`\n[${i+1}] ${status} ${run.status.toUpperCase()}`);
    console.log(`    ID: ${run.id}`);
    console.log(`    Время: ${run.started_at} → ${run.finished_at || 'не завершен'}`);
    console.log(`    Длительность: ${duration}`);
    console.log(`    Получено: ${run.records_fetched || 0} | Вставлено: ${run.records_inserted || 0} | Обновлено: ${run.records_updated || 0} | Ошибок: ${run.records_failed || 0}`);
    if (run.error_message) {
      console.log(`    Ошибка: ${run.error_message}`);
    }
  });

  console.log('\n' + '='.repeat(100));
  console.log('СТАТИСТИКА:');
  const success = runs.filter(r => r.status === 'success').length;
  const errors = runs.filter(r => r.status === 'error').length;
  const running = runs.filter(r => r.status === 'running').length;
  console.log(`  - Успешных: ${success}`);
  console.log(`  - С ошибками: ${errors}`);
  console.log(`  - Не завершенных: ${running}`);

  const totalFetched = runs.reduce((sum, r) => sum + (r.records_fetched || 0), 0);
  const totalInserted = runs.reduce((sum, r) => sum + (r.records_inserted || 0), 0);
  const totalUpdated = runs.reduce((sum, r) => sum + (r.records_updated || 0), 0);
  console.log(`\nВСЕГО обработано:`);
  console.log(`  - Получено: ${totalFetched}`);
  console.log(`  - Вставлено: ${totalInserted}`);
  console.log(`  - Обновлено: ${totalUpdated}`);

  console.log('\n' + '='.repeat(100));

  const { data: callsCount } = await supabase
    .from('vapi_calls_raw')
    .select('id', { count: 'exact', head: true });

  console.log('\nДАННЫЕ В БАЗЕ:');
  console.log(`  - Всего звонков в vapi_calls_raw: ${callsCount?.length || 'не удалось получить'}`);

  const { count } = await supabase
    .from('vapi_calls_raw')
    .select('*', { count: 'exact', head: true });

  console.log(`  - Точное количество: ${count || 'не удалось получить'}`);

  console.log('\n' + '='.repeat(100));
}

getAllRuns().catch(console.error);
