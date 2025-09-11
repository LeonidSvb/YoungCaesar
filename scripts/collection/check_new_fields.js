require('dotenv').config();

const https = require('https');

const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_ID = process.env.AIRTABLE_TABLE_ID;

console.log('🔍 Проверка новых полей в Airtable (без кэша)');
console.log('============================================\n');

// Получаем записи с timestamp для избежания кэширования
function checkNewFields() {
    const timestamp = Date.now();
    const options = {
        hostname: 'api.airtable.com',
        port: 443,
        path: `/v0/${BASE_ID}/${TABLE_ID}?maxRecords=1&_t=${timestamp}`,
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
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
                
                if (response.records && response.records.length > 0) {
                    const allFields = Object.keys(response.records[0].fields).sort();
                    
                    console.log(`📊 Всего полей: ${allFields.length}\n`);
                    
                    // Ищем QCI поля
                    const qciFields = allFields.filter(field => 
                        field.toLowerCase().includes('qci') || 
                        field.toLowerCase().includes('agent') || 
                        field.toLowerCase().includes('coaching') ||
                        field.toLowerCase().includes('classification') ||
                        field.toLowerCase().includes('objection') ||
                        field.toLowerCase().includes('compliance') ||
                        field.toLowerCase().includes('brand') ||
                        field.toLowerCase().includes('meeting') ||
                        field.toLowerCase().includes('evidence') ||
                        field.toLowerCase().includes('dead') ||
                        field.toLowerCase().includes('cta') ||
                        field.toLowerCase().includes('time_to') ||
                        field.toLowerCase().includes('alternative') ||
                        field.toLowerCase().includes('language')
                    );
                    
                    console.log(`🎯 QCI-связанные поля (${qciFields.length}):`);
                    qciFields.forEach(field => {
                        console.log(`✓ ${field}`);
                    });
                    
                    if (qciFields.length === 0) {
                        console.log('❌ QCI поля не найдены');
                        console.log('\n🔍 ВСЕ ДОСТУПНЫЕ ПОЛЯ:');
                        allFields.forEach((field, i) => {
                            console.log(`${(i+1).toString().padStart(2)}. ${field}`);
                        });
                    } else {
                        console.log(`\n✅ Найдено ${qciFields.length} QCI полей - готово к анализу!`);
                    }
                } else {
                    console.log('❌ Нет записей для анализа');
                }
            } else {
                console.log('❌ Ошибка API:', res.statusCode);
                console.log(data);
            }
        });
    });

    req.on('error', (error) => {
        console.error('❌ Ошибка запроса:', error);
    });

    req.end();
}

checkNewFields();