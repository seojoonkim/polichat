/**
 * 위키피디아 크롤러
 * - 한국어/영어 위키피디아 문서 수집
 * - Wikipedia API 활용
 */

import axios from 'axios';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import type { IdolConfig, CollectedData, CollectorOptions } from './types.js';
import { delay } from './config.js';

const DEFAULT_OPTIONS: CollectorOptions = {
  delay: 1000,
  outputDir: 'data/raw/wikipedia',
};

interface WikiResponse {
  query?: {
    pages: {
      [key: string]: {
        pageid: number;
        title: string;
        extract?: string;
        fullurl?: string;
      };
    };
  };
}

export async function collectWikipedia(
  idol: IdolConfig,
  options: CollectorOptions = {}
): Promise<CollectedData[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const results: CollectedData[] = [];

  console.log(`[wikipedia] Collecting for ${idol.name}...`);

  // 한국어 위키피디아
  if (idol.wikipediaKo) {
    const koData = await fetchWikipediaPage(idol.wikipediaKo, 'ko', idol);
    if (koData) {
      results.push(koData);
      console.log(`[wikipedia] ✓ Korean article: ${koData.content.length} chars`);
    }
    await delay(opts.delay!);
  }

  // 영어 위키피디아
  if (idol.wikipediaEn) {
    const enData = await fetchWikipediaPage(idol.wikipediaEn, 'en', idol);
    if (enData) {
      results.push(enData);
      console.log(`[wikipedia] ✓ English article: ${enData.content.length} chars`);
    }
  }

  // 결과 저장
  if (results.length > 0) {
    saveToFile(results, opts.outputDir!, idol.id);
  }

  return results;
}

async function fetchWikipediaPage(
  pageUrl: string,
  lang: 'ko' | 'en',
  idol: IdolConfig
): Promise<CollectedData | null> {
  try {
    // URL에서 페이지 타이틀 추출
    const titleMatch = pageUrl.match(/\/wiki\/(.+)$/);
    if (!titleMatch) return null;
    
    const pageTitle = decodeURIComponent(titleMatch[1]);
    
    // Wikipedia API 사용
    const apiUrl = `https://${lang}.wikipedia.org/w/api.php`;
    const params = new URLSearchParams({
      action: 'query',
      titles: pageTitle,
      prop: 'extracts|info',
      explaintext: '1', // 일반 텍스트로 추출
      exsectionformat: 'plain',
      inprop: 'url',
      format: 'json',
      origin: '*',
    });

    const response = await axios.get<WikiResponse>(`${apiUrl}?${params}`, {
      timeout: 15000,
      headers: {
        'User-Agent': 'MimChatBot/1.0 (https://mim.chat; contact@mim.chat) axios/1.x',
        'Accept': 'application/json',
      },
    });

    const pages = response.data.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0];
    if (!page || page.pageid === -1 || !page.extract) return null;

    return {
      idolId: idol.id,
      source: 'wikipedia',
      title: `${page.title} (${lang === 'ko' ? '한국어' : 'English'})`,
      content: cleanWikiText(page.extract),
      url: page.fullurl || pageUrl,
      collectedAt: new Date().toISOString(),
      metadata: {
        language: lang,
        pageId: page.pageid,
      },
    };

  } catch (error) {
    console.error(`[wikipedia] Error fetching ${lang}:`, error);
    return null;
  }
}

function cleanWikiText(text: string): string {
  return text
    .replace(/\n{3,}/g, '\n\n')
    .replace(/== 같이 보기 ==[\s\S]*$/m, '') // 끝부분 "같이 보기" 이후 제거
    .replace(/== See also ==[\s\S]*$/m, '')
    .replace(/== References ==[\s\S]*$/m, '')
    .replace(/== External links ==[\s\S]*$/m, '')
    .trim();
}

function saveToFile(data: CollectedData[], outputDir: string, idolId: string): void {
  const dir = join(process.cwd(), outputDir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  
  const filename = `${idolId}_${Date.now()}.json`;
  writeFileSync(join(dir, filename), JSON.stringify(data, null, 2));
}

export default collectWikipedia;
