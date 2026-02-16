export interface PoliticianMeta {
  id: string;
  nameKo: string;
  nameEn: string;
  nameJa?: string;
  group: string;
  agencyId?: string;
  profileImageUrl: string;
  themeColor: string;
  themeColorSecondary: string;
  tagline: string;
  greeting?: string;
  firstVisitGreeting?: string;  // 첫 방문 인사 (플랫폼 소개 + 개성)
  language?: 'ko' | 'ja' | 'en' | 'hi';  // Default: 'ko', hi = Hindi (uses English)
  isBuiltIn: boolean;
  createdAt: number;
  updatedAt: number;
}

export const KNOWLEDGE_CATEGORIES = [
  'personality',
  'background',
  'speech-patterns',
  'topics',
  'policies',
  'boundaries',
  'relationships',
  'party-info',
] as const;

export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

export const KNOWLEDGE_LABELS: Record<KnowledgeCategory, string> = {
  personality: '성격/말투',
  background: '프로필/경력',
  'speech-patterns': '말버릇/표현',
  topics: '개인 관심사',
  policies: '정책/공약',
  boundaries: '대화 경계',
  relationships: '관계/호칭',
  'party-info': '정당 정보',
};

export interface PoliticianKnowledgeFile {
  politicianId: string;
  category: KnowledgeCategory;
  content: string;
  updatedAt: number;
}

export interface PoliticianBundle {
  meta: PoliticianMeta;
  knowledge: Record<KnowledgeCategory, string>;
  version: number;
}
