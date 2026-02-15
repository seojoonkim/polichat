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
// idol.firstVisitGreeting이 있으면 사용, 없으면 기본 인사
function getFirstVisitGreeting(idol: IdolMeta): string {
  // 아이돌별 커스텀 첫 인사가 있으면 사용
  if (idol.firstVisitGreeting) {
    return idol.firstVisitGreeting;
  }
  
  // 기본 인사 (fallback)
  const language = idol.language || 'ko';
  if (language === 'ja') {
    const greetings = [
      `あ、MimChat初めて？ここでファンの皆と直接話せるんだ～✨ ところで名前なんていうの？`,
      `お～MimChatに来てくれたんだ！ここで1対1で話せるよ～😊 なんて呼べばいい？`,
      `はじめまして～！MimChatへようこそ！ファンとここで話せるの嬉しいな💕 名前教えて？`,
    ];
    return greetings[Math.floor(Math.random() * greetings.length)]!;
  }
  
  const greetings = [
    `어? 폴리챗 처음이야? 여기서 팬들이랑 직접 얘기할 수 있어서 좋아~ 근데 이름이 뭐야? 😊`,
    `안녕! 폴리챗 처음 온 거야? 여기서 나랑 1:1로 대화할 수 있어~ 뭐라고 불러줄까?✨`,
    `오 새로운 얼굴이네! 반가워~ 여기 폴리챗이야, 나랑 직접 대화할 수 있어 ㅎㅎ 이름이 뭐야?`,
    `어, 폴리챗 처음이지? 여기서 팬들이랑 직접 대화할 수 있어서 나도 좋아~ 뭐라고 부를까?`,
  ];
  return greetings[Math.floor(Math.random() * greetings.length)]!;
}

// 재방문용 인사말 (기존 대화 기록 있음)
function getReturningGreeting(language: string = 'ko'): string {
  if (language === 'ja') {
    const greetings = [
      `あ、来てくれたんだ～！嬉しい😊`,
      `お～また会えたね！元気だった？`,
      `わ、久しぶり～！待ってたよ✨`,
    ];
    return greetings[Math.floor(Math.random() * greetings.length)]!;
  }
  
  const hour = new Date().getHours();
  
  // 시간대별 재방문 인사
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
  
  // 낮 기본
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
  const { messages, isStreaming, error, sendMessage, addAssistantMessage, historyLoaded } =
    useChat(systemPrompt, knowledge);
  
  // 친밀도 관련
  const levelChangeEvent = useIntimacyStore((s) => s.levelChangeEvent);
  const clearLevelChangeEvent = useIntimacyStore((s) => s.clearLevelChangeEvent);
  const checkInactivityPenalty = useIntimacyStore((s) => s.checkInactivityPenalty);

  const initialMessageSent = useRef(false);
  const inactivityChecked = useRef(false);
  
  // 메시지 큐잉: AI 응답 중에 입력하면 대기
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  
  // 비활성 페널티 체크 (채팅 입장 시)
  useEffect(() => {
    if (historyLoaded && !inactivityChecked.current) {
      inactivityChecked.current = true;
      checkInactivityPenalty(idol.id);
    }
  }, [historyLoaded, idol.id, checkInactivityPenalty]);
  
  // 레벨업/다운 시스템 메시지
  useEffect(() => {
    if (levelChangeEvent && levelChangeEvent.idolId === idol.id) {
      const { oldLevel, newLevel, title } = levelChangeEvent;
      const isLevelUp = newLevel > oldLevel;
      const emoji = isLevelUp ? '🎉' : '💔';
      const action = isLevelUp ? '레벨업' : '레벨다운';
      
      const systemMessage = `[시스템] ${emoji} ${action}! Lv.${oldLevel} → Lv.${newLevel} (${title})`;
      
      // 약간의 딜레이 후 시스템 메시지 추가
      setTimeout(() => {
        addAssistantMessage(systemMessage);
        clearLevelChangeEvent();
      }, 500);
    }
  }, [levelChangeEvent, idol.id, addAssistantMessage, clearLevelChangeEvent]);

  // 아이돌이 먼저 인사하기 (첫 방문 vs 재방문 구분)
  useEffect(() => {
    if (historyLoaded && messages.length === 0 && !initialMessageSent.current) {
      initialMessageSent.current = true;
      
      // 첫 방문 여부 확인 (localStorage)
      const visitKey = `mim_visited_${idol.id}`;
      const hasVisitedBefore = localStorage.getItem(visitKey) === 'true';
      
      // 인사말 결정
      let greeting: string;
      if (hasVisitedBefore) {
        // 재방문 - 시간대별 인사
        greeting = getReturningGreeting(idol.language || 'ko');
        console.log('[ChatLayout] Returning user greeting:', greeting);
      } else {
        // 첫 방문 - 아이돌별 개성 있는 인사
        greeting = getFirstVisitGreeting(idol);
        // 첫 방문 기록 저장
        localStorage.setItem(visitKey, 'true');
        console.log('[ChatLayout] First visit greeting:', greeting);
      }
      
      // 자연스러운 딜레이 (0.3~0.6초)
      const delay = 300 + Math.random() * 300;
      setTimeout(() => {
        addAssistantMessage(greeting);
      }, delay);
    }
  }, [historyLoaded, messages.length, idol.id, idol.language, addAssistantMessage]);

  // Handle message sending - queue if AI is responding
  const handleSendMessage = useCallback((text: string) => {
    if (isStreaming) {
      // AI 응답 중이면 큐에 저장
      setPendingMessage(text);
      return;
    }
    sendMessage(text);
  }, [sendMessage, isStreaming]);
  
  // AI 응답 완료 후 대기 메시지 전송
  useEffect(() => {
    if (!isStreaming && pendingMessage) {
      const msg = pendingMessage;
      setPendingMessage(null);
      // 약간의 딜레이 후 전송 (자연스러운 UX)
      setTimeout(() => sendMessage(msg), 100);
    }
  }, [isStreaming, pendingMessage, sendMessage]);

  // Save conversation on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      useChatStore.getState().persistMessages();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-white shadow-xl overflow-hidden overflow-x-hidden">
      <ChatHeader idol={idol} />

      {!historyLoaded ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="loading-spinner" />
            <div className="text-gray-300 text-sm">
              {idol.language === 'ja' ? '読み込み中...' : idol.language === 'en' ? 'Loading...' : '로딩중...'}
            </div>
          </div>
        </div>
      ) : (
        <MessageList
          messages={messages}
          idol={idol}
          isStreaming={isStreaming}
        />
      )}

      {error && (
        <div className="px-4 py-2 bg-red-50 text-red-600 text-xs text-center animate-shake">
          {error}
        </div>
      )}

      {/* Desktop: input fixed to viewport bottom */}
      <div className="animate-input-in mt-auto">
        <ChatInput
          onSend={handleSendMessage}
          disabled={!historyLoaded}
          themeColor={idol.themeColor}
          language={idol.language}
        />
      </div>
    </div>
  );
}
