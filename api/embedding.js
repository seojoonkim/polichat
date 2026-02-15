export const config = {
  maxDuration: 30,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
  }

  const { text, texts } = req.body;

  // 단일 텍스트 또는 배치 처리
  const input = texts || (text ? [text] : null);

  if (!input || input.length === 0) {
    return res.status(400).json({ error: 'text or texts is required' });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({ error: `OpenAI API error: ${error}` });
    }

    const data = await response.json();
    const embeddings = data.data.map((d) => d.embedding);

    // 단일 텍스트면 embedding 하나만, 배치면 embeddings 배열
    if (text && !texts) {
      return res.json({ embedding: embeddings[0] });
    }
    return res.json({ embeddings });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
}
