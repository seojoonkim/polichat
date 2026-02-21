/**
 * issue-backfill.js
 * RSS에서 최근 N일치 이슈 가져와서 날짜별 1개씩 Supabase 저장 + KB 워밍
 * 호출: GET /api/issue-backfill?secret=polichat-warmup-2026&days=3
 */
import { createClient } from '@supabase/supabase-js';
import { saveIssueForDate, toKSTDate, getRecentIssues } from './issue-history.js';

const DEBATE_TYPES = ['seoul', 'national', 'leejeon', 'kimjin', 'hanhong'];

const SPEAKER_MAP = {
  seoul:    { A: '오세훈',  B: '정원오'  },
  national: { A: '정청래', B: '장동혁'  },
  leejeon:  { A: '이준석', B: '전한길'  },
  kimjin:   { A: '김어준', B: '진중권'  },
  hanhong:  { A: '한동훈', B: '홍준표'  },
};

const RSS_FEEDS = [
  'https://www.ytn.co.kr/_ln/0101_rss.xml',
  'https://rss.donga.com/politics.xml',
  'https://www.hani.co.kr/rss/politics/',
];

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/** pubDate 문자열 → KST YYYY-MM-DD */
function pubDateToKST(pubDateStr) {
  try {
    const d = new Date(pubDateStr);
    if (isNaN(d.getTime())) return null;
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 10);
  } catch { return null; }
}

/** RSS 전체 파싱 → [{date, title}] */
async function fetchAllItems(feedUrl) {
  try {
    const res = await fetch(feedUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    return items.map(m => {
      const raw = m[1].match(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>/)?.[1]
        || m[1].match(/<title>([^<]+)<\/title>/)?.[1] || '';
      const title = raw.replace(/<[^>]+>/g, '').trim();
      const pubDateRaw = m[1].match(/<pubDate>([^<]+)<\/pubDate>/)?.[1] || '';
      const date = pubDateToKST(pubDateRaw);
      return { title, date };
    }).filter(i => i.title.length >= 10 && i.date);
  } catch { return []; }
}

/** 날짜별 이슈 맵 생성: { '2026-02-20': '이슈 제목', ... } */
async function buildDateIssueMap(days) {
  const allItems = [];
  for (const url of RSS_FEEDS) {
    const items = await fetchAllItems(url);
    allItems.push(...items);
    if (allItems.length >= 60) break;
  }

  // 날짜별 그룹화 (첫 번째 정치 뉴스 선택)
  const dateMap = {};
  for (const item of allItems) {
    if (!item.date || dateMap[item.date]) continue;
    if (item.title.includes('광고') || item.title.length < 10) continue;
    dateMap[item.date] = item.title;
  }

  // 최근 days일치만 반환
  const today = toKSTDate();
  const result = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() + 9 * 60 * 60 * 1000 - i * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    if (dateMap[dateStr]) result[dateStr] = dateMap[dateStr];
  }
  return result;
}

async function isKBCached(supabase, debateType, issue) {
  if (!supabase) return false;
  try {
    const styleKey = `${debateType}||${issue.slice(0, 80)}`;
    const { data } = await supabase
      .from('debate_cache')
      .select('created_at')
      .eq('topic', '__issue_kb__')
      .eq('style', styleKey)
      .eq('debate_type', debateType)
      .limit(1)
      .single();
    return !!data;
  } catch { return false; }
}

async function saveKB(supabase, debateType, issue, dynamicKB) {
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
  } catch (e) { console.error('[backfill] KB save error:', e.message); }
}

async function generateKB(issue, debateType) {
  const speakers = SPEAKER_MAP[debateType] || { A: 'A', B: 'B' };
  const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_KEY) return null;

  const prompt = `당신은 한국 정치 토론 전문가입니다. 다음 이슈에 대해 두 정치인의 토론 논거를 JSON으로 생성하세요.

이슈: "${issue}"
토론 참가자: ${speakers.A} (A) vs ${speakers.B} (B)

JSON 형식으로만 응답:
{
  "issueSummary": "이슈 1-2문장 요약",
  "keyFacts": ["팩트1 (날짜/출처 포함)", "팩트2", "팩트3", "팩트4"],
  "speakerAPoints": ["${speakers.A} 주장1", "주장2", "주장3", "주장4"],
  "speakerBPoints": ["${speakers.B} 주장1", "주장2", "주장3", "주장4"],
  "attackPoints": {
    "A": ["${speakers.A}→${speakers.B} 공격1", "공격2"],
    "B": ["${speakers.B}→${speakers.A} 공격1", "공격2"]
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
        max_tokens: 1200,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json();
    return JSON.parse(data.choices?.[0]?.message?.content || 'null');
  } catch (e) {
    console.error('[backfill] LLM error:', e.message);
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const secret = req.query.secret || req.headers['x-warmup-secret'];
  const expectedSecret = process.env.WARMUP_SECRET || 'polichat-warmup-2026';
  if (secret !== expectedSecret) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const days = parseInt(req.query.days || '4', 10); // 오늘 포함 4일치
  const supabase = getSupabase();

  // 이미 저장된 날짜 확인
  const existing = await getRecentIssues(days + 1);
  const existingDates = new Set(existing.map(r => r.date));

  // RSS에서 날짜별 이슈 가져오기
  const dateIssueMap = await buildDateIssueMap(days);
  const log = [];

  for (const [date, issueTitle] of Object.entries(dateIssueMap)) {
    // 이미 저장된 날짜는 히스토리 저장 스킵 (KB는 재확인)
    if (!existingDates.has(date)) {
      await saveIssueForDate(date, issueTitle);
      log.push({ date, issue: issueTitle, histSaved: true });
    } else {
      log.push({ date, issue: issueTitle, histSaved: false, note: 'already existed' });
    }

    // 5개 매치업 KB 워밍 (순차 실행 - rate limit 방지)
    let kbOk = 0, kbSkip = 0, kbFail = 0;
    for (const type of DEBATE_TYPES) {
      if (await isKBCached(supabase, type, issueTitle)) {
        kbSkip++;
        continue;
      }
      const kb = await generateKB(issueTitle, type);
      if (kb) {
        await saveKB(supabase, type, issueTitle, kb);
        kbOk++;
      } else {
        kbFail++;
      }
      // rate limit 방지: 1초 간격
      await new Promise(r => setTimeout(r, 1000));
    }
    log[log.length - 1].kb = { ok: kbOk, skipped: kbSkip, failed: kbFail };
  }

  return res.status(200).json({
    processed: Object.keys(dateIssueMap).length,
    dateIssueMap,
    log,
  });
}
