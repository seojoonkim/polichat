import { supabase, type SimilaritySearchResult } from './supabase';
import { createEmbedding } from './embeddings';

export interface RAGSearchOptions {
  idolId?: string;        // 특정 아이돌로 필터링
  category?: string;      // 특정 카테고리로 필터링
  topK?: number;          // 반환할 결과 수 (기본: 5)
  threshold?: number;     // 유사도 임계값 (기본: 0.7)
}

/**
 * 쿼리 기반 similarity search
 */
export async function searchKnowledge(
  query: string,
  options: RAGSearchOptions = {}
): Promise<SimilaritySearchResult[]> {
  if (!supabase) {
    console.warn('Supabase not configured, returning empty results');
    return [];
  }

  const { idolId, category, topK = 5, threshold = 0.7 } = options;

  // 쿼리 임베딩 생성
  const queryEmbedding = await createEmbedding(query);

  // RPC 함수 호출 (Supabase에서 similarity search)
  const { data, error } = await supabase.rpc('match_idol_knowledge', {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: topK,
    filter_idol_id: idolId || null,
    filter_category: category || null,
  });

  if (error) {
    console.error('RAG search error:', error);
    return [];
  }

  return data as SimilaritySearchResult[];
}

/**
 * RAG 컨텍스트를 시스템 프롬프트에 주입
 */
export function buildRAGContext(results: SimilaritySearchResult[]): string {
  if (results.length === 0) {
    return '';
  }

  const contextParts = results.map((r) => {
    const categoryLabel = getCategoryLabel(r.category);
    return `[${categoryLabel}] ${r.content}`;
  });

  return `\n\n---
## 🔍 관련 정보 (참고해서 자연스럽게 대화하세요)

${contextParts.join('\n\n')}

---
위 정보를 직접 인용하지 말고, 자연스럽게 대화에 녹여서 답변하세요.
`;
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    sns: 'SNS/소셜',
    interview: '인터뷰',
    lyrics: '가사/앨범',
    bubble: '버블/팬소통',
    profile: '프로필',
    relationship: '관계',
    general: '일반',
  };
  return labels[category] || category;
}

/**
 * 사용자 메시지에서 RAG 컨텍스트 가져오기 (통합 함수)
 */
export async function getRAGContext(
  userMessage: string,
  idolId: string
): Promise<string> {
  try {
    const results = await searchKnowledge(userMessage, {
      idolId,
      topK: 3,
      threshold: 0.75,
    });

    return buildRAGContext(results);
  } catch (error) {
    console.error('Failed to get RAG context:', error);
    return '';
  }
}
