const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://wbrzbqqpbshjfajfywrz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndicnpicXFwYnNoamZhamZ5d3J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNzA5MDQ0NiwiZXhwIjoyMDQyNjY2NDQ2fQ.wNiWl4Ye1lxHFl7YNsLbRMxLzg7VCGV9Y7Z7xQCcOIo';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkTable(tableName) {
  const { count, error } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true });

  if (!error) {
    console.log(`✅ ${tableName}: ${count} записей`);

    const { data: sample } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);

    if (sample && sample[0]) {
      const columns = Object.keys(sample[0]).slice(0, 10);
      console.log(`   Колонки: ${columns.join(', ')}...`);
    }
    return true;
  } else {
    console.log(`❌ ${tableName}: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('\n=== ПРОВЕРКА ТАБЛИЦ В SUPABASE ===\n');

  console.log('📊 Таблицы со звонками:');
  await checkTable('vapi_calls_raw');
  await checkTable('calls');

  console.log('\n👤 Таблицы с ассистентами:');
  await checkTable('vapi_assistants');
  await checkTable('assistants');

  console.log('\n📈 Таблица QCI:');
  await checkTable('qci_analyses');

  console.log('\n✅ Проверка завершена\n');
}

main().catch(console.error);
