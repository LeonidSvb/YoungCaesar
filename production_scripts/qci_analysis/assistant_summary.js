require('dotenv').config({ path: '../../.env' });

const fs = require('fs');
const path = require('path');

// Загружаем результаты QCI анализа
const qciResultsPath = path.resolve(__dirname, 'results/qci_full_calls_with_assistants_2025-09-17T12-41-22.json');
const qciData = JSON.parse(fs.readFileSync(qciResultsPath, 'utf8'));

console.log('🤖 ПОЛНАЯ СТАТИСТИКА ПО АССИСТЕНТАМ\n');

// Группируем по assistant_id
const assistantStats = {};
qciData.results.forEach(call => {
    const assistantId = call.assistant_id || 'unknown';

    if (!assistantStats[assistantId]) {
        assistantStats[assistantId] = {
            calls: [],
            names: new Set()
        };
    }

    assistantStats[assistantId].calls.push(call);

    // Извлекаем имена из brand mentions
    const mentions = call.ai_analysis?.evidence?.brand_mentions || [];
    for (const mention of mentions) {
        const match = mention.match(/this is (\w+[\s\w]*?)(?:\s+from|\.|$)/i);
        if (match) {
            assistantStats[assistantId].names.add(match[1].trim());
            break;
        }
    }
});

// Вычисляем статистики и сортируем
const sortedAssistants = Object.entries(assistantStats)
    .map(([assistantId, data]) => {
        const calls = data.calls;
        const count = calls.length;
        const avgQCI = (calls.reduce((sum, call) => sum + call.qci_total, 0) / count).toFixed(1);
        const avgDynamics = (calls.reduce((sum, call) => sum + call.dynamics, 0) / count).toFixed(1);
        const avgObjections = (calls.reduce((sum, call) => sum + call.objections, 0) / count).toFixed(1);
        const avgBrand = (calls.reduce((sum, call) => sum + call.brand, 0) / count).toFixed(1);
        const avgOutcome = (calls.reduce((sum, call) => sum + call.outcome, 0) / count).toFixed(1);
        const passCount = calls.filter(call => call.qci_total >= 80).length;
        const passRate = ((passCount / count) * 100).toFixed(1);

        return {
            assistantId,
            count,
            avgQCI: parseFloat(avgQCI),
            avgDynamics: parseFloat(avgDynamics),
            avgObjections: parseFloat(avgObjections),
            avgBrand: parseFloat(avgBrand),
            avgOutcome: parseFloat(avgOutcome),
            passRate: parseFloat(passRate),
            names: Array.from(data.names).filter(n => n).join(', ') || 'No names detected'
        };
    })
    .sort((a, b) => b.avgQCI - a.avgQCI);

// Выводим результаты
sortedAssistants.forEach((assistant, index) => {
    const rank = index + 1;
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '  ';

    console.log(`${medal} #${rank} Assistant ${assistant.assistantId.substring(0, 8)}`);
    console.log(`   📊 QCI: ${assistant.avgQCI}/100 (${assistant.count} calls, ${assistant.passRate}% pass rate)`);
    console.log(`   📈 Dynamics: ${assistant.avgDynamics}/30 | Objections: ${assistant.avgObjections}/20`);
    console.log(`   🏷️  Brand: ${assistant.avgBrand}/20 | Outcome: ${assistant.avgOutcome}/30`);
    console.log(`   👤 Names used: ${assistant.names}`);
    console.log('');
});

console.log('\n📋 РЕКОМЕНДАЦИИ:');
console.log(`🏆 Лучший: ${sortedAssistants[0].assistantId.substring(0, 8)} (QCI: ${sortedAssistants[0].avgQCI}) - изучить его промпты`);
console.log(`⚡ Самый активный: ${sortedAssistants.find(a => a.count === Math.max(...sortedAssistants.map(s => s.count))).assistantId.substring(0, 8)} (${Math.max(...sortedAssistants.map(s => s.count))} calls)`);
console.log(`📉 Требует улучшения: ${sortedAssistants[sortedAssistants.length - 1].assistantId.substring(0, 8)} (QCI: ${sortedAssistants[sortedAssistants.length - 1].avgQCI})`);

const multipleNames = sortedAssistants.filter(a => a.names.includes(','));
if (multipleNames.length > 0) {
    console.log(`🔄 Меняли промпты (разные имена): ${multipleNames.map(a => a.assistantId.substring(0, 8)).join(', ')}`);
}