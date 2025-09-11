require('dotenv').config();

const https = require('https');

const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_ID = process.env.AIRTABLE_TABLE_ID;

console.log('🔗 GETTING MAPPED RECORDS WITH DIRECT LINKS');
console.log('==========================================\n');

// Получаем записи с транскрипциями
function getRecordsWithTranscripts() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.airtable.com',
            port: 443,
            path: `/v0/${BASE_ID}/${TABLE_ID}?maxRecords=20&filterByFormula=${encodeURIComponent("AND({Transcript} != '', LEN({Transcript}) > 50)")}`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve(JSON.parse(data));
                } else {
                    reject(new Error(`API failed: ${res.statusCode} - ${data}`));
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

async function showMappedRecords() {
    try {
        const response = await getRecordsWithTranscripts();
        
        if (!response.records || response.records.length === 0) {
            console.log('❌ No records with transcripts found');
            return;
        }

        console.log(`📊 Found ${response.records.length} records with transcripts\n`);
        
        response.records.forEach((record, index) => {
            const fields = record.fields;
            const recordId = record.id;
            
            // Формируем прямую ссылку на запись
            const recordUrl = `https://airtable.com/${BASE_ID}/${TABLE_ID}/${recordId}`;
            
            console.log(`${index + 1}. RECORD #${index + 1}`);
            console.log(`   Record ID: ${recordId}`);
            console.log(`   Call ID: ${fields['Call ID'] || 'N/A'}`);
            console.log(`   Assistant: ${fields['Assistant Name'] || 'N/A'}`);
            console.log(`   Duration: ${fields['Duration (seconds)'] || 'N/A'} sec`);
            console.log(`   Status: ${fields['Status'] || 'N/A'}`);
            console.log(`   Transcript: ${fields['Transcript'] ? fields['Transcript'].substring(0, 80) + '...' : 'N/A'}`);
            
            // Проверяем QCI поля
            const qciFields = [
                'QCI Score',
                'Agent Talk Ratio', 
                'Time to Value',
                'First CTA time',
                'Dead Air Events',
                'Objections Rec',
                'Compl time',
                'Brand Count',
                'Meeting Sched',
                'Coaching Tips'
            ];
            
            const hasQCIData = qciFields.some(field => fields[field] !== undefined);
            console.log(`   QCI Data: ${hasQCIData ? '✅ HAS DATA' : '❌ EMPTY'}`);
            
            console.log(`   🔗 DIRECT LINK: ${recordUrl}`);
            console.log('');
        });
        
        // Дополнительная информация
        console.log('📋 BULK OPERATIONS:');
        console.log('==================');
        console.log(`Base URL: https://airtable.com/${BASE_ID}/${TABLE_ID}`);
        console.log(`View URL: https://airtable.com/${BASE_ID}/${TABLE_ID}/viwbeRLj9SdSkD23X`);
        
        console.log('\n🎯 QCI FIELD MAPPING:');
        console.log('=====================');
        const qciMapping = {
            'QCI_Score': 'QCI Score',
            'Agent_Talk_Ratio': 'Agent Talk Ratio',
            'Time_To_Value': 'Time to Value',
            'First_CTA_Time': 'First CTA time',
            'Dead_Air_Events': 'Dead Air Events',
            'Objections_Recognized': 'Objections Rec',
            'Compliance_Time': 'Compl time',
            'Brand_Mentions_Count': 'Brand Count',
            'Meeting_Scheduled': 'Meeting Sched',
            'Coaching_Tips': 'Coaching Tips'
        };
        
        Object.entries(qciMapping).forEach(([internal, airtable]) => {
            console.log(`${internal} → "${airtable}"`);
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

showMappedRecords();