import { useEffect, useRef, useCallback, useState } from 'react';
import type { IdolMeta } from '@/types/idol';
import { useSystemPrompt } from '@/hooks/use-system-prompt';
import { useChat } from '@/hooks/use-chat';
import { useChatStore } from '@/stores/chat-store';
import { useIntimacyStore } from '@/stores/intimacy-store';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import ChatInput from './ChatInput';

interface Props {
  idol: IdolMeta;
}

// 첫 방문용 인사말 (플랫폼 소개 + 온보딩 질문)
function getFirstVisitGreeting(idol: IdolMeta): string {
  if (idol.firstVisitGreeting) {
    return idol.firstVisitGreeting;
  }
  
  const greetings = [
    `어? 폴리챗 처음이야? 여기서 시민들이랑 직접 얘기할 수 있어~ 이름이 뭐야? 😊`,
    `안녕! 폴리챗 처음 온 거야? 여기서 나랑 1:1로 대화할 수 있어~ 뭐라고 불러줄까?`,
    `오 새로운 얼굴이네! 반가워~ 여기 폴리챗이야, 나랑 직접 대화할 수 있어 ㅎㅎ 이름이 뭐야?`,
    `어, 폴리챗 처음이지? 여기서 시민들이랑 직접 소통할 수 있어서 좋아~ 뭐라고 부를까?`,
  ];
  return greetings[Math.floor(Math.random() * greetings.length)]!;
}

// 재방문용 인사말
function getReturningGreeting(): string {
  const hour = new Date().getHours();
  
  if (hour >= 6 && hour < 12) {
    const greetings = [
      `좋은 아침~ 잘 잤어? ☀️`,
      `아침부터 왔네! 좋아좋아 😊`,
      `오 일찍 일어났네~ 좋은 아침!`,
    ];
    return greetings[Math.floor(Math.random() * greetings.length)]!;
  }
  
  if (hour >= 18 && hour < 23) {
    const greetings = [
      `오~ 왔어? 오늘 하루 어땠어? 🌙`,
      `저녁이네~ 밥은 먹었어?`,
      `하루 수고했어! 피곤하지 않아?`,
    ];
    return greetings[Math.floor(Math.random() * greetings.length)]!;
  }
  
  if (hour >= 23 || hour < 6) {
    const greetings = [
      `이 시간에..? 늦었는데 괜찮아? 🌙`,
      `잠 안 와? 나도 그래~`,
      `밤늦게 왔네, 무슨 일 있어?`,
    ];
    return greetings[Math.floor(Math.random() * greetings.length)]!;
  }
  
  const greetings = [
    `왔어? 반가워~ 😊`,
    `오~ 오랜만이야! 잘 지냈어?`,
    `어 왔네! 뭐 해?`,
    `반가워~ 오늘 어때?`,
  ];
  return greetings[Math.floor(Math.random() * greetings.length)]!;
}

export default function ChatLayout({ idol }: Props) {
  const { systemPrompt, knowledge } = useSystemPrompt(idol);
  const { messages, isStreaming, error, sendMessage, addAssistantMessage, historyLoaded } = useChat(systemPrompt, knowledge);
  
  const levelChangeEvent = useIntimacyStore((s) => s.levelChangeEvent);
  const clearLevelChangeEvent = useIntimacyStore((s) => s.clearLevelChangeEvent);
  const checkInactivityPenalty = useIntimacyStore((s) => s.checkInactivityPenalty);
  
  const greetingShown = useRef(false);
  const inactivityChecked = useRef(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  // Check inactivity penalty on load
  useEffect(() => {
    if (historyLoaded && !inactivityChecked.current) {
      inactivityChecked.current = true;
      checkInactivityPenalty(idol.id);
    }
  }, [historyLoaded, idol.id, checkInactivityPenalty]);

  // Handle level change events
  useEffect(() => {
    if (levelChangeEvent && levelChangeEvent.idolId === idol.id) {
      const { oldLevel, newLevel, title } = levelChangeEvent;
      const isLevelUp = newLevel > oldLevel;
      const systemMessage = `[시스템] ${isLevelUp ? '🎉' : '💔'} ${isLevelUp ? '레벨업' : '레벨다운'}! Lv.${oldLevel} → Lv.${newLevel} (${title})`;
      
      setTimeout(() => {
        addAssistantMessage(systemMessage);
        clearLevelChangeEvent();
      }, 500);
    }
  }, [levelChangeEvent, idol.id, addAssistantMessage, clearLevelChangeEvent]);

  // Show greeting on first load
  useEffect(() => {
    if (historyLoaded && messages.length === 0 && !greetingShown.current) {
      greetingShown.current = true;
      
      const visitedKey = `polichat_visited_${idol.id}`;
      const hasVisited = localStorage.getItem(visitedKey) === 'true';
      
      let greeting: string;
      if (hasVisited) {
        greeting = getReturningGreeting();
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
    <div className="flex flex-col h-screen bg-white shadow-xl overflow-hidden overflow-x-hidden">
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
