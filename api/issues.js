const CACHE_TTL_MS = 30 * 60 * 1000;
const FALLBACK_ITEMS = [
  {
    title: '국회, AI 공약 검증을 위한 특별 검토기구 출범 논의',
    source: 'YTN',
    url: 'https://www.ytn.co.kr/_ln/0101_rss.xml',
    publishedAt: new Date().toISOString(),
  },
  {
    title: '국정현안별 정책 과제 토론, 지방선거 구도에 미치는 영향 분석',
    source: '동아일보',
    url: 'https://www.donga.com/',
    publishedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
  {
    title: '국민의 알권리 강화를 위한 정보 공개 제도 개선 필요성',
    source: '동아일보',
    url: 'https://www.donga.com/',
    publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
];

let issuesCache = null;
let cacheUpdatedAt = 0;

function decodeHtmlEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripCdataAndTags(raw) {
  if (!raw) return '';
  const cdata = raw.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1');
  return cdata.replace(/<[^>]+>/g, '').trim();
}

function parseRssItems(xmlText, source) {
  const items = [];
  const normalized = xmlText || '';
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match = null;

  while ((match = itemRegex.exec(normalized)) !== null) {
    const itemBlock = match[1] || '';
    const titleMatch = itemBlock.match(/<title>([\s\S]*?)<\/title>/i);
    const linkMatch = itemBlock.match(/<link>([\s\S]*?)<\/link>/i);
    const pubDateMatch = itemBlock.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);

    const title = stripCdataAndTags(decodeHtmlEntities((titleMatch?.[1] || '').trim()));
    const url = stripCdataAndTags(decodeHtmlEntities((linkMatch?.[1] || '').trim()));
    const pubDate = (pubDateMatch?.[1] || '').trim();

    if (!title || title.length < 10) continue;
    if (title.includes('광고')) continue;

    items.push({
      title,
      source,
      url,
      publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
    });
  }

  return items;
}

async function fetchIssueFeed(url, source) {
  const res = await fetch(url);
  if (!res.ok) return [];
  const text = await res.text();
  return parseRssItems(text, source);
}

async function getLatestIssues() {
  const now = Date.now();
  if (issuesCache && now - cacheUpdatedAt < CACHE_TTL_MS) {
    return issuesCache;
  }

  try {
    const [ytnItems, dongAItems] = await Promise.all([
      fetchIssueFeed('https://www.ytn.co.kr/_ln/0101_rss.xml', 'YTN'),
      fetchIssueFeed('https://rss.donga.com/politics.xml', '동아일보'),
    ]);
    const items = [...ytnItems, ...dongAItems]
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 1);

    if (items.length > 0) {
      issuesCache = items;
      cacheUpdatedAt = now;
      return items;
    }
  } catch (error) {
    console.error('[issues] fetch error:', error);
  }

  return FALLBACK_ITEMS;
}

export default async function handler(_req, res) {
  const items = await getLatestIssues();
  res.json({ issues: items });
}
