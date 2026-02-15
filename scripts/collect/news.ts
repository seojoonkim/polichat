/**
 * 네이버 뉴스 크롤러
 * - 검색어 기반 최근 뉴스 수집
 * - 뉴스 본문 추출
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import type { IdolConfig, CollectedData, CollectorOptions } from './types.js';
import { COMMON_HEADERS, delay } from './config.js';

const DEFAULT_OPTIONS: CollectorOptions = {
  delay: 1500,
  maxItems: 20,
  outputDir: 'data/raw/news',
};

interface NewsItem {
  title: string;
  link: string;
  description: string;
  pubDate?: string;
}

export async function collectNews(
  idol: IdolConfig,
  options: CollectorOptions = {}
): Promise<CollectedData[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const results: CollectedData[] = [];

  console.log(`[news] Collecting news for ${idol.name}...`);

  for (const term of idol.searchTerms.slice(0, 2)) {
    try {
      const newsItems = await searchNaverNews(term, opts.maxItems!);
      
      for (const item of newsItems) {
        await delay(opts.delay!);
        
        try {
          const content = await fetchNewsContent(item.link);
          
          if (content && content.length > 100) {
            const data: CollectedData = {
              idolId: idol.id,
              source: 'news',
              title: cleanHtml(item.title),
              content: content,
              url: item.link,
              collectedAt: new Date().toISOString(),
              metadata: {
                searchTerm: term,
                description: cleanHtml(item.description),
                pubDate: item.pubDate,
              },
            };
            results.push(data);
          }
        } catch (err) {
          console.log(`[news] Failed to fetch: ${item.link}`);
        }
      }
      
      console.log(`[news] ✓ Found ${newsItems.length} articles for "${term}"`);
      
    } catch (error) {
      console.error(`[news] Error searching "${term}":`, error);
    }
  }

  // 결과 저장
  if (results.length > 0) {
    saveToFile(results, opts.outputDir!, idol.id);
    console.log(`[news] ✓ Total ${results.length} articles collected for ${idol.name}`);
  }

  return results;
}

async function searchNaverNews(query: string, limit: number): Promise<NewsItem[]> {
  const items: NewsItem[] = [];
  const encodedQuery = encodeURIComponent(query);
  
  // 네이버 뉴스 검색 페이지
  const searchUrl = `https://search.naver.com/search.naver?where=news&query=${encodedQuery}&sm=tab_opt&sort=1`;
  
  try {
    const response = await axios.get(searchUrl, {
      headers: COMMON_HEADERS,
      timeout: 15000,
    });

    const $ = cheerio.load(response.data);
    
    // 뉴스 아이템 추출
    $('.news_wrap, .bx').each((i, el) => {
      if (i >= limit) return false;
      
      const $el = $(el);
      const titleEl = $el.find('.news_tit, a.news_tit').first();
      const title = titleEl.text().trim() || titleEl.attr('title') || '';
      const link = titleEl.attr('href') || '';
      const desc = $el.find('.news_dsc, .dsc_wrap').text().trim();
      
      if (title && link && link.startsWith('http')) {
        items.push({
          title,
          link,
          description: desc,
        });
      }
    });
    
  } catch (error) {
    console.error('[news] Search error:', error);
  }

  return items;
}

async function fetchNewsContent(url: string): Promise<string> {
  try {
    const response = await axios.get(url, {
      headers: COMMON_HEADERS,
      timeout: 10000,
      maxRedirects: 3,
    });

    const $ = cheerio.load(response.data);
    
    // 일반적인 뉴스 본문 셀렉터
    const selectors = [
      '#articleBodyContents',
      '#articeBody',
      '.article_body',
      '.news_body',
      '#newsct_article',
      '.article-body',
      '[itemprop="articleBody"]',
      '.content_text',
      '#content',
      'article',
    ];

    for (const selector of selectors) {
      const content = $(selector).first();
      if (content.length) {
        // 불필요한 요소 제거
        content.find('script, style, .ad, .advertisement, .related').remove();
        const text = content.text().trim();
        if (text.length > 100) {
          return cleanText(text);
        }
      }
    }

    // fallback: 본문 전체에서 긴 텍스트 추출
    const bodyText = $('body').text().trim();
    return cleanText(bodyText).substring(0, 5000);
    
  } catch (error) {
    throw error;
  }
}

function cleanHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n{2,}/g, '\n')
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

export default collectNews;
