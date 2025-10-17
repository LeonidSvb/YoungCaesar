const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

async function createConversionMetricsView() {
  console.log('Creating conversion metrics view...\n');

  const viewSQL = `
    CREATE OR REPLACE VIEW call_conversion_metrics AS
    SELECT
      id,
      assistant_id,
      customer_id,
      status,
      created_at,
      started_at,
      ended_at,
      duration_seconds,
      transcript,
      cost,
      customer_phone_number,
      vapi_success_evaluation,

      CASE
        WHEN vapi_success_evaluation ILIKE '%Meeting Outcome: Booked%' THEN 'booked'
        WHEN vapi_success_evaluation ILIKE '%Meeting Outcome: Not Booked%' THEN 'not_booked'
        WHEN vapi_success_evaluation ILIKE '%Meeting Outcome:%' THEN 'other'
        ELSE NULL
      END as meeting_outcome,

      CASE
        WHEN vapi_success_evaluation ILIKE '%Next Step: Requested Callback%' THEN 'callback'
        WHEN vapi_success_evaluation ILIKE '%Next Step: Requested Email%' THEN 'email'
        WHEN vapi_success_evaluation ILIKE '%Next Step: None%' THEN 'none'
        WHEN vapi_success_evaluation ILIKE '%Next Step:%' THEN 'other'
        ELSE NULL
      END as next_step,

      CASE
        WHEN vapi_success_evaluation ILIKE '%Interest Level: High%' THEN 'high'
        WHEN vapi_success_evaluation ILIKE '%Interest Level: Medium%' THEN 'medium'
        WHEN vapi_success_evaluation ILIKE '%Interest Level: Low%' THEN 'low'
        WHEN vapi_success_evaluation ILIKE '%Interest Level: None%' THEN 'none'
        WHEN vapi_success_evaluation ILIKE '%Interest Level:%' THEN 'other'
        ELSE NULL
      END as interest_level,

      CASE
        WHEN vapi_success_evaluation ILIKE '%DNC: Yes%' THEN true
        WHEN vapi_success_evaluation ILIKE '%DNC: No%' THEN false
        ELSE NULL
      END as dnc_status,

      CASE
        WHEN vapi_success_evaluation ILIKE '%Referral: Yes%' THEN true
        WHEN vapi_success_evaluation ILIKE '%Referral: None%' THEN false
        WHEN vapi_success_evaluation ILIKE '%Referral: No%' THEN false
        ELSE NULL
      END as referral_provided,

      (vapi_success_evaluation IS NOT NULL AND vapi_success_evaluation != '') as has_evaluation

    FROM vapi_calls_raw
    WHERE transcript IS NOT NULL;
  `;

  const { error: viewError } = await supabase.rpc('exec_sql', { sql: viewSQL });

  if (viewError) {
    console.log('Trying alternative method...\n');

    const { data, error } = await supabase
      .from('vapi_calls_raw')
      .select('*')
      .limit(1);

    if (error) {
      throw new Error(`Cannot access vapi_calls_raw: ${error.message}`);
    }

    console.log('Note: View creation requires direct database access');
    console.log('Please run this SQL in Supabase SQL Editor:\n');
    console.log(viewSQL);
    console.log('\nThen create the summary view:\n');
    console.log(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS conversion_stats_summary AS
      SELECT
        COUNT(*) as total_calls,
        COUNT(*) FILTER (WHERE has_evaluation) as calls_with_evaluation,
        COUNT(*) FILTER (WHERE meeting_outcome = 'booked') as meetings_booked,
        COUNT(*) FILTER (WHERE meeting_outcome = 'not_booked') as meetings_not_booked,
        COUNT(*) FILTER (WHERE next_step = 'callback') as callbacks_requested,
        COUNT(*) FILTER (WHERE next_step = 'email') as emails_requested,
        COUNT(*) FILTER (WHERE interest_level = 'high') as high_interest,
        COUNT(*) FILTER (WHERE interest_level = 'medium') as medium_interest,
        COUNT(*) FILTER (WHERE dnc_status = true) as dnc_count,
        COUNT(*) FILTER (WHERE referral_provided = true) as referrals_received,
        ROUND(COUNT(*) FILTER (WHERE meeting_outcome = 'booked')::NUMERIC /
              NULLIF(COUNT(*) FILTER (WHERE has_evaluation), 0) * 100, 2) as conversion_rate
      FROM call_conversion_metrics;
    `);
    return;
  }

  console.log('View created successfully!');

  const { data: stats } = await supabase
    .from('call_conversion_metrics')
    .select('meeting_outcome, next_step, interest_level, dnc_status, referral_provided');

  if (stats) {
    const booked = stats.filter(s => s.meeting_outcome === 'booked').length;
    const total = stats.filter(s => s.meeting_outcome).length;
    console.log(`\nConversion Rate: ${booked}/${total} = ${(booked/total*100).toFixed(1)}%`);
  }
}

createConversionMetricsView().catch(console.error);
