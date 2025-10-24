const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

async function analyzeQciStatus() {
    console.log('=== АНАЛИЗ СТАТУСА QCI ===\n');

    const { data: allCalls } = await supabase
        .from('vapi_calls_raw')
        .select('id, transcript')
        .not('transcript', 'is', null);

    const { data: allQci } = await supabase
        .from('qci_analyses')
        .select('call_id, qci_total_score');

    console.log(`Звонков с транскриптом (любая длина): ${allCalls.length}`);
    console.log(`QCI анализов в базе: ${allQci?.length || 0}\n`);

    const lengths = {
        '0-100': 0,
        '101-500': 0,
        '501-1000': 0,
        '1001+': 0
    };

    allCalls.forEach(call => {
        const len = call.transcript?.length || 0;
        if (len <= 100) lengths['0-100']++;
        else if (len <= 500) lengths['101-500']++;
        else if (len <= 1000) lengths['501-1000']++;
        else lengths['1001+']++;
    });

    console.log('Распределение звонков по длине транскрипта:');
    Object.entries(lengths).forEach(([range, count]) => {
        console.log(`  ${range} символов: ${count} звонков`);
    });

    const qciCallIds = new Set((allQci || []).map(q => q.call_id));
    const callsWithoutQci = allCalls.filter(call =>
        !qciCallIds.has(call.id) &&
        call.transcript &&
        call.transcript.length > 100
    );

    console.log(`\nЗвонков БЕЗ QCI (транскрипт > 100): ${callsWithoutQci.length}`);

    const callsMap = new Map(allCalls.map(c => [c.id, c.transcript?.length || 0]));
    const qciWithShortTranscript = (allQci || []).filter(q => {
        const len = callsMap.get(q.call_id) || 0;
        return len <= 100;
    });

    console.log(`QCI для звонков с транскриптом <= 100: ${qciWithShortTranscript.length}`);

    if (callsWithoutQci.length > 0) {
        console.log(`\nПримеры звонков БЕЗ QCI (первые 10):`);
        callsWithoutQci.slice(0, 10).forEach(call => {
            const short = call.id.substring(0, 12);
            console.log(`  ID: ${short}... | Длина: ${call.transcript.length} символов`);
        });
    }

    console.log('\n=== ВЫВОДЫ ===');
    console.log(`Нужно проанализировать еще: ${callsWithoutQci.length} звонков`);
    console.log(`Текущее покрытие: ${((allQci?.length || 0) / allCalls.length * 100).toFixed(1)}%`);
}

analyzeQciStatus().catch(console.error);
