// Run SQL setup for Supabase pgvector
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const supabaseUrl = process.env.SUPABASE_URL || 'https://imsxflgmgjiakkeoiffe.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imltc3hmbGdtZ2ppYWtrZW9pZmZlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQ5NjM1NSwiZXhwIjoyMDg2MDcyMzU1fQ.vxrqMOWqVxptkGrOGDP3oNE46Rp9mr_xKbel-j0PYIk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runSetup() {
  console.log('🚀 Setting up Supabase for RAG...\n');

  // Read SQL file
  const sqlPath = path.join(__dirname, '..', 'supabase-setup.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  // Split by statements (simplified - just run key ones via RPC if possible)
  // Since we can't run raw SQL via REST, let's try creating the table directly

  console.log('Creating idol_knowledge table...');
  
  // Check if table exists by trying to select
  const { data: existing, error: checkError } = await supabase
    .from('idol_knowledge')
    .select('id')
    .limit(1);

  if (checkError && checkError.code === '42P01') {
    console.log('Table does not exist. Please run the SQL in Supabase Dashboard:');
    console.log('\n------- COPY THIS SQL -------\n');
    console.log(sql);
    console.log('\n------- END SQL -------\n');
    console.log('Go to: https://supabase.com/dashboard/project/imsxflgmgjiakkeoiffe/sql/new');
    return false;
  } else if (checkError) {
    console.log('Error checking table:', checkError.message);
    return false;
  } else {
    console.log('✅ Table already exists!');
    console.log(`   Current records: checking...`);
    
    const { count } = await supabase
      .from('idol_knowledge')
      .select('*', { count: 'exact', head: true });
    
    console.log(`   Total records: ${count || 0}`);
    return true;
  }
}

runSetup().then(success => {
  if (success) {
    console.log('\n✅ Supabase is ready for RAG!');
  } else {
    console.log('\n⚠️ Manual SQL execution required.');
  }
});
