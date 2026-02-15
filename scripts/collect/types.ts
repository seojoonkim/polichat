// 셀럽 데이터 수집 공통 타입

export interface IdolConfig {
  id: string;
  name: string;
  nameEn: string;
  searchTerms: string[];
  namuwikiUrl?: string;
  wikipediaKo?: string;
  wikipediaEn?: string;
  dcGalleryId?: string;
  youtubeSearchTerms?: string[];
}

export interface CollectedData {
  idolId: string;
  source: 'namuwiki' | 'news' | 'dcinside' | 'wikipedia' | 'youtube' | 'instagram';
  title: string;
  content: string;
  url: string;
  collectedAt: string;
  metadata?: Record<string, unknown>;
}

export interface ChunkedData {
  idolId: string;
  source: string;
  chunkIndex: number;
  content: string;
  embedding?: number[];
  metadata: {
    originalUrl: string;
    title: string;
  };
}

export interface CollectorOptions {
  delay?: number; // ms between requests
  maxItems?: number;
  outputDir?: string;
}
