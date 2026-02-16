/**
 * 국회 회의록 API에서 정치인 발언 수집 → Supabase 벡터 DB 적재
 * 
 * Usage:
 *   npx tsx scripts/collect-speeches.ts
 *   npx tsx scripts/collect-speeches.ts --politician=leejm
 *   npx tsx scripts/collect-speeches.ts --dry-run
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// ============================================================
// Config
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
const OPENAI_KEY = process.env.OPENAI_API_KEY!;
const ASSEMBLY_API_KEY = process.env.ASSEMBLY_API_KEY || ''; // 국회 API 키 (없으면 sample key)

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 정치인 매핑 (idol_identity id → 국회 API 검색명)
interface PoliticianConfig {
  id: string;
  name: string;
  searchTerms: string[];
}

const POLITICIANS: PoliticianConfig[] = [
  { id: 'leejm', name: '이재명', searchTerms: ['이재명'] },
  { id: 'jungwono', name: '정원오', searchTerms: ['정원오'] },
  { id: 'jungcr', name: '정청래', searchTerms: ['정청래'] },
  { id: 'ohsehoon', name: '오세훈', searchTerms: ['오세훈'] },
  { id: 'jangdh', name: '장동혁', searchTerms: ['장동혁'] },
];

const BATCH_SIZE = 20; // embedding batch size
const CHUNK_SIZE = 800; // characters per chunk

// ============================================================
// Assembly API (국회 회의록)
// ============================================================

interface AssemblySpeech {
  MONA_CD: string;    // 의원코드
  HG_NM: string;      // 의원명
  COMP_MAIN_TITLE: string; // 회의명
  SPEECH_CONTENT: string;  // 발언 내용
  MEETING_DATE: string;    // 회의일
  UNIT_CD: string;         // 단위
}

async function fetchAssemblySpeeches(name: string, page = 1, size = 50): Promise<AssemblySpeech[]> {
  const baseUrl = 'https://open.assembly.go.kr/portal/openapi/nzmimeepazxkubdpn';
  const params = new URLSearchParams({
    KEY: ASSEMBLY_API_KEY || 'sample',
    Type: 'json',
    pIndex: String(page),
    pSize: String(size),
    HG_NM: name,
  });

  try {
    const res = await fetch(`${baseUrl}?${params}`);
    if (!res.ok) {
      console.warn(`Assembly API error: ${res.status}`);
      return [];
    }
    const json = await res.json();
    const rows = json?.nzmimeepazxkubdpn?.[1]?.row;
    return Array.isArray(rows) ? rows : [];
  } catch (e) {
    console.error(`Assembly API fetch failed for ${name}:`, e);
    return [];
  }
}

// ============================================================
// Text Processing
// ============================================================

function chunkText(text: string, maxLen = CHUNK_SIZE): string[] {
  if (text.length <= maxLen) return [text.trim()].filter(Boolean);
  
  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?。\n])\s*/);
  let current = '';

  for (const sent of sentences) {
    if ((current + sent).length > maxLen && current) {
      chunks.push(current.trim());
      current = sent;
    } else {
      current += (current ? ' ' : '') + sent;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

// ============================================================
// Embedding
// ============================================================

async function createEmbeddings(texts: string[]): Promise<number[][]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: texts,
    }),
  });

  if (!res.ok) {
    throw new Error(`Embedding API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.data.map((d: any) => d.embedding);
}

// ============================================================
// Supabase Upsert
// ============================================================

async function upsertSpeeches(
  rows: { politician_id: string; source: string; content: string; embedding: number[]; metadata: any }[]
) {
  if (rows.length === 0) return;
  
  const { error } = await supabase.from('politician_speeches').insert(rows);
  if (error) {
    console.error('Supabase insert error:', error.message);
    throw error;
  }
}

// ============================================================
// Main Pipeline
// ============================================================

async function collectForPolitician(config: PoliticianConfig, dryRun: boolean) {
  console.log(`\n📥 Collecting speeches for ${config.name} (${config.id})...`);

  let allChunks: { content: string; metadata: any }[] = [];

  // 국회 회의록
  for (const term of config.searchTerms) {
    console.log(`  🔍 Searching assembly records: "${term}"`);
    const speeches = await fetchAssemblySpeeches(term, 1, 100);
    console.log(`  Found ${speeches.length} assembly records`);

    for (const speech of speeches) {
      const content = speech.SPEECH_CONTENT || '';
      if (content.length < 30) continue; // 너무 짧은 발언 스킵

      const chunks = chunkText(content);
      for (const chunk of chunks) {
        allChunks.push({
          content: chunk,
          metadata: {
            speaker: speech.HG_NM,
            meeting: speech.COMP_MAIN_TITLE,
            date: speech.MEETING_DATE,
            mona_cd: speech.MONA_CD,
          },
        });
      }
    }
  }

  console.log(`  📝 Total chunks: ${allChunks.length}`);

  if (dryRun) {
    console.log(`  [DRY RUN] Would insert ${allChunks.length} chunks`);
    if (allChunks.length > 0) {
      console.log(`  Sample: "${allChunks[0].content.slice(0, 100)}..."`);
    }
    return;
  }

  if (allChunks.length === 0) {
    console.log(`  ⚠️  No data found, skipping`);
    return;
  }

  // Batch embedding + insert
  for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
    const batch = allChunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map((c) => c.content);

    console.log(`  🧠 Embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allChunks.length / BATCH_SIZE)}...`);
    const embeddings = await createEmbeddings(texts);

    const rows = batch.map((c, j) => ({
      politician_id: config.id,
      source: 'assembly' as const,
      content: c.content,
      embedding: embeddings[j],
      metadata: c.metadata,
    }));

    await upsertSpeeches(rows);
    console.log(`  ✅ Inserted ${rows.length} rows`);

    // Rate limit
    if (i + BATCH_SIZE < allChunks.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log(`  🎉 Done: ${allChunks.length} chunks for ${config.name}`);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const politicianFlag = args.find((a) => a.startsWith('--politician='));
  const targetId = politicianFlag?.split('=')[1];

  if (!OPENAI_KEY) {
    console.error('❌ OPENAI_API_KEY not set');
    process.exit(1);
  }

  console.log('🚀 Politician Speech Collector');
  console.log(`   Supabase: ${SUPABASE_URL}`);
  console.log(`   Assembly API key: ${ASSEMBLY_API_KEY ? '✅' : '⚠️ using sample'}`);
  if (dryRun) console.log('   🧪 DRY RUN MODE');

  const targets = targetId
    ? POLITICIANS.filter((p) => p.id === targetId)
    : POLITICIANS;

  if (targets.length === 0) {
    console.error(`❌ Unknown politician: ${targetId}`);
    console.log(`Available: ${POLITICIANS.map((p) => p.id).join(', ')}`);
    process.exit(1);
  }

  for (const pol of targets) {
    await collectForPolitician(pol, dryRun);
  }

  console.log('\n✅ All done!');
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
