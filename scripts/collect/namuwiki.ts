/**
 * 나무위키 크롤러
 * - 아이돌 문서 전체 크롤링
 * - HTML 파싱으로 본문 추출
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import type { IdolConfig, CollectedData, CollectorOptions } from './types.js';
import { COMMON_HEADERS, delay } from './config.js';

const DEFAULT_OPTIONS: CollectorOptions = {
  delay: 2000,
  outputDir: 'data/raw/namuwiki',
};

export async function collectNamuwiki(
  idol: IdolConfig,
  options: CollectorOptions = {}
): Promise<CollectedData[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const results: CollectedData[] = [];

  if (!idol.namuwikiUrl) {
    console.log(`[namuwiki] No URL configured for ${idol.name}`);
    return results;
  }

  console.log(`[namuwiki] Collecting ${idol.name}...`);

  try {
    // 나무위키는 raw 모드로 접근하면 더 깔끔한 데이터를 얻을 수 있음
    const response = await axios.get(idol.namuwikiUrl, {
      headers: COMMON_HEADERS,
      timeout: 30000,
    });

    const $ = cheerio.load(response.data);
    
    // 본문 추출 (나무위키 구조에 맞게)
    const content = extractNamuwikiContent($);
    
    if (content) {
      const data: CollectedData = {
        idolId: idol.id,
        source: 'namuwiki',
        title: `${idol.name} - 나무위키`,
        content: content,
        url: idol.namuwikiUrl,
        collectedAt: new Date().toISOString(),
        metadata: {
          length: content.length,
          sections: countSections($),
        },
      };
      results.push(data);
      
      // 파일로 저장
      saveToFile(data, opts.outputDir!);
      
      console.log(`[namuwiki] ✓ Collected ${content.length} chars for ${idol.name}`);
    }

    await delay(opts.delay!);
    
  } catch (error) {
    console.error(`[namuwiki] Error collecting ${idol.name}:`, error);
  }

  return results;
}

function extractNamuwikiContent($: cheerio.CheerioAPI): string {
  // 나무위키 본문 컨테이너
  const articleContent = $('.wiki-content, .wiki-inner-content, article').first();
  
  if (articleContent.length === 0) {
    // fallback: body에서 직접 추출
    return $('body').text().trim().replace(/\s+/g, ' ');
  }

  // 불필요한 요소 제거
  articleContent.find('script, style, .wiki-fn-content, .toc').remove();
  
  // 텍스트 추출
  let text = '';
  
  // 각 섹션별로 추출
  articleContent.find('h2, h3, h4, p, li, td').each((_, el) => {
    const $el = $(el);
    const tagName = el.tagName?.toLowerCase();
    const content = $el.text().trim();
    
    if (!content) return;
    
    if (tagName?.startsWith('h')) {
      text += `\n\n## ${content}\n`;
    } else {
      text += content + '\n';
    }
  });

  return cleanText(text);
}

function countSections($: cheerio.CheerioAPI): number {
  return $('h2, h3').length;
}

function cleanText(text: string): string {
  return text
    .replace(/\[\d+\]/g, '') // 각주 제거
    .replace(/\s+/g, ' ') // 여러 공백을 하나로
    .replace(/\n{3,}/g, '\n\n') // 여러 줄바꿈을 2개로
    .trim();
}

function saveToFile(data: CollectedData, outputDir: string): void {
  const dir = join(process.cwd(), outputDir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  
  const filename = `${data.idolId}_${Date.now()}.json`;
  writeFileSync(join(dir, filename), JSON.stringify(data, null, 2));
}

export default collectNamuwiki;
