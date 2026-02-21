# Codex Task: Tab UX + Bug Fixes + Issue History

## BUG FIX 1: 1:1 대화 탭 카드 안 보이는 버그

File: `src/components/chat/PoliticianSelector.tsx`

The reveal-card useEffect only fires on `politicians` change. When switching to chat tab, newly mounted cards never get `.revealed` class.

Fix: Change the useEffect to also fire when `activeTab === "chat"`:

```tsx
useEffect(() => {
  if (activeTab !== 'chat') return;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const kickoff = setTimeout(() => {
    cardsRef.current.forEach((el) => {
      if (!el) return;
      el.classList.remove('revealed');
      const delay = Number(el.dataset.revealDelay || '0');
      const t = setTimeout(() => el.classList.add('revealed'), delay + 50);
      timers.push(t);
    });
  }, 30);
  timers.push(kickoff);
  return () => timers.forEach(clearTimeout);
}, [politicians, activeTab]);
```

## UX FIX 2: 탭 디자인 - 이모지 → SVG 아이콘

File: `src/components/chat/PoliticianSelector.tsx`

Replace the TABS array that currently uses emoji strings with SVG icon functions.
Replace:
```tsx
{ id: "battle", icon: "⚔️", label: "토론 배틀" },
{ id: "chat",   icon: "💬", label: "1:1 대화"  },
{ id: "issue",  icon: "📰", label: "오늘의 이슈" },
```

With:
```tsx
const TABS = [
  {
    id: 'battle' as TabId,
    label: '토론 배틀',
    icon: (active: boolean) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#7c3aed' : '#9ca3af'} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 17.5L3 6V3h3l11.5 11.5"/>
        <path d="M13 19l6-6M16 16l4 4M19 21l2-2"/>
        <path d="M14.5 6.5L18 3h3v3L9.5 17.5"/>
        <path d="M5 14l4 4M7 21l2-2"/>
      </svg>
    ),
  },
  {
    id: 'chat' as TabId,
    label: '1:1 대화',
    icon: (active: boolean) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#7c3aed' : '#9ca3af'} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    id: 'issue' as TabId,
    label: '오늘의 이슈',
    icon: (active: boolean) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#7c3aed' : '#9ca3af'} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
      </svg>
    ),
  },
];
```

Update the tab bar render to call `tab.icon(isActive)` instead of `{tab.icon}`.

Also update the tab bar container styling:
```tsx
<div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
  <div className="flex">
    {TABS.map((tab) => {
      const isActive = activeTab === tab.id;
      return (
        <button
          key={tab.id}
          onClick={() => switchTab(tab.id)}
          className={`flex-1 flex flex-col items-center gap-1 pt-3 pb-2.5 relative transition-colors duration-200`}
        >
          {tab.icon(isActive)}
          <span className={`text-[11px] font-semibold tracking-tight ${isActive ? 'text-violet-700' : 'text-gray-400'}`}>
            {tab.label}
          </span>
          {isActive && (
            <span className="absolute bottom-0 left-4 right-4 h-[2px] bg-violet-600 rounded-full" />
          )}
          {tab.id === 'issue' && heroIssue && !isActive && (
            <span className="absolute top-2 right-[calc(50%-14px)] w-2 h-2 bg-red-500 rounded-full border border-white" />
          )}
        </button>
      );
    })}
  </div>
</div>
```

## FEATURE 3: 이슈 날짜별 누적 (오늘 + 3일치)

### A. api/issue-history.js (NEW FILE)

```js
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
      title: row.messages && row.messages[0] && row.messages[0].content ? row.messages[0].content : '',
    })).filter((r) => r.title);
  } catch (e) {
    return [];
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const issues = await getRecentIssues(4);
  return res.status(200).json({ issues });
}
```

### B. Modify api/issue-warmup.js

At the top, add:
```js
import { saveIssueForDate, toKSTDate } from './issue-history.js';
```

After fetching `issueTitle`, save to history:
```js
const todayKST = toKSTDate();
await saveIssueForDate(todayKST, issueTitle);
```

### C. Frontend: Issue tab with date-grouped history

In `src/components/chat/PoliticianSelector.tsx`:

Add state and helpers near other useState declarations:
```tsx
const [issueHistory, setIssueHistory] = useState<{date: string; title: string}[]>([]);
const todayKST = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

function formatIssueDate(dateStr: string): string {
  const parts = dateStr.split('-');
  return `${parseInt(parts[1])}월 ${parseInt(parts[2])}일`;
}
```

In the useEffect that fetches /api/issues (after setHeroIssue), also fetch history:
```tsx
fetch('/api/issue-history')
  .then((r) => r.json())
  .then((data) => {
    if (data?.issues?.length) setIssueHistory(data.issues);
  })
  .catch(() => {});
```

Replace the current `{activeTab === 'issue' && ...}` block with:
```tsx
{activeTab === 'issue' && (
  <div className="px-4 py-4 space-y-6">
    {(() => {
      // Build list: history first, fallback to today's hero issue
      const displayList = issueHistory.length > 0
        ? issueHistory
        : heroIssue?.title
        ? [{ date: todayKST, title: heroIssue.title }]
        : [];

      if (displayList.length === 0) {
        return (
          <p className="text-center text-gray-400 text-sm py-16">이슈를 불러오는 중...</p>
        );
      }

      return displayList.map((dayIssue) => {
        const isToday = dayIssue.date === todayKST;
        return (
          <div key={dayIssue.date} className="space-y-2.5">
            {/* Date label */}
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full
                ${isToday ? 'bg-violet-100 text-violet-700' : 'text-gray-400'}`}>
                {isToday ? '오늘' : formatIssueDate(dayIssue.date)}
              </span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            {/* Issue headline card */}
            <div className="rounded-2xl overflow-hidden" style={{background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)'}}>
              <div className="px-4 py-3.5">
                <p className="text-[10px] uppercase tracking-widest text-violet-300 mb-1.5">📰 오늘의 이슈</p>
                <p className="text-sm font-bold text-white leading-snug">{dayIssue.title}</p>
              </div>
            </div>

            {/* Matchup buttons */}
            <div className="space-y-1.5">
              {issueTypes.map((item) => (
                <button
                  key={item.value}
                  onClick={() => navigate(`/debate?type=${item.value}&issue=${encodeURIComponent(dayIssue.title)}`)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:border-violet-300 hover:bg-violet-50 active:scale-[0.98] transition-all duration-150"
                >
                  <span>{item.label}</span>
                  <span className="text-violet-500 text-xs font-bold">토론 시작 →</span>
                </button>
              ))}
            </div>
          </div>
        );
      });
    })()}
  </div>
)}
```

### D. vercel.json — add /api/issue-history route

Add before the /api/(.*) catch-all:
```json
{ "src": "/api/issue-history", "dest": "/api/issue-history.js" }
```

## GENERAL UX

### Issue teaser strip — update to violet brand color
```tsx
{activeTab !== 'issue' && heroIssue?.title && (
  <button
    onClick={() => switchTab('issue')}
    className="w-full flex items-center gap-2.5 px-4 py-2.5 bg-violet-50 border-b border-violet-100 text-left"
  >
    <span className="text-sm shrink-0">🔥</span>
    <span className="text-xs font-semibold text-violet-900 truncate flex-1">
      {heroIssue.title.length > 38 ? heroIssue.title.slice(0, 38) + '…' : heroIssue.title}
    </span>
    <span className="shrink-0 text-[10px] font-bold text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full whitespace-nowrap">이슈 토론 →</span>
  </button>
)}
```

### Section title cleanup
In the battle tab, replace the complex SVG + section title with simpler version:
```tsx
<p className="text-[12px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">
  AI 5분 토론
</p>
```

## AFTER CHANGES:
1. Run: npm run build
2. Fix any TypeScript errors until build passes
3. git add -A
4. git commit -m "fix: 1:1탭 카드버그 + SVG탭 + 이슈날짜누적 + UX개선"
5. git push origin main
6. Run: openclaw system event --text "Done: Tab UX improvements complete - card bug fixed, SVG tabs, date history, UX polish" --mode now
