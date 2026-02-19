import { useChatStore } from '@/stores/chat-store';
import { usePoliticianStore } from '@/stores/politician-store';
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import PoliticianSelector from '@/components/chat/PoliticianSelector';
import ChatLayout from '@/components/chat/ChatLayout';

type TransitionPhase = 'idle' | 'exit' | 'enter';

export default function ChatPage() {
  const { politicianId: urlPoliticianId } = useParams<{ politicianId: string }>();
  const navigate = useNavigate();

  const currentPoliticianId = useChatStore((s) => s.currentPoliticianId);
  const setCurrentPolitician = useChatStore((s) => s.setCurrentPolitician);
  const loadPoliticians = usePoliticianStore((s) => s.loadPoliticians);
  const politicians = usePoliticianStore((s) => s.politicians);
  const loading = usePoliticianStore((s) => s.loading);

  const [phase, setPhase] = useState<TransitionPhase>('idle');
  const [displayedPoliticianId, setDisplayedPoliticianId] = useState<string | null>(null);
  const pendingPoliticianId = useRef<string | null>(null);
  const initialSynced = useRef(false);

  // Load politician list on mount
  useEffect(() => {
    loadPoliticians();
  }, [loadPoliticians]);

  // Sync URL param → store (only on first load)
  useEffect(() => {
    if (loading || politicians.length === 0 || initialSynced.current) return;
    initialSynced.current = true;

    if (urlPoliticianId) {
      const exists = politicians.some((i) => i.id === urlPoliticianId);
      if (exists && currentPoliticianId !== urlPoliticianId) {
        // Skip transition on initial load — go straight to chat
        setCurrentPolitician(urlPoliticianId);
        setDisplayedPoliticianId(urlPoliticianId);
      } else if (!exists) {
        navigate('/', { replace: true });
      }
    }
  }, [urlPoliticianId, loading, politicians, currentPoliticianId, setCurrentPolitician, navigate]);

  // Sync store → URL (after initial sync)
  useEffect(() => {
    if (loading || !initialSynced.current) return;

    if (currentPoliticianId && currentPoliticianId !== urlPoliticianId) {
      navigate(`/chat/${currentPoliticianId}`, { replace: true });
    } else if (!currentPoliticianId && urlPoliticianId) {
      navigate('/', { replace: true });
    }
  }, [currentPoliticianId, urlPoliticianId, navigate, loading]);

  // Handle transitions when politician changes
  useEffect(() => {
    // Going from no politician to politician (enter chat)
    if (currentPoliticianId && !displayedPoliticianId) {
      setPhase('enter');
      setDisplayedPoliticianId(currentPoliticianId);
      const timer = setTimeout(() => setPhase('idle'), 450);
      return () => clearTimeout(timer);
    }

    // Going from politician to no politician (back to selector)
    if (!currentPoliticianId && displayedPoliticianId) {
      setPhase('exit');
      const timer = setTimeout(() => {
        setDisplayedPoliticianId(null);
        setPhase('idle');
      }, 300);
      return () => clearTimeout(timer);
    }

    // Switching between politicians
    if (currentPoliticianId && displayedPoliticianId && currentPoliticianId !== displayedPoliticianId) {
      pendingPoliticianId.current = currentPoliticianId;
      setPhase('exit');
      const timer = setTimeout(() => {
        setDisplayedPoliticianId(pendingPoliticianId.current);
        pendingPoliticianId.current = null;
        setPhase('enter');
        setTimeout(() => setPhase('idle'), 450);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [currentPoliticianId, displayedPoliticianId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="flex flex-col items-center gap-3">
          <div className="loading-spinner" />
          <div className="text-gray-400 text-sm animate-pulse">Loading...</div>
        </div>
      </div>
    );
  }

  const activePolitician = displayedPoliticianId
    ? politicians.find((i) => i.id === displayedPoliticianId)
    : null;

  // Show chat view (no banner in chat)
  if (activePolitician) {
    return (
      <div className="min-h-screen flex justify-center" style={{ background: '#0D0F1A' }}>
        <div
          className={`w-full h-screen ${
            phase === 'enter'
              ? 'animate-fade-in'
              : phase === 'exit'
                ? 'animate-fade-out'
                : ''
          }`}
          style={{ maxWidth: '700px' }}
        >
          <ChatLayout politician={activePolitician} />
        </div>
      </div>
    );
  }

  // Show selector view
  return (
    <div className={phase === 'exit' ? 'animate-page-zoom-out' : ''}>
      <PoliticianSelector politicians={politicians} />
    </div>
  );
}
