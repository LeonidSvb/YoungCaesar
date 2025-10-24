require('dotenv').config({ path: '../../.env' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyMigration() {
    console.log('Applying migration: Update calls VIEW with QCI analytics');
    console.log('');

    const migrationPath = path.join(__dirname, '../../migrations/2025-10-24-update-calls-view-with-qci.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    const { data, error } = await supabase.rpc('exec', { sql });

    if (error) {
        console.error('Migration failed:', error);
        console.log('');
        console.log('Running migration directly...');

        const viewSql = `CREATE OR REPLACE VIEW calls AS
SELECT
    v.id,
    v.assistant_id,
    v.status,
    v.started_at,
    v.ended_at,
    v.created_at,
    v.duration_seconds,
    v.transcript,
    v.cost,
    v.customer_number,
    v.recording_url,
    q.total_score AS qci_score,
    q.dynamics_score AS qci_dynamics,
    q.objections_score AS qci_objections,
    q.brand_score AS qci_brand,
    q.outcome_score AS qci_outcome,
    q.call_classification AS qci_classification,
    q.coaching_tips,
    q.key_issues AS qci_evidence,
    q.analyzed_at AS qci_analyzed_at
FROM vapi_calls_raw v
LEFT JOIN qci_analyses q
    ON v.id = q.call_id
    AND q.framework_id = (SELECT id FROM analysis_frameworks WHERE name = 'QCI Standard' AND is_active = true LIMIT 1);`;

        // Try direct query
        const { error: viewError } = await supabase.rpc('exec', { sql: viewSql });

        if (viewError) {
            console.error('Direct migration also failed:', viewError);
            console.log('');
            console.log('Please apply migration manually in Supabase SQL Editor:');
            console.log(migrationPath);
            return;
        }
    }

    console.log('✅ Migration applied successfully!');
    console.log('');
    console.log('Testing VIEW...');

    const { data: testData, error: testError } = await supabase
        .from('calls')
        .select('id, qci_score, qci_classification')
        .not('qci_score', 'is', null)
        .limit(5);

    if (testError) {
        console.error('Failed to query VIEW:', testError);
        return;
    }

    console.log(`Found ${testData.length} calls with QCI scores:`);
    testData.forEach((call, idx) => {
        console.log(`  ${idx + 1}. ${call.id.substring(0, 8)} - QCI: ${call.qci_score} (${call.qci_classification})`);
    });
}

applyMigration();
