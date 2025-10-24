const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

async function getCallsStatistics() {
    console.log('=== СТАТИСТИКА ЗВОНКОВ ПО ДНЯМ ===\n');

    // Звонки по дням за последние 30 дней
    const { data: byDays } = await supabase.rpc('execute_sql', {
        query: `
            SELECT
                DATE(COALESCE(started_at, created_at)) as date,
                COUNT(*) as total_calls,
                COUNT(CASE WHEN transcript IS NOT NULL AND LENGTH(transcript) > 100 THEN 1 END) as with_transcript
            FROM vapi_calls_raw
            WHERE COALESCE(started_at, created_at) >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY DATE(COALESCE(started_at, created_at))
            ORDER BY date DESC
            LIMIT 15
        `
    });

    if (byDays && byDays.length > 0) {
        console.log('Последние 15 дней:');
        byDays.forEach(row => {
            console.log(`  ${row.date}: ${row.total_calls} звонков | с транскриптом > 100: ${row.with_transcript}`);
        });
    }

    console.log('\n=== СВОДКА ПО ПЕРИОДАМ ===\n');

    // 7 дней
    const { count: calls7d } = await supabase
        .from('vapi_calls_raw')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    console.log(`За 7 дней: ${calls7d} звонков`);

    // 14 дней
    const { count: calls14d } = await supabase
        .from('vapi_calls_raw')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString());

    console.log(`За 14 дней: ${calls14d} звонков`);

    // 30 дней
    const { count: calls30d } = await supabase
        .from('vapi_calls_raw')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    console.log(`За 30 дней: ${calls30d} звонков`);

    // Всего
    const { count: totalCalls } = await supabase
        .from('vapi_calls_raw')
        .select('*', { count: 'exact', head: true });

    console.log(`\nВсего в базе: ${totalCalls} звонков`);

    console.log('\n=== QCI ПОКРЫТИЕ ===\n');

    const { count: qciTotal } = await supabase
        .from('qci_analyses')
        .select('*', { count: 'exact', head: true });

    console.log(`QCI анализов: ${qciTotal}`);
    console.log(`Покрытие: ${(qciTotal / totalCalls * 100).toFixed(1)}%`);
}

getCallsStatistics().catch(console.error);
