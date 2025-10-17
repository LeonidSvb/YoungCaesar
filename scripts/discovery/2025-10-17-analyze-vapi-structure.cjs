const fs = require('fs');

// Загружаем последний файл с данными
const data = JSON.parse(fs.readFileSync('production_scripts/vapi_collection/results/2025-09-26T10-14-46_vapi_calls_2025-09-20_to_2025-09-26_cost-0.json', 'utf8'));

console.log('📊 АНАЛИЗ СТРУКТУРЫ VAPI ДАННЫХ');
console.log('='.repeat(60));
console.log(`\n💼 Всего звонков: ${data.length}`);

if (data.length > 0) {
    const sample = data[0];

    console.log('\n📋 ОСНОВНЫЕ ПОЛЯ (TOP LEVEL):');
    Object.keys(sample).forEach(key => {
        const value = sample[key];
        const type = Array.isArray(value) ? 'array' : typeof value;
        const preview = type === 'object' && value !== null ? '{...}' :
                       type === 'array' ? `[${value.length} items]` :
                       type === 'string' ? `"${String(value).substring(0, 30)}..."` :
                       String(value);
        console.log(`  ${key}: ${type} = ${preview}`);
    });

    // Анализ вложенных структур
    if (sample.messages && Array.isArray(sample.messages)) {
        console.log('\n📨 СТРУКТУРА MESSAGES:');
        const msg = sample.messages[0];
        if (msg) {
            Object.keys(msg).forEach(key => {
                console.log(`  ${key}: ${typeof msg[key]}`);
            });
        }
    }

    if (sample.customer) {
        console.log('\n👤 СТРУКТУРА CUSTOMER:');
        Object.keys(sample.customer).forEach(key => {
            console.log(`  ${key}: ${typeof sample.customer[key]}`);
        });
    }

    if (sample.assistant) {
        console.log('\n🤖 СТРУКТУРА ASSISTANT:');
        Object.keys(sample.assistant).forEach(key => {
            const val = sample.assistant[key];
            const type = typeof val === 'object' && val !== null ? 'object' : typeof val;
            console.log(`  ${key}: ${type}`);
        });
    }

    // Статистика по полям
    console.log('\n📈 ЗАПОЛНЕННОСТЬ ПОЛЕЙ (sample 100 calls):');
    const sampleSize = Math.min(100, data.length);
    const fieldsStats = {};

    for (let i = 0; i < sampleSize; i++) {
        const call = data[i];
        Object.keys(call).forEach(key => {
            if (!fieldsStats[key]) fieldsStats[key] = { filled: 0, empty: 0 };
            if (call[key] !== null && call[key] !== undefined && call[key] !== '') {
                fieldsStats[key].filled++;
            } else {
                fieldsStats[key].empty++;
            }
        });
    }

    Object.keys(fieldsStats).sort().forEach(key => {
        const { filled, empty } = fieldsStats[key];
        const percent = Math.round((filled / sampleSize) * 100);
        console.log(`  ${key.padEnd(30)} ${percent}% filled (${filled}/${sampleSize})`);
    });

    // Сохраняем пример структуры
    console.log('\n💾 Сохраняю пример звонка для детального анализа...');
    fs.writeFileSync(
        'scripts/discovery/2025-10-17-vapi-call-sample.json',
        JSON.stringify(sample, null, 2)
    );
    console.log('✅ Сохранено: scripts/discovery/2025-10-17-vapi-call-sample.json');
}

console.log('\n' + '='.repeat(60));
