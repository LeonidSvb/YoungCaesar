const fs = require('fs');
const path = require('path');

// Читаем сырые данные VAPI
const callsFile = path.join('data', 'raw', 'vapi_raw_calls_2025-09-03.json');

if (fs.existsSync(callsFile)) {
    const calls = JSON.parse(fs.readFileSync(callsFile, 'utf-8'));
    
    // Фильтруем разговоры длиннее 60 секунд
    const longCalls = calls.filter(call => {
        const duration = call.endedAt && call.createdAt ? 
            (new Date(call.endedAt) - new Date(call.createdAt)) / 1000 : 0;
        return duration > 60;
    });
    
    console.log('\n=== СТАТИСТИКА VAPI CALLS ===');
    console.log('Всего записей:', calls.length);
    console.log('Разговоров > 1 мин:', longCalls.length);
    
    if (longCalls.length > 0) {
        const sampleCall = longCalls[0];
        
        console.log('\n=== ДОСТУПНЫЕ ПОЛЯ В VAPI ===');
        Object.keys(sampleCall).forEach(key => {
            const value = sampleCall[key];
            let type = typeof value;
            if (Array.isArray(value)) {
                type = `array[${value.length}]`;
            } else if (value && typeof value === 'object') {
                type = 'object';
            }
            console.log(`- ${key}: ${type}`);
        });
        
        console.log('\n=== АНАЛИЗ ПЕРВЫХ 3 ДЛИННЫХ РАЗГОВОРОВ ===');
        
        longCalls.slice(0, 3).forEach((call, index) => {
            const duration = (new Date(call.endedAt) - new Date(call.createdAt)) / 1000;
            console.log(`\n--- Разговор ${index + 1} ---`);
            console.log('ID:', call.id);
            console.log('Assistant:', call.assistant?.name || call.assistantId);
            console.log('Duration:', Math.round(duration), 'сек');
            console.log('Status:', call.status);
            console.log('End Reason:', call.endedReason);
            console.log('Cost:', call.cost);
            
            // Проверяем messages
            if (call.messages && call.messages.length > 0) {
                console.log('\nСообщений:', call.messages.length);
                const agentMessages = call.messages.filter(m => m.role === 'assistant').length;
                const userMessages = call.messages.filter(m => m.role === 'user').length;
                const systemMessages = call.messages.filter(m => m.role === 'system').length;
                const toolMessages = call.messages.filter(m => m.role === 'tool').length;
                
                console.log('От агента:', agentMessages);
                console.log('От клиента:', userMessages);
                console.log('Системных:', systemMessages);
                console.log('Tool calls:', toolMessages);
                
                // Проверяем транскрипцию
                const hasTranscript = call.messages.some(m => m.content || m.text || m.message);
                console.log('Транскрипция доступна:', hasTranscript);
                
                // Пример первых сообщений
                if (call.messages[0]) {
                    console.log('\nПервое сообщение:');
                    console.log('- Role:', call.messages[0].role);
                    console.log('- Content:', (call.messages[0].content || call.messages[0].text || call.messages[0].message || '').substring(0, 100));
                }
            }
            
            // Проверяем artifact
            if (call.artifact) {
                console.log('\nArtifact:');
                console.log('- Transcript:', call.artifact.transcript ? 'Есть' : 'Нет');
                console.log('- Messages:', call.artifact.messages ? call.artifact.messages.length : 0);
                console.log('- Recording URL:', call.artifact.recordingUrl ? 'Есть' : 'Нет');
            }
            
            // Проверяем analysis
            if (call.analysis) {
                console.log('\nAnalysis:');
                console.log('- Summary:', call.analysis.summary ? 'Есть' : 'Нет');
                console.log('- Structure:', call.analysis.structuredData ? 'Есть' : 'Нет');
            }
        });
        
        console.log('\n=== ПОЛЯ НЕОБХОДИМЫЕ ДЛЯ QCI АНАЛИЗА ===');
        console.log('\nДля расчета QCI нужны:');
        console.log('1. Транскрипция с таймстампами - ', 
            longCalls[0].messages ? 'ВОЗМОЖНО (есть messages)' : 'НЕТ');
        console.log('2. Роли участников (agent/user) - ',
            longCalls[0].messages && longCalls[0].messages.some(m => m.role) ? 'ДА' : 'НЕТ');
        console.log('3. Длительность разговора - ДА (есть createdAt/endedAt)');
        console.log('4. Бренд/компания - ',
            longCalls[0].assistant?.name ? 'ЧАСТИЧНО (из имени assistant)' : 'НЕТ');
        console.log('5. Результат звонка - ',
            longCalls[0].endedReason ? 'ЧАСТИЧНО (есть endedReason)' : 'НЕТ');
        
        console.log('\n=== НЕДОСТАЮЩИЕ ПОЛЯ ДЛЯ QCI ===');
        console.log('Нужно добавить в Airtable:');
        console.log('- QCI_Score (число 0-100)');
        console.log('- Agent_Talk_Ratio (%)');
        console.log('- Time_To_Value (секунды)');
        console.log('- First_CTA_Time (секунды)');
        console.log('- Dead_Air_Count (количество)');
        console.log('- Objections_Handled (булево)');
        console.log('- Compliance_Time (секунды)');
        console.log('- Alternative_Offered (булево)');
        console.log('- Brand_Mentions (количество)');
        console.log('- Language_Match (булево)');
        console.log('- Meeting_Scheduled (булево)');
        console.log('- Coaching_Tips (длинный текст)');
        console.log('- QCI_Evidence (длинный текст JSON)');
        console.log('- Tool_Duplicates (количество)');
        console.log('- Apology_Rate (на минуту)');
    }
} else {
    console.log('Файл не найден:', callsFile);
}