require('dotenv').config({ path: '../../.env' });
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const TEST_CONFIGURATIONS = {
    temperatures: [0.0, 0.2, 0.5, 0.7, 1.0],
    max_tokens: [2000, 3000, 5000, 8000, 10000]
};

const QCI_PROMPT_TEMPLATE = `Analyze this VAPI call transcript for Quality Call Index (QCI) scoring.

Transcript: "{transcript}"

CRITICAL: Respond ONLY with valid JSON. NO explanations, NO markdown formatting, NO \`\`\`json blocks.

Required JSON structure:
{
  "qci_total_score": <number 0-100>,
  "scores": {
    "dynamics": <number 0-30>,
    "objections": <number 0-20>,
    "brand": <number 0-20>,
    "outcome": <number 0-30>
  },
  "evidence": {
    "brand_mentions": [<array of actual quotes mentioning "Young Caesar">],
    "outcomes": [<array of specific outcome statements>],
    "key_moments": [<array of 2-5 important conversation points>],
    "agent_talk_ratio": "<percentage as string>"
  },
  "coaching_tips": [<array of 2-3 specific actionable tips>]
}

SCORING CRITERIA:
1. DYNAMICS (0-30pts): Conversation flow, engagement, agent talk ratio
2. OBJECTIONS (0-20pts): Recognition and handling of customer concerns
3. BRAND (0-20pts): "Young Caesar" mentioned = 15-20pts, not mentioned = 0pts
4. OUTCOME (0-30pts): Meeting scheduled = 30pts, warm lead = 20pts, callback = 15pts, info exchange = 10pts, no result = 0-5pts

EVIDENCE REQUIREMENTS:
- brand_mentions: Include EXACT quotes where "Young Caesar" is mentioned
- outcomes: Include what was achieved (meeting time, callback agreement, etc)
- key_moments: Include 2-5 significant conversation excerpts
- agent_talk_ratio: Calculate percentage of conversation spoken by agent

IMPORTANT:
- If brand not mentioned, brand_mentions = [] and brand score = 0
- outcomes array should ALWAYS have at least 1 item (even "No concrete outcome")
- key_moments should ALWAYS have 2-5 items from the conversation`;

async function fetchLongestCalls(limit = 10) {
    console.log(`Fetching ${limit} longest calls...`);

    const { data: calls, error } = await supabase
        .from('vapi_calls_raw')
        .select('*')
        .not('transcript', 'is', null)
        .order('transcript', { ascending: false })
        .limit(limit * 2);

    if (error) throw error;

    const sorted = calls
        .filter(call => call.transcript && call.transcript.length >= 100)
        .sort((a, b) => b.transcript.length - a.transcript.length)
        .slice(0, limit);

    console.log(`Found ${sorted.length} longest calls (minimum 100 chars)`);
    sorted.forEach((call, i) => {
        console.log(`  ${i + 1}. Call ${call.id.substring(0, 8)} - ${call.transcript.length} chars - ${new Date(call.created_at).toISOString().substring(0, 10)}`);
    });

    return sorted;
}

async function analyzeWithConfig(call, temperature, maxTokens) {
    const prompt = QCI_PROMPT_TEMPLATE.replace('{transcript}', call.transcript);

    const startTime = Date.now();

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: temperature,
            max_tokens: maxTokens
        });

        const responseTime = Date.now() - startTime;

        let jsonContent = response.choices[0].message.content.trim();
        if (jsonContent.includes('```json')) {
            jsonContent = jsonContent.replace(/```json\s*/g, '').replace(/\s*```/g, '').trim();
        }

        const analysis = JSON.parse(jsonContent);

        const inputCost = (response.usage.prompt_tokens / 1000000) * 0.15;
        const outputCost = (response.usage.completion_tokens / 1000000) * 0.60;
        const totalCost = inputCost + outputCost;

        const quality = calculateQualityMetrics(analysis);

        return {
            success: true,
            analysis,
            quality,
            cost: totalCost,
            responseTime,
            tokens: response.usage,
            call_data: {
                id: call.id,
                assistant_id: call.assistant_id,
                customer_id: call.customer_id,
                created_at: call.created_at,
                ended_at: call.ended_at,
                duration_seconds: call.duration_seconds,
                transcript: call.transcript,
                transcript_length: call.transcript.length,
                metadata: {
                    phone_number: call.phone_number,
                    type: call.type,
                    status: call.status
                }
            }
        };

    } catch (error) {
        return {
            success: false,
            error: error.message,
            cost: 0,
            responseTime: Date.now() - startTime
        };
    }
}

function calculateQualityMetrics(analysis) {
    const metrics = {
        evidence_completeness: 0,
        brand_mentions_count: 0,
        outcomes_count: 0,
        key_moments_count: 0,
        evidence_total_length: 0,
        consistency_score: 100,
        has_all_required_fields: true
    };

    if (!analysis.evidence) {
        metrics.has_all_required_fields = false;
        return metrics;
    }

    const ev = analysis.evidence;

    metrics.brand_mentions_count = (ev.brand_mentions || []).length;
    metrics.outcomes_count = (ev.outcomes || []).length;
    metrics.key_moments_count = (ev.key_moments || []).length;

    const brandText = (ev.brand_mentions || []).join(' ');
    const outcomesText = (ev.outcomes || []).join(' ');
    const momentsText = (ev.key_moments || []).join(' ');

    metrics.evidence_total_length = brandText.length + outcomesText.length + momentsText.length;

    let fieldsComplete = 0;
    if (ev.brand_mentions && ev.brand_mentions.length >= 0) fieldsComplete++;
    if (ev.outcomes && ev.outcomes.length > 0) fieldsComplete++;
    if (ev.key_moments && ev.key_moments.length >= 2) fieldsComplete++;
    if (ev.agent_talk_ratio) fieldsComplete++;

    metrics.evidence_completeness = (fieldsComplete / 4) * 100;

    if (analysis.scores) {
        const brandScore = analysis.scores.brand || 0;
        const outcomeScore = analysis.scores.outcome || 0;

        if (brandScore > 0 && metrics.brand_mentions_count === 0) {
            metrics.consistency_score -= 30;
        }
        if (outcomeScore > 0 && metrics.outcomes_count === 0) {
            metrics.consistency_score -= 30;
        }
    }

    return metrics;
}

async function runABTest() {
    console.log('='.repeat(80));
    console.log('QCI A/B TESTING - Configuration Optimization');
    console.log('='.repeat(80));
    console.log();

    const calls = await fetchLongestCalls(10);

    if (calls.length === 0) {
        console.log('No calls found for testing');
        return;
    }

    console.log();
    console.log('Test matrix:');
    console.log(`  Temperatures: ${TEST_CONFIGURATIONS.temperatures.join(', ')}`);
    console.log(`  Max tokens: ${TEST_CONFIGURATIONS.max_tokens.join(', ')}`);
    console.log(`  Total configurations: ${TEST_CONFIGURATIONS.temperatures.length * TEST_CONFIGURATIONS.max_tokens.length}`);
    console.log(`  Test calls: ${calls.length}`);
    console.log(`  Total API calls: ${TEST_CONFIGURATIONS.temperatures.length * TEST_CONFIGURATIONS.max_tokens.length * calls.length}`);
    console.log();

    const results = [];
    let totalTests = 0;
    const totalConfigs = TEST_CONFIGURATIONS.temperatures.length * TEST_CONFIGURATIONS.max_tokens.length;

    for (const temperature of TEST_CONFIGURATIONS.temperatures) {
        for (const maxTokens of TEST_CONFIGURATIONS.max_tokens) {
            totalTests++;
            const configName = `temp_${temperature}_tokens_${maxTokens}`;

            console.log(`[${totalTests}/${totalConfigs}] Testing: temperature=${temperature}, max_tokens=${maxTokens}`);

            // Process calls in parallel batches of 5
            const batchSize = 5;
            const configResults = [];

            for (let i = 0; i < calls.length; i += batchSize) {
                const batch = calls.slice(i, i + batchSize);
                console.log(`  Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(calls.length / batchSize)} (${batch.length} calls)...`);

                const batchPromises = batch.map(call =>
                    analyzeWithConfig(call, temperature, maxTokens)
                );

                const batchResults = await Promise.all(batchPromises);

                batchResults.forEach((result, idx) => {
                    if (result.success) {
                        const callId = result.call_data.id.substring(0, 8);
                        console.log(`    Call ${i + idx + 1} (${callId}): OK (${result.responseTime}ms, $${result.cost.toFixed(4)})`);
                    } else {
                        console.log(`    Call ${i + idx + 1}: FAILED (${result.error})`);
                    }
                });

                configResults.push(...batchResults);

                // Small delay between batches
                if (i + batchSize < calls.length) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            const summary = calculateConfigSummary(configName, temperature, maxTokens, configResults);
            results.push(summary);

            console.log(`  Summary: Quality=${summary.avg_quality.toFixed(1)}%, Cost=$${summary.total_cost.toFixed(4)}, Success=${summary.success_rate.toFixed(1)}%`);
            console.log();
        }
    }

    saveResults(results);
    displayComparison(results);
}

function calculateConfigSummary(configName, temperature, maxTokens, configResults) {
    const successful = configResults.filter(r => r.success);

    const summary = {
        config_name: configName,
        temperature,
        max_tokens: maxTokens,
        total_tests: configResults.length,
        successful_tests: successful.length,
        failed_tests: configResults.filter(r => !r.success).length,
        success_rate: (successful.length / configResults.length) * 100,

        total_cost: successful.reduce((sum, r) => sum + r.cost, 0),
        avg_cost: successful.length > 0 ? successful.reduce((sum, r) => sum + r.cost, 0) / successful.length : 0,

        avg_response_time: successful.length > 0 ? successful.reduce((sum, r) => sum + r.responseTime, 0) / successful.length : 0,

        avg_quality: 0,
        avg_evidence_completeness: 0,
        avg_brand_mentions: 0,
        avg_outcomes: 0,
        avg_key_moments: 0,
        avg_evidence_length: 0,
        avg_consistency: 0,

        results: configResults
    };

    if (successful.length > 0) {
        summary.avg_evidence_completeness = successful.reduce((sum, r) => sum + r.quality.evidence_completeness, 0) / successful.length;
        summary.avg_brand_mentions = successful.reduce((sum, r) => sum + r.quality.brand_mentions_count, 0) / successful.length;
        summary.avg_outcomes = successful.reduce((sum, r) => sum + r.quality.outcomes_count, 0) / successful.length;
        summary.avg_key_moments = successful.reduce((sum, r) => sum + r.quality.key_moments_count, 0) / successful.length;
        summary.avg_evidence_length = successful.reduce((sum, r) => sum + r.quality.evidence_total_length, 0) / successful.length;
        summary.avg_consistency = successful.reduce((sum, r) => sum + r.quality.consistency_score, 0) / successful.length;

        summary.avg_quality = (
            summary.avg_evidence_completeness * 0.3 +
            summary.avg_consistency * 0.3 +
            (summary.avg_evidence_length / 500) * 0.2 +
            (summary.avg_key_moments / 3) * 100 * 0.2
        );
    }

    return summary;
}

function saveResults(results) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const filename = `qci_ab_test_results_${timestamp}.json`;
    const filepath = path.join(__dirname, filename);

    fs.writeFileSync(filepath, JSON.stringify({ timestamp, results }, null, 2));
    console.log(`Results saved to: ${filename}`);
}

function displayComparison(results) {
    console.log();
    console.log('='.repeat(80));
    console.log('COMPARISON TABLE');
    console.log('='.repeat(80));
    console.log();

    const sorted = [...results].sort((a, b) => b.avg_quality - a.avg_quality);

    console.log('Temp | MaxTok | Quality | Evidence | Consistency | Cost    | Success');
    console.log('-'.repeat(80));

    sorted.forEach((r, i) => {
        const rank = i === 0 ? 'BEST' : (i === sorted.length - 1 ? 'WORST' : `#${i + 1}`);
        console.log(
            `${r.temperature.toFixed(1).padStart(4)} | ` +
            `${String(r.max_tokens).padStart(6)} | ` +
            `${r.avg_quality.toFixed(1).padStart(7)}% | ` +
            `${r.avg_evidence_completeness.toFixed(1).padStart(8)}% | ` +
            `${r.avg_consistency.toFixed(1).padStart(11)}% | ` +
            `$${r.avg_cost.toFixed(4)} | ` +
            `${r.success_rate.toFixed(0)}% ${rank}`
        );
    });

    console.log();
    console.log('='.repeat(80));
    console.log('RECOMMENDATION');
    console.log('='.repeat(80));

    const best = sorted[0];
    console.log();
    console.log(`Best configuration:`);
    console.log(`  Temperature: ${best.temperature}`);
    console.log(`  Max tokens: ${best.max_tokens}`);
    console.log(`  Quality score: ${best.avg_quality.toFixed(1)}%`);
    console.log(`  Evidence completeness: ${best.avg_evidence_completeness.toFixed(1)}%`);
    console.log(`  Consistency: ${best.avg_consistency.toFixed(1)}%`);
    console.log(`  Average cost per call: $${best.avg_cost.toFixed(4)}`);
    console.log(`  Success rate: ${best.success_rate.toFixed(1)}%`);
    console.log();

    console.log(`Detailed evidence metrics:`);
    console.log(`  Avg brand mentions: ${best.avg_brand_mentions.toFixed(1)}`);
    console.log(`  Avg outcomes: ${best.avg_outcomes.toFixed(1)}`);
    console.log(`  Avg key moments: ${best.avg_key_moments.toFixed(1)}`);
    console.log(`  Avg evidence length: ${Math.round(best.avg_evidence_length)} chars`);
    console.log();
}

runABTest()
    .then(() => {
        console.log('A/B testing completed');
        process.exit(0);
    })
    .catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });
