const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

async function fullQciAnalysis() {
    console.log('=== ПОЛНЫЙ АНАЛИЗ QCI ===\n');

    const { count: totalCalls } = await supabase
        .from('vapi_calls_raw')
        .select('*', { count: 'exact', head: true });

    console.log(`Всего звонков в базе: ${totalCalls}`);

    const { count: callsWithTranscript } = await supabase
        .from('vapi_calls_raw')
        .select('*', { count: 'exact', head: true })
        .not('transcript', 'is', null)
        .neq('transcript', '');

    console.log(`Звонков с транскриптом: ${callsWithTranscript}`);

    const { count: qciCount } = await supabase
        .from('qci_analyses')
        .select('*', { count: 'exact', head: true });

    console.log(`QCI анализов в базе: ${qciCount}`);

    console.log(`\nПокрытие: ${(qciCount / totalCalls * 100).toFixed(1)}% от всех звонков`);
    console.log(`Покрытие: ${(qciCount / callsWithTranscript * 100).toFixed(1)}% от звонков с транскриптом`);

    const { data: allCalls } = await supabase
        .from('vapi_calls_raw')
        .select('id, transcript')
        .not('transcript', 'is', null);

    const { data: allQci } = await supabase
        .from('qci_analyses')
        .select('call_id');

    const qciCallIds = new Set((allQci || []).map(q => q.call_id));

    const lengths = {
        '0-100': { total: 0, withQci: 0 },
        '101-500': { total: 0, withQci: 0 },
        '501-1000': { total: 0, withQci: 0 },
        '1001-5000': { total: 0, withQci: 0 },
        '5000+': { total: 0, withQci: 0 }
    };

    allCalls.forEach(call => {
        const len = call.transcript?.length || 0;
        const hasQci = qciCallIds.has(call.id);

        let range;
        if (len <= 100) range = '0-100';
        else if (len <= 500) range = '101-500';
        else if (len <= 1000) range = '501-1000';
        else if (len <= 5000) range = '1001-5000';
        else range = '5000+';

        lengths[range].total++;
        if (hasQci) lengths[range].withQci++;
    });

    console.log('\n=== РАСПРЕДЕЛЕНИЕ ПО ДЛИНЕ ТРАНСКРИПТА ===');
    Object.entries(lengths).forEach(([range, stats]) => {
        const coverage = stats.total > 0 ? (stats.withQci / stats.total * 100).toFixed(1) : 0;
        console.log(`${range}: ${stats.total} звонков | QCI: ${stats.withQci} (${coverage}%)`);
    });

    const callsOver100 = allCalls.filter(c => (c.transcript?.length || 0) > 100);
    const callsOver100WithQci = callsOver100.filter(c => qciCallIds.has(c.id));
    const callsOver100WithoutQci = callsOver100.filter(c => !qciCallIds.has(c.id));

    console.log('\n=== ФОКУС НА ЗВОНКАХ > 100 СИМВОЛОВ ===');
    console.log(`Всего звонков с транскриптом > 100: ${callsOver100.length}`);
    console.log(`С QCI анализом: ${callsOver100WithQci.length}`);
    console.log(`БЕЗ QCI анализа: ${callsOver100WithoutQci.length}`);
    console.log(`Покрытие: ${(callsOver100WithQci.length / callsOver100.length * 100).toFixed(1)}%`);

    if (callsOver100WithoutQci.length > 0) {
        console.log(`\nПримеры звонков БЕЗ QCI (> 100 символов, первые 5):`);
        callsOver100WithoutQci.slice(0, 5).forEach(call => {
            const short = call.id.substring(0, 12);
            console.log(`  ID: ${short}... | Длина: ${call.transcript.length} символов`);
        });
    }

    console.log('\n=== ВЫВОДЫ ===');
    console.log(`Нужно проанализировать еще: ${callsOver100WithoutQci.length} звонков (> 100 символов)`);
    console.log(`Текущий фильтр в qci_analyzer.js: MIN_TRANSCRIPT_LENGTH = 100`);
}

fullQciAnalysis().catch(console.error);
