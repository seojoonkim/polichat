import { createClient } from '@supabase/supabase-js';

export const config = {
  supportsResponseStreaming: true,
  maxDuration: 60,
};

// 아이돌 아이덴티티 캐시
const identityCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5분

const EMOTION_PATTERNS = {
  angry: ['화가', '분노', '어이없', '기가 막', '말이 됩니까', '선 넘'],
  happy: ['감사', '기쁘', '다행', '좋습니다', '물론이죠'],
  defensive: ['억울', '오해', '왜곡', '사실이 아닙니다', '근거 없'],
};

const TRIGGER_KEYWORDS = {
  '이재명': ['대장동', '성남FC', '쌍방울', '변호사비'],
  '전한길': ['현상금', '강간', '건국펀드', '공금횡령'],
  '정청래': ['막말', '종북', '조폭', '입틀막'],
  '장동혁': ['절윤', '尹어게인', '다주택', '6채'],
  '이준석': ['성상납', '당원명부', '케이크', '내부총질'],
  '한동훈': ['김건희', '채상병', '명품백', '검사독재'],
  '홍준표': ['달빛동맹', '친윤배신', '여론조작'],
  '오세훈': ['내곡동', 'BBK', '논문표절'],
  'generic': ['거짓말', '사기꾼', '쓰레기', '역적'],
  'leejunseok': ['성상납', '당원명부', '케이크', '내부총질'],
  'ohsehoon': ['내곡동', 'BBK', '논문표절'],
  'jungcr': ['막말', '종북', '조폭', '입틀막'],
  'jangdh': ['절윤', '尹어게인', '다주택', '6채'],
  'jeonhangil': ['현상금', '강간', '건국펀드', '공금횡령'],
  'kimeoojun': ['사실이 아닙니다'],
  'jinjungkwon': ['거짓말', '사기꾼'],
  'handoonghoon': ['김건희', '채상병', '명품백', '검사독재'],
  'hongjunpyo': ['달빛동맹', '친윤배신', '여론조작'],
};

function detectEmotion(text) {
  const normalized = text.replace(/\s+/g, ' ');
  if (EMOTION_PATTERNS.angry.some((word) => normalized.includes(word))) return 'angry';
  if (EMOTION_PATTERNS.happy.some((word) => normalized.includes(word))) return 'happy';
  if (EMOTION_PATTERNS.defensive.some((word) => normalized.includes(word))) return 'defensive';
  return 'neutral';
}

function hasAnyKeyword(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function isTriggeredPolitician(text, idolId, identity) {
  const fullText = text || '';
  const id = idolId || '';
  const normalizedId = id.toLowerCase();
  const name = identity?.name_ko || '';
  const normalizedName = name.replace(/\s+/g, '');

  const detectedKeywords = new Set();

  for (const [key, keywords] of Object.entries(TRIGGER_KEYWORDS)) {
    if (key === 'generic') continue;
    const normalizedKey = key.replace(/\s+/g, '');
    const keyLower = normalizedKey.toLowerCase();
    if (
      (id && id.includes(key)) ||
      (normalizedId && normalizedId.includes(keyLower)) ||
      (name && name.includes(normalizedKey)) ||
      (name && normalizedName.includes(normalizedKey))
    ) {
      for (const keyword of keywords) {
        detectedKeywords.add(keyword);
      }
    }
  }

  return (
    Array.from(detectedKeywords).some((keyword) => hasAnyKeyword(fullText, [keyword])) ||
    hasAnyKeyword(fullText, TRIGGER_KEYWORDS.generic)
  );
}

// Tier 1: 아이돌 코어 아이덴티티 로드
async function getIdolIdentity(idolId, supabase) {
  console.log(`[identity] Loading identity for idol: ${idolId}`);
  
  if (!supabase) {
    console.error('[identity] ERROR: Supabase client is null');
    return null;
  }
  
  // 캐시 확인
  const cached = identityCache.get(idolId);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    console.log(`[identity] Cache hit for ${idolId}`);
    return cached.data;
  }

  try {
    console.log(`[identity] Querying idol_identity table for id=${idolId}`);
    const { data, error } = await supabase
      .from('idol_identity')
      .select('*')
      .eq('id', idolId)
      .single();

    if (error) {
      console.error(`[identity] Supabase error:`, JSON.stringify(error));
      return null;
    }
    
    if (!data) {
      console.error(`[identity] No data found for idol: ${idolId}`);
      return null;
    }
    
    console.log(`[identity] Loaded identity: ${data.name_ko || data.id}`);
    identityCache.set(idolId, { data, cachedAt: Date.now() });
    return data;
  } catch (e) {
    console.error('[identity] Exception:', e);
  }
  return null;
}

// 유저 메모리 로드
async function getUserMemory(userId, idolId, supabase) {
  try {
    const { data, error } = await supabase
      .from('user_memory')
      .select('*')
      .eq('user_id', userId)
      .eq('idol_id', idolId)
      .single();

    if (!error && data) {
      return data;
    }
  } catch (e) {
    // 새 유저면 에러가 발생할 수 있음
  }
  return null;
}

// 유저 메시지 카운트 증가
async function incrementMessageCount(userId, idolId, supabase) {
  try {
    const existing = await getUserMemory(userId, idolId, supabase);
    
    if (existing) {
      await supabase
        .from('user_memory')
        .update({ total_messages: existing.total_messages + 1 })
        .eq('user_id', userId)
        .eq('idol_id', idolId);
    } else {
      await supabase.from('user_memory').insert({
        user_id: userId,
        idol_id: idolId,
        total_messages: 1,
        affinity_score: 0.5,
        facts: {},
      });
    }
  } catch (e) {
    console.error('incrementMessageCount error:', e);
  }
}

// 관련 대화 기억 검색
async function getRelevantMemories(userId, idolId, query, openaiKey, supabase) {
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

    const { data, error } = await supabase.rpc('match_conversation_memory', {
      query_embedding: queryEmbedding,
      filter_user_id: userId,
      filter_idol_id: idolId,
      match_threshold: 0.6,
      match_count: 3,
    });

    if (error) return [];
    return data || [];
  } catch (e) {
    return [];
  }
}

// ============================================================
// 의도 분류 시스템 (키워드 기반, 비용 제로)
// ============================================================

const INTENT_KEYWORDS = {
  policy: [
    '공약', '정책', '예산', '법안', '세금', '복지', '교육', '경제',
    '의료', '부동산', '연금', '국방', '외교', '환경', '노동', '규제',
    '개혁', '입법', '의안', '안건', '찬성', '반대', '투표',
  ],
  issue: [
    '최근', '요즘', '뉴스', '오늘', '어제', '이번주', '논란',
    '사건', '속보', '화제', '이슈', '발표', '기자회견',
  ],
};

function classifyIntent(message) {
  const lower = message.toLowerCase();
  
  const policyScore = INTENT_KEYWORDS.policy.filter(kw => lower.includes(kw)).length;
  const issueScore = INTENT_KEYWORDS.issue.filter(kw => lower.includes(kw)).length;

  if (policyScore >= 1) return 'policy';
  if (issueScore >= 1) return 'issue';
  return 'casual';
}

// 의도별 프롬프트 접두사
function getIntentPromptPrefix(intent, speechContext) {
  switch (intent) {
    case 'policy':
      return `\n\n## 🏛️ 정책 관련 질문입니다
아래 실제 발언/회의록을 참고하여 구체적이고 상세하게 답변하세요.
정책 내용, 배경, 기대효과를 포함하세요.
${speechContext}`;
    case 'issue':
      return `\n\n## 📰 최근 이슈 관련 질문입니다
아래 최근 발언을 참고하여 시의성 있게 답변하세요.
${speechContext}`;
    case 'casual':
    default:
      return speechContext ? `\n\n## 💬 참고 정보\n${speechContext}` : '';
  }
}

// ============================================================
// RAG: 기존 idol_knowledge + 새 politician_speeches 통합 검색
// ============================================================

async function getRAGContext(query, idolId, supabase, openaiKey) {
  if (!supabase || !openaiKey) {
    return '';
  }

  try {
    // 1. 쿼리 임베딩 생성
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

    if (!embeddingRes.ok) return '';

    const embeddingData = await embeddingRes.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    // 2. 병렬로 두 테이블 검색
    const [knowledgeResult, speechResult] = await Promise.all([
      // 기존 idol_knowledge
      supabase.rpc('match_idol_knowledge', {
        query_embedding: queryEmbedding,
        match_threshold: 0.7,
        match_count: 3,
        filter_idol_id: idolId || null,
        filter_category: null,
      }),
      // 새 politician_speeches
      supabase.rpc('match_politician_speeches', {
        query_embedding: queryEmbedding,
        filter_politician_id: idolId || null,
        filter_source: null,
        match_threshold: 0.65,
        match_count: 5,
      }).catch(() => ({ data: null, error: true })), // 테이블 없으면 graceful fail
    ]);

    // 3. 기존 knowledge 컨텍스트
    const categoryLabels = {
      sns: 'SNS/소셜',
      interview: '인터뷰',
      lyrics: '가사/앨범',
      bubble: '버블/팬소통',
      profile: '프로필',
      relationship: '관계',
      general: '일반',
    };

    let contextParts = [];

    if (knowledgeResult.data?.length > 0) {
      contextParts.push(...knowledgeResult.data.map((r) => {
        const label = categoryLabels[r.category] || r.category;
        return `[${label}] ${r.content}`;
      }));
    }

    // 4. 의도 분류 + 발언 데이터 컨텍스트
    const intent = classifyIntent(query);
    let speechContext = '';

    if (speechResult.data?.length > 0) {
      const speechParts = speechResult.data.map((r) => {
        const meta = r.metadata || {};
        const dateStr = meta.date ? ` (${meta.date})` : '';
        const meetingStr = meta.meeting ? ` [${meta.meeting}]` : '';
        return `[발언${dateStr}${meetingStr}] ${r.content}`;
      });
      speechContext = speechParts.join('\n\n');
    }

    // 5. 의도별 프롬프트 조합
    const intentPrefix = getIntentPromptPrefix(intent, speechContext);

    // 기존 knowledge context
    let knowledgeContext = '';
    if (contextParts.length > 0) {
      knowledgeContext = `\n\n---\n## 🔍 관련 정보 (참고해서 자연스럽게 대화하세요)\n\n${contextParts.join('\n\n')}\n\n---\n위 정보를 직접 인용하지 말고, 자연스럽게 대화에 녹여서 답변하세요.`;
    }

    return knowledgeContext + intentPrefix;
  } catch (e) {
    console.error('RAG error:', e);
    return '';
  }
}

// 아이덴티티를 프롬프트 텍스트로 변환
function identityToPrompt(identity) {
  if (!identity) return '';
  
  const lines = [];
  lines.push(`\n\n---\n## 🎭 코어 아이덴티티`);
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
    lines.push(`\n### 말투 규칙`);
    if (style.self_reference) {
      lines.push(`- 자기 지칭: "${style.self_reference}"`);
    }
    if (style.sentence_endings?.length) {
      lines.push(`- 말끝 습관: ${style.sentence_endings.join(', ')}`);
    }
    if (style.emoticons?.length) {
      lines.push(`- 이모티콘: ${style.emoticons.join(' ')}`);
    }
    if (style.tone) {
      lines.push(`- 톤: ${style.tone}`);
    }
  }
  
  return lines.join('\n');
}

// Eval 프롬프트 (나코 화이트리스트 포함)
const EVAL_PROMPT = `あなたは日本語ネイティブ水準の品質評価者です。以下のアイドルチャット応答を5つの軸で採点してください。

## 【重要】ペルソナ固有表現ホワイトリスト
以下は標準日本語としては非典型だが、矢吹奈子本人がラジオ等で実際に使用する固有表現。減点対象外：
- 「成長期のお坊さん」「反省はしてないんですけど正直に」「出き」「野の時期」
- 文末「みたいな」多用、「～んですけど」連鎖、「じゃないですか？」多用
- 「なんか」「めっちゃ」「本当に」頻用、「で、」「でね」連結

## 評価軸 (各1-5点、合計25点満点)
1. 語彙の正確性 - 存在しない慣用句チェック (ホワイトリスト除外)
2. 文法の自然さ - 語順、助詞、敬語切替 (ホワイトリスト除外)
3. 文体の一貫性 - www/笑混在チェック、絵文字一貫性
4. ペルソナ適合性 - アイドル距離感、一人称安定
5. 構造の完結性 - 文中断なし、完結した流れ

## 出力 (JSON only)
{"lexical_accuracy":{"score":0,"issues":[]},"grammatical_naturalness":{"score":0,"issues":[]},"stylistic_consistency":{"score":0,"issues":[]},"persona_fidelity":{"score":0,"issues":[]},"structural_completeness":{"score":0,"issues":[]},"total":0,"grade":"A|B|C|D|F","corrections":[]}

グレード: A(23-25) B(18-22) C(13-17) D(8-12) F(5-7)`;

// 비동기 eval 실행 (인라인, 응답 latency에 영향 없게)
async function triggerEval(responseText, idolId, userId, modelUsed, stopReason, supabase, apiKey) {
  try {
    // Claude Haiku로 eval
    const evalResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: `以下のアイドルチャット応答を評価:\n\n${responseText}` }],
        system: EVAL_PROMPT,
      }),
    });

    if (!evalResponse.ok) {
      console.error('Eval API error:', evalResponse.status);
      return;
    }

    const evalData = await evalResponse.json();
    let evalText = evalData.content?.[0]?.text || '';
    
    // JSON 파싱 (마크다운 제거)
    if (evalText.startsWith('```')) evalText = evalText.replace(/```json?\n?/g, '').replace(/```$/g, '');
    
    let evalResult;
    try {
      evalResult = JSON.parse(evalText.trim());
    } catch {
      console.error('Eval JSON parse error');
      return;
    }

    const total = evalResult.total || 0;
    const grade = evalResult.grade || (total >= 23 ? 'A' : total >= 18 ? 'B' : total >= 13 ? 'C' : total >= 8 ? 'D' : 'F');
    const flagged = total <= 17;

    // Supabase 저장 (테이블 없으면 에러 무시)
    if (supabase) {
      supabase.from('eval_logs').insert({
        idol_id: idolId || 'unknown',
        user_id: userId || null,
        response_text: responseText,
        eval_result: evalResult,
        total_score: total,
        grade,
        flagged,
        model_used: modelUsed || null,
        stop_reason: stopReason || null,
      }).then(() => {
        console.log(`Eval logged: ${grade} (${total}pts)${flagged ? ' [FLAGGED]' : ''}`);
      }).catch(() => {
        // 테이블 없으면 무시
        console.log(`Eval result: ${grade} (${total}pts) - DB skip`);
      });
    } else {
      console.log(`Eval result: ${grade} (${total}pts) - no DB`);
    }
  } catch (e) {
    console.error('Eval error (ignored):', e);
  }
}

// 유저 메모리를 프롬프트 텍스트로 변환
function userMemoryToPrompt(memory, recentMemories = []) {
  if (!memory && recentMemories.length === 0) {
    return '';
  }

  const lines = [];
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

    const facts = memory.facts || {};
    const factEntries = Object.entries(facts);
    if (factEntries.length > 0) {
      lines.push('- 알고 있는 것들:');
      factEntries.forEach(([key, value]) => {
        lines.push(`  - ${key}: ${value}`);
      });
    }
  }

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // === Anthropic API 사용 ===
  const anthropicApiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
  if (!anthropicApiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const { system, messages, model, max_tokens, idolId, userId } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Supabase 클라이언트
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

  try {
    // 마지막 사용자 메시지
    const lastUserMessage = messages.filter((m) => m.role === 'user').pop();
    const userQuery = lastUserMessage?.content || '';

    // 병렬로 컨텍스트 로드
    const [identity, userMemory, ragContext, relevantMemories] = await Promise.all([
      // Tier 1: 아이돌 아이덴티티
      idolId && supabase ? getIdolIdentity(idolId, supabase) : null,
      // 유저 메모리
      userId && idolId && supabase ? getUserMemory(userId, idolId, supabase) : null,
      // Tier 2: RAG 컨텍스트
      getRAGContext(userQuery, idolId, supabase, openaiKey),
      // 관련 대화 기억
      userId && idolId && supabase && openaiKey 
        ? getRelevantMemories(userId, idolId, userQuery, openaiKey, supabase) 
        : [],
    ]);

    // 기본 시스템 프롬프트 (클라이언트에서 안 보내면 사용)
    const DEFAULT_SYSTEM = `あなたはアイドルとしてファンと1:1チャットをしています。
キャラクターを維持し、親しみやすく自然に会話してください。
絶対にAIであることを明かさないでください。
返答は短く、カジュアルに。1-2文が基本です。`;

    // 시스템 프롬프트 조합
    let enhancedSystem = system || DEFAULT_SYSTEM;
    const triggerEmotionPrompt = isTriggeredPolitician(userQuery, idolId, identity)
      ? '[발끈 모드 활성화] 방금 발언은 당신의 가장 민감한 약점을 건드렸습니다. 평소보다 훨씬 격앙되고 방어적으로 반응하세요. 감정이 표면에 드러나도 됩니다. 단, 욕설은 하지 말고, 강하게 부인하거나 역공하세요.'
      : '';
    if (triggerEmotionPrompt) {
      enhancedSystem = `${triggerEmotionPrompt}\n\n${enhancedSystem}`;
    }
    enhancedSystem += identityToPrompt(identity);
    enhancedSystem += userMemoryToPrompt(userMemory, relevantMemories);
    enhancedSystem += ragContext;

    // 멀티턴 메모리 강화: userMemoryToPrompt에서 이미 주입됨 — 중복 제거

    // 메시지 카운트 증가 (비동기, 응답 대기 안 함)
    if (userId && idolId && supabase) {
      incrementMessageCount(userId, idolId, supabase).catch(() => {});
    }

    // === Anthropic Claude API (스트리밍) ===
    const modelUsed = 'claude-haiku-4-5-20251001';
    const anthropicBody = {
      model: modelUsed,
      max_tokens: max_tokens || 1024,
      messages,
      stream: true,
    };
    if (enhancedSystem) anthropicBody.system = enhancedSystem;

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(anthropicBody),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      res.write(`data: ${JSON.stringify({ type: 'error', error: `API ${anthropicRes.status}: ${errText.slice(0, 300)}` })}\n\n`);
      res.end();
      return;
    }

    const reader = anthropicRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // eval용 응답 버퍼와 stop_reason 추적
    let responseBuffer = '';
    let stopReason = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (!data) continue;

        try {
          const event = JSON.parse(data);
          // Anthropic 스트리밍 포맷
          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            const text = event.delta.text;
            responseBuffer += text;
            res.write(`data: ${JSON.stringify({ type: 'text', text })}\n\n`);
          }
          if (event.type === 'message_delta') {
            stopReason = event.delta?.stop_reason || null;
            if (stopReason === 'max_tokens') {
              console.warn(`[chat] Response truncated (max_tokens) - idol: ${idolId}`);
            }
          }
          if (event.type === 'error') {
            res.write(`data: ${JSON.stringify({ type: 'error', error: event.error?.message || 'Unknown error' })}\n\n`);
          }
        } catch {
          // skip unparseable lines
        }
      }
    }

    const emotionTag = `\n[[EMOTION:${detectEmotion(responseBuffer)}]]`;
    const triggeredTag = triggerEmotionPrompt ? '\n[[TRIGGERED:true]]' : '';
    const finalResponse = responseBuffer + emotionTag + triggeredTag;

    if (finalResponse.length > responseBuffer.length) {
      res.write(`data: ${JSON.stringify({ type: 'text', text: finalResponse.slice(responseBuffer.length) })}\n\n`);
    }

    if (idolId && anthropicApiKey) {
      triggerEval(finalResponse, idolId, userId, modelUsed, stopReason, supabase, anthropicApiKey);
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: message })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: message });
    }
  }
}
