const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

async function extractConversionMetrics() {
  console.log('Extracting conversion metrics from VAPI calls...\n');

  const { data: calls, error } = await supabase
    .from('vapi_calls_raw')
    .select('id, assistant_id, created_at, vapi_success_evaluation, cost, duration_seconds')
    .not('vapi_success_evaluation', 'is', null);

  if (error) throw error;

  console.log(`Found ${calls.length} calls with success evaluation\n`);

  const metrics = calls.map(call => {
    const eval_text = call.vapi_success_evaluation || '';

    return {
      call_id: call.id,
      assistant_id: call.assistant_id,
      created_at: call.created_at,
      cost: call.cost,
      duration_seconds: call.duration_seconds,

      meeting_outcome: eval_text.includes('Meeting Outcome: Booked') ? 'booked' :
                      eval_text.includes('Meeting Outcome: Not Booked') ? 'not_booked' : null,

      next_step: eval_text.includes('Next Step: Requested Callback') ? 'callback' :
                eval_text.includes('Next Step: Requested Email') ? 'email' :
                eval_text.includes('Next Step: None') ? 'none' : null,

      interest_level: eval_text.includes('Interest Level: High') ? 'high' :
                     eval_text.includes('Interest Level: Medium') ? 'medium' :
                     eval_text.includes('Interest Level: Low') ? 'low' :
                     eval_text.includes('Interest Level: None') ? 'none' : null,

      dnc: eval_text.includes('DNC: Yes'),
      referral: eval_text.includes('Referral: Yes')
    };
  });

  const stats = {
    total_calls_with_evaluation: metrics.length,

    meetings_booked: metrics.filter(m => m.meeting_outcome === 'booked').length,
    meetings_not_booked: metrics.filter(m => m.meeting_outcome === 'not_booked').length,

    callbacks_requested: metrics.filter(m => m.next_step === 'callback').length,
    emails_requested: metrics.filter(m => m.next_step === 'email').length,

    high_interest: metrics.filter(m => m.interest_level === 'high').length,
    medium_interest: metrics.filter(m => m.interest_level === 'medium').length,
    low_interest: metrics.filter(m => m.interest_level === 'low').length,

    dnc_count: metrics.filter(m => m.dnc).length,
    referrals_received: metrics.filter(m => m.referral).length
  };

  stats.conversion_rate = (stats.meetings_booked / stats.total_calls_with_evaluation * 100).toFixed(2);

  console.log('CONVERSION METRICS:');
  console.log(`Total calls analyzed: ${stats.total_calls_with_evaluation}`);
  console.log(`\nMeetings booked: ${stats.meetings_booked} (${stats.conversion_rate}%)`);
  console.log(`Meetings not booked: ${stats.meetings_not_booked}`);
  console.log(`\nCallbacks requested: ${stats.callbacks_requested}`);
  console.log(`Emails requested: ${stats.emails_requested}`);
  console.log(`\nHigh interest: ${stats.high_interest}`);
  console.log(`Medium interest: ${stats.medium_interest}`);
  console.log(`Low interest: ${stats.low_interest}`);
  console.log(`\nDNC requests: ${stats.dnc_count}`);
  console.log(`Referrals received: ${stats.referrals_received}`);

  const outputDir = path.join(__dirname, '../../data/processed');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().split('T')[0];
  const outputPath = path.join(outputDir, `conversion_metrics_${timestamp}.json`);

  const output = {
    generated_at: new Date().toISOString(),
    summary: stats,
    calls: metrics
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nResults saved to: ${outputPath}`);

  const latestPath = path.join(outputDir, 'conversion_metrics_latest.json');
  fs.writeFileSync(latestPath, JSON.stringify(output, null, 2));
  console.log(`Latest link updated: conversion_metrics_latest.json`);

  return stats;
}

extractConversionMetrics().catch(console.error);
