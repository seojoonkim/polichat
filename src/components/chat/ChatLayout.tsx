import { useEffect, useRef, useCallback, useState } from 'react';
import type { IdolMeta } from '@/types/idol';
import { useSystemPrompt } from '@/hooks/use-system-prompt';
import { useChat } from '@/hooks/use-chat';
import { useChatStore } from '@/stores/chat-store';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import ChatInput from './ChatInput';

interface Props {
  idol: IdolMeta;
}

// iOS Safari 키보드 대응: visualViewport로 실제 보이는 높이 추적
function useVisualViewport() {
  const [height, setHeight] = useState<number | null>(null);
  
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    
    const update = () => {
      setHeight(vv.height);
    };
    
    // 초기값 설정
    update();
    
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  
  return height;
}

// 첫 방문용 인사말
function getFirstVisitGreeting(idol: IdolMeta): string {
  if (idol.firstVisitGreeting) {
    return idol.firstVisitGreeting;
  }
  
  const title = idol.tagline || `${idol.group} 소속`;
  
  const greetings = [
    `안녕하세요, ${title} ${idol.nameKo}입니다! 폴리챗에서 이렇게 만나뵙게 되어 반갑습니다. 어떻게 불러드리면 될까요?`,
    `반갑습니다! ${idol.nameKo}입니다. ${title}이에요. 여기서 시민분들과 직접 소통할 수 있어서 좋네요. 성함이 어떻게 되세요?`,
    `안녕하세요, ${idol.nameKo}입니다! 폴리챗에서 1:1로 대화할 수 있어서 좋습니다. 뭐라고 불러드릴까요?`,
  ];
  return greetings[Math.floor(Math.random() * greetings.length)]!;
}

// 재방문용 인사말
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
  
  // iOS Safari 키보드 대응
  const viewportHeight = useVisualViewport();

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

  // 전체 레이아웃: visualViewport 높이 사용 (iOS Safari 키보드 대응)
  // height를 동적으로 설정하면 키보드가 올라와도 레이아웃이 안정적
  return (
    <div 
      className="fixed left-0 right-0 top-0 flex flex-col bg-white overflow-hidden"
      style={{ 
        maxWidth: '600px', 
        margin: '0 auto',
        height: viewportHeight ? `${viewportHeight}px` : '100dvh',
      }}
    >
      {/* 헤더: 절대 스크롤 안 됨 */}
      <ChatHeader idol={idol} />
      
      {/* 메시지 영역: 이 영역만 내부 스크롤 */}
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
      
      {/* 입력창: 절대 스크롤 안 됨 */}
      <ChatInput
        onSend={handleSend}
        disabled={!historyLoaded}
        themeColor={idol.themeColor}
        language={idol.language}
      />
    </div>
  );
}
