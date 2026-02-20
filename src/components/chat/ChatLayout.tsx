import { useEffect, useRef, useCallback, useState } from 'react';
import type { PoliticianMeta } from '@/types/politician';
import { useSystemPrompt } from '@/hooks/use-system-prompt';
import { useChat } from '@/hooks/use-chat';
import { useChatStore } from '@/stores/chat-store';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import QuickMenu from './QuickMenu';
import SuggestedQuestions from './SuggestedQuestions';

interface Props {
  politician: PoliticianMeta;
}

// 첫 방문용 인사말 (짧게, 두 개로 쪼개서)
function getFirstVisitGreetings(politician: PoliticianMeta): [string, string] {
  const intro = politician.tagline ? `${politician.tagline}, ` : `${politician.group} 소속 `;
  const greetings: [string, string][] = [
    [`안녕하세요! ${intro}${politician.nameKo}입니다.`, `어떻게 불러드릴까요?`],
    [`반갑습니다! ${intro}${politician.nameKo}입니다.`, `성함이 어떻게 되세요?`],
    [`안녕하세요, ${intro}${politician.nameKo}입니다!`, `뭐라고 불러드릴까요?`],
  ];
  return greetings[Math.floor(Math.random() * greetings.length)]!;
}

// 재방문용 인사말 (짧게)
function getReturningGreeting(_politician: PoliticianMeta): string {
  const hour = new Date().getHours();
  
  if (hour >= 6 && hour < 12) {
    const greetings = [
      `좋은 아침이에요!`,
      `아침부터 찾아주셨네요!`,
      `오늘 하루도 화이팅이에요!`,
    ];
    return greetings[Math.floor(Math.random() * greetings.length)]!;
  }
  
  if (hour >= 18 && hour < 23) {
    const greetings = [
      `저녁 시간에 찾아주셨네요.`,
      `저녁 식사는 하셨나요?`,
      `하루 수고 많으셨어요!`,
    ];
    return greetings[Math.floor(Math.random() * greetings.length)]!;
  }
  
  if (hour >= 23 || hour < 6) {
    const greetings = [
      `이 시간에 찾아주셨네요.`,
      `밤늦게까지 수고가 많으시네요.`,
      `늦은 시간인데 괜찮으세요?`,
    ];
    return greetings[Math.floor(Math.random() * greetings.length)]!;
  }
  
  const greetings = [
    `다시 찾아주셨네요!`,
    `반갑습니다!`,
    `무엇이 궁금하신가요?`,
  ];
  return greetings[Math.floor(Math.random() * greetings.length)]!;
}

export default function ChatLayout({ politician }: Props) {
  const { systemPrompt, knowledge } = useSystemPrompt(politician);
  const { messages, isStreaming, error, sendMessage, addAssistantMessage, historyLoaded } = useChat(systemPrompt, knowledge);
  const clearSuggestedQuestions = useChatStore((s) => s.clearSuggestedQuestions);
  
  const greetingShown = useRef(false);
  const prevMessageCount = useRef<number | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [quickMenuDismissed, setQuickMenuDismissed] = useState(false);

  // Show greeting when messages are empty and history is loaded
  // Also handles reset: when messages go from >0 to 0, re-trigger greeting
  useEffect(() => {
    const wasNonEmpty = prevMessageCount.current !== null && prevMessageCount.current > 0;
    const isEmpty = messages.length === 0;
    
    // Reset greetingShown flag when messages are cleared (초기화)
    if (wasNonEmpty && isEmpty) {
      greetingShown.current = false;
    }
    prevMessageCount.current = messages.length;
  }, [messages.length]);

  useEffect(() => {
    if (historyLoaded && messages.length === 0 && !greetingShown.current) {
      greetingShown.current = true;
      
      const visitedKey = `polichat_visited_${politician.id}`;
      const hasVisited = localStorage.getItem(visitedKey) === 'true';
      
      const delay1 = 300 + Math.random() * 200;
      
      if (hasVisited) {
        // 재방문: 짧은 인사 하나만
        setTimeout(() => {
          addAssistantMessage(getReturningGreeting(politician));
        }, delay1);
      } else {
        // 첫 방문: 두 개로 쪼개서 (타이핑 시뮬레이션 포함)
        const [greeting1, greeting2] = getFirstVisitGreetings(politician);
        localStorage.setItem(visitedKey, 'true');
        
        setTimeout(() => {
          addAssistantMessage(greeting1);
        }, delay1);
        
        // 두 번째 메시지: 첫 번째 타이핑(~1.5초) 완료 후 + 읽는 시간(1초) + 두 번째 타이핑 시작
        setTimeout(() => {
          addAssistantMessage(greeting2);
        }, delay1 + 3000);
      }
    }
  }, [historyLoaded, messages.length, politician.id, addAssistantMessage]);

  // Determine if quick menu should show:
  // - First visit onboarding only (not returning visitors)
  // - Messages >= 4 (greeting1 + greeting2 + user name + welcome)
  // - Not yet dismissed
  // - Last assistant message contains "님" + welcome pattern
  const showQuickMenu = (() => {
    if (quickMenuDismissed) return false;
    if (messages.length < 4) return false;
    // Check last assistant message for welcome pattern
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistant) return false;
    const text = lastAssistant.content;
    return /님/.test(text) && (/반갑|환영|찾아주|잘 부탁/.test(text));
  })();

  const handleQuickMenuSelect = useCallback((text: string) => {
    setQuickMenuDismissed(true);
    sendMessage(text);
  }, [sendMessage]);

  const handleDirectAsk = useCallback(() => {
    setQuickMenuDismissed(true);
    // Focus the textarea in ChatInput
    const textarea = document.querySelector('form textarea') as HTMLTextAreaElement | null;
    textarea?.focus();
  }, []);

  // 추천 질문 클릭 → 바로 전송 + 질문 목록 초기화
  const handleSuggestedSelect = useCallback((question: string) => {
    clearSuggestedQuestions();
    sendMessage(question);
  }, [clearSuggestedQuestions, sendMessage]);

  // 직접 입력하기 → 입력창 포커스 + 질문 목록 초기화
  const handleSuggestedDirectInput = useCallback(() => {
    clearSuggestedQuestions();
    const textarea = document.querySelector('form textarea') as HTMLTextAreaElement | null;
    textarea?.focus();
  }, [clearSuggestedQuestions]);

  const handleSend = useCallback((text: string) => {
    if (showQuickMenu) setQuickMenuDismissed(true);
    if (isStreaming) {
      setPendingMessage(text);
      return;
    }
    sendMessage(text);
  }, [sendMessage, isStreaming, showQuickMenu]);

  // Send pending message after streaming completes
  useEffect(() => {
    if (!isStreaming && pendingMessage) {
      const msg = pendingMessage;
      setPendingMessage(null);
      setTimeout(() => sendMessage(msg), 100);
    }
  }, [isStreaming, pendingMessage, sendMessage]);

  // Persist messages on unload
  useEffect(() => {
    const handleUnload = () => {
      useChatStore.getState().persistMessages();
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  // 전체 레이아웃: 100svh로 Safari 툴바 고려
  // 내부는 flexbox로 헤더-메시지-입력창 배치
  return (
    <div 
      className="app-bg fixed top-0 left-0 right-0 flex flex-col overflow-hidden"
      style={{ maxWidth: '700px', margin: '0 auto', height: '100svh' }}
    >
      {/* 헤더: 절대 스크롤 안 됨 */}
      <ChatHeader politician={politician} />
      
      {/* 메시지 영역: 이 영역만 내부 스크롤 */}
      {historyLoaded ? (
        <MessageList messages={messages} politician={politician} isStreaming={isStreaming} />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="loading-spinner" />
            <div className="text-gray-300 text-sm">로딩중...</div>
          </div>
        </div>
      )}
      
      {showQuickMenu && (
        <QuickMenu
          politicianId={politician.id}
          themeColor={politician.themeColor}
          onSelect={handleQuickMenuSelect}
          onDirectAsk={handleDirectAsk}
        />
      )}

      {error && (
        <div className="px-4 py-2 bg-red-50 text-red-600 text-xs text-center animate-shake">
          {error}
        </div>
      )}

      {/* 추천 질문 버튼: AI 답변 완료 후 자동 표시 */}
      <SuggestedQuestions
        onSelect={handleSuggestedSelect}
        onDirectInput={handleSuggestedDirectInput}
        themeColor={politician.themeColor}
      />
      
      {/* 입력창: 절대 스크롤 안 됨 */}
      <ChatInput
        onSend={handleSend}
        disabled={!historyLoaded}
        themeColor={politician.themeColor}
        language={politician.language}
      />

      {/* 면책 문구 */}
      <div className="text-center px-3 py-1.5">
        <p className="text-[10px] text-gray-400 leading-relaxed">
          본 서비스에서 제공되는 모든 대화와 토론 콘텐츠는 인공지능(AI) 기술을 통해 생성된 가상의 시뮬레이션 결과물입니다. 해당 콘텐츠는 각 정치인의 공개된 과거 발언 및 언론 보도 등을 기반으로 학습된 모델이 생성한 것이나, 이는 실제 인물의 현재 의지나 공식적인 견해를 대변하지 않으며 실제 입장과 상당한 차이가 있을 수 있습니다. 또한, 인공지능 기술의 특성상 생성 과정에서 사실과 다른 허구의 내용이나 왜곡 및 과장된 표현이 포함될 수 있으므로, 본 서비스의 내용을 공식적인 근거로 인용하거나 절대적인 사실로 신뢰하지 마시기 바랍니다. 서비스 이용 중 발생하는 오해나 사용자의 판단에 따른 결과에 대해 운영측은 어떠한 법적 책임도 지지 않으며, 정확한 정보 확인이 필요한 사안은 반드시 공식적인 경로를 통해 재확인하시길 권고드립니다.
        </p>
      </div>
    </div>
  );
}
