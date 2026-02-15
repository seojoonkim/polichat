/**
 * 유튜브 자막 수집기
 * - 인터뷰/콘텐츠 검색
 * - 자막 추출 (자동 생성 포함)
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import type { IdolConfig, CollectedData, CollectorOptions } from './types.js';
import { COMMON_HEADERS, delay } from './config.js';

const DEFAULT_OPTIONS: CollectorOptions = {
  delay: 2000,
  maxItems: 10,
  outputDir: 'data/raw/youtube',
};

interface YouTubeVideo {
  videoId: string;
  title: string;
  channel: string;
  duration?: string;
}

export async function collectYoutube(
  idol: IdolConfig,
  options: CollectorOptions = {}
): Promise<CollectedData[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const results: CollectedData[] = [];

  const searchTerms = idol.youtubeSearchTerms || [`${idol.name} 인터뷰`];
  
  console.log(`[youtube] Collecting videos for ${idol.name}...`);

  for (const term of searchTerms.slice(0, 2)) {
    try {
      const videos = await searchYouTube(term, Math.ceil(opts.maxItems! / 2));
      console.log(`[youtube] Found ${videos.length} videos for "${term}"`);

      for (const video of videos) {
        await delay(opts.delay!);
        
        try {
          const transcript = await getTranscript(video.videoId);
          
          if (transcript && transcript.length > 100) {
            const data: CollectedData = {
              idolId: idol.id,
              source: 'youtube',
              title: video.title,
              content: transcript,
              url: `https://www.youtube.com/watch?v=${video.videoId}`,
              collectedAt: new Date().toISOString(),
              metadata: {
                videoId: video.videoId,
                channel: video.channel,
                searchTerm: term,
                transcriptLength: transcript.length,
              },
            };
            results.push(data);
            console.log(`[youtube] ✓ Got transcript for: ${video.title.substring(0, 40)}...`);
          }
        } catch (err) {
          // 자막 없는 영상은 스킵
          console.log(`[youtube] No transcript: ${video.videoId}`);
        }
      }
      
    } catch (error) {
      console.error(`[youtube] Search error for "${term}":`, error);
    }
  }

  // 결과 저장
  if (results.length > 0) {
    saveToFile(results, opts.outputDir!, idol.id);
    console.log(`[youtube] ✓ Total ${results.length} transcripts collected for ${idol.name}`);
  }

  return results;
}

async function searchYouTube(query: string, limit: number): Promise<YouTubeVideo[]> {
  const videos: YouTubeVideo[] = [];
  
  try {
    // YouTube 검색 페이지 스크래핑 (API 없이)
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    
    const response = await axios.get(searchUrl, {
      headers: {
        ...COMMON_HEADERS,
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      timeout: 15000,
    });

    // ytInitialData에서 비디오 정보 추출
    const html = response.data;
    const dataMatch = html.match(/var ytInitialData = ({.+?});/s);
    
    if (dataMatch) {
      const data = JSON.parse(dataMatch[1]);
      const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
        ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
      
      for (const item of contents) {
        if (videos.length >= limit) break;
        
        const videoRenderer = item.videoRenderer;
        if (videoRenderer) {
          videos.push({
            videoId: videoRenderer.videoId,
            title: videoRenderer.title?.runs?.[0]?.text || '',
            channel: videoRenderer.ownerText?.runs?.[0]?.text || '',
            duration: videoRenderer.lengthText?.simpleText,
          });
        }
      }
    }
    
  } catch (error) {
    console.error('[youtube] Search parsing error:', error);
  }

  return videos;
}

async function getTranscript(videoId: string): Promise<string> {
  try {
    // 방법 1: youtube-transcript 스타일 (직접 구현)
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    const response = await axios.get(watchUrl, {
      headers: COMMON_HEADERS,
      timeout: 15000,
    });

    const html = response.data;
    
    // captionTracks에서 자막 URL 추출
    const captionMatch = html.match(/"captionTracks":\[({.+?})\]/);
    if (!captionMatch) {
      throw new Error('No captions available');
    }

    const captionData = JSON.parse(`[${captionMatch[1]}]`);
    const captionTrack = captionData.find((t: any) => 
      t.languageCode === 'ko' || t.languageCode === 'ko-KR'
    ) || captionData[0];

    if (!captionTrack?.baseUrl) {
      throw new Error('No caption URL');
    }

    // 자막 XML 가져오기
    const captionResponse = await axios.get(captionTrack.baseUrl, {
      timeout: 10000,
    });

    const $ = cheerio.load(captionResponse.data, { xmlMode: true });
    const texts: string[] = [];
    
    $('text').each((_, el) => {
      const text = $(el).text().trim();
      if (text) {
        texts.push(decodeHtmlEntities(text));
      }
    });

    return texts.join(' ').replace(/\s+/g, ' ').trim();
    
  } catch (error) {
    throw error;
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function saveToFile(data: CollectedData[], outputDir: string, idolId: string): void {
  const dir = join(process.cwd(), outputDir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  
  const filename = `${idolId}_${Date.now()}.json`;
  writeFileSync(join(dir, filename), JSON.stringify(data, null, 2));
}

export default collectYoutube;
