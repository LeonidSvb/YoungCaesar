const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const QCI_FRAMEWORK_ID = 1; // QCI Standard v1.0
const BATCH_SIZE = 50;

async function loadQciResults() {
  console.log('📂 Loading existing QCI results from JSON...\n');

  const jsonPath = path.join(__dirname, '../../production_scripts/qci_analysis/results/qci_full_calls_with_assistants_latest.json');
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  console.log(`📊 Found ${data.results.length} QCI analyses in JSON\n`);

  let inserted = 0, skipped = 0, failed = 0;

  for (let i = 0; i < data.results.length; i += BATCH_SIZE) {
    const batch = data.results.slice(i, Math.min(i + BATCH_SIZE, data.results.length));

    const records = batch.map(result => ({
      call_id: result.call_id,
      framework_id: QCI_FRAMEWORK_ID,
      total_score: result.qci_total || 0,
      dynamics_score: result.dynamics || 0,
      objections_score: result.objections || 0,
      brand_score: result.brand || 0,
      outcome_score: result.outcome || 0,
      coaching_tips: result.ai_analysis?.coaching_tips || null,
      key_issues: result.ai_analysis?.evidence?.key_moments || null,
      recommendations: null,
      call_classification: result.status === 'pass' ? 'excellent' : result.status === 'review' ? 'good' : 'needs_improvement',
      analysis_model: 'gpt-4o-mini',
      analysis_cost: result.cost || 0,
      analyzed_at: result.timestamp || new Date().toISOString()
    }));

    try {
      const { data: insertedData, error } = await supabase
        .from('qci_analyses')
        .upsert(records, {
          onConflict: 'call_id,framework_id',
          ignoreDuplicates: false
        });

      if (error) {
        console.log(`❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${error.message}`);
        failed += batch.length;
      } else {
        inserted += batch.length;
        console.log(`✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} records`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      failed += batch.length;
    }

    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n🎉 IMPORT COMPLETE`);
  console.log(`✅ Inserted: ${inserted}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`❌ Failed: ${failed}`);
}

loadQciResults().catch(console.error);
