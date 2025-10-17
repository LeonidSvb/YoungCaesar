const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

async function checkFormat() {
  const { data: allCalls, error } = await supabase
    .from('vapi_calls_raw')
    .select('id, raw_json')
    .not('raw_json', 'is', null)
    .limit(1000);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Analyzing ${allCalls.length} calls for conversion data...\n`);

  let callsWithAnalysis = 0;
  let callsWithToolCalls = 0;
  let meetingsBooked = 0;
  const analysisKeys = new Set();

  allCalls.forEach(call => {
    const json = call.raw_json;

    if (json?.analysis) {
      callsWithAnalysis++;
      Object.keys(json.analysis).forEach(k => analysisKeys.add(k));

      const summary = json.analysis.summary || '';
      if (typeof summary === 'string') {
        if (summary.toLowerCase().includes('meeting') ||
            summary.toLowerCase().includes('booked') ||
            summary.toLowerCase().includes('appointment')) {
          meetingsBooked++;
        }
      }
    }

    if (json?.messages?.some(m => m.toolCalls)) {
      callsWithToolCalls++;
    }

    if (json?.toolCalls || json?.tool_calls) {
      callsWithToolCalls++;
    }
  });

  console.log(`Calls with analysis: ${callsWithAnalysis}`);
  console.log(`Analysis object keys found:`, Array.from(analysisKeys));
  console.log(`\nCalls with 'meeting/booked' in summary: ${meetingsBooked}`);
  console.log(`Calls with tool calls: ${callsWithToolCalls}`);

  console.log('\n=== Analyzing tool call data ===');
  const callsWithToolsData = allCalls.filter(c => {
    if (c.raw_json?.messages) {
      return c.raw_json.messages.some(m => m.toolCalls && m.toolCalls.length > 0);
    }
    return false;
  });

  console.log(`Calls with non-empty tool calls: ${callsWithToolsData.length}`);

  if (callsWithToolsData.length > 0) {
    const sample = callsWithToolsData[0];
    console.log(`\nSample call: ${sample.id.substring(0, 8)}`);

    const toolMessage = sample.raw_json.messages.find(m => m.toolCalls && m.toolCalls.length > 0);
    console.log('Tool calls:', JSON.stringify(toolMessage.toolCalls, null, 2));
    console.log('\nSummary of this call:');
    console.log(sample.raw_json?.analysis?.summary || 'No summary');
  }

  const toolNames = new Set();
  callsWithToolsData.forEach(call => {
    call.raw_json.messages.forEach(msg => {
      if (msg.toolCalls) {
        msg.toolCalls.forEach(tc => {
          if (tc.function?.name) toolNames.add(tc.function.name);
        });
      }
    });
  });

  console.log('\nTool functions used:', Array.from(toolNames));

  console.log('\n=== Sample summaries mentioning meetings ===');
  const meetingSamples = allCalls.filter(c => {
    const summary = c.raw_json?.analysis?.summary || '';
    return summary.toLowerCase().includes('meeting') ||
           summary.toLowerCase().includes('booked');
  }).slice(0, 3);

  meetingSamples.forEach(call => {
    console.log(`\nCall ${call.id.substring(0, 8)}:`);
    console.log(call.raw_json.analysis.summary);
  });
}

checkFormat().catch(console.error);
