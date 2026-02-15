import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 30,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  if (!openaiKey) {
    return res.status(500).json({ error: 'OpenAI API key not configured' });
  }

  const { query, idolId, category, topK = 5, threshold = 0.7 } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'query is required' });
  }

  try {
    // 1. 쿼리 임베딩 생성
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
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

    if (!embeddingResponse.ok) {
      const error = await embeddingResponse.text();
      return res.status(500).json({ error: `Embedding error: ${error}` });
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    // 2. Supabase에서 similarity search
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase.rpc('match_idol_knowledge', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: topK,
      filter_idol_id: idolId || null,
      filter_category: category || null,
    });

    if (error) {
      return res.status(500).json({ error: `Supabase error: ${error.message}` });
    }

    return res.json({ results: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
}
