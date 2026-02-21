import { useEffect, useMemo, useState } from 'react';

export interface ResearchHeadline {
  title: string;
  source?: string;
  pubDate?: string;
}

export interface ResearchResult {
  dynamicKB: any;
  headlines: ResearchHeadline[];
  issue: string;
  type: string;
  speakers: {
    A: string;
    B: string;
  };
  cached?: boolean;
}

interface Props {
  issue: string;
  onComplete: (result: ResearchResult) => void;
  onError: () => void;
}

const phases = [
  { icon: '📡', label: '뉴스 수집 중' },
  { icon: '🔍', label: '팩트 분석 중' },
  { icon: '🧠', label: '논거 구성 중' },
  { icon: '⚡', label: '토론 준비 완료' },
];

export default function IssueResearchLoader({ issue, onComplete, onError }: Props) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState(0);
  const [completedPhases, setCompletedPhases] = useState<number[]>([]);
  const [headlines, setHeadlines] = useState<string[]>([]);

  const particles = useMemo(
    () =>
      Array.from({ length: 10 }).map((_, i) => {
        const size = 4 + ((i % 4) * 2);
        return {
          id: i,
          size,
          left: `${8 + i * 9}%`,
          animDuration: `${3 + (i % 5)}s`,
          animDelay: `${(i * 0.45) % 2.2}s`,
          opacity: 0.15 + ((i % 3) * 0.08),
        };
      }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    let completionTimer: ReturnType<typeof setTimeout> | null = null;
    let fakeTimer: ReturnType<typeof setInterval> | null = null;
    let requestTimeout: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();

    const moveToNextPhase = (nextPhase: number, donePhase: number) => {
      if (cancelled) return;
      setPhase(nextPhase);
      setCompletedPhases((prev) => (prev.includes(donePhase) ? prev : [...prev, donePhase]));
    };

    fakeTimer = setInterval(() => {
      if (cancelled) return;
      setProgress((prev) => {
        const next = Math.min(prev + 1.4, 85);
        if (next >= 30) moveToNextPhase(1, 0);
        if (next >= 60) moveToNextPhase(2, 1);
        if (next >= 85) moveToNextPhase(3, 2);
        return next;
      });
    }, 40);

    requestTimeout = setTimeout(() => {
      if (!cancelled) {
        controller.abort();
        onError();
      }
    }, 30000);

    const issueType = new URLSearchParams(window.location.search).get('type') || 'leejeon';
    fetch(`/api/issue-research?issue=${encodeURIComponent(issue)}&type=${encodeURIComponent(issueType)}`, {
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}`);
        }
        const data = (await r.json()) as ResearchResult;
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        if (fakeTimer) clearInterval(fakeTimer);
        if (requestTimeout) clearTimeout(requestTimeout);

        if (Array.isArray(data.headlines)) {
          setHeadlines(data.headlines.map((h) => h?.title).filter(Boolean).slice(0, 5) as string[]);
        }
        setCompletedPhases([0, 1, 2, 3]);
        setPhase(3);
        setProgress(100);

        completionTimer = setTimeout(() => {
          if (!cancelled) onComplete(data);
        }, 600);
      })
      .catch(() => {
        if (cancelled) return;
        if (fakeTimer) clearInterval(fakeTimer);
        if (requestTimeout) clearTimeout(requestTimeout);
        onError();
      });

    return () => {
      cancelled = true;
      if (fakeTimer) clearInterval(fakeTimer);
      if (requestTimeout) clearTimeout(requestTimeout);
      if (completionTimer) clearTimeout(completionTimer);
      controller.abort();
    };
  }, [issue, onComplete, onError]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden text-white" style={{ background: '#080818' }}>
      {/* Floating particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full bg-orange-400"
          style={{
            width: p.size,
            height: p.size,
            left: p.left,
            opacity: p.opacity,
            animation: `floatUp ${p.animDuration} ${p.animDelay} ease-in-out infinite alternate`,
          }}
        />
      ))}

      <style>{`
        @keyframes floatUp {
          0% { transform: translateY(60vh) scale(0.8); }
          100% { transform: translateY(-10vh) scale(1.2); }
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.6); }
        }
        @keyframes headlineScroll {
          0% { transform: translateX(110%); }
          100% { transform: translateX(-110%); }
        }
      `}</style>

      <div className="relative z-10 w-full max-w-lg px-6">
        <p className="text-xs uppercase tracking-[0.22em] text-orange-400 mb-3">오늘의 이슈</p>
        <h2 className="text-white text-lg md:text-2xl font-black leading-snug mb-8">{issue}</h2>

        <div className="mb-8 space-y-3">
          {phases.map((item, i) => {
            const isDone = completedPhases.includes(i);
            const isActive = phase === i;

            return (
              <div
                key={`${item.label}-${i}`}
                className={`flex items-center gap-3 transition-all duration-500 ${
                  isActive ? 'opacity-100' : isDone ? 'opacity-70' : 'opacity-25'
                }`}
              >
                <span className="text-lg w-6 text-center">{isDone ? '✅' : isActive ? item.icon : '○'}</span>
                <span className={`text-sm ${isActive ? 'text-white font-semibold' : 'text-gray-400'}`}>{item.label}</span>
                {isActive && (
                  <span className="ml-auto flex gap-1">
                    {[0, 1, 2].map((d) => (
                      <span
                        key={d}
                        className="w-1.5 h-1.5 rounded-full bg-orange-400"
                        style={{ animation: `pulseDot 0.8s ${d * 0.2}s ease-in-out infinite` }}
                      />
                    ))}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="mb-7 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left">
          <p className="text-xs text-gray-400 mb-2">수집된 뉴스</p>
          {headlines.length > 0 ? (
            <div className="space-y-1">
              {headlines.slice(0, 3).map((headline) => (
                <div key={headline} className="text-sm leading-relaxed text-gray-200 truncate">
                  {headline}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {[1, 2, 3].map((idx) => (
                <div
                  key={`loading-${idx}`}
                  className="h-4 rounded-full bg-white/10 animate-pulse"
                  style={{ width: `${58 + idx * 12}%` }}
                />
              ))}
            </div>
          )}
        </div>

        {headlines.length > 0 && (
          <div className="mb-6 overflow-hidden rounded-lg bg-black/30 border border-white/10 px-3 py-2">
            <p className="text-xs text-gray-300">실시간 헤드라인</p>
            <div className="space-y-2 mt-2">
              {headlines.map((headline, idx) => (
                <p
                  key={headline}
                  className="text-white text-sm whitespace-nowrap"
                  style={{ animation: `headlineScroll 8s linear infinite`, animationDelay: `${idx * 1.2}s` }}
                >
                  {headline}
                </p>
              ))}
            </div>
          </div>
        )}

        <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${progress}%`, background: 'linear-gradient(to right, #f97316, #ef4444)' }}
          />
        </div>
        <p className="mt-2 text-xs text-gray-400 text-right">{Math.round(progress)}%</p>
      </div>
    </div>
  );
}
