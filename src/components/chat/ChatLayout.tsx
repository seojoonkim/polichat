import { useEffect, useRef, useCallback, useState, useLayoutEffect } from 'react';
import type { IdolMeta } from '@/types/idol';
import { useSystemPrompt } from '@/hooks/use-system-prompt';
import { useChat } from '@/hooks/use-chat';
import { useChatStore } from '@/stores/chat-store';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import ChatInput from './ChatInput';

// iOS Safari 키보드 올라와도 레이아웃 고정을 위한 커스텀 훅
function useFixedHeight() {
  const [fixedHeight, setFixedHeight] = useState<number | null>(null);
  
  useLayoutEffect(() => {
    // 초기 높이 저장 (키보드 없는 상태)
    const initialHeight = window.innerHeight;
    setFixedHeight(initialHeight);
    
    // orientation 변경 시에만 높이 재계산
    const handleOrientationChange = () => {
      setTimeout(() => {
        setFixedHeight(window.innerHeight);
      }, 100);
    };
    
    window.addEventListener('orientationchange', handleOrientationChange);
    return () => window.removeEventListener('orientationchange', handleOrientationChange);
  }, []);
  
  return fixedHeight;
}

interface Props {
  idol: IdolMeta;
}

// 첫 방문용 인사말 (자기소개 + 플랫폼 소개 + 온보딩 질문)
function getFirstVisitGreeting(idol: IdolMeta): string {
  if (idol.firstVisitGreeting) {
    return idol.firstVisitGreeting;
  }
  
  // 직책/소속 정보 생성
  const title = idol.tagline || `${idol.group} 소속`;
  
  const greetings = [
    `안녕하세요, ${title} ${idol.nameKo}입니다! 폴리챗에서 이렇게 만나뵙게 되어 반갑습니다. 어떻게 불러드리면 될까요?`,
    `반갑습니다! ${idol.nameKo}입니다. ${title}이에요. 여기서 시민분들과 직접 소통할 수 있어서 좋네요. 성함이 어떻게 되세요?`,
    `안녕하세요, ${idol.nameKo}입니다! 폴리챗에서 1:1로 대화할 수 있어서 좋습니다. 뭐라고 불러드릴까요?`,
  ];
  return greetings[Math.floor(Math.random() * greetings.length)]!;
}

// 재방문용 인사말 (자기소개 포함)
function getReturningGreeting(idol: IdolMeta): string {
  const hour = new Date().getHours();
  const title = idol.tagline || `${idol.group} 소속`;
  
  if (hour >= 6 && hour < 12) {
    const greetings = [
      `안녕하세요, ${idol.nameKo}입니다! 좋은 아침이에요 ☀️`,
      `${idol.nameKo}입니다. 아침부터 찾아주셨네요! 반갑습니다 😊`,
      `안녕하세요! ${title} ${idol.nameKo}입니다. 오늘 하루도 화이팅이에요!`,
    ];
    return greetings[Math.floor(Math.random() * greetings.length)]!;
  }
  
  if (hour >= 18 && hour < 23) {
    const greetings = [
      `안녕하세요, ${idol.nameKo}입니다! 저녁 시간에 찾아주셨네요.`,
      `${idol.nameKo}입니다. 저녁 식사는 하셨나요?`,
      `안녕하세요! ${title} ${idol.nameKo}입니다. 하루 수고 많으셨어요!`,
    ];
    return greetings[Math.floor(Math.random() * greetings.length)]!;
  }
  
  if (hour >= 23 || hour < 6) {
    const greetings = [
      `안녕하세요, ${idol.nameKo}입니다. 이 시간에 찾아주셨네요.`,
      `${idol.nameKo}입니다. 밤늦게까지 수고가 많으시네요.`,
      `안녕하세요! ${title} ${idol.nameKo}입니다. 늦은 시간인데 괜찮으세요?`,
    ];
    return greetings[Math.floor(Math.random() * greetings.length)]!;
  }
  
  const greetings = [
    `안녕하세요, ${idol.nameKo}입니다! 다시 찾아주셨네요 😊`,
    `${idol.nameKo}입니다. 반갑습니다! 잘 지내셨어요?`,
    `안녕하세요! ${title} ${idol.nameKo}입니다. 무엇이 궁금하신가요?`,
  ];
  return greetings[Math.floor(Math.random() * greetings.length)]!;
}

export default function ChatLayout({ idol }: Props) {
  const { systemPrompt, knowledge } = useSystemPrompt(idol);
  const { messages, isStreaming, error, sendMessage, addAssistantMessage, historyLoaded } = useChat(systemPrompt, knowledge);
  
  const greetingShown = useRef(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const fixedHeight = useFixedHeight();

  // Show greeting on first load
  useEffect(() => {
    if (historyLoaded && messages.length === 0 && !greetingShown.current) {
      greetingShown.current = true;
      
      const visitedKey = `polichat_visited_${idol.id}`;
      const hasVisited = localStorage.getItem(visitedKey) === 'true';
      
      let greeting: string;
      if (hasVisited) {
        greeting = getReturningGreeting(idol);
      } else {
        greeting = getFirstVisitGreeting(idol);
        localStorage.setItem(visitedKey, 'true');
      }
      
      const delay = 300 + Math.random() * 300;
      setTimeout(() => {
        addAssistantMessage(greeting);
      }, delay);
    }
  }, [historyLoaded, messages.length, idol.id, addAssistantMessage]);

  const handleSend = useCallback((text: string) => {
    if (isStreaming) {
      setPendingMessage(text);
      return;
    }
    sendMessage(text);
  }, [sendMessage, isStreaming]);

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

  return (
    <div 
      className="relative flex flex-col bg-white shadow-xl overflow-hidden overflow-x-hidden"
      style={{ height: fixedHeight ? `${fixedHeight}px` : '100vh' }}
    >
      <ChatHeader idol={idol} />
      
      {historyLoaded ? (
        <MessageList messages={messages} idol={idol} isStreaming={isStreaming} />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="loading-spinner" />
            <div className="text-gray-300 text-sm">로딩중...</div>
          </div>
        </div>
      )}
      
      {error && (
        <div className="px-4 py-2 bg-red-50 text-red-600 text-xs text-center animate-shake">
          {error}
        </div>
      )}
      
      <div className="animate-input-in mt-auto">
        <ChatInput
          onSend={handleSend}
          disabled={!historyLoaded}
          themeColor={idol.themeColor}
          language={idol.language}
        />
      </div>
    </div>
  );
}
