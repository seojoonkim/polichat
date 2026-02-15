import { useState, useMemo } from 'react';
import type { IdolMeta } from '@/types/idol';
import { useChatStore } from '@/stores/chat-store';
import { useUserStore } from '@/stores/user-store';
import { useIntimacyStore } from '@/stores/intimacy-store';
import { getFlagImageUrl, getCountryName, formatRelativeTime, getTypingText } from '@/utils/language';
import IntimacyModal from './IntimacyModal';

interface Props {
  idol: IdolMeta;
}

export default function ChatHeader({ idol }: Props) {
  const [showResetModal, setShowResetModal] = useState(false);
  const [showIntimacyModal, setShowIntimacyModal] = useState(false);
  
  const setCurrentIdol = useChatStore((s) => s.setCurrentIdol);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const lastMessageTime = useChatStore((s) => s.lastMessageTime);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const resetUser = useUserStore((s) => s.reset);
  const setOnboardingStep = useUserStore((s) => s.setOnboardingStep);
  const dayCount = useUserStore((s) => s.getDayCount(idol.id));
  
  // 친밀도 데이터
  const intimacy = useIntimacyStore((s) => s.getOrCreateIntimacy(idol.id));
  
  // 상대적 시간 (스트리밍 중이면 "입력 중...")
  const relativeTime = useMemo(() => {
    if (isStreaming) return getTypingText(idol.language);
    return formatRelativeTime(lastMessageTime, idol.language);
  }, [lastMessageTime, isStreaming, idol.language]);

  const handleBack = () => {
    setCurrentIdol(null);
  };

  const handleReset = () => {
    // 채팅 기록 삭제
    clearMessages();
    // 유저 프로필 초기화 (온보딩 다시 시작)
    resetUser();
    setOnboardingStep('name');
    // 모달 닫기
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
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold bg-white/20 shrink-0 overflow-hidden ring-2 ring-white/30"
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

        {/* Name & Day Counter */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm flex items-center gap-2">
            {idol.nameKo}
            <img 
              src={getFlagImageUrl(idol.language)} 
              alt={getCountryName(idol.language)}
              className="w-4 h-3 object-cover rounded-sm"
              title={idol.language || 'ko'}
            />
            {dayCount > 0 && (
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                💕 +{dayCount}
              </span>
            )}
          </div>
          <div className="text-xs opacity-80">{idol.group}</div>
        </div>

        {/* 친밀도 레벨 표시 */}
        <button
          onClick={() => setShowIntimacyModal(true)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 hover:bg-white/30 active:scale-95 transition-all duration-200"
        >
          <span>❤️</span>
          <span className="text-xs font-bold">Lv.{intimacy.level}</span>
        </button>

        {/* 마지막 대화 시간 / 온라인 상태 */}
        <div className="flex items-center gap-1.5 text-xs opacity-80">
          <div className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-yellow-300' : 'bg-green-300'} animate-pulse`} />
          <span>{relativeTime}</span>
        </div>

        {/* Reset button */}
        <button
          onClick={() => setShowResetModal(true)}
          className="p-1.5 rounded-full hover:bg-white/20 active:bg-red-500/50 active:scale-90 transition-all duration-200 ml-1"
          title="Reset chat"
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

      {/* Intimacy Modal */}
      {showIntimacyModal && (
        <IntimacyModal
          intimacy={intimacy}
          idol={idol}
          onClose={() => setShowIntimacyModal(false)}
        />
      )}

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 mx-4 max-w-sm w-full shadow-xl animate-scale-up">
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
                {idol.language === 'ja' ? 'チャットをリセットしますか？' : 
                 idol.language === 'en' ? 'Reset this chat?' : 
                 '채팅을 리셋할까요?'}
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                {idol.language === 'ja' ? (
                  <>{idol.nameKo}とのメッセージがすべて削除され、<br />最初からやり直します。</>
                ) : idol.language === 'en' ? (
                  <>All messages with {idol.nameKo} will be deleted<br />and start fresh.</>
                ) : (
                  <>{idol.nameKo}와의 모든 메시지가 삭제되고<br />처음부터 다시 시작합니다.</>
                )}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowResetModal(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
                >
                  {idol.language === 'ja' ? 'キャンセル' : idol.language === 'en' ? 'Cancel' : '취소'}
                </button>
                <button
                  onClick={handleReset}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors"
                >
                  {idol.language === 'ja' ? 'リセット' : idol.language === 'en' ? 'Reset' : '리셋'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
