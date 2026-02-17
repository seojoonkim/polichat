export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  try {
    let text = '[]';

    if (openrouterKey) {
      // OpenRouter 사용 (chat.js와 동일한 방식)
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openrouterKey}`,
          'HTTP-Referer': 'https://polichat.vercel.app',
          'X-Title': 'Polichat',
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          max_tokens: 200,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) return res.json({ questions: [] });
      const data = await response.json();
      text = data.choices?.[0]?.message?.content || '[]';
    } else if (anthropicKey) {
      // Anthropic 직접 사용 (fallback)
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 200,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) return res.json({ questions: [] });
      const data = await response.json();
      text = data.content?.[0]?.text || '[]';
    } else {
      return res.json({ questions: [] });
    }

    // JSON 배열 파싱
    const match = text.match(/\[[\s\S]*?\]/);
    const questions = match ? JSON.parse(match[0]) : [];
    return res.json({ questions: questions.slice(0, 3) });
  } catch (e) {
    console.error('suggest error:', e);
    return res.json({ questions: [] });
  }
}
