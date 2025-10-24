require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getLastRun() {
  const { data: lastRun, error: runError } = await supabase
    .from('runs')
    .select('*')
    .eq('script_name', 'vapi-sync')
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  if (runError) {
    console.error('Ошибка получения run:', runError);
    return;
  }

  console.log('\n' + '='.repeat(80));
  console.log('ПОСЛЕДНИЙ ЗАПУСК СИНХРОНИЗАЦИИ');
  console.log('='.repeat(80));
  console.log('ID запуска:', lastRun.id);
  console.log('Статус:', lastRun.status);
  console.log('Время начала:', lastRun.started_at);
  console.log('Время завершения:', lastRun.finished_at);
  console.log('Длительность:', lastRun.duration_ms ? (lastRun.duration_ms / 1000).toFixed(2) + ' сек' : 'N/A');
  console.log('\nСТАТИСТИКА:');
  console.log('  - Получено из VAPI:', lastRun.records_fetched || 0);
  console.log('  - Вставлено новых:', lastRun.records_inserted || 0);
  console.log('  - Обновлено:', lastRun.records_updated || 0);
  console.log('  - Ошибок:', lastRun.records_failed || 0);
  if (lastRun.error_message) {
    console.log('  - Сообщение об ошибке:', lastRun.error_message);
  }

  const { data: logs, error: logsError } = await supabase
    .from('logs')
    .select('*')
    .eq('run_id', lastRun.id)
    .order('timestamp', { ascending: true });

  if (!logsError && logs && logs.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('ДЕТАЛЬНЫЕ ЛОГИ (' + logs.length + ' записей)');
    console.log('='.repeat(80));
    logs.forEach((log, i) => {
      const time = new Date(log.timestamp).toLocaleTimeString('ru-RU');
      const meta = log.meta && Object.keys(log.meta).length > 0 ? JSON.stringify(log.meta) : '';
      console.log(`[${i+1}] [${time}] [${log.level}] ${log.step}: ${log.message}${meta ? ' ' + meta : ''}`);
    });
  }

  console.log('\n' + '='.repeat(80));
}

getLastRun().catch(console.error);
