const MODULE_CACHE = new Map(); // key: `${type}::${issue}`
const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours

function toIssueError(message) {
  return { error: message };
}

function extractTitleFromCData(raw) {
  if (!raw) return '';
  return raw
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/<[^>]+>/g, '')
    .trim();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { issue, type } = req.query || {};
  if (!issue || !type) {
    return res.status(400).json(toIssueError('missing params'));
  }

  const cacheKey = `${type}::${issue}`;
  const cached = MODULE_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return res.status(200).json({ ...cached.data, cached: true });
  }

  // 1. Fetch Google News RSS for this topic
  const query = encodeURIComponent(issue);
  const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=ko&gl=KR&ceid=KR:ko`;

  let headlines = [];
  try {
    const rssRes = await fetch(rssUrl, { signal: AbortSignal.timeout(5000) });
    const xml = await rssRes.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 8);
    headlines = items
      .map((m) => {
        const body = m[1] || '';
        const titleMatch = body.match(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>/) || body.match(/<title>([^<]+)<\/title>/);
        const sourceMatch = body.match(/<source[^>]*>([^<]+)<\/source>/);
        const pubDateMatch = body.match(/<pubDate>([^<]+)<\/pubDate>/);

        const title = extractTitleFromCData(titleMatch?.[1] || titleMatch?.[0] || '').trim() || '';
        const source = (sourceMatch?.[1] || '').trim();
        const pubDate = (pubDateMatch?.[1] || '').trim();
        return { title, source, pubDate };
      })
      .filter((item) => item.title && item.title.length > 5);
  } catch (_e) {
    // continue with empty headlines
  }

  // 2. Get speaker names for this debate type
  const speakerMap = {
    seoul: { A: '오세훈', B: '정원오' },
    national: { A: '정청래', B: '장동혁' },
    leejeon: { A: '이준석', B: '전한길' },
    kimjin: { A: '김어준', B: '진중권' },
    hanhong: { A: '한동훈', B: '홍준표' },
  };
  const speakers = speakerMap[type] || { A: 'A', B: 'B' };

  // 3. Call LLM (OpenRouter) to build dynamic KB
  const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

  const headlineContext = headlines.length > 0
    ? `관련 뉴스 헤드라인:\n${headlines
      .map((h, i) => `${i + 1}. [${h.source}] ${h.title}`)
      .join('\n')}`
    : '관련 뉴스 헤드라인 없음 — 일반 지식 기반으로 추론하세요.';

  const prompt = `당신은 한국 정치 토론 전문가입니다. 다음 이슈에 대해 두 정치인의 토론 논거를 JSON으로 생성해주세요.

이슈: "${issue}"
토론 참가자: ${speakers.A} (A) vs ${speakers.B} (B)

${headlineContext}

아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "issueSummary": "이슈 1-2문장 요약",
  "keyFacts": ["팩트1 (출처/날짜 포함)", "팩트2", "팩트3", "팩트4", "팩트5"],
  "speakerAPoints": [
    "${speakers.A}의 핵심 주장 1",
    "${speakers.A}의 핵심 주장 2", 
    "${speakers.A}의 핵심 주장 3",
    "${speakers.A}의 핵심 주장 4",
    "${speakers.A}의 핵심 주장 5"
  ],
  "speakerBPoints": [
    "${speakers.B}의 핵심 주장 1",
    "${speakers.B}의 핵심 주장 2",
    "${speakers.B}의 핵심 주장 3",
    "${speakers.B}의 핵심 주장 4",
    "${speakers.B}의 핵심 주장 5"
  ],
  "attackPoints": {
    "A": ["${speakers.A}가 ${speakers.B}를 공격할 포인트 1", "포인트 2", "포인트 3"],
    "B": ["${speakers.B}가 ${speakers.A}를 공격할 포인트 1", "포인트 2", "포인트 3"]
  },
  "sources": ["출처1", "출처2"]
}`;

  let dynamicKB = null;
  try {
    if (OPENROUTER_KEY) {
      const llmRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
        signal: AbortSignal.timeout(25000),
      });
      const llmData = await llmRes.json();
      const raw = llmData?.choices?.[0]?.message?.content || '{}';
      dynamicKB = JSON.parse(raw);
    }
  } catch (_e) {
    // fallback: minimal KB
  }

  if (!dynamicKB || typeof dynamicKB !== 'object') {
    dynamicKB = {
      issueSummary: issue,
      keyFacts: [`${issue} 관련 토론`],
      speakerAPoints: [`${speakers.A}의 입장에서 ${issue}를 분석합니다.`],
      speakerBPoints: [`${speakers.B}의 입장에서 ${issue}를 분석합니다.`],
      attackPoints: { A: [], B: [] },
      sources: [],
    };
  }

  const result = { dynamicKB, headlines, issue, type, speakers };
  MODULE_CACHE.set(cacheKey, { data: result, ts: Date.now() });

  return res.status(200).json(result);
}

