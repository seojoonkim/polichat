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

// 첫 방문용 인사말 (짧게, 두 개로 쪼개서)
function getFirstVisitGreetings(idol: IdolMeta): [string, string] {
  const greetings: [string, string][] = [
    [`안녕하세요! ${idol.nameKo}입니다.`, `어떻게 불러드릴까요?`],
    [`반갑습니다! ${idol.nameKo}입니다.`, `성함이 어떻게 되세요?`],
    [`안녕하세요, ${idol.nameKo}입니다!`, `뭐라고 불러드릴까요?`],
  ];
  return greetings[Math.floor(Math.random() * greetings.length)]!;
}

// 재방문용 인사말 (짧게)
function getReturningGreeting(idol: IdolMeta): string {
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

export default function ChatLayout({ idol }: Props) {
  const { systemPrompt, knowledge } = useSystemPrompt(idol);
  const { messages, isStreaming, error, sendMessage, addAssistantMessage, historyLoaded } = useChat(systemPrompt, knowledge);
  
  const greetingShown = useRef(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  // Show greeting on first load (짧게 쪼개서)
  useEffect(() => {
    if (historyLoaded && messages.length === 0 && !greetingShown.current) {
      greetingShown.current = true;
      
      const visitedKey = `polichat_visited_${idol.id}`;
      const hasVisited = localStorage.getItem(visitedKey) === 'true';
      
      const delay1 = 300 + Math.random() * 200;
      
      if (hasVisited) {
        // 재방문: 짧은 인사 하나만
        setTimeout(() => {
          addAssistantMessage(getReturningGreeting(idol));
        }, delay1);
      } else {
        // 첫 방문: 두 개로 쪼개서
        const [greeting1, greeting2] = getFirstVisitGreetings(idol);
        localStorage.setItem(visitedKey, 'true');
        
        setTimeout(() => {
          addAssistantMessage(greeting1);
        }, delay1);
        
        // 두 번째 메시지는 1초 후
        setTimeout(() => {
          addAssistantMessage(greeting2);
        }, delay1 + 1000);
      }
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

  // 전체 레이아웃: 100svh로 Safari 툴바 고려
  // 내부는 flexbox로 헤더-메시지-입력창 배치
  return (
    <div 
      className="fixed top-0 left-0 right-0 flex flex-col bg-white overflow-hidden"
      style={{ maxWidth: '600px', margin: '0 auto', height: '100svh' }}
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
