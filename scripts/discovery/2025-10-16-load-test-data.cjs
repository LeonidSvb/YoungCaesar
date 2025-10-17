require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load VAPI data
const dataPath = path.join(__dirname, '..', '..', 'data', 'raw', 'vapi_filtered_calls_2025-09-17T09-42-18-444.json');
const allCalls = require(dataPath);

console.log(`Loaded ${allCalls.length} calls from file`);

// Take first 50
const calls = allCalls.slice(0, 50);

// Prepare for Supabase
const prepared = calls.map(call => ({
    id: call.id,
    assistant_id: call.assistantId || null,
    customer_id: call.customerId || null,
    org_id: call.orgId || null,
    type: call.type || null,
    status: call.status || null,
    ended_reason: call.endedReason || null,
    started_at: call.startedAt || null,
    ended_at: call.endedAt || null,
    created_at: call.createdAt || new Date().toISOString(),
    transcript: call.transcript || null,
    summary: call.summary || null,
    cost: call.cost || 0,
    customer_phone_number: call.customer?.number || null,
    raw_json: call
}));

console.log(`Prepared ${prepared.length} records for insert\n`);

// Supabase connection
const supabaseUrl = process.env.SUPABASE_URL || 'https://ufickndxlqlwgjmcfgii.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!supabaseKey) {
    console.error('❌ Error: SUPABASE_SERVICE_KEY not found in .env');
    console.log('Add this to your .env file:');
    console.log('SUPABASE_URL=https://ufickndxlqlwgjmcfgii.supabase.co');
    console.log('SUPABASE_SERVICE_KEY=your_service_key_here');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function loadData() {
    console.log(`📤 Loading ${prepared.length} records to Supabase...`);

    // Insert in batches of 10
    const batchSize = 10;
    let inserted = 0;
    let failed = 0;

    for (let i = 0; i < prepared.length; i += batchSize) {
        const batch = prepared.slice(i, i + batchSize);

        const { data: result, error } = await supabase
            .from('vapi_calls_raw')
            .insert(batch);

        if (error) {
            console.error(`❌ Batch ${Math.floor(i / batchSize) + 1} failed:`, error.message);
            failed += batch.length;
        } else {
            inserted += batch.length;
            console.log(`✅ Batch ${Math.floor(i / batchSize) + 1}: Inserted ${batch.length} records (total: ${inserted})`);
        }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   - Inserted: ${inserted}`);
    console.log(`   - Failed: ${failed}`);
    console.log(`   - Total: ${prepared.length}`);

    // Verify
    const { count, error: countError } = await supabase
        .from('vapi_calls_raw')
        .select('*', { count: 'exact', head: true });

    if (!countError) {
        console.log(`\n✅ Total records in table: ${count}`);
    }
}

loadData().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
