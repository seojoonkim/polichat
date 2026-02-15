/**
 * 데이터 수집 및 임베딩 스크립트
 * 실행: npx tsx scripts/collect-data.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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

  return chunks.filter(c => c.length > 50); // 너무 짧은 청크 제외
}

// 카테고리 매핑
function inferCategory(filename: string, dirPath: string): string {
  const lower = filename.toLowerCase();
  if (lower.includes('bubble') || lower.includes('chat')) return 'bubble';
  if (lower.includes('interview')) return 'interview';
  if (lower.includes('lyric') || lower.includes('song')) return 'lyrics';
  if (lower.includes('relationship')) return 'relationship';
  if (lower.includes('background') || lower.includes('profile')) return 'profile';
  if (lower.includes('sns') || lower.includes('instagram') || lower.includes('twitter')) return 'sns';
  return 'general';
}

// MD 파일에서 아이돌 ID 추출
function extractIdolId(filePath: string): string {
  const parts = filePath.split(path.sep);
  // public/idols/wonyoung/... → wonyoung
  const idolsIndex = parts.indexOf('idols');
  if (idolsIndex !== -1 && parts[idolsIndex + 1]) {
    return parts[idolsIndex + 1];
  }
  // public/groups/ive/... → ive
  const groupsIndex = parts.indexOf('groups');
  if (groupsIndex !== -1 && parts[groupsIndex + 1]) {
    return `group:${parts[groupsIndex + 1]}`;
  }
  return 'unknown';
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

// MD 파일 수집
function collectMDFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

// 메인 실행
async function main() {
  console.log('🚀 Starting data collection...\n');

  const publicDir = path.join(process.cwd(), 'public');
  const mdFiles = collectMDFiles(publicDir);

  console.log(`📁 Found ${mdFiles.length} MD files\n`);

  const allItems: KnowledgeItem[] = [];

  // 파일별로 청크 생성
  for (const filePath of mdFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const idolId = extractIdolId(filePath);
    const category = inferCategory(path.basename(filePath), path.dirname(filePath));
    const chunks = chunkText(content);

    for (const chunk of chunks) {
      allItems.push({
        idol_id: idolId,
        category,
        content: chunk,
        metadata: {
          source: path.relative(publicDir, filePath),
        },
      });
    }
  }

  console.log(`📝 Created ${allItems.length} chunks\n`);

  // 배치로 임베딩 생성 (100개씩)
  const BATCH_SIZE = 100;
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

  console.log('\n✨ Data collection complete!');
  console.log(`   Total records: ${allItems.length}`);
}

main().catch(console.error);
