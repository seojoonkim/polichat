/**
 * SQL 마이그레이션 실행 스크립트
 * Supabase PostgreSQL에 직접 연결하여 마이그레이션 실행
 * 
 * 실행: npm run migrate:sql
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// .env.local 로드
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

async function runMigration() {
  console.log('🚀 Running SQL migration...\n');

  // SQL 파일 읽기
  const sqlPath = path.resolve(process.cwd(), 'supabase/migrations/20260208_tier2_memory_system.sql');
  
  if (!fs.existsSync(sqlPath)) {
    console.error('❌ Migration file not found:', sqlPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf-8');
  
  console.log('📄 Migration file loaded:', sqlPath);
  console.log('📝 SQL statements to execute:\n');
  
  // SQL을 개별 statement로 분리
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Found ${statements.length} SQL statements\n`);

  // Supabase 대시보드에서 실행할 SQL 출력
  console.log('=' .repeat(60));
  console.log('📋 Copy and paste this SQL into Supabase SQL Editor:');
  console.log('=' .repeat(60));
  console.log('\n' + sql + '\n');
  console.log('=' .repeat(60));
  
  console.log('\n✅ SQL ready to execute in Supabase Dashboard');
  console.log('   1. Go to: https://supabase.com/dashboard/project/imsxflgmgjiakkeoiffe/sql');
  console.log('   2. Paste the SQL above');
  console.log('   3. Click "Run"\n');
  
  console.log('After running the SQL, execute:');
  console.log('   npm run migrate:identity\n');
}

runMigration().catch(console.error);
