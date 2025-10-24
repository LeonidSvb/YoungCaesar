const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function checkRuns() {
  const { data: runs, error } = await supabase
    .from('runs')
    .select('*')
    .eq('script_name', 'qci-analysis')
    .order('started_at', { ascending: false })
    .limit(5);

  if (error) {
    console.log('Error:', error);
    return;
  }

  console.log('QCI Analysis Runs:');
  console.log('==================\n');

  runs.forEach((run, i) => {
    console.log((i+1) + '. Run ID: ' + run.id.substring(0, 8) + '...');
    console.log('   Status: ' + run.status);
    console.log('   Started: ' + new Date(run.started_at).toLocaleString());
    console.log('   Calls analyzed: ' + (run.calls_analyzed || 0));

    const hasCallIds = run.metadata && run.metadata.analyzed_call_ids;
    console.log('   Has analyzed_call_ids: ' + (hasCallIds ? 'YES (' + run.metadata.analyzed_call_ids.length + ' calls)' : 'NO'));

    if (hasCallIds) {
      const firstThree = run.metadata.analyzed_call_ids.slice(0, 3).map(id => id.substring(0, 12)).join(', ');
      console.log('   First 3 call IDs: ' + firstThree + '...');
    }
    console.log('');
  });
}

checkRuns().catch(console.error);
