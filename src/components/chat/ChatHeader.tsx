import { useState, useMemo } from 'react';
import type { IdolMeta } from '@/types/idol';
import { useChatStore } from '@/stores/chat-store';
import { useUserStore } from '@/stores/user-store';
import { formatRelativeTime, getTypingText } from '@/utils/language';

interface Props {
  idol: IdolMeta;
}

export default function ChatHeader({ idol }: Props) {
  const [showResetModal, setShowResetModal] = useState(false);
  
  const setCurrentIdol = useChatStore((s) => s.setCurrentIdol);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const lastMessageTime = useChatStore((s) => s.lastMessageTime);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const resetUser = useUserStore((s) => s.reset);
  const setOnboardingStep = useUserStore((s) => s.setOnboardingStep);

  // 상대적 시간 (스트리밍 중이면 "입력 중...")
  const relativeTime = useMemo(() => {
    if (isStreaming) return getTypingText(idol.language);
    return formatRelativeTime(lastMessageTime, idol.language);
  }, [lastMessageTime, isStreaming, idol.language]);

  const handleBack = () => {
    setCurrentIdol(null);
  };

  const handleReset = () => {
    clearMessages();
    resetUser();
    setOnboardingStep('name');
    setShowResetModal(false);
  };

  return (
    <>
      <div
        className="sticky top-0 z-10 px-4 pb-3 pt-[calc(env(safe-area-inset-top,44px)+8px)] flex items-center gap-3 text-white shadow-md animate-header-in"
        style={{
          background: `linear-gradient(135deg, ${idol.themeColor}, ${idol.themeColorSecondary})`,
        }}
      >
        {/* Back button */}
        <button
          onClick={handleBack}
          className="p-1.5 rounded-full hover:bg-white/20 active:bg-white/30 active:scale-90 transition-all duration-200"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        {/* Profile */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-white/20 shrink-0 overflow-hidden ring-2 ring-white/30"
        >
          {idol.profileImageUrl ? (
            <img
              src={idol.profileImageUrl}
              alt={idol.nameKo}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            idol.nameKo.slice(0, 1)
          )}
        </div>

        {/* Name & Position */}
        <div className="flex-1 min-w-0">
          <div className="font-bold text-base flex items-center gap-2">
            {idol.nameKo}
          </div>
          <div className="text-xs opacity-90 flex items-center gap-1.5">
            <span 
              className="px-1.5 py-0.5 rounded text-[10px] font-medium"
              style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
            >
              {idol.group}
            </span>
            <span className="opacity-70">•</span>
            <span className="opacity-70">{idol.tagline?.split(' ').slice(0, 3).join(' ')}</span>
          </div>
        </div>

        {/* 온라인 상태 */}
        <div className="flex items-center gap-1.5 text-xs bg-white/15 px-2.5 py-1 rounded-full">
          <div className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-yellow-300' : 'bg-green-400'} animate-pulse`} />
          <span className="opacity-90">{relativeTime}</span>
        </div>

        {/* Reset button */}
        <button
          onClick={() => setShowResetModal(true)}
          className="p-1.5 rounded-full hover:bg-white/20 active:bg-red-500/50 active:scale-90 transition-all duration-200"
          title="대화 초기화"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
          <div className="w-full max-w-[600px] px-4 flex justify-center">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl animate-scale-up">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                대화를 초기화할까요?
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                {idol.nameKo}와의 모든 대화 내용이 삭제되고<br />
                처음부터 다시 시작합니다.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowResetModal(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleReset}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors"
                >
                  초기화
                </button>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
