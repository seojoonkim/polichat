import { useSearchParams } from 'react-router';
import { useEffect, useState } from 'react';
import DebateView, { type DebateType } from '@/components/debate/DebateView';
import IssueResearchLoader, { type ResearchResult } from '@/components/debate/IssueResearchLoader';

const LS_PREFIX = 'pc_issue_kb_';
const LS_TTL = 2 * 60 * 60 * 1000; // 2 hours

export default function DebatePage() {
  const [searchParams] = useSearchParams();
  const debateType = (searchParams.get('type') as DebateType) || 'seoul';
  const issueParam = searchParams.get('issue') || '';

  const [researchState, setResearchState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [dynamicKB, setDynamicKB] = useState<any>(null);

  useEffect(() => {
    setResearchState('idle');
    setDynamicKB(null);

    if (!issueParam) return;

    const lsKey = `${LS_PREFIX}${debateType}_${issueParam.slice(0, 50)}`;
    try {
      const cached = localStorage.getItem(lsKey);
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < LS_TTL) {
          setDynamicKB(data);
          setResearchState('done');
          return;
        }
      }
    } catch {}

    setResearchState('loading');
  }, [issueParam, debateType]);

  const handleResearchComplete = (result: ResearchResult) => {
    if (result?.dynamicKB) {
      const lsKey = `${LS_PREFIX}${debateType}_${issueParam.slice(0, 50)}`;
      try {
        localStorage.setItem(lsKey, JSON.stringify({ data: result, ts: Date.now() }));
      } catch {}
      setDynamicKB(result);
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
        />
      </div>
    </div>
  );
}
