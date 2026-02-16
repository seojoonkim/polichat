/**
 * Politician Identity Service
 * Tier 1: Core Identity - 항상 로드, 메모리 캐시
 */

import { createClient } from '@supabase/supabase-js';

export interface PoliticianIdentity {
  id: string;
  name_ko: string;
  name_en?: string;
  birth_date?: string;
  group_name?: string;
  personality_tags?: string[];
  speech_style?: SpeechStyle;
  updated_at?: string;
}

export interface SpeechStyle {
  self_reference?: string; // 자기 지칭 (예: "원녕이")
  sentence_endings?: string[]; // 말끝 습관
  abbreviations?: Record<string, string>; // 축약어
  emoticons?: string[]; // 자주 쓰는 이모티콘
  tone?: string; // 전체적인 톤
  keywords?: string[]; // 특유의 키워드
}

// 메모리 캐시 (서버 재시작 전까지 유지)
const identityCache = new Map<string, { data: PoliticianIdentity; cachedAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5분

/**
 * 정치인 코어 아이덴티티 로드 (캐시 우선)
 */
export async function getPoliticianIdentity(politicianId: string): Promise<PoliticianIdentity | null> {
  // 1. 캐시 확인
  const cached = identityCache.get(politicianId);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return cached.data;
  }

  // 2. Supabase에서 로드
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase credentials not found, returning null');
    return null;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from('idol_identity')
      .select('*')
      .eq('id', politicianId)
      .single();

    if (error || !data) {
      console.warn(`Identity not found for politician: ${politicianId}`);
      return null;
    }

    // 3. 캐시에 저장
    identityCache.set(politicianId, { data, cachedAt: Date.now() });
    return data;
  } catch (e) {
    console.error('getPoliticianIdentity error:', e);
    return null;
  }
}

/**
 * 캐시 무효화
 */
export function invalidateIdentityCache(politicianId?: string) {
  if (politicianId) {
    identityCache.delete(politicianId);
  } else {
    identityCache.clear();
  }
}

/**
 * 아이덴티티를 시스템 프롬프트용 텍스트로 변환
 */
export function identityToPrompt(identity: PoliticianIdentity): string {
  const lines: string[] = [];

  lines.push(`## 코어 아이덴티티`);
  lines.push(`- 이름: ${identity.name_ko}${identity.name_en ? ` (${identity.name_en})` : ''}`);
  
  if (identity.birth_date) {
    lines.push(`- 생년월일: ${identity.birth_date}`);
  }
  
  if (identity.group_name) {
    lines.push(`- 그룹: ${identity.group_name}`);
  }
  
  if (identity.personality_tags?.length) {
    lines.push(`- 성격 키워드: ${identity.personality_tags.join(', ')}`);
  }

  if (identity.speech_style) {
    const style = identity.speech_style;
    lines.push(`\n## 말투 규칙`);
    
    if (style.self_reference) {
      lines.push(`- 자기 지칭: "${style.self_reference}"`);
    }
    
    if (style.sentence_endings?.length) {
      lines.push(`- 말끝 습관: ${style.sentence_endings.join(', ')}`);
    }
    
    if (style.abbreviations) {
      const abbrevs = Object.entries(style.abbreviations)
        .map(([k, v]) => `${k}→${v}`)
        .join(', ');
      lines.push(`- 축약어: ${abbrevs}`);
    }
    
    if (style.emoticons?.length) {
      lines.push(`- 자주 쓰는 이모티콘: ${style.emoticons.join(' ')}`);
    }
    
    if (style.tone) {
      lines.push(`- 톤: ${style.tone}`);
    }
    
    if (style.keywords?.length) {
      lines.push(`- 특유의 표현: ${style.keywords.join(', ')}`);
    }
  }

  return lines.join('\n');
}

/**
 * 정치인 아이덴티티 저장/업데이트
 */
export async function savePoliticianIdentity(identity: PoliticianIdentity): Promise<boolean> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase credentials not found');
    return false;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error } = await supabase
      .from('idol_identity')
      .upsert(identity, { onConflict: 'id' });

    if (error) {
      console.error('savePoliticianIdentity error:', error);
      return false;
    }

    // 캐시 무효화
    invalidateIdentityCache(identity.id);
    return true;
  } catch (e) {
    console.error('savePoliticianIdentity error:', e);
    return false;
  }
}
