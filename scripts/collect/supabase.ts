/**
 * Supabase 저장 모듈
 * 처리된 청크 데이터를 Supabase에 저장
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import type { ChunkedData } from './types.js';

// 환경변수에서 로드
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

interface SupabaseOptions {
  inputDir?: string;
  tableName?: string;
  batchSize?: number;
}

const DEFAULT_OPTIONS: SupabaseOptions = {
  inputDir: 'data/processed',
  tableName: 'celeb_knowledge',
  batchSize: 100,
};

export async function uploadToSupabase(options: SupabaseOptions = {}): Promise<number> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[supabase] Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    console.log('Set environment variables in .env.local');
    return 0;
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  
  console.log('[supabase] Starting upload...');
  
  const inputDir = join(process.cwd(), opts.inputDir!);
  if (!existsSync(inputDir)) {
    console.log('[supabase] No processed data found');
    return 0;
  }
  
  const files = readdirSync(inputDir).filter(f => f.endsWith('.json'));
  let totalUploaded = 0;
  
  for (const file of files) {
    try {
      const filePath = join(inputDir, file);
      const content = readFileSync(filePath, 'utf-8');
      const chunks: ChunkedData[] = JSON.parse(content);
      
      // 배치로 업로드
      for (let i = 0; i < chunks.length; i += opts.batchSize!) {
        const batch = chunks.slice(i, i + opts.batchSize!);
        
        const records = batch.map(chunk => ({
          idol_id: chunk.idolId,
          source: chunk.source,
          chunk_index: chunk.chunkIndex,
          content: chunk.content,
          metadata: chunk.metadata,
          created_at: new Date().toISOString(),
        }));
        
        const { error } = await supabase
          .from(opts.tableName!)
          .upsert(records, { onConflict: 'idol_id,source,chunk_index' });
        
        if (error) {
          console.error(`[supabase] Batch error:`, error);
        } else {
          totalUploaded += batch.length;
          console.log(`[supabase] Uploaded ${totalUploaded} chunks...`);
        }
      }
      
    } catch (error) {
      console.error(`[supabase] Error processing ${file}:`, error);
    }
  }
  
  console.log(`[supabase] ✓ Total uploaded: ${totalUploaded} chunks`);
  return totalUploaded;
}

// Supabase 테이블 스키마 생성 SQL
export const CREATE_TABLE_SQL = `
-- 셀럽 지식 청크 테이블
CREATE TABLE IF NOT EXISTS celeb_knowledge (
  id BIGSERIAL PRIMARY KEY,
  idol_id TEXT NOT NULL,
  source TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  embedding vector(1536), -- OpenAI embedding 차원
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(idol_id, source, chunk_index)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_celeb_knowledge_idol ON celeb_knowledge(idol_id);
CREATE INDEX IF NOT EXISTS idx_celeb_knowledge_source ON celeb_knowledge(source);

-- 벡터 검색 인덱스 (pgvector 확장 필요)
-- CREATE INDEX IF NOT EXISTS idx_celeb_knowledge_embedding ON celeb_knowledge 
--   USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
`;

// CLI 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  uploadToSupabase()
    .then(count => {
      console.log(`\n✅ 업로드 완료: ${count}개`);
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ 에러:', err);
      process.exit(1);
    });
}

export default uploadToSupabase;
