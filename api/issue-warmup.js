import { createClient } from '@supabase/supabase-js';
import { saveIssueForDate, toKSTDate } from './issue-history.js';

const DEBATE_TYPES = ['seoul', 'national', 'leejeon', 'kimjin', 'hanhong'];

const SPEAKER_MAP = {
  seoul:    { A: '오세훈',  B: '정원오'  },
  national: { A: '정청래', B: '장동혁'  },
  leejeon:  { A: '이준석', B: '전한길'  },
  kimjin:   { A: '김어준', B: '진중권'  },
  hanhong:  { A: '한동훈', B: '홍준표'  },
};

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function isAlreadyCached(supabase, debateType, issue) {
  if (!supabase) return false;
  try {
    const styleKey = `${debateType}||${issue.slice(0, 80)}`;
    const cutoff = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('debate_cache')
      .select('created_at')
      .eq('topic', '__issue_kb__')
      .eq('style', styleKey)
      .eq('debate_type', debateType)
      .gte('created_at', cutoff)
      .limit(1)
      .single();
    return !!data;
  } catch { return false; }
}

async function saveToSupabase(supabase, debateType, issue, dynamicKB) {
  if (!supabase) return;
  try {
    const styleKey = `${debateType}||${issue.slice(0, 80)}`;
    await supabase.from('debate_cache').insert({
      topic: '__issue_kb__',
      style: styleKey,
      debate_type: debateType,
      messages: [{ role: 'kb', content: JSON.stringify(dynamicKB) }],
      version: 1,
    });
  } catch (e) {
    console.error('[warmup] Supabase save error:', e.message);
  }
}

function stripMediaName(title) {
  return title
    .replace(/\s*[-–—]\s*(조선일보|동아일보|중앙일보|한겨레|경향신문|뉴스1|연합뉴스|YTN|MBC|KBS|SBS|JTBC|TV조선|채널A|매일경제|한국경제|아시아경제|세계일보|국민일보|문화일보|데일리안|오마이뉴스|v\.daum\.net)[^\n]*/gi, '')
    .replace(/\s*"[^"]*"$/g, '').trim();
}

async function fetchTopIssue(todayKST) {
  // 오늘 이슈 이미 있으면 재사용 (하루 1개 고정)
  const cached = await getRecentIssues(1);
  const todayCached = cached.find(r => r.date === todayKST);
  if (todayCached?.title) return todayCached.title;

  // 여러 피드 동시 수집 (어제 자정 이후)
  const FEEDS = [
    'https://news.google.com/rss/search?q=%ED%95%9C%EA%B5%AD+%EC%A0%95%EC%B9%98&hl=ko&gl=KR&ceid=KR:ko',
    'https://www.ytn.co.kr/_ln/0101_rss.xml',
    'https://rss.donga.com/politics.xml',
    'https://www.hani.co.kr/rss/politics/',
  ];
  const kstNow = Date.now() + 9 * 60 * 60 * 1000;
  const kstMidnight = new Date(new Date(kstNow).toISOString().slice(0, 10) + 'T00:00:00+09:00').getTime();
  const cutoff = kstMidnight - 24 * 60 * 60 * 1000;

  const results = await Promise.allSettled(FEEDS.map(async url => {
    const r = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!r.ok) return [];
    const xml = await r.text();
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => {
      const raw = m[1].match(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>/)?.[1]
        || m[1].match(/<title>([^<]+)<\/title>/)?.[1] || '';
      const title = stripMediaName(raw.replace(/<[^>]+>/g, '').trim());
      const pubRaw = m[1].match(/<pubDate>([^<]+)<\/pubDate>/)?.[1] || '';
      return { title, publishedAt: pubRaw ? new Date(pubRaw).toISOString() : new Date().toISOString() };
    }).filter(i => i.title.length >= 10 && !i.title.includes('광고')
      && new Date(i.publishedAt).getTime() >= cutoff);
  }));

  const items = results.filter(r => r.status === 'fulfilled').flatMap(r => r.value).slice(0, 40);
  if (items.length === 0) return null;

  // LLM으로 화제 이슈 선택 + 논점화
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return items[0]?.title || null;
  const headlines = items.map((it, i) => `${i + 1}. ${it.title}`).join('\n');
  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-4o',
        messages: [{ role: 'user', content: `아래 한국 정치 뉴스 헤드라인 중 오늘 가장 화제가 되고 여야 대립 구도가 명확한 이슈 1개를 선택해 토론 논제로 재작성하세요.\n조건: 언론사명 제거, 대립구도 명확, 20~35자\nJSON만 출력: {"topic": "..."}\n\n${headlines}` }],
        max_tokens: 100, temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(20000),
    });
    const d = await r.json();
    const content = d.choices?.[0]?.message?.content?.trim();
    const parsed = content ? JSON.parse(content) : null;
    return parsed?.topic?.length >= 5 ? parsed.topic : items[0].title;
  } catch { return items[0].title; }
}

async function generateKB(issue, debateType) {
  const speakers = SPEAKER_MAP[debateType] || { A: 'A', B: 'B' };
  const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_KEY) return null;

  const prompt = `당신은 한국 정치 토론 전문가입니다. 다음 이슈에 대해 두 정치인의 토론 논거를 JSON으로 생성해주세요.

이슈: "${issue}"
토론 참가자: ${speakers.A} (A) vs ${speakers.B} (B)

아래 JSON 형식으로만 응답하세요:
{
  "issueSummary": "이슈 1-2문장 요약",
  "keyFacts": ["팩트1 (날짜/출처 포함)", "팩트2", "팩트3", "팩트4", "팩트5"],
  "speakerAPoints": ["${speakers.A} 주장1", "주장2", "주장3", "주장4", "주장5"],
  "speakerBPoints": ["${speakers.B} 주장1", "주장2", "주장3", "주장4", "주장5"],
  "attackPoints": {
    "A": ["${speakers.A}→${speakers.B} 공격1", "공격2", "공격3"],
    "B": ["${speakers.B}→${speakers.A} 공격1", "공격2", "공격3"]
  }
}`;

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json();
    return JSON.parse(data.choices?.[0]?.message?.content || 'null');
  } catch (e) {
    console.error('[warmup] LLM error:', e.message);
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const secret = req.query.secret || req.headers['x-warmup-secret'];
  const expectedSecret = process.env.WARMUP_SECRET || 'polichat-warmup-2026';
  if (!isVercelCron && secret !== expectedSecret) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const todayKST = toKSTDate();

  // 1. 오늘 이슈 1개 가져오기 (캐시 우선)
  const issueTitle = await fetchTopIssue(todayKST);
  if (!issueTitle) {
    return res.status(200).json({ warmed: 0, message: 'no issues found' });
  }

  await saveIssueForDate(todayKST, issueTitle);

  const supabase = getSupabase();

  // 2. 5개 매치업 병렬 생성
  const tasks = DEBATE_TYPES.map(async (type) => {
    // 이미 캐시됐으면 스킵
    if (await isAlreadyCached(supabase, type, issueTitle)) {
      return { type, status: 'skipped (cached)' };
    }
    const kb = await generateKB(issueTitle, type);
    if (!kb) return { type, status: 'error: LLM failed' };
    await saveToSupabase(supabase, type, issueTitle, kb);
    return { type, status: 'ok' };
  });

  const results = await Promise.all(tasks);
  const succeeded = results.filter(r => r.status === 'ok').length;
  const skipped = results.filter(r => r.status?.includes('skipped')).length;
  const failed = results.filter(r => r.status?.includes('error')).length;

  return res.status(200).json({
    issue: issueTitle,
    warmed: succeeded,
    skipped,
    failed,
    results,
  });
}
