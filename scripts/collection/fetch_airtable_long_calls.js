require('dotenv').config();

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_ID = process.env.AIRTABLE_TABLE_ID;

console.log('Base ID:', BASE_ID);
console.log('Table ID:', TABLE_ID);

// Функция для получения записей из Airtable
function getAirtableRecords() {
    const options = {
        hostname: 'api.airtable.com',
        port: 443,
        path: `/v0/${BASE_ID}/${TABLE_ID}?maxRecords=500&view=viwbeRLj9SdSkD23X`,
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
        }
    };

    const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            if (res.statusCode === 200) {
                const response = JSON.parse(data);
                console.log('\n=== СТАТИСТИКА AIRTABLE ===');
                console.log('Всего записей получено:', response.records.length);
                
                if (response.records.length > 0) {
                    const sampleRecord = response.records[0];
                    console.log('\n=== ПОЛЯ В ЗАПИСИ ===');
                    Object.keys(sampleRecord.fields).forEach(field => {
                        const value = sampleRecord.fields[field];
                        const type = Array.isArray(value) ? 'array' : typeof value;
                        console.log(`- ${field}: ${type}`);
                    });
                    
                    // Анализируем длительности
                    let longCalls = 0;
                    let totalCalls = 0;
                    let durations = [];
                    let callsWithTranscript = 0;
                    
                    response.records.forEach(record => {
                        const fields = record.fields;
                        if (fields.Duration) {
                            totalCalls++;
                            durations.push(fields.Duration);
                            if (fields.Duration > 60) {
                                longCalls++;
                            }
                        }
                        
                        // Проверяем наличие транскрипции
                        if (fields.Transcript || fields.Messages) {
                            callsWithTranscript++;
                        }
                    });
                    
                    console.log('\n=== АНАЛИЗ ДЛИТЕЛЬНОСТИ ===');
                    console.log('Всего разговоров с Duration:', totalCalls);
                    console.log('Разговоров > 60 сек:', longCalls);
                    console.log('Разговоров с транскрипцией:', callsWithTranscript);
                    
                    if (durations.length > 0) {
                        durations.sort((a,b) => b-a);
                        console.log('Максимальная длительность:', durations[0], 'сек');
                        console.log('Медиана:', durations[Math.floor(durations.length/2)], 'сек');
                        console.log('Топ-5 длительностей:', durations.slice(0,5).join(', '));
                    }
                    
                    // Проверяем поля для QCI
                    console.log('\n=== ГОТОВНОСТЬ К QCI АНАЛИЗУ ===');
                    const qciFields = ['Duration', 'Transcript', 'Messages', 'Assistant', 'Status', 'End Reason'];
                    qciFields.forEach(field => {
                        const hasField = Object.keys(sampleRecord.fields).includes(field);
                        console.log(`${field}: ${hasField ? '✓' : '✗'}`);
                    });
                    
                    // Нужные поля для добавления
                    console.log('\n=== ПОЛЯ ДЛЯ ДОБАВЛЕНИЯ В AIRTABLE ===');
                    const newFields = [
                        'QCI_Score (Number)',
                        'Agent_Talk_Ratio (Number)', 
                        'Time_To_Value (Number)',
                        'First_CTA_Time (Number)',
                        'Dead_Air_Events (Number)',
                        'Objections_Recognized (Checkbox)',
                        'Compliance_Time (Number)',
                        'Alternative_Offered (Checkbox)',
                        'Brand_Mentions_Count (Number)',
                        'Language_Match (Checkbox)',
                        'Meeting_Scheduled (Checkbox)',
                        'Coaching_Tips (Long text)',
                        'QCI_Evidence (Long text)',
                        'Call_Classification (Single select: poor/average/good/excellent)'
                    ];
                    
                    newFields.forEach(field => {
                        console.log(`- ${field}`);
                    });
                    
                    // Сохраняем данные
                    const outputPath = path.join('data', 'processed', 'airtable_long_calls.json');
                    fs.writeFileSync(outputPath, JSON.stringify(response, null, 2));
                    console.log('\nДанные сохранены в:', outputPath);
                }
            } else {
                console.log('Ошибка:', res.statusCode);
                console.log('Ответ:', data);
            }
        });
    });

    req.on('error', (error) => {
        console.error('Ошибка запроса:', error);
    });

    req.end();
}

getAirtableRecords();