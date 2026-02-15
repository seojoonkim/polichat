/**
 * DCinside 갤러리 크롤러
 * - 아이돌 갤러리 인기글 수집
 * - 본문 + 댓글 추출
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import type { IdolConfig, CollectedData, CollectorOptions } from './types.js';
import { COMMON_HEADERS, delay } from './config.js';

const DEFAULT_OPTIONS: CollectorOptions = {
  delay: 2000,
  maxItems: 30,
  outputDir: 'data/raw/dcinside',
};

interface DCPost {
  id: string;
  title: string;
  link: string;
  author: string;
  date: string;
  views: number;
  recommend: number;
}

export async function collectDcinside(
  idol: IdolConfig,
  options: CollectorOptions = {}
): Promise<CollectedData[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const results: CollectedData[] = [];

  if (!idol.dcGalleryId) {
    console.log(`[dcinside] No gallery ID configured for ${idol.name}`);
    return results;
  }

  console.log(`[dcinside] Collecting from gallery: ${idol.dcGalleryId}...`);

  try {
    // 인기글 목록 수집
    const posts = await getPopularPosts(idol.dcGalleryId, opts.maxItems!);
    console.log(`[dcinside] Found ${posts.length} popular posts`);

    for (const post of posts) {
      await delay(opts.delay!);
      
      try {
        const content = await getPostContent(post.link, idol.dcGalleryId);
        
        if (content && content.length > 50) {
          const data: CollectedData = {
            idolId: idol.id,
            source: 'dcinside',
            title: post.title,
            content: content,
            url: post.link,
            collectedAt: new Date().toISOString(),
            metadata: {
              postId: post.id,
              author: post.author,
              date: post.date,
              views: post.views,
              recommend: post.recommend,
              galleryId: idol.dcGalleryId,
            },
          };
          results.push(data);
        }
      } catch (err) {
        console.log(`[dcinside] Failed to fetch post: ${post.id}`);
      }
    }

    // 결과 저장
    if (results.length > 0) {
      saveToFile(results, opts.outputDir!, idol.id);
      console.log(`[dcinside] ✓ Collected ${results.length} posts for ${idol.name}`);
    }

  } catch (error) {
    console.error(`[dcinside] Error:`, error);
  }

  return results;
}

async function getPopularPosts(galleryId: string, limit: number): Promise<DCPost[]> {
  const posts: DCPost[] = [];
  
  // 마이너 갤러리 먼저 시도, 실패하면 일반 갤러리
  const urls = [
    `https://gall.dcinside.com/mgallery/board/lists?id=${galleryId}&sort_type=R`,
    `https://gall.dcinside.com/board/lists?id=${galleryId}&sort_type=R`,
  ];

  for (const baseUrl of urls) {
    try {
      const response = await axios.get(baseUrl, {
        headers: {
          ...COMMON_HEADERS,
          'Referer': 'https://gall.dcinside.com/',
        },
        timeout: 15000,
      });

      const $ = cheerio.load(response.data);
      
      // 게시글 목록 추출
      $('tr.ub-content').each((i, el) => {
        if (posts.length >= limit) return false;
        
        const $el = $(el);
        const $title = $el.find('.gall_tit a').first();
        const title = $title.text().trim();
        const href = $title.attr('href') || '';
        const postId = $el.find('.gall_num').text().trim();
        const author = $el.find('.gall_writer').text().trim();
        const date = $el.find('.gall_date').text().trim();
        const views = parseInt($el.find('.gall_count').text().trim()) || 0;
        const recommend = parseInt($el.find('.gall_recommend').text().trim()) || 0;
        
        if (title && postId && !isNaN(Number(postId))) {
          const link = href.startsWith('http') 
            ? href 
            : `https://gall.dcinside.com${href}`;
          
          posts.push({
            id: postId,
            title,
            link,
            author,
            date,
            views,
            recommend,
          });
        }
      });

      if (posts.length > 0) break; // 성공하면 중단
      
    } catch (error) {
      continue;
    }
  }

  return posts;
}

async function getPostContent(url: string, galleryId: string): Promise<string> {
  try {
    const response = await axios.get(url, {
      headers: {
        ...COMMON_HEADERS,
        'Referer': `https://gall.dcinside.com/mgallery/board/lists?id=${galleryId}`,
      },
      timeout: 15000,
    });

    const $ = cheerio.load(response.data);
    
    // 본문 추출
    const contentEl = $('.write_div, .writing_view_box').first();
    contentEl.find('script, style, .ad_wrap').remove();
    
    let content = contentEl.text().trim();
    
    // 댓글도 수집 (선택적)
    const comments: string[] = [];
    $('.reply_info, .cmt_txt').each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 5) {
        comments.push(text);
      }
    });
    
    if (comments.length > 0) {
      content += '\n\n[댓글]\n' + comments.slice(0, 20).join('\n');
    }

    return cleanText(content);
    
  } catch (error) {
    throw error;
  }
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/- dc official App/gi, '')
    .replace(/- dc App/gi, '')
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

export default collectDcinside;
