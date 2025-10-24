require('dotenv').config({ path: '../../.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCallsView() {
    const { data, error } = await supabase
        .from('calls')
        .select('*')
        .limit(3);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('='.repeat(70));
    console.log('CALLS VIEW - COLUMNS');
    console.log('='.repeat(70));
    console.log('');

    if (data.length > 0) {
        console.log('Available columns:');
        Object.keys(data[0]).forEach((key, idx) => {
            console.log(`  ${idx + 1}. ${key}`);
        });
    }

    console.log('');
    console.log('Sample data:');
    console.log(JSON.stringify(data[0], null, 2));
}

checkCallsView();
