import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // GET: 캐시 조회 (최신 버전)
  if (req.method === 'GET') {
    const { topic, style = 'free', debateType = 'seoul' } = req.query;
    if (!topic) return res.status(400).json({ error: 'topic required' });

    try {
      const { data, error } = await supabase
        .from('debate_cache')
        .select('*')
        .eq('topic', topic)
        .eq('style', style)
        .eq('debate_type', debateType)
        .order('version', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows found
        console.error('[debate-cache] GET error:', error);
        return res.json({ cached: null });
      }

      return res.json({ cached: data || null });
    } catch (e) {
      console.error('[debate-cache] GET exception:', e);
      return res.json({ cached: null });
    }
  }

  // POST: 캐시 저장
  if (req.method === 'POST') {
    const { topic, style = 'free', messages, judgment, debateType = 'seoul' } = req.body;
    if (!topic || !messages) {
      return res.status(400).json({ error: 'topic and messages required' });
    }

    try {
      // 현재 최대 버전 확인
      const { data: existing } = await supabase
        .from('debate_cache')
        .select('version')
        .eq('topic', topic)
        .eq('style', style)
        .eq('debate_type', debateType)
        .order('version', { ascending: false })
        .limit(1)
        .single();

      const nextVersion = existing ? existing.version + 1 : 1;

      const { data, error } = await supabase
        .from('debate_cache')
        .insert({ topic, style, debate_type: debateType, version: nextVersion, messages, judgment: judgment || null })
        .select()
        .single();

      if (error) {
        console.error('[debate-cache] POST error:', error);
        return res.status(500).json({ error: error.message });
      }

      return res.json({ saved: data });
    } catch (e) {
      console.error('[debate-cache] POST exception:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).end();
}
