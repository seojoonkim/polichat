import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

interface IssueItem {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
}

function getTimeAgo(dateString: string): string {
  const now = Date.now();
  const target = new Date(dateString).getTime();
  const diff = Math.max(0, now - target);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return '방금 전';
  if (diff < hour) return `${Math.floor(diff / minute)}분 전`;
  if (diff < day) return `${Math.floor(diff / hour)}시간 전`;
  return `${Math.floor(diff / day)}일 전`;
}

export default function IssuesPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [issues, setIssues] = useState<IssueItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/issues');
        if (!res.ok) throw new Error('API 실패');
        const data = await res.json();
        if (!cancelled) {
          const list = Array.isArray(data?.issues) ? (data.issues as IssueItem[]) : [];
          setIssues(list);
        }
      } catch {
        if (!cancelled) {
          setIssues([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const todayLabel = useMemo(() => {
    return new Date().toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, []);

  return (
    <div className="min-h-screen app-bg">
      <div className="max-w-[700px] mx-auto px-4 pt-10 pb-8">
        <header className="flex items-center justify-between gap-3 mb-5">
          <div>
            <p className="text-xs text-gray-400">📰 오늘의 이슈 토론</p>
            <h1 className="text-2xl font-bold text-gray-900">오늘의 이슈 토론</h1>
            <p className="text-sm text-gray-500 mt-1">{todayLabel}</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="text-sm px-3 py-2 rounded-full border border-gray-200 text-gray-600 bg-white/70"
          >
            홈으로
          </button>
        </header>

        {loading ? (
          <div className="space-y-3">
            <div className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
            <div className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
            <div className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
          </div>
        ) : (
          <div className="space-y-3">
            {issues.slice(0, 1).map((issue) => (
              <div
                key={`${issue.url}-${issue.publishedAt}`}
                className="rounded-2xl bg-white border border-gray-200 p-4 flex flex-col gap-3"
              >
                <div className="flex items-end justify-end gap-3">
                  <span className="text-xs text-gray-400 whitespace-nowrap">{getTimeAgo(issue.publishedAt)}</span>
                </div>
                <p className="text-base font-semibold text-gray-900 leading-snug">{issue.title}</p>
                <button
                  onClick={() =>
                    navigate(`/debate?type=leejeon&issue=${encodeURIComponent(issue.title)}`)
                  }
                  className="self-start inline-flex px-3 py-2 rounded-full text-sm font-semibold text-white"
                  style={{
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  }}
                >
                  이 이슈로 토론 →
                </button>
              </div>
            ))}

            {issues.length === 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white p-6 text-gray-500 text-sm">
                이슈 정보를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
