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

async function reformatToDebateTopic(rawTitle) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return rawTitle;
  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-4o',
        messages: [{ role: 'user', content: `다음 뉴스 헤드라인을 한국 정치 토론 논제로 재작성하세요.\n조건: 언론사명·기자명·따옴표 제거, 정치적 대립구도 명확, 20-35자, 제목만 출력\n\n헤드라인: "${rawTitle}"` }],
        max_tokens: 80, temperature: 0.3,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const d = await r.json();
    const result = d.choices?.[0]?.message?.content?.trim();
    return result?.length >= 5 ? result : rawTitle;
  } catch { return rawTitle; }
}

async function fetchTopIssue(todayKST) {
  // 오늘 이슈 이미 있으면 재사용 (자꾸 바뀌는 문제 방지)
  const { getRecentIssues } = await import('./issue-history.js');
  const cached = await getRecentIssues(1);
  const todayCached = cached.find(r => r.date === todayKST);
  if (todayCached?.title) return todayCached.title;

  const feeds = [
    { url: 'https://www.ytn.co.kr/_ln/0101_rss.xml' },
    { url: 'https://rss.donga.com/politics.xml' },
  ];
  for (const feed of feeds) {
    try {
      const res = await fetch(feed.url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) continue;
      const xml = await res.text();
      const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 5);
      for (const m of items) {
        const raw = m[1].match(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>/)?.[1]
          || m[1].match(/<title>([^<]+)<\/title>/)?.[1] || '';
        const title = stripMediaName(raw.replace(/<[^>]+>/g, '').trim());
        if (title.length >= 10 && !title.includes('광고')) {
          return await reformatToDebateTopic(title);
        }
      }
    } catch {}
  }
  return null;
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
