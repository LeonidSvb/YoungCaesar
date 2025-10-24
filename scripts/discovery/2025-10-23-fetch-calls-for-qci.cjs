const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

async function fetchCallsForQCI() {
    console.log('=== ПОЛУЧЕНИЕ ЗВОНКОВ ДЛЯ QCI АНАЛИЗА ===\n');

    // Получить все звонки с транскриптом
    const { data: allCalls } = await supabase
        .from('vapi_calls_raw')
        .select('id, transcript, assistant_id, created_at')
        .not('transcript', 'is', null);

    console.log(`Всего звонков с транскриптом: ${allCalls.length}`);

    // Получить все существующие QCI анализы
    const { data: existingQCI } = await supabase
        .from('qci_analyses')
        .select('call_id');

    console.log(`Существующих QCI анализов: ${existingQCI?.length || 0}`);

    const qciSet = new Set((existingQCI || []).map(q => q.call_id));

    // Отфильтровать звонки БЕЗ QCI и с транскриптом > 100 символов
    const callsNeedingQCI = allCalls
        .filter(c =>
            c.transcript &&
            c.transcript.length > 100 &&
            !qciSet.has(c.id)
        )
        .map(c => ({
            id: c.id,
            assistantId: c.assistant_id,
            transcript: c.transcript
        }));

    console.log(`\nЗвонков БЕЗ QCI (транскрипт > 100): ${callsNeedingQCI.length}`);

    // Показать распределение по длине
    const lengths = {
        '101-500': 0,
        '501-1000': 0,
        '1001-5000': 0,
        '5000+': 0
    };

    callsNeedingQCI.forEach(call => {
        const len = call.transcript.length;
        if (len <= 500) lengths['101-500']++;
        else if (len <= 1000) lengths['501-1000']++;
        else if (len <= 5000) lengths['1001-5000']++;
        else lengths['5000+']++;
    });

    console.log('\nРаспределение по длине транскрипта:');
    Object.entries(lengths).forEach(([range, count]) => {
        console.log(`  ${range}: ${count} звонков`);
    });

    // Сохранить в файл для QCI analyzer
    const outputPath = path.resolve(__dirname, '../../production_scripts/qci_analysis/results/calls_for_analysis.json');

    // Создать директорию если не существует
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(callsNeedingQCI, null, 2));

    console.log(`\n✅ Сохранено в: ${outputPath}`);
    console.log(`📊 Готово к анализу: ${callsNeedingQCI.length} звонков`);
}

fetchCallsForQCI().catch(console.error);
