require('dotenv').config({ path: '../../.env' });

const fs = require('fs');
const path = require('path');

// Загружаем исходные данные с assistantId
const sourceDataPath = path.resolve(__dirname, '../vapi_collection/results/2025-09-17T09-51-00_vapi_calls_2025-01-01_to_2025-09-17_cost-0.03.json');
const sourceData = JSON.parse(fs.readFileSync(sourceDataPath, 'utf8'));

// Создаем мапу call_id -> assistantId
const assistantMap = {};
sourceData.forEach(call => {
    assistantMap[call.id] = call.assistantId;
});

// Загружаем результаты QCI анализа
const qciResultsPath = path.resolve(__dirname, 'results/qci_full_calls_2025-09-17T12-41-22.json');
const qciData = JSON.parse(fs.readFileSync(qciResultsPath, 'utf8'));

// Добавляем assistantId к каждому результату
qciData.results.forEach(result => {
    result.assistant_id = assistantMap[result.call_id] || 'unknown';
});

// Сохраняем обновленные результаты
const updatedPath = path.resolve(__dirname, 'results/qci_full_calls_with_assistants_2025-09-17T12-41-22.json');
fs.writeFileSync(updatedPath, JSON.stringify(qciData, null, 2));

console.log(`✅ Updated QCI data with assistant IDs saved to: ${updatedPath}`);
console.log(`📊 Total calls: ${qciData.results.length}`);

// Показываем статистику по ассистентам
const assistantStats = {};
qciData.results.forEach(result => {
    const assistantId = result.assistant_id;
    if (!assistantStats[assistantId]) {
        assistantStats[assistantId] = {
            count: 0,
            totalQCI: 0,
            avgQCI: 0
        };
    }
    assistantStats[assistantId].count++;
    assistantStats[assistantId].totalQCI += result.qci_total;
});

// Вычисляем средние значения
for (const assistantId in assistantStats) {
    assistantStats[assistantId].avgQCI = (assistantStats[assistantId].totalQCI / assistantStats[assistantId].count).toFixed(1);
}

console.log('\n📈 Assistant Performance:');
Object.entries(assistantStats)
    .sort((a, b) => b[1].avgQCI - a[1].avgQCI)
    .forEach(([assistantId, stats]) => {
        console.log(`🤖 ${assistantId.substring(0, 8)}: ${stats.count} calls, avg QCI: ${stats.avgQCI}/100`);
    });