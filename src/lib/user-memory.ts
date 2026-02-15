/**
 * User Memory Service
 * 유저별 기억 시스템 - 아이돌이 팬을 기억하는 것처럼
 */

import { createClient } from '@supabase/supabase-js';

export interface UserMemory {
  id?: number;
  user_id: string;
  idol_id: string;
  name?: string; // 유저가 알려준 이름
  birthday?: string; // 유저 생일 (YYYY-MM-DD)
  honorific?: string; // 호칭
  facts: Record<string, unknown>; // 기타 사실들
  first_chat_at?: string;
  total_messages: number;
  affinity_score: number; // 0.0 ~ 1.0
}

export interface ConversationMemory {
  id?: number;
  user_id: string;
  idol_id: string;
  memory_type: 'preference' | 'event' | 'topic' | 'emotion' | 'personal' | 'other';
  content: string;
  importance: number; // 0.0 ~ 1.0
  embedding?: number[];
}

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey);
}

/**
 * 유저 기억 로드
 */
export async function getUserMemory(
  userId: string,
  idolId: string
): Promise<UserMemory | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('user_memory')
      .select('*')
      .eq('user_id', userId)
      .eq('idol_id', idolId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      console.error('getUserMemory error:', error);
      return null;
    }

    return data || null;
  } catch (e) {
    console.error('getUserMemory error:', e);
    return null;
  }
}

/**
 * 유저 기억 저장/업데이트
 */
export async function saveUserMemory(
  userId: string,
  idolId: string,
  updates: Partial<UserMemory>
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    const { error } = await supabase.from('user_memory').upsert(
      {
        user_id: userId,
        idol_id: idolId,
        ...updates,
        facts: updates.facts || {},
      },
      { onConflict: 'user_id,idol_id' }
    );

    if (error) {
      console.error('saveUserMemory error:', error);
      return false;
    }

    return true;
  } catch (e) {
    console.error('saveUserMemory error:', e);
    return false;
  }
}

/**
 * 메시지 카운트 증가
 */
export async function incrementMessageCount(
  userId: string,
  idolId: string
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    // 기존 메모리 가져오기
    const existing = await getUserMemory(userId, idolId);

    if (existing) {
      await supabase
        .from('user_memory')
        .update({ total_messages: existing.total_messages + 1 })
        .eq('user_id', userId)
        .eq('idol_id', idolId);
    } else {
      // 새 유저 - 첫 대화
      await saveUserMemory(userId, idolId, {
        total_messages: 1,
        affinity_score: 0.5,
        facts: {},
      });
    }
  } catch (e) {
    console.error('incrementMessageCount error:', e);
  }
}

/**
 * 대화에서 기억 추출 (OpenAI 활용)
 * 중요한 정보를 자동으로 추출하여 저장
 */
export async function extractMemoriesFromConversation(
  userId: string,
  idolId: string,
  userMessage: string,
  assistantResponse: string
): Promise<ConversationMemory[]> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return [];

  try {
    const prompt = `다음 대화에서 팬에 대해 기억할 만한 정보를 추출하세요.
중요한 정보만 추출하고, 일상적인 인사나 일반적인 대화는 무시하세요.

유저 메시지: "${userMessage}"
아이돌 응답: "${assistantResponse}"

추출할 정보 유형:
- preference: 좋아하는 것, 싫어하는 것
- event: 중요한 이벤트 (생일, 기념일, 콘서트 참석 등)
- personal: 개인 정보 (이름, 나이, 직업, 거주지 등)
- topic: 관심 주제
- emotion: 현재 감정 상태

JSON 배열로 응답하세요. 추출할 정보가 없으면 빈 배열 []을 반환하세요.
형식: [{"type": "preference", "content": "딸기케이크를 좋아함", "importance": 0.7}]`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!res.ok) return [];

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '[]';

    // JSON 파싱
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const extracted = JSON.parse(jsonMatch[0]) as Array<{
      type: string;
      content: string;
      importance: number;
    }>;

    // 유효한 기억만 필터링
    const memories: ConversationMemory[] = extracted
      .filter((m) => m.type && m.content && m.importance >= 0.5)
      .map((m) => ({
        user_id: userId,
        idol_id: idolId,
        memory_type: m.type as ConversationMemory['memory_type'],
        content: m.content,
        importance: m.importance,
      }));

    // 중요한 기억이 있으면 저장
    if (memories.length > 0) {
      await saveConversationMemories(memories);
    }

    return memories;
  } catch (e) {
    console.error('extractMemoriesFromConversation error:', e);
    return [];
  }
}

/**
 * 대화 기억 저장
 */
async function saveConversationMemories(
  memories: ConversationMemory[]
): Promise<void> {
  const supabase = getSupabase();
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!supabase || !openaiKey) return;

  try {
    // 임베딩 생성
    const contents = memories.map((m) => m.content);
    const embeddingRes = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: contents,
      }),
    });

    if (!embeddingRes.ok) return;

    const embeddingData = await embeddingRes.json();
    const embeddings = embeddingData.data.map(
      (d: { embedding: number[] }) => d.embedding
    );

    // 기억 저장
    const memoriesWithEmbedding = memories.map((m, i) => ({
      ...m,
      embedding: embeddings[i],
    }));

    await supabase.from('conversation_memory').insert(memoriesWithEmbedding);
  } catch (e) {
    console.error('saveConversationMemories error:', e);
  }
}

/**
 * 관련 대화 기억 검색
 */
export async function getRelevantMemories(
  userId: string,
  idolId: string,
  query: string,
  limit = 3
): Promise<ConversationMemory[]> {
  const supabase = getSupabase();
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!supabase || !openaiKey) return [];

  try {
    // 쿼리 임베딩
    const embeddingRes = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: query,
      }),
    });

    if (!embeddingRes.ok) return [];

    const embeddingData = await embeddingRes.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    // 유사도 검색
    const { data, error } = await supabase.rpc('match_conversation_memory', {
      query_embedding: queryEmbedding,
      filter_user_id: userId,
      filter_idol_id: idolId,
      match_threshold: 0.6,
      match_count: limit,
    });

    if (error) {
      console.error('getRelevantMemories error:', error);
      return [];
    }

    return data || [];
  } catch (e) {
    console.error('getRelevantMemories error:', e);
    return [];
  }
}

/**
 * 유저 메모리를 프롬프트 텍스트로 변환
 */
export function userMemoryToPrompt(
  memory: UserMemory | null,
  recentMemories: ConversationMemory[] = []
): string {
  if (!memory && recentMemories.length === 0) {
    return '';
  }

  const lines: string[] = [];
  lines.push('\n\n---\n## 👤 이 팬에 대한 기억\n');

  if (memory) {
    if (memory.name) {
      lines.push(`- 이름: ${memory.name}`);
    }
    if (memory.birthday) {
      lines.push(`- 생일: ${memory.birthday}`);
    }
    if (memory.honorific) {
      lines.push(`- 호칭: ${memory.honorific}`);
    }
    if (memory.total_messages > 0) {
      const relationship =
        memory.total_messages < 5
          ? '새로운 팬'
          : memory.total_messages < 20
          ? '가끔 대화하는 팬'
          : '자주 대화하는 친한 팬';
      lines.push(`- 관계: ${relationship} (${memory.total_messages}회 대화)`);
    }

    // 기타 사실들
    const facts = memory.facts || {};
    const factEntries = Object.entries(facts);
    if (factEntries.length > 0) {
      lines.push('- 알고 있는 것들:');
      factEntries.forEach(([key, value]) => {
        lines.push(`  - ${key}: ${value}`);
      });
    }
  }

  // 관련 대화 기억
  if (recentMemories.length > 0) {
    lines.push('\n### 관련 기억');
    recentMemories.forEach((m) => {
      lines.push(`- [${m.memory_type}] ${m.content}`);
    });
  }

  lines.push(
    '\n---\n위 정보를 자연스럽게 활용해서 팬을 기억하고 있는 것처럼 대화하세요.'
  );

  return lines.join('\n');
}
