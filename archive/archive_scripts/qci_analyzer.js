const AirtableClient = require('./api/airtable_client');
const DataUtils = require('./utils/data_utils');
const OpenAI = require('openai');
const fs = require('fs');

// QCI Field Mapping - точные названия из Airtable
const QCI_FIELD_MAPPING = {
    'QCI_Score': ['QCI Score'],
    'Agent_Talk_Ratio': ['Agent Talk Ratio'],
    'Time_To_Value': ['Time to Value'],
    'First_CTA_Time': ['First CTA time'],
    'Dead_Air_Events': ['Dead Air Events'],
    'Objections_Recognized': ['Objections Rec'],
    'Compliance_Time': ['Compl time'],
    'Alternative_Offered': ['Alter Offered'],
    'Brand_Mentions_Count': ['Brand Count'],
    'Language_Match': ['Lang Match'],
    'Meeting_Scheduled': ['Meeting Sched'],
    'Coaching_Tips': ['Coaching Tips'],
    'QCI_Evidence': ['QCI Evidence'],
    'Call_Classification': ['Call Class']
};

class QCIAnalyzer {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        this.airtable = new AirtableClient();
        this.fieldMapping = {};
    }

    // Определяет реальные поля через Meta API
    async detectFields() {
        try {
            // Используем Meta API для получения всех полей (включая пустые)
            const https = require('https');
            
            const metaData = await new Promise((resolve, reject) => {
                const options = {
                    hostname: 'api.airtable.com',
                    port: 443,
                    path: `/v0/meta/bases/${process.env.AIRTABLE_BASE_ID}/tables`,
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`,
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
                            reject(new Error(`Meta API failed: ${res.statusCode}`));
                        }
                    });
                });
                req.on('error', reject);
                req.end();
            });

            const targetTable = metaData.tables.find(table => table.id === process.env.AIRTABLE_TABLE_ID);
            if (!targetTable) throw new Error('Table not found in Meta API');

            const availableFields = targetTable.fields.map(field => field.name);
            
            // Мапим каждое QCI поле на реальное поле в Airtable
            for (const [qciField, variants] of Object.entries(QCI_FIELD_MAPPING)) {
                const found = variants.find(variant => availableFields.includes(variant));
                if (found) {
                    this.fieldMapping[qciField] = found;
                }
            }

            console.log(`Found ${Object.keys(this.fieldMapping).length}/14 QCI fields in Airtable`);
            return this.fieldMapping;
            
        } catch (error) {
            console.log('Meta API failed, falling back to Records API:', error.message);
            
            // Fallback к Records API
            const records = await this.airtable.getAllRecords(process.env.AIRTABLE_TABLE_ID, { maxRecords: 1 });
            if (!records.length) return {};

            const availableFields = Object.keys(records[0].fields);
            
            for (const [qciField, variants] of Object.entries(QCI_FIELD_MAPPING)) {
                const found = variants.find(variant => availableFields.includes(variant));
                if (found) {
                    this.fieldMapping[qciField] = found;
                }
            }

            console.log(`Found ${Object.keys(this.fieldMapping).length}/14 QCI fields (Records API fallback)`);
            return this.fieldMapping;
        }
    }

    // Получает звонки для анализа
    async getCallsForAnalysis(limit = null) {
        const records = await this.airtable.getAllRecords(process.env.AIRTABLE_TABLE_ID, {
            maxRecords: limit ? limit * 3 : null, // Получаем больше для фильтрации
            filterByFormula: "AND({Transcript} != '', LEN({Transcript}) > 200)" // Минимум 200 символов
        });

        const validCalls = records.map(record => ({
            id: record.id,
            callId: record.get('Call ID'),
            transcript: record.get('Transcript'),
            assistant: record.get('Assistant Name'),
            duration: record.get('Duration (seconds)'),
            status: record.get('Status')
        })).filter(call => call.transcript && call.transcript.length > 200); // Двойная фильтрация

        return limit ? validCalls.slice(0, limit) : validCalls;
    }

    // Этап 1: Структуризация транскрипта
    async structureTranscript(transcript) {
        const prompt = `Analyze this call transcript and return ONLY valid JSON:

TRANSCRIPT: ${transcript}

Return this JSON structure:
{
    "participants": {"agent": "agent name", "customer": "customer name"},
    "conversation_flow": [
        {"speaker": "agent|customer", "message": "text", "timestamp": "1"}
    ],
    "call_metadata": {
        "total_exchanges": "number",
        "agent_talk_ratio": "0.0-1.0",
        "call_outcome": "meeting_scheduled|callback_requested|rejection|no_answer|other",
        "objections_raised": ["list"],
        "call_length_estimate": "short|medium|long"
    },
    "key_moments": {
        "opening_line": "first agent phrase",
        "value_proposition": "main offer",
        "closing_attempt": "closing phrase",
        "objection_handling": ["list"]
    }
}`;

        const response = await this.openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
                { role: 'system', content: 'You are an expert call analyst. Return only valid JSON.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.1,
            max_tokens: 2000
        });

        const content = response.choices[0].message.content.trim();
        
        // Попытка извлечь JSON из ответа
        let jsonContent = content;
        if (content.includes('{')) {
            const startIndex = content.indexOf('{');
            const endIndex = content.lastIndexOf('}') + 1;
            jsonContent = content.substring(startIndex, endIndex);
        }
        
        try {
            return JSON.parse(jsonContent);
        } catch (error) {
            console.error('JSON Parse Error:', error.message);
            console.error('Content:', content.substring(0, 100));
            throw new Error('Invalid JSON from OpenAI');
        }
    }

    // Этап 2: QCI расчет
    async calculateQCI(structuredData, originalTranscript) {
        const prompt = `Calculate QCI score (0-100) for this call:

STRUCTURED DATA: ${JSON.stringify(structuredData, null, 2)}
ORIGINAL TRANSCRIPT: ${originalTranscript}

QCI RUBRIC:
A. DYNAMICS (30 pts):
- Agent talk ratio 35-55% → 0-8 pts
- Time-To-Value ≤20s → 0-8 pts
- First CTA ≤120s → 0-8 pts
- Dead air >3s → -2 per event (max -6)

B. OBJECTIONS & COMPLIANCE (20 pts):
- Recognized stop words → 0-6 pts
- Compliance time ≤10s → 0-8 pts
- Alternative offered → 0-6 pts

C. BRAND & LANGUAGE (20 pts):
- First brand mention ≤10s → 0-8 pts
- Brand consistency → 0-8 pts
- Language match ≤15s → 0-4 pts

D. OUTCOME & HYGIENE (30 pts):
- Outcome: meeting 15/warm 10/callback 6/info 4/none 0
- Wrap-up confirmation → 0-5 pts
- Tool hygiene → 0-10 pts

Return ONLY this JSON:
{
    "qci_score": 0-100,
    "agent_talk_ratio": 0.0-1.0,
    "time_to_value": seconds,
    "first_cta_time": seconds,
    "dead_air_events": count,
    "objections_recognized": true/false,
    "compliance_time": seconds,
    "alternative_offered": true/false,
    "brand_mentions_count": count,
    "language_match": true/false,
    "meeting_scheduled": true/false,
    "call_classification": "poor|average|good|excellent",
    "coaching_tips": ["tip1", "tip2", "tip3"],
    "evidence": {"successful_moments": [], "improvement_areas": []}
}`;

        const response = await this.openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
                { role: 'system', content: 'You are a strict QCI scorer. Return only valid JSON.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.1,
            max_tokens: 3000
        });

        const content = response.choices[0].message.content.trim();
        
        // Попытка извлечь JSON из ответа
        let jsonContent = content;
        if (content.includes('{')) {
            const startIndex = content.indexOf('{');
            const endIndex = content.lastIndexOf('}') + 1;
            jsonContent = content.substring(startIndex, endIndex);
        }
        
        try {
            return JSON.parse(jsonContent);
        } catch (error) {
            console.error('JSON Parse Error:', error.message);
            console.error('Content:', content.substring(0, 100));
            throw new Error('Invalid JSON from OpenAI');
        }
    }

    // Анализирует один звонок
    async analyzeCall(call) {
        try {
            console.log(`Analyzing call ${call.callId}...`);
            
            // Этап 1: Структуризация
            const structured = await this.structureTranscript(call.transcript);
            
            // Небольшая пауза между запросами
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Этап 2: QCI расчет
            const qci = await this.calculateQCI(structured, call.transcript);
            
            return {
                recordId: call.id,
                callId: call.callId,
                qci_data: qci,
                analysis_timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error(`Error analyzing call ${call.callId}:`, error.message);
            return { recordId: call.id, callId: call.callId, error: error.message };
        }
    }

    // Обновляет Airtable запись
    async updateCallRecord(analysis) {
        if (analysis.error) return false;

        const updates = {};
        const qci = analysis.qci_data;

        // Мапим результаты в поля Airtable
        Object.entries({
            'QCI_Score': qci.qci_score,
            'Agent_Talk_Ratio': qci.agent_talk_ratio,
            'Time_To_Value': qci.time_to_value,
            'First_CTA_Time': qci.first_cta_time,
            'Dead_Air_Events': qci.dead_air_events,
            'Objections_Recognized': qci.objections_recognized,
            'Compliance_Time': qci.compliance_time,
            'Alternative_Offered': qci.alternative_offered,
            'Brand_Mentions_Count': qci.brand_mentions_count,
            'Language_Match': qci.language_match,
            'Meeting_Scheduled': qci.meeting_scheduled,
            'Call_Classification': qci.call_classification,
            'Coaching_Tips': qci.coaching_tips.join('\\n'),
            'QCI_Evidence': JSON.stringify(qci.evidence)
        }).forEach(([qciField, value]) => {
            const airtableField = this.fieldMapping[qciField];
            if (airtableField && value !== undefined) {
                // Специальная обработка для чекбоксов - всегда устанавливаем значение
                if (typeof value === 'boolean') {
                    updates[airtableField] = value; // true или false
                } else {
                    updates[airtableField] = value;
                }
            }
        });

        try {
            await this.airtable.updateRecord(process.env.AIRTABLE_TABLE_ID, analysis.recordId, updates);
            console.log(`✅ Updated ${analysis.callId} - QCI: ${qci.qci_score}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to update ${analysis.callId}:`, error.message);
            return false;
        }
    }

    // Основная функция анализа
    async analyze(options = {}) {
        const { limit = 5, dryRun = false } = options;
        
        console.log('🚀 Starting QCI Analysis');
        console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE UPDATE'}`);
        
        // Определяем поля
        await this.detectFields();
        
        // Получаем звонки
        const calls = await this.getCallsForAnalysis(limit);
        console.log(`Found ${calls.length} calls to analyze`);
        
        if (calls.length === 0) {
            console.log('❌ No calls with transcripts found');
            return;
        }

        // Анализируем каждый звонок
        const results = [];
        let successful = 0;
        let failed = 0;

        for (let i = 0; i < calls.length; i++) {
            const call = calls[i];
            console.log(`[${i+1}/${calls.length}] Processing ${call.callId}`);
            
            const analysis = await this.analyzeCall(call);
            results.push(analysis);
            
            if (analysis.error) {
                failed++;
                continue;
            }

            // Обновляем Airtable если не dry run
            if (!dryRun) {
                const updated = await this.updateCallRecord(analysis);
                if (updated) successful++;
                else failed++;
            } else {
                console.log(`📊 ${call.callId} - QCI: ${analysis.qci_data.qci_score} (DRY RUN)`);
                successful++;
            }
        }

        // Результаты
        console.log('\\n📈 ANALYSIS COMPLETE');
        console.log(`✅ Successful: ${successful}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`📊 Total: ${calls.length}`);
        
        if (!dryRun && successful > 0) {
            const avgQCI = results
                .filter(r => !r.error)
                .reduce((sum, r) => sum + r.qci_data.qci_score, 0) / successful;
            console.log(`📊 Average QCI: ${avgQCI.toFixed(1)}`);
        }

        return results;
    }
}

// CLI Commands
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];
    
    const analyzer = new QCIAnalyzer();
    
    switch (command) {
        case 'test':
            analyzer.analyze({ limit: 5, dryRun: true })
                .then(() => process.exit(0))
                .catch(err => {
                    console.error('❌ Test failed:', err.message);
                    process.exit(1);
                });
            break;
            
        case 'analyze':
            const limit = args.includes('--all') ? null : 10;
            const dryRun = args.includes('--dry-run');
            
            analyzer.analyze({ limit, dryRun })
                .then(() => process.exit(0))
                .catch(err => {
                    console.error('❌ Analysis failed:', err.message);
                    process.exit(1);
                });
            break;
            
        default:
            console.log('🎯 QCI ANALYZER');
            console.log('Usage:');
            console.log('  node qci_analyzer.js test                  - Test on 5 calls');
            console.log('  node qci_analyzer.js analyze               - Analyze 10 calls');
            console.log('  node qci_analyzer.js analyze --all         - Analyze all calls');
            console.log('  node qci_analyzer.js analyze --dry-run     - Analyze without updating');
            process.exit(0);
    }
}

module.exports = QCIAnalyzer;