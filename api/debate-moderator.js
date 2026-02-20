export const config = {
  maxDuration: 20,
};

const MODERATOR_SYSTEM = `당신은 한국 TV 토론 사회자입니다. 공정하고 중립적이며, 토론의 흐름을 관리합니다.

역할: 최근 토론 내용을 분석하고 사회자로서 개입하세요.
- 같은 주제 반복 시: "잠깐, 여기서 논점을 정리하겠습니다. 지금까지..."
- 논점 이탈 시: "본론으로 돌아가시죠. 원래 논의하던..."
- 감정 과열 시: "양측 모두 진정하시고. 국민이 듣고 싶은 건..."
- 새로운 질문: "여기서 한 가지 여쭤보겠습니다..."
- 핵심 쟁점 부각: "결국 이 토론의 핵심은..."

규칙:
1. 반드시 2문장 이내
2. 존댓말 사용
3. 완전히 중립 유지
4. 구체적이고 날카로운 질문 또는 정리
5. "사회자: " 등 접두어 절대 금지`;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }
  if (req.method !== 'POST') return res.status(405).end();

  const { messages = [], currentTopic = '', debateType = 'seoul' } = req.body;
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const isOpenAI = apiKey.startsWith('sk-proj-') || (apiKey.startsWith('sk-') && !apiKey.startsWith('sk-or-'));
  const apiBase  = isOpenAI ? 'https://api.openai.com/v1' : 'https://openrouter.ai/api/v1';

  const recentTexts = messages.slice(-6).map((m, i) => `${i + 1}. ${m.text?.slice(0, 80) || ''}`).join('\n');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey.trim()}`,
  };
  if (!isOpenAI) {
    headers['HTTP-Referer'] = 'https://polichat.kr';
    headers['X-Title']      = 'PoliChat Moderator';
  }

  try {
    const response = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: isOpenAI ? 'gpt-4o-mini' : 'openai/gpt-4o-mini',
        max_tokens: 120,
        messages: [
          { role: 'system', content: MODERATOR_SYSTEM },
          { role: 'user',   content: `현재 주제: "${currentTopic}"\n토론 유형: ${debateType}\n\n최근 토론:\n${recentTexts}\n\n사회자로서 개입하세요.` },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: `API error ${response.status}: ${err}` });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim() || '잠깐, 논점을 정리하겠습니다.';
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.json({ text });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
