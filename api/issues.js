import { createClient } from '@supabase/supabase-js';
import { saveIssueForDate, toKSTDate, getRecentIssues } from './issue-history.js';

// ── 언론사명 패턴 제거 ───────────────────────────────────────────────────────
function stripMediaName(title) {
  return title
    .replace(/\s*[-–—]\s*(조선일보|동아일보|중앙일보|한겨레|경향신문|뉴스1|연합뉴스|YTN|MBC|KBS|SBS|JTBC|TV조선|채널A|매일경제|한국경제|아시아경제|세계일보|국민일보|문화일보|데일리안|오마이뉴스|v\.daum\.net|news\.naver\.com)[^\n]*/gi, '')
    .replace(/\s*\|\s*(조선일보|동아일보|중앙일보|한겨레|뉴스1|연합뉴스|YTN)[^\n]*/gi, '')
    .replace(/\s*"[^"]*"$/g, '')   // 끝 따옴표 문구 제거
    .trim();
}

// ── RSS 파싱 ─────────────────────────────────────────────────────────────────
function parseRssItems(xml, source) {
  const items = [];
  const matches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
  for (const m of matches) {
    const raw = m[1].match(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>/)?.[1]
      || m[1].match(/<title>([^<]+)<\/title>/)?.[1] || '';
    const title = raw.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
    const pubRaw = m[1].match(/<pubDate>([^<]+)<\/pubDate>/)?.[1] || '';
    if (title.length < 10 || title.includes('광고')) continue;
    items.push({ title: stripMediaName(title), source, publishedAt: pubRaw ? new Date(pubRaw).toISOString() : new Date().toISOString() });
  }
  return items;
}

// ── LLM으로 논점 명확한 제목 재작성 ─────────────────────────────────────────
async function reformatToDebateTopic(rawTitle) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return rawTitle;
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-4o',
        messages: [{
          role: 'user',
          content: `다음 뉴스 헤드라인을 한국 정치 토론 논제로 재작성하세요.
조건:
- 언론사명, 기자명, 따옴표 인용 제거
- 정치적 대립 구도와 핵심 쟁점이 명확히 드러나도록
- 20-35자 이내 한 줄
- 제목만 출력 (설명 없이)

헤드라인: "${rawTitle}"`,
        }],
        max_tokens: 80,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    const result = data.choices?.[0]?.message?.content?.trim();
    return result && result.length >= 5 ? result : rawTitle;
  } catch {
    return rawTitle;
  }
}

// ── Supabase ─────────────────────────────────────────────────────────────────
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ── 메인 핸들러 ──────────────────────────────────────────────────────────────
export default async function handler(_req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const todayKST = toKSTDate(new Date());

  // 1) Supabase에서 오늘 이슈 먼저 체크 (자꾸 바뀌는 문제 방지)
  try {
    const cached = await getRecentIssues(1);
    const todayCached = cached.find(r => r.date === todayKST);
    if (todayCached?.title) {
      return res.json({ issues: [{ title: todayCached.title, source: 'cached', publishedAt: new Date().toISOString() }] });
    }
  } catch {}

  // 2) 오늘 이슈 없으면 RSS에서 가져오기
  try {
    const feeds = [
      { url: 'https://www.ytn.co.kr/_ln/0101_rss.xml', source: 'YTN' },
      { url: 'https://rss.donga.com/politics.xml', source: '동아일보' },
      { url: 'https://www.hani.co.kr/rss/politics/', source: '한겨레' },
    ];

    let rawTitle = null;
    for (const f of feeds) {
      try {
        const r = await fetch(f.url, { signal: AbortSignal.timeout(6000) });
        if (!r.ok) continue;
        const xml = await r.text();
        const items = parseRssItems(xml, f.source);
        if (items.length > 0) { rawTitle = items[0].title; break; }
      } catch {}
    }

    if (!rawTitle) {
      return res.json({ issues: [{ title: '오늘의 주요 정치 이슈를 분석 중입니다', source: 'fallback', publishedAt: new Date().toISOString() }] });
    }

    // 3) LLM으로 논점 명확한 제목으로 재작성
    const debateTopic = await reformatToDebateTopic(rawTitle);

    // 4) Supabase 저장 (오늘 날짜로 고정)
    await saveIssueForDate(todayKST, debateTopic);

    return res.json({ issues: [{ title: debateTopic, source: 'rss', publishedAt: new Date().toISOString() }] });
  } catch (e) {
    console.error('[issues] error:', e);
    return res.json({ issues: [{ title: '정치 이슈 로딩 실패', source: 'error', publishedAt: new Date().toISOString() }] });
  }
}
