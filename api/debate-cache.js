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

  const buildStyleKey = (style, promptVersion) => {
    const baseStyle = (typeof style === 'string' ? style : 'free').trim() || 'free';
    const versionTag = typeof promptVersion === 'string' && promptVersion.trim()
      ? `__pv_${promptVersion.trim()}`
      : '';
    return `${baseStyle}${versionTag}`;
  };

  // GET: 캐시 조회 (최신 버전)
  if (req.method === 'GET') {
    const { topic, style = 'free', debateType = 'seoul', pv = null } = req.query;
    if (!topic) return res.status(400).json({ error: 'topic required' });
    const styleKey = buildStyleKey(style, pv);

    try {
      const { data, error } = await supabase
        .from('debate_cache')
        .select('*')
        .eq('topic', topic)
        .eq('style', styleKey)
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
    const { topic, style = 'free', messages, judgment, debateType = 'seoul', promptVersion = null } = req.body;
    if (!topic || !messages) {
      return res.status(400).json({ error: 'topic and messages required' });
    }
    const styleKey = buildStyleKey(style, promptVersion);

    try {
      // 현재 최대 버전 확인
      const { data: existing } = await supabase
        .from('debate_cache')
        .select('version')
        .eq('topic', topic)
        .eq('style', styleKey)
        .eq('debate_type', debateType)
        .order('version', { ascending: false })
        .limit(1)
        .single();

      let nextVersion = existing ? existing.version + 1 : 1;

      // Retry on version conflict (race condition between concurrent writes)
      let data, error;
      for (let attempt = 0; attempt < 3; attempt++) {
        ({ data, error } = await supabase
          .from('debate_cache')
          .insert({ topic, style: styleKey, debate_type: debateType, version: nextVersion, messages, judgment: judgment || null })
          .select()
          .single());
        
        if (!error) break;
        if (error.code === '23505') { // unique constraint violation
          nextVersion++;
          continue;
        }
        break; // other errors, don't retry
      }

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
