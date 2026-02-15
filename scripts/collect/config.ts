import type { IdolConfig } from './types.js';

export const IDOLS: IdolConfig[] = [
  {
    id: 'wonyoung',
    name: '장원영',
    nameEn: 'Jang Won-young',
    searchTerms: ['장원영', 'IVE 원영', 'Wonyoung'],
    namuwikiUrl: 'https://namu.wiki/w/%EC%9E%A5%EC%9B%90%EC%98%81',
    wikipediaKo: 'https://ko.wikipedia.org/wiki/%EC%9E%A5%EC%9B%90%EC%98%81',
    wikipediaEn: 'https://en.wikipedia.org/wiki/Jang_Won-young',
    dcGalleryId: 'wonyoung',
    youtubeSearchTerms: ['장원영 인터뷰', 'IVE 원영', 'Wonyoung interview'],
  },
  {
    id: 'mingyu',
    name: '김민규',
    nameEn: 'Kim Min-gyu',
    searchTerms: ['김민규', 'SEVENTEEN 민규', 'Mingyu'],
    namuwikiUrl: 'https://namu.wiki/w/%EB%AF%BC%EA%B7%9C(SEVENTEEN)',
    wikipediaKo: 'https://ko.wikipedia.org/wiki/%EB%AF%BC%EA%B7%9C_(1997%EB%85%84)',
    wikipediaEn: 'https://en.wikipedia.org/wiki/Mingyu_(singer)',
    dcGalleryId: 'mingyu',
    youtubeSearchTerms: ['민규 인터뷰', 'SEVENTEEN 민규', 'Mingyu interview'],
  },
  {
    id: 'chaeyeon',
    name: '김채연',
    nameEn: 'Kim Chae-yeon',
    searchTerms: ['김채연', 'IZ*ONE 채연', 'Chaeyeon'],
    namuwikiUrl: 'https://namu.wiki/w/%EA%B9%80%EC%B1%84%EC%97%B0(2000)',
    wikipediaKo: 'https://ko.wikipedia.org/wiki/%EA%B9%80%EC%B1%84%EC%97%B0_(2000%EB%85%84)',
    wikipediaEn: 'https://en.wikipedia.org/wiki/Kim_Chae-yeon_(singer,_born_2000)',
    dcGalleryId: 'chaeyeon',
    youtubeSearchTerms: ['김채연 인터뷰', 'Chaeyeon interview'],
  },
  {
    id: 'rain',
    name: '비',
    nameEn: 'Rain',
    searchTerms: ['비 가수', 'Rain 정지훈', '정지훈'],
    namuwikiUrl: 'https://namu.wiki/w/%EB%B9%84(%EA%B0%80%EC%88%98)',
    wikipediaKo: 'https://ko.wikipedia.org/wiki/%EB%B9%84_(%EA%B0%80%EC%88%98)',
    wikipediaEn: 'https://en.wikipedia.org/wiki/Rain_(entertainer)',
    dcGalleryId: 'rain_entertainer',
    youtubeSearchTerms: ['비 인터뷰', 'Rain interview', '정지훈 인터뷰'],
  },
];

export function getIdol(id: string): IdolConfig | undefined {
  return IDOLS.find(idol => idol.id === id);
}

export function getAllIdols(): IdolConfig[] {
  return IDOLS;
}

// Rate limiting helper
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Common headers to avoid blocking
export const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
};
