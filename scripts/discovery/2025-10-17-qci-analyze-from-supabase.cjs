const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const CONFIG = {
  BATCH_SIZE: 15,
  BATCH_DELAY: 1000,
  MIN_TRANSCRIPT_LENGTH: 100,
  OPENAI_MODEL: 'gpt-4o-mini',
  OPENAI_TEMP: 0.1,
  MAX_TOKENS: 2000,
  RETRY_ATTEMPTS: 2,
  RETRY_DELAY: 3000
};

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function loadPrompt(transcript) {
  const promptPath = path.join(__dirname, '../../production_scripts/qci_analysis/prompts.md');
  const content = fs.readFileSync(promptPath, 'utf8');
  const match = content.match(/##\s*QCI_ANALYSIS_PROMPT[\s\S]*?```\s*([\s\S]*?)\s*```/);
  if (!match) throw new Error('QCI_ANALYSIS_PROMPT not found');
  return match[1].trim().replace('{transcript}', transcript);
}

async function analyzeCall(call, retryCount = 0) {
  try {
    const prompt = loadPrompt(call.transcript);
    const response = await openai.chat.completions.create({
      model: CONFIG.OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: CONFIG.OPENAI_TEMP,
      max_tokens: CONFIG.MAX_TOKENS
    });

    let jsonContent = response.choices[0].message.content.trim();
    if (jsonContent.includes('```json')) {
      jsonContent = jsonContent.replace(/```json\s*/g, '').replace(/\s*```/g, '').trim();
    }

    const analysis = JSON.parse(jsonContent);
    const totalScore = analysis.qci_total_score || 0;

    const qciRecord = {
      call_id: call.id,
      total_score: totalScore,
      dynamics_score: analysis.dynamics_total || 0,
      objections_score: analysis.objections_total || 0,
      brand_score: analysis.brand_total || 0,
      outcome_score: analysis.outcome_total || 0,
      coaching_tips: analysis.coaching_tips || null,
      key_issues: analysis.key_issues || null,
      recommendations: analysis.recommendations || null,
      call_classification: totalScore >= 80 ? 'excellent' : totalScore >= 60 ? 'good' : 'needs_improvement',
      analysis_model: CONFIG.OPENAI_MODEL,
      analysis_cost: (response.usage.prompt_tokens / 1000000) * 0.15 + (response.usage.completion_tokens / 1000000) * 0.60
    };

    const { error } = await supabase.from('qci_analyses').upsert(qciRecord, { onConflict: 'call_id' });
    if (error) throw error;

    console.log(`✅ ${call.id.substring(0, 8)}: QCI ${totalScore}/100`);
    return { success: true, qci: totalScore, cost: qciRecord.analysis_cost };

  } catch (error) {
    if (retryCount < CONFIG.RETRY_ATTEMPTS) {
      console.log(`🔄 Retry ${retryCount + 1} for ${call.id.substring(0, 8)}...`);
      await new Promise(r => setTimeout(r, CONFIG.RETRY_DELAY * (retryCount + 1)));
      return analyzeCall(call, retryCount + 1);
    }
    console.log(`❌ Failed ${call.id.substring(0, 8)}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🚀 Starting QCI analysis from Supabase...\n');

  const { data: calls, error } = await supabase
    .from('vapi_calls_raw')
    .select('id, transcript')
    .not('transcript', 'is', null)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const validCalls = calls.filter(c => c.transcript && c.transcript.length >= CONFIG.MIN_TRANSCRIPT_LENGTH);
  console.log(`📊 Found ${validCalls.length} calls with transcripts (min ${CONFIG.MIN_TRANSCRIPT_LENGTH} chars)\n`);

  let processed = 0, failed = 0, totalCost = 0;
  const startTime = Date.now();

  for (let i = 0; i < validCalls.length; i += CONFIG.BATCH_SIZE) {
    const batch = validCalls.slice(i, Math.min(i + CONFIG.BATCH_SIZE, validCalls.length));
    const results = await Promise.all(batch.map(call => analyzeCall(call)));

    processed += results.filter(r => r.success).length;
    failed += results.filter(r => !r.success).length;
    totalCost += results.filter(r => r.success).reduce((sum, r) => sum + (r.cost || 0), 0);

    console.log(`📊 Progress: ${Math.min(i + CONFIG.BATCH_SIZE, validCalls.length)}/${validCalls.length}\n`);

    if (i + CONFIG.BATCH_SIZE < validCalls.length) {
      await new Promise(r => setTimeout(r, CONFIG.BATCH_DELAY));
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n🎉 ANALYSIS COMPLETE`);
  console.log(`✅ Processed: ${processed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`💰 Total cost: $${totalCost.toFixed(4)}`);
  console.log(`⏱️  Time: ${duration}s`);
}

main().catch(console.error);
