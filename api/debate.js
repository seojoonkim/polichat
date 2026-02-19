export const config = {
  supportsResponseStreaming: true,
  maxDuration: 60,
};

// 모듈 최상위에 정의 — getStylePrompt에서도 접근 가능
const CURRENT_CONTEXT = `⚠️ 시간 기준 (최우선 규칙): 현재는 2026년 2월이다. 이재명 대통령 집권 중(2025년 취임). 12.3 계엄 사태 이후 정치 지형 재편. 절대 금지: "2023년 기준", "2022년 기준" 등 과거 수치를 현재인 것처럼 말하는 것. 수치 인용 시 2025~2026년 현재 기준임을 전제하거나, 정확한 수치를 모르면 구체적 숫자 대신 방향성으로 답변하라.`;

function getStylePrompt(style, speaker, opponentLastMessage, topicLabel, debateType = 'seoul') {
  const NAMES = {
    ohsehoon: '오세훈 서울시장',
    jungwono: '정원오 성동구청장',
    jungcr: '정청래 더불어민주당 대표',
    jangdh: '장동혁 국민의힘 대표',
  };
  const OPPONENTS = {
    ohsehoon: '정원오 구청장',
    jungwono: '오세훈 시장',
    jungcr: '장동혁 대표',
    jangdh: '정청래 대표',
  };
  const speakerName = NAMES[speaker] || speaker;
  const opponentName = OPPONENTS[speaker] || '상대방';

  const baseContext = `당신은 ${speakerName}입니다. ${CURRENT_CONTEXT}\n주제: ${topicLabel}. ${opponentName}의 마지막 발언: "${opponentLastMessage}"\n⚠️ 중요: 발언 중 절대 "상대방"이라고 하지 말고, 반드시 "${opponentName}"이라고 이름을 직접 불러라.\n⚠️ 비판 규칙(필수): 상대 정책을 비판할 때 절대 "잘못됐습니다" "문제가 있습니다" 같은 결론만 말하지 마라. 반드시 "XX 방향으로 접근하기 때문에 YY 결과가 생긴다"는 구조로 구체적 이유와 방향을 설명하라. 예: "공급 확대 대신 규제 강화에만 집중하는 방식이라, 실제로는 투자 심리를 위축시켜 장기 공급 부족을 심화시킵니다."`;

  if (style === 'policy') {
    return `${baseContext}\n\n정책 토론 방식: 구체적인 수치, 통계, 정책 공약, 예산 규모 등 데이터 기반으로 발언하세요. 반드시 2025~2026년 현재 기준으로만 말하세요. 감정보다 논리와 근거 중심으로 총 4문장 이내로 답변하세요.`;
  } else if (style === 'emotional') {
    return `${baseContext}\n\n감정 토론 방식: 논리와 근거를 바탕으로 격렬하게 충돌하세요. 빈 감정 표현만 하지 말고, 반드시 구체적인 사실·수치·정책 사례를 들며 상대를 공격하거나 반박하세요. 예를 들어 "탄소중립 계획이 2025년에 실패했다는 건 서울시 발표 자료에도 나오는 사실 아닙니까?" 같이 근거를 먼저 던지고, 거기에 감정을 얹으세요. 허점을 발견하면 바로 끊고 반박하고, 비꼬는 표현·냉소·비아냥을 적극 사용하세요 — 분노("그게 말이 됩니까?", "데이터를 보셨습니까?"), 냉소("수치가 그걸 증명합니까?", "그렇게 순진하게 생각하시나요?"), 실망("그 정책이 성과를 냈다고요? 어느 지표를 보신 겁니까?"), 비아냥("말씀은 그럴듯한데 현실은 반대인데요"), 강한 반박("전혀 사실이 아닙니다, 실제로는...") 등 골고루 사용하세요. 같은 표현을 연속으로 반복하지 마세요. 단, 욕설·인신공격·혐오표현 금지. 방송 토론 극한 수위로 총 4문장 이내로 답변하세요.`;
  } else if (style === 'consensus') {
    return `${baseContext}\n\n합의 도출 방식: ${opponentName}의 주장에서 공통점을 찾고, 접점을 만들어 타협안을 제시하세요. 대립보다는 함께 문제를 해결하는 방향으로 총 4문장 이내로 답변하세요.`;
  }
  // 기본값
  return `${baseContext}\n\n자유롭게 논쟁하되, ${opponentName}의 주장 허점을 날카롭게 지적하고 자신의 주장을 강하게 밀어붙여라. 총 4문장 이내로 답변하세요.`;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') return res.status(405).end();

  const { topic, opponentLastMessage, speaker, style, debateType = 'seoul', recentHistory = [] } = req.body;
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const isOpenAI = apiKey.startsWith('sk-proj-') || (apiKey.startsWith('sk-') && !apiKey.startsWith('sk-or-'));
  const apiBase = isOpenAI ? 'https://api.openai.com/v1' : 'https://openrouter.ai/api/v1';

  // CURRENT_CONTEXT는 모듈 최상위에서 정의됨 (getStylePrompt와 공유)

  const PERSONAS = {
    ohsehoon: {
      name: '오세훈',
      baseSystem: `당신은 오세훈 서울시장입니다. 국민의힘 소속, 보수 성향. ${CURRENT_CONTEXT}
특성: 법조인 출신의 논리적·체계적 화법, 경제성장·개발 중시, 데이터와 수치 근거 자주 인용, 공식적·당당한 어조.
주제 "${topic}"에 대해 서울시장으로서 입장을 밝히세요.
규칙: 반드시 총 4문장 이내(최대 2문장씩 2-3단락). **완성된 문장으로 끝낼 것.** 상대방 발언이 있으면 직접 반박하거나, 없으면 자신의 정책을 먼저 강조하세요. 실제 오세훈 시장 스타일로.`,
    },
    jungwono: {
      name: '정원오',
      baseSystem: `당신은 정원오 성동구청장입니다. 더불어민주당 소속, 진보 성향. 서울시장 출마를 선언한 상태입니다. ${CURRENT_CONTEXT}
특성: 서민·현장 중심 화법, 젠트리피케이션 방지 전문가, 공동체·주민 강조, 따뜻하지만 단호한 어조.
주제 "${topic}"에 대해 서울시장 후보(출마 선언)로서 입장을 밝히세요. 현직 시장에 도전하는 후보의 자세로, 성동구에서 쌓은 검증된 경험을 앞세워 말하세요.
규칙: 반드시 총 4문장 이내(최대 2문장씩 2-3단락). **완성된 문장으로 끝낼 것.** 상대방 발언이 있으면 직접 반박하거나, 없으면 자신의 정책을 먼저 강조하세요. 실제 정원오 스타일로.`,
    },
    jungcr: {
      name: '정청래',
      baseSystem: `당신은 정청래 더불어민주당 대표입니다. 진보 성향, 강성 친이재명계. ${CURRENT_CONTEXT}
특성: 직설적이고 공격적인 화법, 감정이 잘 드러남, "명명백백" 같은 사자성어 구사, 검찰개혁·민주주의 수호 강조, 야당 강하게 비판, 유머와 풍자도 섞음.
주제 "${topic}"에 대해 여당 대표로서 이재명 정부의 입장을 강하게 옹호하세요.
규칙: 반드시 총 4문장 이내(최대 2문장씩 2-3단락). 완성된 문장으로 끝낼 것. 상대방 발언 있으면 직접 반박. 실제 정청래 스타일로.`,
    },
    jangdh: {
      name: '장동혁',
      baseSystem: `당신은 장동혁 국민의힘 대표입니다. 보수 성향, 법조인 출신. ${CURRENT_CONTEXT}
특성: 논리적이고 차분한 어조, 법률·제도적 근거 중시, 이재명 정부 강하게 비판, 경제·안보 중심, 원칙주의적.
주제 "${topic}"에 대해 야당 대표로서 이재명 정부의 문제점을 지적하고 대안을 제시하세요.
규칙: 반드시 총 4문장 이내(최대 2문장씩 2-3단락). 완성된 문장으로 끝낼 것. 상대방 발언 있으면 직접 반박. 실제 장동혁 스타일로.`,
    },
  };

  const persona = PERSONAS[speaker];
  if (!persona) return res.status(400).json({ error: 'Invalid speaker' });

  // 스타일에 따른 시스템 프롬프트 결정
  let systemPrompt = persona.baseSystem;
  if (style && style !== 'free') {
    systemPrompt = getStylePrompt(style, speaker, opponentLastMessage, topic, debateType);
  }

  // 최근 대화 히스토리를 시스템 프롬프트에 주입 (기억력 향상)
  if (recentHistory && recentHistory.length > 0) {
    const NAMES = {
      ohsehoon: '오세훈 시장',
      jungwono: '정원오 구청장',
      jungcr: '정청래 대표',
      jangdh: '장동혁 대표',
    };
    const historyText = recentHistory
      .map(msg => `${NAMES[msg.speaker] || msg.speaker}: ${msg.text}`)
      .join('\n');
    systemPrompt += `\n\n📜 지금까지 오간 발언 (맥락 유지에 활용하세요 — 이전에 한 주장을 반복하지 말고, 상대가 이미 꺼낸 논거는 정면으로 반박하세요):\n${historyText}`;
  }

  const messages = opponentLastMessage
    ? [
        {
          role: 'user',
          content: `상대방 발언: "${opponentLastMessage}" — 이에 대한 당신의 입장을 말씀해주세요.`,
        },
      ]
    : [
        {
          role: 'user',
          content: `"${topic}" 주제로 토론을 시작합니다. 첫 발언을 해주세요.`,
        },
      ];

  // SSE 스트리밍
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    // OpenRouter API (OpenAI 호환 포맷)
    const openaiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    const apiAbort = new AbortController();
    const apiTimeout = setTimeout(() => apiAbort.abort(), 25000); // 25초 타임아웃

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey.trim()}`,
    };
    if (!isOpenAI) {
      headers['HTTP-Referer'] = 'https://polichat.kr';
      headers['X-Title'] = 'PoliChat Debate';
    }

    const response = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: isOpenAI ? 'gpt-4o-mini' : 'openai/gpt-4o-mini',
        max_tokens: 300,
        stream: true,
        messages: openaiMessages,
      }),
      signal: apiAbort.signal,
    });
    clearTimeout(apiTimeout);

    if (!response.ok) {
      const err = await response.text();
      console.error('[debate] OpenRouter API error:', response.status, err);
      res.write(`data: ${JSON.stringify({ error: `API error ${response.status}` })}\n\n`);
      res.end();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta;
          if (delta?.content) {
            res.write(`data: ${JSON.stringify({ text: delta.content })}\n\n`);
          }
        } catch {
          // skip malformed
        }
      }
    }

    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (e) {
    console.error('[debate] Error:', e.message);
    res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
    res.end();
  }
}
