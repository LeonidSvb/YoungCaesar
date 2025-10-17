require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const data = require('./vapi_test_data.json');

const supabaseUrl = process.env.SUPABASE_URL || 'https://ufickndxlqlwgjmcfgii.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!supabaseKey) {
    console.error('Error: SUPABASE_SERVICE_KEY not found in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function loadData() {
    console.log(`Loading ${data.length} records to Supabase...`);

    // Insert in batches of 10
    const batchSize = 10;
    let inserted = 0;
    let failed = 0;

    for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);

        const { data: result, error } = await supabase
            .from('vapi_calls_raw')
            .insert(batch);

        if (error) {
            console.error(`Batch ${i / batchSize + 1} failed:`, error.message);
            failed += batch.length;
        } else {
            inserted += batch.length;
            console.log(`Batch ${i / batchSize + 1}: Inserted ${batch.length} records (total: ${inserted})`);
        }
    }

    console.log(`\nSummary:`);
    console.log(`- Inserted: ${inserted}`);
    console.log(`- Failed: ${failed}`);
    console.log(`- Total: ${data.length}`);

    // Verify
    const { count, error: countError } = await supabase
        .from('vapi_calls_raw')
        .select('*', { count: 'exact', head: true });

    if (!countError) {
        console.log(`\nTotal records in table: ${count}`);
    }
}

loadData().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
