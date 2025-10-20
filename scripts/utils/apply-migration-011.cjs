const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from frontend/.env.local
require('dotenv').config({ path: path.join(__dirname, '../../frontend/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: Missing environment variables');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'found' : 'MISSING');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'found' : 'MISSING');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const sqlPath = path.join(__dirname, '../../data/migrations/011_fix_quality_badge_logic.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

console.log('Applying migration: 011_fix_quality_badge_logic.sql');
console.log('---');

async function applyMigration() {
  try {
    // Execute the SQL directly
    const { data, error } = await supabase.rpc('query', { sql });

    if (error) {
      console.error('✗ Migration failed:', error.message);
      process.exit(1);
    }

    console.log('✓ Migration applied successfully!');
    console.log('');
    console.log('Changes:');
    console.log('  - Quality badge теперь показывается ТОЛЬКО для звонков с QCI анализом');
    console.log('  - Звонки без QCI анализа не будут иметь quality badge (NULL)');
    process.exit(0);
  } catch (err) {
    console.error('✗ Error:', err.message);
    process.exit(1);
  }
}

applyMigration();
