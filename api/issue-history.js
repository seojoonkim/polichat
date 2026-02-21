import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export function toKSTDate(d) {
  const kst = new Date((d || new Date()).getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export async function saveIssueForDate(date, issueTitle) {
  const supabase = getSupabase();
  if (!supabase || !issueTitle) return;
  try {
    const { data: existing } = await supabase
      .from('debate_cache')
      .select('id')
      .eq('topic', '__issue_history__')
      .eq('style', date)
      .maybeSingle();
    if (existing) return;
    await supabase.from('debate_cache').insert({
      topic: '__issue_history__',
      style: date,
      debate_type: 'history',
      messages: [{ role: 'issue', content: issueTitle }],
      version: 1,
    });
  } catch (e) {
    console.error('[issue-history] save error:', e.message);
  }
}

export async function getRecentIssues(days) {
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (days || 4));
    const { data } = await supabase
      .from('debate_cache')
      .select('style, messages, created_at')
      .eq('topic', '__issue_history__')
      .eq('debate_type', 'history')
      .gte('created_at', cutoff.toISOString())
      .order('created_at', { ascending: false });
    return (data || []).map((row) => ({
      date: row.style,
      title: row.messages && row.messages[0] && row.messages[0].content ? row.messages[0].content : '',
    })).filter((r) => r.title);
  } catch (e) {
    return [];
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const issues = await getRecentIssues(4);
  return res.status(200).json({ issues });
}
