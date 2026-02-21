const DEBATE_TYPES = ['seoul', 'national', 'leejeon', 'kimjin', 'hanhong'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Vercel cron 자동 호출 or 수동 호출 허용
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const secret = req.query.secret || req.headers['x-warmup-secret'];
  const expectedSecret = process.env.WARMUP_SECRET || 'polichat-warmup-2026';
  if (!isVercelCron && secret !== expectedSecret) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const baseUrl = process.env.VERCEL_URL
    ? 'https://' + process.env.VERCEL_URL
    : 'https://polichat.kr';

  // 1. 오늘 이슈 가져오기
  let issues = [];
  try {
    const issuesRes = await fetch(baseUrl + '/api/issues', { signal: AbortSignal.timeout(8000) });
    const data = await issuesRes.json();
    issues = (data.issues || []).slice(0, 1);
  } catch (e) {
    return res.status(500).json({ error: 'failed to fetch issues', detail: e.message });
  }

  if (issues.length === 0) {
    return res.status(200).json({ warmed: 0, message: 'no issues found' });
  }

  // 2. 모든 조합 병렬 프리워밍
  const tasks = [];
  for (const iss of issues) {
    for (const type of DEBATE_TYPES) {
      const url = baseUrl + '/api/issue-research?issue=' + encodeURIComponent(iss.title) + '&type=' + type;
      tasks.push(
        fetch(url, { signal: AbortSignal.timeout(35000) })
          .then(r => r.json())
          .then(d => ({ issue: iss.title.slice(0, 30), type, status: 'ok', cached: d.cached || 'generated' }))
          .catch(e => ({ issue: iss.title.slice(0, 30), type, status: 'error', error: e.message }))
      );
    }
  }

  const results = await Promise.all(tasks);
  const succeeded = results.filter(r => r.status === 'ok').length;
  const failed = results.filter(r => r.status === 'error').length;

  return res.status(200).json({ warmed: succeeded, failed, total: tasks.length, results });
}

