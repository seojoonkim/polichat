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
      title: row.messages?.[0]?.content || '',
    })).filter((r) => r.title);
  } catch (e) {
    return [];
  }
}

/** RSS에서 날짜별 이슈 직접 가져오기 (Supabase fallback용) */
async function fetchIssuesByDateFromRSS(days) {
  const feeds = [
    'https://news.google.com/rss/search?q=%ED%95%9C%EA%B5%AD+%EC%A0%95%EC%B9%98&hl=ko&gl=KR&ceid=KR:ko',
    'https://www.ytn.co.kr/_ln/0101_rss.xml',
    'https://rss.donga.com/politics.xml',
    'https://www.hani.co.kr/rss/politics/',
  ];

  const dateMap = {};

  for (const feedUrl of feeds) {
    try {
      const res = await fetch(feedUrl, { signal: AbortSignal.timeout(7000) });
      if (!res.ok) continue;
      const xml = await res.text();
      const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

      for (const m of items) {
        const raw = m[1].match(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>/)?.[1]
          || m[1].match(/<title>([^<]+)<\/title>/)?.[1] || '';
        const title = raw.replace(/<[^>]+>/g, '').trim();
        if (title.length < 10 || title.includes('광고')) continue;

        const pubDateRaw = m[1].match(/<pubDate>([^<]+)<\/pubDate>/)?.[1] || '';
        if (!pubDateRaw) continue;

        try {
          const d = new Date(pubDateRaw);
          if (isNaN(d.getTime())) continue;
          const dateStr = new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
          if (!dateMap[dateStr]) dateMap[dateStr] = title;
        } catch {}
      }
    } catch {}

    if (Object.keys(dateMap).length >= days) break;
  }

  // 최근 days일 필터링하여 내림차순 반환
  const result = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() + 9 * 60 * 60 * 1000 - i * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    if (dateMap[dateStr]) {
      result.push({ date: dateStr, title: dateMap[dateStr] });
    }
  }
  return result;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const days = parseInt(req.query.days || '3', 10);

  // 1차: Supabase에서 저장된 히스토리 조회
  const saved = await getRecentIssues(days + 1);

  if (saved.length >= days) {
    return res.status(200).json({ issues: saved.slice(0, days), source: 'supabase' });
  }

  // 2차: Supabase 부족하면 RSS에서 직접 파싱
  const rssIssues = await fetchIssuesByDateFromRSS(days);

  // 병합: saved 우선, 빠진 날짜는 RSS로 보완
  const savedDates = new Set(saved.map(r => r.date));
  const merged = [...saved];
  for (const r of rssIssues) {
    if (!savedDates.has(r.date)) merged.push(r);
  }

  // 날짜 내림차순 정렬
  merged.sort((a, b) => b.date.localeCompare(a.date));

  // Supabase에 없는 것들 비동기 저장 (fire-and-forget)
  for (const item of merged) {
    if (!savedDates.has(item.date)) {
      saveIssueForDate(item.date, item.title).catch(() => {});
    }
  }

  return res.status(200).json({ issues: merged.slice(0, days), source: 'rss+supabase' });
}
