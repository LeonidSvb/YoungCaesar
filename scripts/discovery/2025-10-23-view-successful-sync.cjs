require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getSuccessfulRun() {
  const runId = 'a31c0c6e-3557-495e-b788-5709d951672b';

  const { data: run, error: runError } = await supabase
    .from('runs')
    .select('*')
    .eq('id', runId)
    .single();

  if (runError) {
    console.error('Ошибка получения run:', runError);
    return;
  }

  console.log('\n' + '='.repeat(100));
  console.log('УСПЕШНЫЙ ЗАПУСК ИНКРЕМЕНТАЛЬНОЙ СИНХРОНИЗАЦИИ');
  console.log('GitHub Actions Run: https://github.com/LeonidSvb/YoungCaesar/actions/runs/18737830202');
  console.log('='.repeat(100));
  console.log('ID запуска:', run.id);
  console.log('Статус: ✅', run.status.toUpperCase());
  console.log('Время начала:', run.started_at);
  console.log('Время завершения:', run.finished_at);
  console.log('Длительность:', (run.duration_ms / 1000).toFixed(2), 'секунд');
  console.log('\n📊 СТАТИСТИКА СИНХРОНИЗАЦИИ:');
  console.log('  ✅ Получено из VAPI API:', run.records_fetched, 'звонков');
  console.log('  ➕ Вставлено новых записей:', run.records_inserted, 'звонков');
  console.log('  🔄 Обновлено записей:', run.records_updated, 'звонков');
  console.log('  ❌ Ошибок:', run.records_failed);

  const { data: logs, error: logsError } = await supabase
    .from('logs')
    .select('*')
    .eq('run_id', runId)
    .order('timestamp', { ascending: true });

  if (!logsError && logs && logs.length > 0) {
    console.log('\n' + '='.repeat(100));
    console.log('ДЕТАЛЬНЫЕ ЛОГИ ВЫПОЛНЕНИЯ (' + logs.length + ' записей)');
    console.log('='.repeat(100));

    const importantSteps = ['START', 'MODE', 'FETCH', 'SAVE', 'PROCESS', 'END'];

    logs.forEach((log, i) => {
      const time = new Date(log.timestamp).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      const icon = log.level === 'INFO' ? '📝' :
                   log.level === 'ERROR' ? '❌' :
                   log.level === 'WARNING' ? '⚠️' : 'ℹ️';

      let metaDisplay = '';
      if (log.meta && Object.keys(log.meta).length > 0) {
        if (log.meta.count !== undefined) {
          metaDisplay = ` [Количество: ${log.meta.count}]`;
        } else if (log.meta.inserted !== undefined || log.meta.updated !== undefined) {
          metaDisplay = ` [Вставлено: ${log.meta.inserted || 0}, Обновлено: ${log.meta.updated || 0}]`;
        } else if (log.meta.new_versions !== undefined) {
          metaDisplay = ` [Новых версий: ${log.meta.new_versions}]`;
        } else if (log.meta.start_date && log.meta.end_date) {
          metaDisplay = ` [Период: ${log.meta.start_date} → ${log.meta.end_date}]`;
        }
      }

      if (importantSteps.includes(log.step)) {
        console.log(`\n${icon} [${time}] [${log.step}] ${log.message}${metaDisplay}`);
      } else {
        console.log(`   [${time}] [${log.step}] ${log.message}${metaDisplay}`);
      }
    });
  }

  console.log('\n' + '='.repeat(100));
  console.log('ИТОГОВАЯ ИНФОРМАЦИЯ');
  console.log('='.repeat(100));

  const { count: totalCalls } = await supabase
    .from('vapi_calls_raw')
    .select('*', { count: 'exact', head: true });

  console.log('📊 Всего звонков в базе данных:', totalCalls);

  const { data: recentCalls } = await supabase
    .from('vapi_calls_raw')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (recentCalls) {
    console.log('📅 Последний звонок в базе:', new Date(recentCalls.created_at).toLocaleString('ru-RU'));
  }

  const { data: oldestCall } = await supabase
    .from('vapi_calls_raw')
    .select('created_at')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (oldestCall) {
    console.log('📅 Первый звонок в базе:', new Date(oldestCall.created_at).toLocaleString('ru-RU'));
  }

  console.log('\n' + '='.repeat(100));
  console.log('КАК ПРОСМАТРИВАТЬ ЛОГИ В SUPABASE:');
  console.log('='.repeat(100));
  console.log('1. Все запуски синхронизации:');
  console.log('   SELECT * FROM runs WHERE script_name = \'vapi-sync\' ORDER BY started_at DESC;');
  console.log('\n2. Логи конкретного запуска:');
  console.log(`   SELECT * FROM logs WHERE run_id = '${runId}' ORDER BY timestamp;`);
  console.log('\n3. Только ошибки:');
  console.log('   SELECT * FROM logs WHERE level = \'ERROR\' ORDER BY timestamp DESC;');
  console.log('\n4. Статистика по всем запускам:');
  console.log('   SELECT status, COUNT(*) as count, SUM(records_inserted) as total_inserted');
  console.log('   FROM runs WHERE script_name = \'vapi-sync\' GROUP BY status;');
  console.log('\n' + '='.repeat(100));
}

getSuccessfulRun().catch(console.error);
