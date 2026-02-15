/**
 * 강호동 아이돌 임베딩 스크립트
 * 실행: npx tsx scripts/embed-hodong.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// .env.local 로드
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !OPENAI_API_KEY) {
  console.error('❌ Missing environment variables:');
  console.error('   SUPABASE_URL, SUPABASE_ANON_KEY, OPENAI_API_KEY');
  process.exit(1);
}

interface KnowledgeItem {
  idol_id: string;
  category: string;
  content: string;
  metadata: Record<string, unknown>;
  embedding?: number[];
}

// 텍스트 청킹
function chunkText(text: string, maxChunkSize = 500): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length > maxChunkSize && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = paragraph;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter(c => c.length > 50);
}

// 카테고리 매핑
function inferCategory(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.includes('bubble') || lower.includes('chat')) return 'bubble';
  if (lower.includes('interview')) return 'interview';
  if (lower.includes('lyric') || lower.includes('song')) return 'lyrics';
  if (lower.includes('relationship')) return 'relationship';
  if (lower.includes('background') || lower.includes('profile')) return 'profile';
  if (lower.includes('personality')) return 'general';
  if (lower.includes('speech') || lower.includes('pattern')) return 'general';
  if (lower.includes('topic')) return 'general';
  if (lower.includes('boundar')) return 'general';
  if (lower.includes('sns') || lower.includes('instagram')) return 'sns';
  return 'general';
}

// OpenAI 임베딩 생성
async function createEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: texts,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${await response.text()}`);
  }

  const data = await response.json();
  return data.data.map((d: any) => d.embedding);
}

// 기존 Hodong 데이터 삭제
async function deleteExistingHodongData(): Promise<void> {
  console.log('🗑️  Deleting existing Hodong data...');
  
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/idol_knowledge?idol_id=eq.hodong`,
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: 'return=representation',
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    console.warn(`   Warning: Delete returned ${response.status}: ${text}`);
  } else {
    console.log('   ✅ Existing data deleted');
  }
}

// Supabase에 데이터 삽입
async function insertToSupabase(items: KnowledgeItem[]): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/idol_knowledge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(items),
  });

  if (!response.ok) {
    throw new Error(`Supabase insert error: ${await response.text()}`);
  }
}

// 메인 실행
async function main() {
  console.log('🚀 Starting Hodong (강호동) embedding...\n');

  const hodongDir = path.join(process.cwd(), 'public/idols/hodong');
  const mdFiles = fs.readdirSync(hodongDir).filter(f => f.endsWith('.md'));

  console.log(`📁 Found ${mdFiles.length} MD files in hodong folder\n`);

  // 기존 데이터 삭제
  await deleteExistingHodongData();

  const allItems: KnowledgeItem[] = [];

  // 파일별로 청크 생성
  for (const filename of mdFiles) {
    const filePath = path.join(hodongDir, filename);
    const content = fs.readFileSync(filePath, 'utf-8');
    const category = inferCategory(filename);
    const chunks = chunkText(content);

    console.log(`📄 ${filename}: ${chunks.length} chunks (category: ${category})`);

    for (const chunk of chunks) {
      allItems.push({
        idol_id: 'hodong',
        category,
        content: chunk,
        metadata: {
          source: `idols/hodong/${filename}`,
          filename,
        },
      });
    }
  }

  console.log(`\n📝 Total: ${allItems.length} chunks\n`);

  // 배치로 임베딩 생성 (50개씩)
  const BATCH_SIZE = 50;
  for (let i = 0; i < allItems.length; i += BATCH_SIZE) {
    const batch = allItems.slice(i, i + BATCH_SIZE);
    const texts = batch.map(item => item.content);

    console.log(`🔄 Embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allItems.length / BATCH_SIZE)}...`);

    const embeddings = await createEmbeddings(texts);

    for (let j = 0; j < batch.length; j++) {
      batch[j].embedding = embeddings[j];
    }

    // Supabase에 삽입
    await insertToSupabase(batch);
    console.log(`   ✅ Inserted ${batch.length} records`);

    // Rate limiting
    if (i + BATCH_SIZE < allItems.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('\n✨ Hodong embedding complete!');
  console.log(`   Total records: ${allItems.length}`);
}

main().catch(console.error);
