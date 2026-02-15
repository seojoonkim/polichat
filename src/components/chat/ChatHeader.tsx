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
        className="shrink-0 z-50 px-4 pb-3 pt-[calc(env(safe-area-inset-top,44px)+8px)] flex items-center gap-3 text-white shadow-md animate-header-in"
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

        {/* Name & Party & Position */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="font-bold text-base truncate">
            {idol.nameKo}
            <span className="font-normal text-sm opacity-70 ml-1.5">| {idol.group}</span>
          </div>
          <div className="text-xs opacity-80 truncate">
            {idol.tagline}
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
          className="px-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25 active:bg-red-500/50 active:scale-95 transition-all duration-200 text-xs font-medium"
        >
          초기화
        </button>
      </div>

      {/* Reset Confirmation Modal - 채팅 컨테이너 안에만 표시 */}
      {showResetModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 mx-4 shadow-xl animate-scale-up" style={{ maxWidth: '320px', width: '100%' }}>
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
      )}
    </>
  );
}
