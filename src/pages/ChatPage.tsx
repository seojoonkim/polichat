import { useChatStore } from '@/stores/chat-store';
import { useIdolStore } from '@/stores/idol-store';
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import IdolSelector from '@/components/chat/IdolSelector';
import ChatLayout from '@/components/chat/ChatLayout';

type TransitionPhase = 'idle' | 'exit' | 'enter';

// R&D Demo 안내 배너 - 입력창 아래에 위치 (z-10)
function DemoBanner() {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-100/95 backdrop-blur-sm border-t border-gray-200 py-1.5 px-4 text-center z-10">
      <p className="text-[10px] text-gray-400 leading-relaxed">
        R&D Demo · 저작권 요청 시 즉시 중단
      </p>
    </div>
  );
}

export default function ChatPage() {
  const { idolId: urlIdolId } = useParams<{ idolId: string }>();
  const navigate = useNavigate();

  const currentIdolId = useChatStore((s) => s.currentIdolId);
  const setCurrentIdol = useChatStore((s) => s.setCurrentIdol);
  const loadIdols = useIdolStore((s) => s.loadIdols);
  const idols = useIdolStore((s) => s.idols);
  const loading = useIdolStore((s) => s.loading);

  const [phase, setPhase] = useState<TransitionPhase>('idle');
  const [displayedIdolId, setDisplayedIdolId] = useState<string | null>(null);
  const pendingIdolId = useRef<string | null>(null);
  const initialSynced = useRef(false);

  // Load idol list on mount
  useEffect(() => {
    loadIdols();
  }, [loadIdols]);

  // Sync URL param → store (only on first load)
  useEffect(() => {
    if (loading || idols.length === 0 || initialSynced.current) return;
    initialSynced.current = true;

    if (urlIdolId) {
      const exists = idols.some((i) => i.id === urlIdolId);
      if (exists && currentIdolId !== urlIdolId) {
        // Skip transition on initial load — go straight to chat
        setCurrentIdol(urlIdolId);
        setDisplayedIdolId(urlIdolId);
      } else if (!exists) {
        navigate('/', { replace: true });
      }
    }
  }, [urlIdolId, loading, idols, currentIdolId, setCurrentIdol, navigate]);

  // Sync store → URL (after initial sync)
  useEffect(() => {
    if (loading || !initialSynced.current) return;

    if (currentIdolId && currentIdolId !== urlIdolId) {
      navigate(`/chat/${currentIdolId}`, { replace: true });
    } else if (!currentIdolId && urlIdolId) {
      navigate('/', { replace: true });
    }
  }, [currentIdolId, urlIdolId, navigate, loading]);

  // Handle transitions when idol changes
  useEffect(() => {
    // Going from no idol to idol (enter chat)
    if (currentIdolId && !displayedIdolId) {
      setPhase('enter');
      setDisplayedIdolId(currentIdolId);
      const timer = setTimeout(() => setPhase('idle'), 450);
      return () => clearTimeout(timer);
    }

    // Going from idol to no idol (back to selector)
    if (!currentIdolId && displayedIdolId) {
      setPhase('exit');
      const timer = setTimeout(() => {
        setDisplayedIdolId(null);
        setPhase('idle');
      }, 300);
      return () => clearTimeout(timer);
    }

    // Switching between idols
    if (currentIdolId && displayedIdolId && currentIdolId !== displayedIdolId) {
      pendingIdolId.current = currentIdolId;
      setPhase('exit');
      const timer = setTimeout(() => {
        setDisplayedIdolId(pendingIdolId.current);
        pendingIdolId.current = null;
        setPhase('enter');
        setTimeout(() => setPhase('idle'), 450);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [currentIdolId, displayedIdolId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-pink-50 to-purple-50">
        <div className="flex flex-col items-center gap-3">
          <div className="loading-spinner" />
          <div className="text-gray-400 text-sm animate-pulse">Loading...</div>
        </div>
      </div>
    );
  }

  const activeIdol = displayedIdolId
    ? idols.find((i) => i.id === displayedIdolId)
    : null;

  // Show chat view (no banner in chat)
  if (activeIdol) {
    return (
      <div className="min-h-screen bg-gray-100 flex justify-center">
        <div
          className={`w-full h-screen ${
            phase === 'enter'
              ? 'animate-page-slide-in'
              : phase === 'exit'
                ? 'animate-page-slide-out'
                : ''
          }`}
          style={{ maxWidth: '600px' }}
        >
          <ChatLayout idol={activeIdol} />
        </div>
      </div>
    );
  }

  // Show selector view
  return (
    <div className={phase === 'exit' ? 'animate-page-zoom-out' : ''}>
      <IdolSelector idols={idols} />
      <DemoBanner />
    </div>
  );
}
