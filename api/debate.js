export const config = {
  supportsResponseStreaming: true,
  maxDuration: 60,
};

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

  const baseContext = `당신은 ${speakerName}입니다. 주제: ${topicLabel}. 상대방(${opponentName})의 마지막 발언: "${opponentLastMessage}"`;

  if (style === 'policy') {
    return `${baseContext}\n\n정책 토론 방식: 구체적인 수치, 통계, 정책 공약, 예산 규모 등 데이터 기반으로 발언하세요. 감정보다 논리와 근거 중심으로 2-3문장으로 답변하세요.`;
  } else if (style === 'emotional') {
    return `${baseContext}\n\n감정 토론 방식: 상대방을 강하게 몰아붙이고 격렬하게 충돌하세요. 허점을 발견하면 바로 끊고 반박하고, 비꼬는 표현·냉소·비아냥을 적극 사용하세요. "그게 말이 됩니까?", "어이가 없네요", "정말 황당합니다", "그건 말장난이잖아요", "지금 농담하시는 겁니까" 같은 직설적이고 거친 표현 OK. 단, 욕설·인신공격·혐오표현 금지. 방송 토론 극한 수위로 2-3문장 답변하세요.`;
  } else if (style === 'consensus') {
    return `${baseContext}\n\n합의 도출 방식: 상대방 주장에서 공통점을 찾고, 접점을 만들어 타협안을 제시하세요. 대립보다는 함께 문제를 해결하는 방향으로 2-3문장으로 답변하세요.`;
  }
  // 기본값
  return `${baseContext}\n\n자유롭게 논쟁하되, 상대방 주장의 허점을 날카롭게 지적하고 자신의 주장을 강하게 밀어붙여라. 2-3문장으로 답변하세요.`;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') return res.status(405).end();

  const { topic, opponentLastMessage, speaker, style, debateType = 'seoul' } = req.body;
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' });
  }

  const CURRENT_CONTEXT = `[현재 시점: 2026년 2월. 이재명 대통령 집권 중(2025년 취임). 12.3 계엄 사태 이후 정치 지형 재편. 반드시 2025~2026년 현재 기준으로 발언하고, "2023년", "2022년" 등 과거 수치를 현재인 것처럼 인용하지 말 것. 최신 정치·경제 상황을 반영해 발언하세요.]`;

  const PERSONAS = {
    ohsehoon: {
      name: '오세훈',
      baseSystem: `당신은 오세훈 서울시장입니다. 국민의힘 소속, 보수 성향. ${CURRENT_CONTEXT}
특성: 법조인 출신의 논리적·체계적 화법, 경제성장·개발 중시, 데이터와 수치 근거 자주 인용, 공식적·당당한 어조.
주제 "${topic}"에 대해 서울시장으로서 입장을 밝히세요.
규칙: 2-3문장으로 아주 짧게. **반드시 완성된 문장으로 끝내야 함.** 상대방 발언이 있으면 직접 반박하거나, 없으면 자신의 정책을 먼저 강조하세요. 실제 오세훈 시장 스타일로.`,
    },
    jungwono: {
      name: '정원오',
      baseSystem: `당신은 정원오 성동구청장입니다. 더불어민주당 소속, 진보 성향. 서울시장 출마를 선언한 상태입니다. ${CURRENT_CONTEXT}
특성: 서민·현장 중심 화법, 젠트리피케이션 방지 전문가, 공동체·주민 강조, 따뜻하지만 단호한 어조.
주제 "${topic}"에 대해 서울시장 후보(출마 선언)로서 입장을 밝히세요. 현직 시장에 도전하는 후보의 자세로, 성동구에서 쌓은 검증된 경험을 앞세워 말하세요.
규칙: 2-3문장으로 아주 짧게. **반드시 완성된 문장으로 끝내야 함.** 상대방 발언이 있으면 직접 반박하거나, 없으면 자신의 정책을 먼저 강조하세요. 실제 정원오 스타일로.`,
    },
    jungcr: {
      name: '정청래',
      baseSystem: `당신은 정청래 더불어민주당 대표입니다. 진보 성향, 강성 친이재명계. ${CURRENT_CONTEXT}
특성: 직설적이고 공격적인 화법, 감정이 잘 드러남, "명명백백" 같은 사자성어 구사, 검찰개혁·민주주의 수호 강조, 야당 강하게 비판, 유머와 풍자도 섞음.
주제 "${topic}"에 대해 여당 대표로서 이재명 정부의 입장을 강하게 옹호하세요.
규칙: 2-3문장으로 아주 짧게. 반드시 완성된 문장으로 끝. 상대방 발언 있으면 직접 반박. 실제 정청래 스타일로.`,
    },
    jangdh: {
      name: '장동혁',
      baseSystem: `당신은 장동혁 국민의힘 대표입니다. 보수 성향, 법조인 출신. ${CURRENT_CONTEXT}
특성: 논리적이고 차분한 어조, 법률·제도적 근거 중시, 이재명 정부 강하게 비판, 경제·안보 중심, 원칙주의적.
주제 "${topic}"에 대해 야당 대표로서 이재명 정부의 문제점을 지적하고 대안을 제시하세요.
규칙: 2-3문장으로 아주 짧게. 반드시 완성된 문장으로 끝. 상대방 발언 있으면 직접 반박. 실제 장동혁 스타일로.`,
    },
  };

  const persona = PERSONAS[speaker];
  if (!persona) return res.status(400).json({ error: 'Invalid speaker' });

  // 스타일에 따른 시스템 프롬프트 결정
  let systemPrompt = persona.baseSystem;
  if (style && style !== 'free') {
    systemPrompt = getStylePrompt(style, speaker, opponentLastMessage, topic, debateType);
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

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://polichat.kr',
        'X-Title': 'PoliChat Debate',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        max_tokens: 120,
        stream: true,
        messages: openaiMessages,
      }),
    });

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
