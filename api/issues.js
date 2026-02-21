import { saveIssueForDate, toKSTDate, getRecentIssues } from './issue-history.js';

// ── 언론사명 제거 ────────────────────────────────────────────────────────────
function stripMediaName(title) {
  return title
    .replace(/\s*[-–—]\s*(조선일보|동아일보|중앙일보|한겨레|경향신문|뉴스1|연합뉴스|YTN|MBC|KBS|SBS|JTBC|TV조선|채널A|매일경제|한국경제|아시아경제|세계일보|국민일보|문화일보|데일리안|오마이뉴스|v\.daum\.net|news\.naver\.com)[^\n]*/gi, '')
    .replace(/\s*"[^"]*"$/g, '').trim();
}

// ── RSS 파싱 (pubDate 포함) ──────────────────────────────────────────────────
function parseRssItems(xml, source) {
  const items = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const raw = m[1].match(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>/)?.[1]
      || m[1].match(/<title>([^<]+)<\/title>/)?.[1] || '';
    const title = stripMediaName(
      raw.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
    );
    const pubRaw = m[1].match(/<pubDate>([^<]+)<\/pubDate>/)?.[1] || '';
    if (title.length < 10 || title.includes('광고')) continue;
    items.push({ title, source, publishedAt: pubRaw ? new Date(pubRaw).toISOString() : new Date().toISOString() });
  }
  return items;
}

// ── 여러 피드에서 최신 기사 수집 ─────────────────────────────────────────────
async function collectAllItems() {
  const FEEDS = [
    { url: 'https://news.google.com/rss/search?q=%ED%95%9C%EA%B5%AD+%EC%A0%95%EC%B9%98&hl=ko&gl=KR&ceid=KR:ko', source: 'Google뉴스' },
    { url: 'https://www.ytn.co.kr/_ln/0101_rss.xml', source: 'YTN' },
    { url: 'https://rss.donga.com/politics.xml', source: '동아일보' },
    { url: 'https://www.hani.co.kr/rss/politics/', source: '한겨레' },
    { url: 'https://rss.joins.com/joins_politics_list.xml', source: '중앙일보' },
  ];

  // KST 어제 자정 이후만 포함
  const kstNow = Date.now() + 9 * 60 * 60 * 1000;
  const kstMidnight = new Date(new Date(kstNow).toISOString().slice(0, 10) + 'T00:00:00+09:00').getTime();
  const cutoff = kstMidnight - 24 * 60 * 60 * 1000; // 어제 자정 기준

  const results = await Promise.allSettled(
    FEEDS.map(async (f) => {
      const r = await fetch(f.url, { signal: AbortSignal.timeout(7000) });
      if (!r.ok) return [];
      const xml = await r.text();
      return parseRssItems(xml, f.source);
    })
  );

  const all = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value)
    .filter(item => new Date(item.publishedAt).getTime() >= cutoff);

  return all.slice(0, 40); // 최대 40개
}

// ── LLM: 화제성 기준 1개 선택 + 논점 제목 생성 ──────────────────────────────
async function selectTopDebateTopic(items) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key || items.length === 0) return items[0]?.title || null;

  const headlines = items
    .map((item, i) => `${i + 1}. [${item.source}] ${item.title}`)
    .join('\n');

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-4o',
        messages: [{
          role: 'user',
          content: `아래는 오늘 한국 주요 정치 뉴스 헤드라인 목록입니다.

선택 기준:
1. 여러 매체가 동시에 다루는 화제성 높은 이슈
2. 여야 또는 정치 진영 간 대립 구도가 명확한 이슈
3. 국민 생활에 실질적 영향이 있는 이슈

선택한 이슈를 한국 정치 토론 논제로 재작성하세요:
- 언론사명·기자명·따옴표 인용 제거
- 대립 구도 명확히 (A vs B 또는 쟁점 중심)
- 20~35자 한 줄

JSON만 출력: {"topic": "논점 제목"}

헤드라인 목록:
${headlines}`,
        }],
        max_tokens: 120,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return items[0]?.title || null;
    const parsed = JSON.parse(content);
    return parsed.topic && parsed.topic.length >= 5 ? parsed.topic : items[0]?.title || null;
  } catch {
    return items[0]?.title || null;
  }
}

// ── 메인 핸들러 ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const todayKST = toKSTDate(new Date());
  const force = req.query.force === '1';
  const secret = req.query.secret;
  const expectedSecret = process.env.WARMUP_SECRET || 'polichat-warmup-2026';

  // 1) Supabase 캐시: 오늘 이슈 있으면 그대로 반환 (하루에 하나 고정)
  if (!force || secret !== expectedSecret) {
    try {
      const cached = await getRecentIssues(1);
      const todayCached = cached.find(r => r.date === todayKST);
      if (todayCached?.title) {
        return res.json({ issues: [{ title: todayCached.title, source: 'cached', publishedAt: new Date().toISOString() }] });
      }
    } catch {}
  }

  // 2) 여러 RSS 피드에서 어제 자정 이후 기사 수집
  try {
    const items = await collectAllItems();

    if (items.length === 0) {
      return res.json({ issues: [{ title: '오늘의 이슈 분석 중', source: 'fallback', publishedAt: new Date().toISOString() }] });
    }

    // 3) LLM으로 가장 화제 이슈 1개 선택 + 논점 제목 생성
    const debateTopic = await selectTopDebateTopic(items);
    if (!debateTopic) {
      return res.json({ issues: [{ title: '오늘의 이슈 분석 중', source: 'fallback', publishedAt: new Date().toISOString() }] });
    }

    // 4) Supabase에 오늘 날짜로 고정 저장
    await saveIssueForDate(todayKST, debateTopic);

    return res.json({ issues: [{ title: debateTopic, source: 'rss', publishedAt: new Date().toISOString() }] });
  } catch (e) {
    console.error('[issues] error:', e);
    return res.json({ issues: [{ title: '정치 이슈 로딩 실패', source: 'error', publishedAt: new Date().toISOString() }] });
  }
}
