import DebateView from '@/components/debate/DebateView';

export default function DebatePage() {
  return (
    <div className="flex justify-center min-h-screen bg-gray-900">
      <div className="w-full" style={{ maxWidth: '600px' }}>
        <DebateView />
      </div>
    </div>
  );
}
