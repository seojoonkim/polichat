import { useEffect, useRef, useCallback } from 'react';
import type { Message } from '@/types/chat';
import type { IdolMeta } from '@/types/idol';
import MessageBubble from './MessageBubble';

interface Props {
  messages: Message[];
  idol: IdolMeta;
  isStreaming: boolean;
}

export default function MessageList({ messages, idol, isStreaming }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 스크롤 함수 - 더 확실하게
  const scrollToBottom = useCallback((smooth = true) => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ 
        behavior: smooth ? 'smooth' : 'auto', 
        block: 'end' 
      });
    }
    // 컨테이너 직접 스크롤도 보조로 사용
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, []);

  // 새 버블이 나타날 때 호출될 callback
  const handleBubbleReveal = useCallback(() => {
    // 더 자주 스크롤 (DOM 업데이트 대기)
    requestAnimationFrame(() => scrollToBottom(true));
    setTimeout(() => scrollToBottom(true), 50);
    setTimeout(() => scrollToBottom(true), 150);
    setTimeout(() => scrollToBottom(true), 300);
  }, [scrollToBottom]);

  // 메시지 변경 시 스크롤
  useEffect(() => {
    scrollToBottom(false);
    
    const timers = [
      setTimeout(() => scrollToBottom(true), 50),
      setTimeout(() => scrollToBottom(true), 150),
      setTimeout(() => scrollToBottom(true), 300),
      setTimeout(() => scrollToBottom(true), 500),
    ];

    return () => timers.forEach(clearTimeout);
  }, [messages.length, scrollToBottom]);

  // 스트리밍 중 지속적 스크롤 (50ms 간격)
  useEffect(() => {
    if (!isStreaming) return;
    
    scrollToBottom(true);
    const interval = setInterval(() => scrollToBottom(true), 50);
    
    return () => clearInterval(interval);
  }, [isStreaming, scrollToBottom]);

  // 스트리밍 종료 시 최종 스크롤
  useEffect(() => {
    if (isStreaming) return;
    
    const timers = [
      setTimeout(() => scrollToBottom(true), 100),
      setTimeout(() => scrollToBottom(true), 300),
    ];
    
    return () => timers.forEach(clearTimeout);
  }, [isStreaming, scrollToBottom]);

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-hidden px-5 pt-5 pb-4 custom-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* Welcome message area */}
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4 shadow-lg animate-scale-in overflow-hidden ring-2 ring-white/50"
            style={{
              background: `linear-gradient(135deg, ${idol.themeColor}, ${idol.themeColorSecondary})`,
            }}
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
          <h2
            className="text-lg font-bold text-gray-700 animate-fade-in-up"
            style={{ animationDelay: '0.1s', opacity: 0 }}
          >
            {idol.nameKo}
          </h2>
          <p
            className="text-sm text-gray-400 mt-1 animate-fade-in-up"
            style={{ animationDelay: '0.2s', opacity: 0 }}
          >
            {idol.tagline}
          </p>
          <p
            className="text-xs text-gray-300 mt-5 animate-fade-in-up"
            style={{ animationDelay: '0.35s', opacity: 0 }}
          >
            Send a message to start chatting!
          </p>
        </div>
      )}

      {/* Messages - 시스템 트리거만 필터링, 나머지는 MessageBubble이 처리 */}
      {messages
        .filter((msg) => !(msg.role === 'user' && msg.content.startsWith('[시스템:')))
        .map((msg, idx, arr) => (
          <MessageBubble 
            key={msg.id} 
            message={msg} 
            idol={idol} 
            isNew={isStreaming && idx === arr.length - 1 && msg.role === 'assistant'}
            onBubbleReveal={handleBubbleReveal}
          />
        ))}

      <div ref={bottomRef} />
    </div>
  );
}
