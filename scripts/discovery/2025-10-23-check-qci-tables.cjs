const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

async function checkTables() {
    console.log('=== ПРОВЕРКА ТАБЛИЦ QCI ===\n');

    const tables = [
        'qci_analyses',
        'vapi_qci_analyses',
        'call_qci',
        'qci_analysis',
        'analyses'
    ];

    for (const table of tables) {
        try {
            const { count, error } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });

            if (error) {
                console.log(`${table}: не существует`);
            } else {
                console.log(`${table}: ${count} записей`);
            }
        } catch (e) {
            console.log(`${table}: ошибка (${e.message})`);
        }
    }

    console.log('\n=== ПРОВЕРКА МИГРАЦИЙ ===\n');
    try {
        const { data, error } = await supabase
            .from('_migrations')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);

        if (data) {
            console.log('Последние 10 миграций:');
            data.forEach(m => {
                console.log(`  ${m.name} - ${m.created_at}`);
            });
        }
    } catch (e) {
        console.log('Таблица _migrations не найдена');
    }
}

checkTables().catch(console.error);
