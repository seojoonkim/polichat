import { useSearchParams } from 'react-router';
import DebateView, { type DebateType } from '@/components/debate/DebateView';

export default function DebatePage() {
  const [searchParams] = useSearchParams();
  const debateType = (searchParams.get('type') as DebateType) || 'seoul';

  return (
    <div className="flex justify-center min-h-screen bg-gray-900">
      <div className="w-full" style={{ maxWidth: '700px' }}>
        <DebateView debateType={debateType} />
      </div>
    </div>
  );
}
