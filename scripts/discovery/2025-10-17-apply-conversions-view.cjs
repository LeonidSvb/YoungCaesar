const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

async function applyMigration() {
  console.log('Applying conversion metrics materialized view migration...\n');

  const sqlPath = path.join(__dirname, '2025-10-17-create-conversions-view.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Note: This SQL needs to be run in Supabase SQL Editor with admin privileges.');
  console.log('The view creation requires DDL permissions.\n');
  console.log('SQL to execute:');
  console.log('='.repeat(60));
  console.log(sql);
  console.log('='.repeat(60));

  console.log('\nAfter running the SQL, test with:');
  console.log('SELECT * FROM get_conversion_stats();');
  console.log('SELECT * FROM call_conversions WHERE meeting_booked = true LIMIT 5;');
}

applyMigration().catch(console.error);
