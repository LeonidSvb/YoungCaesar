const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const SUCCESS_PATTERNS = [
  /successfully\s+scheduled/i,
  /meeting\s+(was\s+)?booked/i,
  /appointment\s+(was\s+)?(set|scheduled|booked|confirmed)/i,
  /demo\s+(was\s+)?(set|scheduled|booked)/i,
  /confirmed.*?(meeting|appointment|demo)/i,
  /scheduled.*?(meeting|appointment|demo).*?for/i,
  /booked.*?on\s+\w+day/i,
  /calendar\s+invite.*?(sent|will\s+be\s+sent)/i
];

const FAILURE_PATTERNS = [
  /without.*?(scheduling|scheduled|appointment)/i,
  /could\s+not\s+(schedule|book)/i,
  /failed\s+to\s+(schedule|book|arrange)/i,
  /ended\s+without.*?appointment/i,
  /declined.*?(meeting|appointment)/i,
  /not\s+interested/i,
  /breakdown\s+in\s+communication/i,
  /hung\s+up/i
];

function classifyMeeting(summary) {
  if (!summary || typeof summary !== 'string') {
    return 'no_data';
  }

  const lowerSummary = summary.toLowerCase();

  const hasSuccess = SUCCESS_PATTERNS.some(pattern => pattern.test(summary));
  const hasFailure = FAILURE_PATTERNS.some(pattern => pattern.test(summary));

  const mentionsMeeting = lowerSummary.includes('meeting') ||
                         lowerSummary.includes('appointment') ||
                         lowerSummary.includes('demo') ||
                         lowerSummary.includes('call back') ||
                         lowerSummary.includes('follow up');

  if (hasSuccess && !hasFailure) {
    return 'booked';
  }

  if (hasFailure) {
    return 'attempted_failed';
  }

  if (mentionsMeeting) {
    return 'mentioned_unclear';
  }

  return 'no_meeting_discussion';
}

async function analyzeConversions() {
  console.log('Analyzing meeting conversions from ALL call summaries...\n');

  let allCalls = [];
  let offset = 0;
  const batchSize = 1000;

  while (true) {
    const { data: calls, error } = await supabase
      .from('vapi_calls_raw')
      .select('id, assistant_id, created_at, duration_seconds, cost, raw_json')
      .not('raw_json', 'is', null)
      .range(offset, offset + batchSize - 1);

    if (error) throw error;

    if (!calls || calls.length === 0) break;

    allCalls = allCalls.concat(calls);
    console.log(`Loaded ${allCalls.length} calls...`);

    if (calls.length < batchSize) break;
    offset += batchSize;
  }

  console.log(`\nTotal calls loaded: ${allCalls.length}\n`);
  const calls = allCalls;

  const results = calls.map(call => {
    const summary = call.raw_json?.analysis?.summary || null;
    const classification = classifyMeeting(summary);

    return {
      call_id: call.id,
      assistant_id: call.assistant_id,
      created_at: call.created_at,
      duration_seconds: call.duration_seconds,
      cost: call.cost,
      has_analysis: !!summary,
      summary: summary,
      classification: classification
    };
  });

  const stats = {
    total_calls: results.length,
    calls_with_analysis: results.filter(r => r.has_analysis).length,

    meetings_booked: results.filter(r => r.classification === 'booked').length,
    attempts_failed: results.filter(r => r.classification === 'attempted_failed').length,
    mentioned_unclear: results.filter(r => r.classification === 'mentioned_unclear').length,
    no_discussion: results.filter(r => r.classification === 'no_meeting_discussion').length,
    no_data: results.filter(r => r.classification === 'no_data').length
  };

  stats.conversion_rate = (stats.meetings_booked / stats.calls_with_analysis * 100).toFixed(2);
  stats.attempt_rate = ((stats.meetings_booked + stats.attempts_failed) / stats.calls_with_analysis * 100).toFixed(2);

  console.log('CONVERSION ANALYSIS RESULTS:');
  console.log('='.repeat(60));
  console.log(`Total calls analyzed: ${stats.total_calls}`);
  console.log(`Calls with AI analysis: ${stats.calls_with_analysis}`);
  console.log('');
  console.log(`Meetings SUCCESSFULLY booked: ${stats.meetings_booked} (${stats.conversion_rate}%)`);
  console.log(`Booking attempts FAILED: ${stats.attempts_failed}`);
  console.log(`Meetings mentioned (unclear outcome): ${stats.mentioned_unclear}`);
  console.log(`No meeting discussion: ${stats.no_discussion}`);
  console.log(`No analysis data: ${stats.no_data}`);
  console.log('');
  console.log(`Booking attempt rate: ${stats.attempt_rate}%`);
  console.log(`Success rate among attempts: ${((stats.meetings_booked / (stats.meetings_booked + stats.attempts_failed)) * 100).toFixed(2)}%`);
  console.log('='.repeat(60));

  const bookedCalls = results.filter(r => r.classification === 'booked');
  console.log(`\nSAMPLE SUCCESSFUL BOOKINGS (first 5):`);
  bookedCalls.slice(0, 5).forEach((call, i) => {
    console.log(`\n${i + 1}. Call ${call.call_id.substring(0, 8)} (${new Date(call.created_at).toLocaleDateString()})`);
    console.log(call.summary);
  });

  const outputDir = path.join(__dirname, '../../data/processed');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().split('T')[0];
  const outputPath = path.join(outputDir, `meeting_conversions_${timestamp}.json`);

  const output = {
    generated_at: new Date().toISOString(),
    summary: stats,
    calls: results,
    booked_calls: bookedCalls
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nFull results saved to: ${outputPath}`);

  const latestPath = path.join(outputDir, 'meeting_conversions_latest.json');
  fs.writeFileSync(latestPath, JSON.stringify(output, null, 2));
  console.log(`Latest link updated: meeting_conversions_latest.json`);

  return stats;
}

analyzeConversions().catch(console.error);
