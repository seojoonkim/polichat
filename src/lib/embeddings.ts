import { supabase, type PoliticianKnowledge } from './supabase';

/**
 * 텍스트를 임베딩 벡터로 변환 (서버 API 호출)
 */
export async function createEmbedding(text: string): Promise<number[]> {
  const response = await fetch('/api/embedding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(`Embedding API error: ${response.status}`);
  }

  const data = await response.json();
  return data.embedding;
}

/**
 * 여러 텍스트를 배치로 임베딩
 */
export async function createEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await fetch('/api/embedding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts }),
  });

  if (!response.ok) {
    throw new Error(`Embedding API error: ${response.status}`);
  }

  const data = await response.json();
  return data.embeddings;
}

/**
 * 지식을 Supabase에 저장 (임베딩 포함)
 */
export async function storeKnowledge(
  politicianId: string,
  category: PoliticianKnowledge['category'],
  content: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const embedding = await createEmbedding(content);

  const { error } = await supabase.from('idol_knowledge').insert({
    idol_id: politicianId,
    category,
    content,
    embedding,
    metadata,
  });

  if (error) {
    throw new Error(`Failed to store knowledge: ${error.message}`);
  }
}

/**
 * 여러 지식을 배치로 저장
 */
export async function storeKnowledgeBatch(
  items: Array<{
    politicianId: string;
    category: PoliticianKnowledge['category'];
    content: string;
    metadata?: Record<string, unknown>;
  }>
): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  // 배치 임베딩 생성
  const texts = items.map(item => item.content);
  const embeddings = await createEmbeddings(texts);

  // 데이터 준비
  const records = items.map((item, index) => ({
    idol_id: item.politicianId,
    category: item.category,
    content: item.content,
    embedding: embeddings[index],
    metadata: item.metadata,
  }));

  // 배치 삽입
  const { error } = await supabase.from('idol_knowledge').insert(records);

  if (error) {
    throw new Error(`Failed to store knowledge batch: ${error.message}`);
  }
}

/**
 * 텍스트를 청크로 분할 (임베딩 크기 제한 고려)
 */
export function chunkText(
  text: string,
  maxChunkSize: number = 500,
  overlap: number = 50
): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?。！？])\s+/);
  
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxChunkSize && currentChunk) {
      chunks.push(currentChunk.trim());
      // 오버랩: 마지막 문장의 일부를 다음 청크에 포함
      const words = currentChunk.split(' ');
      const overlapWords = words.slice(-Math.ceil(overlap / 5));
      currentChunk = overlapWords.join(' ') + ' ' + sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}
