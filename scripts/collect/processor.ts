/**
 * 데이터 처리 파이프라인
 * Raw Data → Clean → Chunk → Embed → Store in Supabase
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import type { CollectedData, ChunkedData } from './types.js';

const CHUNK_SIZE = 1000; // 문자 수
const CHUNK_OVERLAP = 200;

interface ProcessorOptions {
  inputDir?: string;
  outputDir?: string;
  chunkSize?: number;
  chunkOverlap?: number;
}

const DEFAULT_OPTIONS: ProcessorOptions = {
  inputDir: 'data/raw',
  outputDir: 'data/processed',
  chunkSize: CHUNK_SIZE,
  chunkOverlap: CHUNK_OVERLAP,
};

export async function processCollectedData(options: ProcessorOptions = {}): Promise<ChunkedData[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const allChunks: ChunkedData[] = [];
  
  console.log('[processor] Starting data processing pipeline...');
  
  // 모든 raw 데이터 디렉토리 스캔
  const inputDir = join(process.cwd(), opts.inputDir!);
  if (!existsSync(inputDir)) {
    console.log('[processor] No input directory found');
    return [];
  }

  const sources = readdirSync(inputDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const source of sources) {
    const sourceDir = join(inputDir, source);
    const files = readdirSync(sourceDir).filter(f => f.endsWith('.json'));
    
    for (const file of files) {
      try {
        const filePath = join(sourceDir, file);
        const content = readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        
        // 배열 또는 단일 객체 처리
        const items: CollectedData[] = Array.isArray(data) ? data : [data];
        
        for (const item of items) {
          const chunks = processItem(item, opts);
          allChunks.push(...chunks);
        }
        
      } catch (error) {
        console.error(`[processor] Error processing ${file}:`, error);
      }
    }
  }

  // 처리된 데이터 저장
  if (allChunks.length > 0) {
    saveProcessedData(allChunks, opts.outputDir!);
  }

  console.log(`[processor] ✓ Created ${allChunks.length} chunks from ${sources.length} sources`);
  return allChunks;
}

function processItem(item: CollectedData, opts: ProcessorOptions): ChunkedData[] {
  // 1. Clean
  const cleanedContent = cleanContent(item.content);
  
  // 2. Chunk
  const chunks = chunkText(cleanedContent, opts.chunkSize!, opts.chunkOverlap!);
  
  // 3. Create ChunkedData objects
  return chunks.map((chunk, index) => ({
    idolId: item.idolId,
    source: item.source,
    chunkIndex: index,
    content: chunk,
    metadata: {
      originalUrl: item.url,
      title: item.title,
    },
  }));
}

function cleanContent(text: string): string {
  return text
    // 여러 공백을 하나로
    .replace(/\s+/g, ' ')
    // 여러 줄바꿈을 2개로
    .replace(/\n{3,}/g, '\n\n')
    // URL 제거 (선택적)
    // .replace(/https?:\/\/[^\s]+/g, '')
    // 특수문자 정리
    .replace(/[^\w\s가-힣ㄱ-ㅎㅏ-ㅣ.,!?;:'"()\-–—]/g, '')
    .trim();
}

function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    let end = start + chunkSize;
    
    // 단어 경계에서 자르기
    if (end < text.length) {
      const lastSpace = text.lastIndexOf(' ', end);
      const lastNewline = text.lastIndexOf('\n', end);
      const breakPoint = Math.max(lastSpace, lastNewline);
      
      if (breakPoint > start + chunkSize / 2) {
        end = breakPoint;
      }
    }
    
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    
    start = end - overlap;
    if (start < 0) start = 0;
    if (end >= text.length) break;
  }
  
  return chunks;
}

function saveProcessedData(chunks: ChunkedData[], outputDir: string): void {
  const dir = join(process.cwd(), outputDir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  
  // 아이돌별로 그룹화
  const byIdol: Record<string, ChunkedData[]> = {};
  for (const chunk of chunks) {
    if (!byIdol[chunk.idolId]) {
      byIdol[chunk.idolId] = [];
    }
    byIdol[chunk.idolId].push(chunk);
  }
  
  // 각 아이돌별로 저장
  for (const [idolId, idolChunks] of Object.entries(byIdol)) {
    const filename = `${idolId}_chunks_${Date.now()}.json`;
    writeFileSync(join(dir, filename), JSON.stringify(idolChunks, null, 2));
    console.log(`[processor] Saved ${idolChunks.length} chunks for ${idolId}`);
  }
  
  // 전체 통합 파일도 저장
  const allFilename = `all_chunks_${Date.now()}.json`;
  writeFileSync(join(dir, allFilename), JSON.stringify(chunks, null, 2));
}

export default processCollectedData;
