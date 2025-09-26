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

class EnhancedQCIAnalyzer {
    constructor() {
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        this.airtable = new AirtableClient();
        this.fieldMapping = {};
        this.batchSize = 8; // Reduced for more detailed analysis
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

    buildEnhancedPrompt(call) {
        const callData = call.fields;

        // Extract metadata
        const duration = callData['Duration (seconds)'] || 0;
        const messagesCount = callData['Messages Count'] || 0;
        const assistantName = callData['Assistant Name'] || 'Unknown';
        const endReason = callData['End Reason'] || 'unknown';
        const status = callData['Status'] || 'unknown';
        const cost = callData['Cost'] || 0;

        return `CALL QUALITY ANALYSIS - Enhanced with Metadata

CALL METADATA:
- Assistant: ${assistantName}
- Duration: ${duration} seconds (${Math.floor(duration/60)}:${(duration%60).toString().padStart(2,'0')})
- Messages exchanged: ${messagesCount}
- End reason: ${endReason}
- Status: ${status}
- Cost: $${cost}

TRANSCRIPT TO ANALYZE:
${callData['Transcript']}

ANALYSIS INSTRUCTIONS:
You are a call quality analyst with access to both transcript and technical metadata.
Use this information to provide precise QCI scoring.

Calculate these metrics using BOTH transcript content AND metadata:

1. AGENT_TALK_RATIO (0-1): Estimate from transcript length and message distribution
2. TIME_TO_VALUE (seconds): Analyze transcript to find when value proposition was delivered
3. FIRST_CTA_TIME (seconds): Find first call-to-action in transcript timeline
4. DEAD_AIR_EVENTS (count): Look for pauses/gaps indicated in transcript
5. OBJECTIONS_RECOGNIZED (boolean): Did agent acknowledge customer concerns?
6. COMPLIANCE_TIME (seconds): How quickly agent responded to customer requests
7. ALTERNATIVE_OFFERED (boolean): Did agent provide options when needed?
8. BRAND_MENTIONS_COUNT (count): Count explicit brand/company name mentions
9. LANGUAGE_MATCH (boolean): Does agent language match customer language?
10. MEETING_SCHEDULED (boolean): Was a follow-up meeting/appointment scheduled?
11. CALL_CLASSIFICATION: Based on end_reason and transcript quality:
    - "excellent" if status=completed, good engagement, meeting scheduled
    - "good" if status=completed, decent engagement
    - "average" if some issues but productive conversation
    - "poor" if ended-by-customer, no-answer, or very short/unproductive

Return JSON with exact fields:
{
    "qci_score": 0-100,
    "agent_talk_ratio": 0-1,
    "time_to_value": seconds,
    "first_cta_time": seconds,
    "dead_air_events": count,
    "objections_recognized": boolean,
    "compliance_time": seconds,
    "alternative_offered": boolean,
    "brand_mentions_count": count,
    "language_match": boolean,
    "meeting_scheduled": boolean,
    "call_classification": "poor"/"average"/"good"/"excellent",
    "coaching_tips": ["tip1", "tip2", "tip3"],
    "evidence": {
        "successful_moments": ["quote1", "quote2"],
        "areas_for_improvement": ["issue1", "issue2"],
        "metadata_insights": ["duration_analysis", "message_pattern_analysis"]
    }
}`;
    }

    async analyzeCall(call) {
        try {
            const enhancedPrompt = this.buildEnhancedPrompt(call);

            const response = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'user', content: enhancedPrompt }
                ],
                temperature: 0.2, // Lower for more consistent results
                response_format: { type: "json_object" }
            });

            const result = JSON.parse(response.choices[0].message.content);

            // Validate required fields
            const requiredFields = ['qci_score', 'call_classification', 'coaching_tips'];
            for (const field of requiredFields) {
                if (!(field in result)) {
                    throw new Error(`Missing required field: ${field}`);
                }
            }

            return result;
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
                    return {
                        id: call.fields['Call ID'],
                        success: true,
                        score: analysis.qci_score,
                        classification: analysis.call_classification
                    };
                }
                return { id: call.fields['Call ID'], success: false };
            })
        );
        return results;
    }

    async updateRecord(recordId, analysis) {
        const updates = {};

        // Map all QCI fields
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

        if (this.fieldMapping.QCI_Evidence && analysis.evidence) {
            updates[this.fieldMapping.QCI_Evidence] = JSON.stringify(analysis.evidence, null, 2);
        }

        await this.airtable.updateRecord(process.env.AIRTABLE_TABLE_ID, recordId, updates);
    }

    async run() {
        console.log('🚀 ENHANCED QCI ANALYZER - Metadata + Transcript Analysis');
        console.log('Processing', this.batchSize, 'calls in parallel with enhanced prompts...\n');

        await this.detectFields();

        const records = await this.airtable.getAllRecords(process.env.AIRTABLE_TABLE_ID);

        // Find calls that need re-analysis with enhanced data
        const toReanalyze = records.filter(r =>
            r.fields['Transcript'] &&
            r.fields['Transcript'].length > 200 &&
            r.fields['QCI Score'] // Has old analysis that needs enhancement
        ).slice(0, 50); // Test on first 50 calls

        console.log(`Found ${toReanalyze.length} calls to re-analyze with enhanced metadata\n`);

        if (toReanalyze.length === 0) {
            console.log('No calls need re-analysis');
            return;
        }

        let processed = 0;
        let successful = 0;
        const startTime = Date.now();
        const scores = [];
        const classifications = { poor: 0, average: 0, good: 0, excellent: 0 };

        // Process in batches
        for (let i = 0; i < toReanalyze.length; i += this.batchSize) {
            const batch = toReanalyze.slice(i, i + this.batchSize);
            console.log(`Processing enhanced batch ${Math.floor(i/this.batchSize) + 1}/${Math.ceil(toReanalyze.length/this.batchSize)}...`);

            const results = await this.processBatch(batch);

            processed += results.length;
            successful += results.filter(r => r.success).length;

            // Collect statistics
            results.forEach(r => {
                if (r.success) {
                    scores.push(r.score);
                    classifications[r.classification] = (classifications[r.classification] || 0) + 1;
                }
            });

            const elapsed = (Date.now() - startTime) / 1000;
            const rate = processed / elapsed;
            const remaining = (toReanalyze.length - processed) / rate;

            console.log(`✅ Enhanced processed: ${processed}/${toReanalyze.length}`);
            console.log(`⚡ Rate: ${rate.toFixed(1)} calls/sec`);
            console.log(`⏱️ ETA: ${Math.ceil(remaining / 60)} minutes`);

            if (scores.length > 0) {
                const avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
                console.log(`📊 Average QCI Score: ${avgScore}`);
                console.log(`📈 Classifications: Poor:${classifications.poor} Avg:${classifications.average} Good:${classifications.good} Exc:${classifications.excellent}\n`);
            }
        }

        console.log('🎉 ENHANCED ANALYSIS COMPLETE!');
        console.log(`Total processed: ${processed}`);
        console.log(`Successful: ${successful}`);
        console.log(`Failed: ${processed - successful}`);
        console.log(`Time taken: ${Math.round((Date.now() - startTime) / 60000)} minutes`);

        if (scores.length > 0) {
            console.log(`\nFINAL STATISTICS:`);
            console.log(`Average QCI Score: ${(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)}`);
            console.log(`Score distribution: ${JSON.stringify(classifications)}`);
        }
    }
}

// Run if called directly
if (require.main === module) {
    const analyzer = new EnhancedQCIAnalyzer();
    analyzer.run().catch(console.error);
}

module.exports = EnhancedQCIAnalyzer;