import Anthropic from '@anthropic-ai/sdk';

export const config = {
  maxDuration: 30,
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { topic, messages } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  if (!topic || !messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'topic and messages required' });
  }

  // 토론 내용 포맷팅
  const debateText = messages
    .map((msg, i) => {
      const speakerName = msg.speaker === 'ohsehoon' ? '오세훈' : '정원오';
      return `[라운드 ${Math.floor(i / 2) + 1} - ${speakerName}]\n${msg.text}`;
    })
    .join('\n\n');

  const JUDGE_SYSTEM = `당신은 공정한 토론 심판입니다. 정당이나 이념이 아닌 토론 내용만으로 판단하세요.

아래 4개 기준으로 각 후보에게 1~10점을 매기세요:
- 논리력 (30%): 주장의 논리적 일관성, 근거 제시
- 구체성 (25%): 구체적 정책·수치·사례 제시
- 설득력 (25%): 시민 관점에서 공감 가능한 메시지
- 실현가능성 (20%): 실제 실행 가능한 정책인지

반드시 아래 JSON 형식으로만 응답하세요:
{
  "winner": "ohsehoon" 또는 "jungwono",
  "scores": {
    "ohsehoon": { "logic": N, "specificity": N, "persuasion": N, "feasibility": N, "total": N },
    "jungwono": { "logic": N, "specificity": N, "persuasion": N, "feasibility": N, "total": N }
  },
  "reason": "3문장 이내의 판정 이유"
}`;

  const userMessage = `주제: ${topic}\n\n=== 토론 내용 ===\n\n${debateText}`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 512,
      system: JUDGE_SYSTEM,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = response.content[0]?.text || '';

    // JSON 파싱 (마크다운 제거)
    let cleanText = text.trim();
    if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }

    let judgment;
    try {
      judgment = JSON.parse(cleanText);
    } catch {
      // JSON 파싱 실패 시 기본값
      console.error('[debate-judge] JSON parse error:', cleanText);
      judgment = {
        winner: 'ohsehoon',
        scores: {
          ohsehoon: { logic: 7, specificity: 7, persuasion: 7, feasibility: 7, total: 70 },
          jungwono: { logic: 7, specificity: 7, persuasion: 7, feasibility: 7, total: 70 },
        },
        reason: '두 후보 모두 균형 잡힌 토론을 펼쳤습니다.',
      };
    }

    return res.json(judgment);
  } catch (e) {
    console.error('[debate-judge] Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
