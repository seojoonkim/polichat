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

function cleanTitle(title) {
  return title
    .replace(/\s*[-–—]\s*(조선일보|동아일보|중앙일보|한겨레|경향신문|뉴스1|연합뉴스|YTN|MBC|KBS|SBS|JTBC|TV조선|채널A|서울신문|매일경제|한국경제|아시아경제|세계일보|국민일보|문화일보|데일리안|오마이뉴스|월간조선|뉴스핌|v\.daum\.net|news\.naver\.com)[^\n]*/gi, '')
    .replace(/^\[[^\]]*\]\s*/, '') // [글로벌이슈] 등 접두 태그
    .replace(/\s*"[^"]*"$/g, '')
    .trim();
}

// ── 날짜별 이슈 저장 (한 날짜에 하나만 유지) ──────────────────────────────
export async function saveIssueForDate(date, issueTitle, judgment = null, force = false) {
  const supabase = getSupabase();
  if (!supabase || !issueTitle) return;
  try {
    // 가장 최신 행 조회 (중복 행 안전 처리)
    const { data } = await supabase
      .from('debate_cache')
      .select('id')
      .eq('topic', '__issue_history__')
      .eq('style', date)
      .order('style', { ascending: false })
      .limit(1);
    const existing = data?.[0];

    if (existing) {
      if (!force) return; // 덮어쓰지 않음 (하루 1개 고정)
      // force=true: 최신 행 업데이트
      const updateObj = { messages: [{ role: 'issue', content: issueTitle }] };
      if (judgment) updateObj.judgment = judgment;
      await supabase.from('debate_cache')
        .update(updateObj)
        .eq('id', existing.id);
      return;
    }
    // 신규 저장 (debate_type 컬럼 없음 — style로 날짜 구분)
    const insertObj = {
      topic: '__issue_history__',
      style: date,
      messages: [{ role: 'issue', content: issueTitle }],
      version: 1,
    };
    if (judgment) insertObj.judgment = judgment;
    await supabase.from('debate_cache').insert(insertObj);
  } catch (e) {
    console.error('[issue-history] save error:', e.message);
  }
}

// ── 전체 이슈 조회 (무제한) ──────────────────────────────────────────────────
export async function getAllIssues() {
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const { data } = await supabase
      .from('debate_cache')
      .select('style, messages, judgment, created_at')
      .eq('topic', '__issue_history__')
      .order('style', { ascending: false });

    const seenDates = new Set();
    const deduped = (data || []).filter(row => {
      if (seenDates.has(row.style)) return false;
      seenDates.add(row.style);
      return true;
    });

    return deduped.map(row => {
      const raw = row.messages?.[0]?.content || '';
      const matchups = (() => {
        try {
          const parsed = JSON.parse(row.judgment || '{}');
          return Array.isArray(parsed.matchups) ? parsed.matchups : [];
        } catch { return []; }
      })();
      return { date: row.style, title: cleanTitle(raw), matchups };
    }).filter(r => r.title);
  } catch (e) {
    console.error('[issue-history] getAllIssues error:', e.message);
    return [];
  }
}

// ── 최근 날짜 이슈 조회 ─────────────────────────────────────────────────────
export async function getRecentIssues(days) {
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (days || 4));
    const { data } = await supabase
      .from('debate_cache')
      .select('style, messages, judgment, created_at')
      .eq('topic', '__issue_history__')
      .gte('created_at', cutoff.toISOString())
      .order('style', { ascending: false });

    // 날짜별 중복 제거 (가장 최신 행만 유지)
    const seenDates = new Set();
    const deduped = (data || []).filter(row => {
      if (seenDates.has(row.style)) return false;
      seenDates.add(row.style);
      return true;
    });

    return deduped.map(row => {
      const raw = row.messages?.[0]?.content || '';
      const matchups = (() => {
        try {
          const parsed = JSON.parse(row.judgment || '{}');
          return Array.isArray(parsed.matchups) ? parsed.matchups : [];
        } catch { return []; }
      })();
      return { date: row.style, title: cleanTitle(raw), matchups };
    }).filter(r => r.title);
  } catch (e) {
    console.error('[issue-history] getRecentIssues error:', e.message);
    return [];
  }
}

/** RSS에서 날짜별 이슈 직접 파싱 (Supabase fallback) */
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
      for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
        const raw = m[1].match(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>/)?.[1]
          || m[1].match(/<title>([^<]+)<\/title>/)?.[1] || '';
        const title = cleanTitle(raw.replace(/<[^>]+>/g, '').trim());
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
  const result = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() + 9 * 60 * 60 * 1000 - i * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    if (dateMap[dateStr]) result.push({ date: dateStr, title: dateMap[dateStr] });
  }
  return result;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // all=1 → 날짜 제한 없이 전체 반환
  if (req.query.all === '1') {
    const all = await getAllIssues();
    return res.status(200).json({ issues: all, source: 'supabase-all' });
  }

  const days = parseInt(req.query.days || '7', 10);
  const saved = await getRecentIssues(days + 1);

  if (saved.length >= days) {
    return res.status(200).json({ issues: saved.slice(0, days), source: 'supabase' });
  }

  // Supabase 부족 → RSS 보완
  const rssIssues = await fetchIssuesByDateFromRSS(days);
  const savedDates = new Set(saved.map(r => r.date));
  const merged = [...saved];
  for (const r of rssIssues) {
    if (!savedDates.has(r.date)) merged.push(r);
  }
  merged.sort((a, b) => b.date.localeCompare(a.date));

  // 빠진 날짜는 Supabase에 비동기 저장
  for (const item of merged) {
    if (!savedDates.has(item.date)) {
      saveIssueForDate(item.date, item.title).catch(() => {});
    }
  }

  return res.status(200).json({ issues: merged.slice(0, days), source: 'rss+supabase' });
}
