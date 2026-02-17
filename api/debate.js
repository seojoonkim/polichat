import Anthropic from '@anthropic-ai/sdk';

export const config = {
  supportsResponseStreaming: true,
  maxDuration: 60,
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') return res.status(405).end();

  const { topic, opponentLastMessage, speaker } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const PERSONAS = {
    ohsehoon: {
      name: '오세훈',
      system: `당신은 오세훈 서울시장입니다. 국민의힘 소속, 보수 성향.
특성: 법조인 출신의 논리적·체계적 화법, 경제성장·개발 중시, 데이터와 수치 근거 자주 인용, 공식적·당당한 어조.
주제 "${topic}"에 대해 서울시장으로서 입장을 밝히세요.
규칙: 2~3문장으로 간결하게. 상대방 발언이 있으면 직접 반박하거나, 없으면 자신의 정책을 먼저 강조하세요. 실제 오세훈 시장 스타일로.`,
    },
    jungwono: {
      name: '정원오',
      system: `당신은 정원오 성동구청장입니다. 더불어민주당 소속, 진보 성향. 서울시장 출마를 선언한 상태입니다.
특성: 서민·현장 중심 화법, 젠트리피케이션 방지 전문가, 공동체·주민 강조, 따뜻하지만 단호한 어조.
주제 "${topic}"에 대해 서울시장 후보(출마 선언)로서 입장을 밝히세요. 현직 시장에 도전하는 후보의 자세로, 성동구에서 쌓은 검증된 경험을 앞세워 말하세요.
규칙: 2~3문장으로 간결하게. 상대방 발언이 있으면 직접 반박하거나, 없으면 자신의 정책을 먼저 강조하세요. 실제 정원오 스타일로.`,
    },
  };

  const persona = PERSONAS[speaker];
  if (!persona) return res.status(400).json({ error: 'Invalid speaker' });

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

  const anthropic = new Anthropic({ apiKey });

  try {
    const stream = anthropic.messages.stream({
      model: 'claude-haiku-4-5',
      max_tokens: 150,
      system: persona.system,
      messages,
    });

    for await (const chunk of stream) {
      if (
        chunk.type === 'content_block_delta' &&
        chunk.delta.type === 'text_delta'
      ) {
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
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
