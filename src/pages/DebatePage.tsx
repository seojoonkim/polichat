import { useSearchParams } from 'react-router';
import { useEffect, useState } from 'react';
import DebateView, { type DebateType } from '@/components/debate/DebateView';
import IssueResearchLoader, { type ResearchResult } from '@/components/debate/IssueResearchLoader';

const VALID_TYPES: DebateType[] = ['seoul', 'national', 'leejeon', 'kimjin', 'hanhong'];

const LS_PREFIX = 'pc_issue_kb_';
const LS_TTL = 2 * 60 * 60 * 1000; // 2 hours

export default function DebatePage() {
  const [searchParams] = useSearchParams();
  const rawType = searchParams.get('type') || 'seoul';
  // 유효하지 않은 debate type이면 'seoul'로 fallback
  const debateType: DebateType = (VALID_TYPES.includes(rawType as DebateType) ? rawType : 'seoul') as DebateType;
  const issueParam = searchParams.get('issue') || '';
  const autoStart = searchParams.get('autostart') === '1';

  const [researchState, setResearchState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [dynamicKB, setDynamicKB] = useState<any>(null);

  useEffect(() => {
    if (!issueParam) return;

    const lsKey = `${LS_PREFIX}${debateType}_${issueParam.slice(0, 50)}`;

    // localStorage 즉시 체크
    try {
      const cached = localStorage.getItem(lsKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.ts < LS_TTL) {
          setDynamicKB(parsed.data);
          setResearchState('done');
          return;
        }
      }
    } catch {}

    // 800ms 이내 응답 → 로더 없이 진행 (Supabase 캐시 히트)
    const quickTimer = setTimeout(() => {
      setResearchState('loading');
    }, 800);

    const controller = new AbortController();
    fetch('/api/issue-research?issue=' + encodeURIComponent(issueParam) + '&type=' + debateType, {
      signal: controller.signal,
    })
      .then(r => r.json())
      .then(data => {
        clearTimeout(quickTimer);
        if (data.dynamicKB) {
          try {
            localStorage.setItem(lsKey, JSON.stringify({ data: data.dynamicKB, ts: Date.now() }));
          } catch {}
          setDynamicKB(data.dynamicKB);
        }
        setResearchState('done');
      })
      .catch(() => {
        clearTimeout(quickTimer);
        setResearchState('done');
      });

    return () => {
      clearTimeout(quickTimer);
      controller.abort();
    };
  }, [issueParam, debateType]);

  const handleResearchComplete = (result: ResearchResult) => {
    if (result?.dynamicKB) {
      const lsKey = `${LS_PREFIX}${debateType}_${issueParam.slice(0, 50)}`;
      try {
        localStorage.setItem(lsKey, JSON.stringify({ data: result.dynamicKB, ts: Date.now() }));
      } catch {}
      setDynamicKB(result.dynamicKB);
    }
    setResearchState('done');
  };

  const handleResearchError = () => {
    // On error, proceed without dynamicKB (fallback to normal debate)
    setResearchState('done');
  };

  if (issueParam && researchState === 'loading') {
    return (
      <IssueResearchLoader
        issue={decodeURIComponent(issueParam)}
        onComplete={handleResearchComplete}
        onError={handleResearchError}
      />
    );
  }

  return (
    <div className="flex justify-center min-h-screen bg-gray-900">
      <div className="w-full" style={{ maxWidth: '700px' }}>
        <DebateView
          debateType={debateType}
          dynamicKB={dynamicKB}
          issueTitle={issueParam ? decodeURIComponent(issueParam) : undefined}
          autoStart={autoStart && (!issueParam || researchState === 'done')}
        />
      </div>
    </div>
  );
}
