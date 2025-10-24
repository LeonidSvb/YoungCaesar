const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

async function quickSync() {
    console.log('=== БЫСТРАЯ СИНХРОНИЗАЦИЯ QCI ===\n');

    // Чтение результатов QCI
    const qciFile = path.resolve(__dirname, '../../production_scripts/qci_analysis/results/qci_full_calls_with_assistants_latest.json');

    if (!fs.existsSync(qciFile)) {
        console.log('❌ Файл QCI results не найден!');
        return;
    }

    const qciData = JSON.parse(fs.readFileSync(qciFile, 'utf8'));
    const results = qciData.results || [];

    console.log(`Найдено QCI результатов: ${results.length}`);

    // Получить существующие QCI из Supabase
    const { data: existing } = await supabase
        .from('qci_analyses')
        .select('call_id');

    const existingSet = new Set((existing || []).map(e => e.call_id));
    console.log(`Уже в базе: ${existingSet.size}`);

    // Отфильтровать новые
    const newResults = results.filter(r => !existingSet.has(r.call_id));
    console.log(`Новых для синхронизации: ${newResults.length}\n`);

    if (newResults.length === 0) {
        console.log('✅ Все результаты уже синхронизированы!');
        return;
    }

    // Синхронизация порциями по 50
    let synced = 0;
    let failed = 0;

    for (let i = 0; i < newResults.length; i += 50) {
        const batch = newResults.slice(i, i + 50);

        const records = batch.map(r => ({
            call_id: r.call_id,
            total_score: r.qci_total || 0,
            dynamics_score: r.dynamics || 0,
            objections_score: r.objections || 0,
            brand_score: r.brand || 0,
            outcome_score: r.outcome || 0,
            analyzed_at: new Date().toISOString()
        }));

        const { data, error } = await supabase
            .from('qci_analyses')
            .insert(records);

        if (error) {
            console.log(`❌ Ошибка в batch ${i}: ${error.message}`);
            failed += batch.length;
        } else {
            synced += batch.length;
            console.log(`✅ Синхронизировано: ${synced}/${newResults.length}`);
        }
    }

    console.log(`\n=== РЕЗУЛЬТАТ ===`);
    console.log(`Успешно: ${synced}`);
    console.log(`Ошибок: ${failed}`);
}

quickSync().catch(console.error);
