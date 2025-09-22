const AirtableClient = require('./api/airtable_client');
const DataUtils = require('./utils/data_utils');
const OpenAI = require('openai');
const fs = require('fs');
require('dotenv').config();

// QCI Field Mapping
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

class BatchQCIAnalyzer {
    constructor() {
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        this.airtable = new AirtableClient();
        this.fieldMapping = {};
        this.batchSize = 10; // Process 10 calls in parallel
    }

    async detectFields() {
        try {
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
            if (!targetTable) throw new Error('Table not found');

            const availableFields = targetTable.fields.map(field => field.name);

            for (const [qciField, variants] of Object.entries(QCI_FIELD_MAPPING)) {
                const found = variants.find(variant => availableFields.includes(variant));
                if (found) this.fieldMapping[qciField] = found;
            }

            console.log(`Found ${Object.keys(this.fieldMapping).length}/14 QCI fields`);
            return this.fieldMapping;
        } catch (error) {
            console.error('Field detection error:', error.message);
            return {};
        }
    }

    async analyzeCall(call) {
        try {
            const systemPrompt = `You are a call quality analyst. Analyze call transcripts and provide QCI scoring.
Return JSON with these exact fields:
- qci_score: 0-100
- agent_talk_ratio: 0-1
- time_to_value: seconds
- first_cta_time: seconds
- dead_air_events: count
- objections_recognized: boolean
- compliance_time: seconds
- alternative_offered: boolean
- brand_mentions_count: count
- language_match: boolean
- meeting_scheduled: boolean
- call_classification: "poor"/"average"/"good"/"excellent"
- coaching_tips: array of 3 tips
- evidence: object with quotes`;

            const response = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Analyze:\n${call.fields['Transcript']}` }
                ],
                temperature: 0.3,
                response_format: { type: "json_object" }
            });

            return JSON.parse(response.choices[0].message.content);
        } catch (error) {
            console.error(`Analysis error for ${call.fields['Call ID']}:`, error.message);
            return null;
        }
    }

    async processBatch(calls) {
        const results = await Promise.all(
            calls.map(async (call) => {
                const analysis = await this.analyzeCall(call);
                if (analysis) {
                    await this.updateRecord(call.id, analysis);
                    return { id: call.fields['Call ID'], success: true, score: analysis.qci_score };
                }
                return { id: call.fields['Call ID'], success: false };
            })
        );
        return results;
    }

    async updateRecord(recordId, analysis) {
        const updates = {};

        if (this.fieldMapping.QCI_Score) updates[this.fieldMapping.QCI_Score] = analysis.qci_score;
        if (this.fieldMapping.Agent_Talk_Ratio) updates[this.fieldMapping.Agent_Talk_Ratio] = analysis.agent_talk_ratio;
        if (this.fieldMapping.Time_To_Value) updates[this.fieldMapping.Time_To_Value] = analysis.time_to_value;
        if (this.fieldMapping.First_CTA_Time) updates[this.fieldMapping.First_CTA_Time] = analysis.first_cta_time;
        if (this.fieldMapping.Dead_Air_Events) updates[this.fieldMapping.Dead_Air_Events] = analysis.dead_air_events;
        if (this.fieldMapping.Objections_Recognized) updates[this.fieldMapping.Objections_Recognized] = analysis.objections_recognized;
        if (this.fieldMapping.Compliance_Time) updates[this.fieldMapping.Compliance_Time] = analysis.compliance_time;
        if (this.fieldMapping.Alternative_Offered) updates[this.fieldMapping.Alternative_Offered] = analysis.alternative_offered;
        if (this.fieldMapping.Brand_Mentions_Count) updates[this.fieldMapping.Brand_Mentions_Count] = analysis.brand_mentions_count;
        if (this.fieldMapping.Language_Match) updates[this.fieldMapping.Language_Match] = analysis.language_match;
        if (this.fieldMapping.Meeting_Scheduled) updates[this.fieldMapping.Meeting_Scheduled] = analysis.meeting_scheduled;
        if (this.fieldMapping.Call_Classification) updates[this.fieldMapping.Call_Classification] = analysis.call_classification;

        if (this.fieldMapping.Coaching_Tips && analysis.coaching_tips) {
            updates[this.fieldMapping.Coaching_Tips] = analysis.coaching_tips.join('\n');
        }

        await this.airtable.updateRecord(process.env.AIRTABLE_TABLE_ID, recordId, updates);
    }

    async run() {
        console.log('🚀 BATCH QCI ANALYZER - HIGH SPEED MODE');
        console.log('Processing', this.batchSize, 'calls in parallel...\n');

        await this.detectFields();

        const records = await this.airtable.getAllRecords(process.env.AIRTABLE_TABLE_ID);
        const toAnalyze = records.filter(r =>
            r.fields['Transcript'] &&
            r.fields['Transcript'].length > 200 &&
            !r.fields['QCI Score']
        );

        console.log(`Found ${toAnalyze.length} calls to analyze\n`);

        let processed = 0;
        let successful = 0;
        const startTime = Date.now();

        // Process in batches
        for (let i = 0; i < toAnalyze.length; i += this.batchSize) {
            const batch = toAnalyze.slice(i, i + this.batchSize);
            console.log(`Processing batch ${Math.floor(i/this.batchSize) + 1}/${Math.ceil(toAnalyze.length/this.batchSize)}...`);

            const results = await this.processBatch(batch);

            processed += results.length;
            successful += results.filter(r => r.success).length;

            const elapsed = (Date.now() - startTime) / 1000;
            const rate = processed / elapsed;
            const remaining = (toAnalyze.length - processed) / rate;

            console.log(`✅ Processed: ${processed}/${toAnalyze.length}`);
            console.log(`⚡ Rate: ${rate.toFixed(1)} calls/sec`);
            console.log(`⏱️ ETA: ${Math.ceil(remaining / 60)} minutes\n`);
        }

        console.log('🎉 ANALYSIS COMPLETE!');
        console.log(`Total processed: ${processed}`);
        console.log(`Successful: ${successful}`);
        console.log(`Failed: ${processed - successful}`);
        console.log(`Time taken: ${Math.round((Date.now() - startTime) / 60000)} minutes`);
    }
}

// Run if called directly
if (require.main === module) {
    const analyzer = new BatchQCIAnalyzer();
    analyzer.run().catch(console.error);
}

module.exports = BatchQCIAnalyzer;