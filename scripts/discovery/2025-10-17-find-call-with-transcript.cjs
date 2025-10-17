const fs = require('fs');

// Загружаем БОЛЬШОЙ файл с данными (35MB, там точно есть transcript)
const data = JSON.parse(fs.readFileSync('production_scripts/vapi_collection/results/2025-09-17T09-51-00_vapi_calls_2025-01-01_to_2025-09-17_cost-0.03.json', 'utf8'));

console.log(`Всего звонков: ${data.length}`);

// Найти звонок с transcript и messages
const callWithTranscript = data.find(call => call.transcript && call.messages && call.messages.length > 0);

if (callWithTranscript) {
    console.log('\nНайден звонок с transcript!');
    console.log(`ID: ${callWithTranscript.id}`);
    console.log(`Assistant: ${callWithTranscript.assistantId}`);
    console.log(`Cost: $${callWithTranscript.cost}`);
    const duration = Math.round((new Date(callWithTranscript.endedAt) - new Date(callWithTranscript.startedAt)) / 1000);
    console.log(`Duration: ${duration}s`);
    console.log(`Messages: ${callWithTranscript.messages.length} messages`);
    console.log(`Transcript length: ${callWithTranscript.transcript.length} chars`);

    // Сохраняем для детального анализа
    fs.writeFileSync(
        'scripts/discovery/2025-10-17-vapi-call-with-transcript.json',
        JSON.stringify(callWithTranscript, null, 2)
    );

    console.log('\n✅ Сохранено: scripts/discovery/2025-10-17-vapi-call-with-transcript.json');

    // Показываем структуру
    console.log('\nПОЛЯ В ЗВОНКЕ С TRANSCRIPT:');
    Object.keys(callWithTranscript).sort().forEach(key => {
        const val = callWithTranscript[key];
        const type = Array.isArray(val) ? 'array' : typeof val;
        if (type === 'array') {
            console.log(`  ${key}: array[${val.length}]`);
        } else if (type === 'object' && val !== null) {
            console.log(`  ${key}: object {}`);
        } else {
            console.log(`  ${key}: ${type}`);
        }
    });

    // Messages structure
    if (callWithTranscript.messages && callWithTranscript.messages.length > 0) {
        console.log('\nПРИМЕР MESSAGE СТРУКТУРЫ:');
        const msg = callWithTranscript.messages[0];
        Object.keys(msg).forEach(key => {
            console.log(`  ${key}: ${typeof msg[key]}`);
        });
    }

    // Analysis structure if exists
    if (callWithTranscript.analysis) {
        console.log('\nСТРУКТУРА ANALYSIS:');
        Object.keys(callWithTranscript.analysis).forEach(key => {
            const type = typeof callWithTranscript.analysis[key];
            console.log(`  ${key}: ${type}`);
        });
    }
} else {
    console.log('❌ Не найдено звонков с transcript в этом файле');
}
