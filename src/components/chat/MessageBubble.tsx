import { useState, useEffect, useRef } from 'react';
import type { Message } from '@/types/chat';
import type { IdolMeta } from '@/types/idol';

interface Props {
  message: Message;
  idol: IdolMeta;
  isNew?: boolean; // 스트리밍 중인 메시지인지
  onBubbleReveal?: () => void; // 새 버블이 나타날 때 호출 (스크롤용)
}

// @username을 클릭 가능한 인스타그램 링크로 변환
function parseInstagramHandles(text: string): React.ReactNode {
  // @로 시작하고 영문, 숫자, 언더스코어, 점으로 이루어진 아이디 매칭
  const regex = /@([a-zA-Z0-9_.]+)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // 매치 이전의 텍스트
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    // 인스타그램 링크로 변환
    const username = match[1];
    parts.push(
      <a
        key={match.index}
        href={`https://instagram.com/${username}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-pink-500 hover:text-pink-600 underline underline-offset-2"
        onClick={(e) => e.stopPropagation()}
      >
        @{username}
      </a>
    );
    lastIndex = regex.lastIndex;
  }

  // 마지막 텍스트
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

// 타이핑 인디케이터 컴포넌트
function TypingDots({ color }: { color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full typing-dot" style={{ backgroundColor: color }} />
      <span className="w-1.5 h-1.5 rounded-full typing-dot" style={{ backgroundColor: color }} />
      <span className="w-1.5 h-1.5 rounded-full typing-dot" style={{ backgroundColor: color }} />
    </span>
  );
}

// 타이핑 애니메이션이 있는 버블
function TypingBubble({ 
  text, 
  color, 
  onComplete,
  onProgress,
}: { 
  text: string; 
  color: string;
  onComplete: () => void;
  onProgress?: () => void;
}) {
  const [visibleChars, setVisibleChars] = useState(0);
  const completedRef = useRef(false);

  useEffect(() => {
    if (visibleChars >= text.length) {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete();
      }
      return;
    }

    // 글자당 36~60ms (랜덤) - 40% 빠르게 조정
    const delay = 36 + Math.random() * 24;
    const timer = setTimeout(() => {
      setVisibleChars(c => c + 1);
      onProgress?.();
    }, delay);

    return () => clearTimeout(timer);
  }, [visibleChars, text.length, onComplete, onProgress]);

  return (
    <div
      className="w-fit max-w-full px-4 py-2.5 rounded-2xl rounded-tl-sm text-[15px] leading-relaxed shadow-sm text-gray-800 animate-bubble-in"
      style={{
        backgroundColor: `${color}08`,
        border: `1px solid ${color}18`,
      }}
    >
      {text.slice(0, visibleChars)}
      {visibleChars < text.length && (
        <span className="inline-block w-0.5 h-4 ml-0.5 animate-pulse" style={{ backgroundColor: color }} />
      )}
    </div>
  );
}

export default function MessageBubble({ message, idol, isNew = false, onBubbleReveal }: Props) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  // 시스템 메시지: 가운데 정렬 배지
  if (isSystem) {
    return (
      <div className="flex justify-center my-4 animate-bubble-in">
        <div 
          className="px-4 py-1.5 rounded-full text-xs font-medium shadow-sm"
          style={{
            background: `linear-gradient(135deg, ${idol.themeColor}15, ${idol.themeColorSecondary}15)`,
            color: idol.themeColor,
            border: `1px solid ${idol.themeColor}25`,
          }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  // Split assistant messages by "||" for multiple bubbles
  const bubbleParts = !isUser && message.content
    ? message.content.split('||').map((s) => s.trim()).filter(Boolean)
    : [];

  // 10초 이내 생성된 메시지만 애니메이션 적용
  const [shouldAnimate] = useState(() => {
    if (isUser) return false;
    return Date.now() - message.timestamp < 10000;
  });

  // 상태: 'streaming' | 'typing-N' | 'delay-N' | 'complete'
  const [phase, setPhase] = useState<string>(() => {
    if (isUser) return 'complete';
    if (!shouldAnimate) return 'complete';
    if (isNew) return 'streaming';
    return 'start'; // 스트리밍 완료 직후
  });

  const [completedBubbles, setCompletedBubbles] = useState<string[]>([]);
  const [currentTypingIndex, setCurrentTypingIndex] = useState(-1);
  const finalBubblePartsRef = useRef<string[]>([]);

  // 스트리밍 완료 감지
  const prevIsNewRef = useRef(isNew);
  useEffect(() => {
    if (prevIsNewRef.current && !isNew && shouldAnimate) {
      // 스트리밍 완료 - 버블 파츠 저장하고 첫 번째 버블 타이핑 시작
      finalBubblePartsRef.current = bubbleParts;
      if (bubbleParts.length > 0) {
        setCurrentTypingIndex(0);
        setPhase('typing-0');
        onBubbleReveal?.();
      } else {
        setPhase('complete');
      }
    }
    prevIsNewRef.current = isNew;
  }, [isNew, shouldAnimate, bubbleParts, onBubbleReveal]);

  // 버블 타이핑 완료 핸들러
  const handleBubbleComplete = (index: number) => {
    const parts = finalBubblePartsRef.current;
    const part = parts[index];
    if (part) {
      setCompletedBubbles(prev => [...prev, part]);
    }
    
    if (index + 1 < parts.length) {
      // 다음 버블 있으면 딜레이 후 타이핑 (생각하는 느낌)
      setPhase(`delay-${index}`);
      const delay = 1500 + Math.random() * 1500; // 1.5~3초
      setTimeout(() => {
        setCurrentTypingIndex(index + 1);
        setPhase(`typing-${index + 1}`);
        onBubbleReveal?.();
      }, delay);
    } else {
      // 모든 버블 완료
      setPhase('complete');
    }
  };

  if (isUser) {
    return (
      <div className="flex justify-end mb-3 animate-bubble-in-user">
        <div className="flex flex-col items-end gap-0.5">
          <div className="relative">
            <div
              className="max-w-[78%] px-4 py-2.5 rounded-2xl rounded-br-sm text-white text-[15px] leading-relaxed shadow-sm"
              style={{
                background: `linear-gradient(135deg, ${idol.themeColor}, ${idol.themeColorSecondary})`,
              }}
            >
              {message.content}
            </div>
            {/* 리액션 표시 - 말풍선 아래에 겹치지 않게 */}
            {message.reaction && (
              <div 
                className="absolute -bottom-5 left-0 flex items-center gap-1 animate-bounce-in bg-white/90 px-1.5 py-0.5 rounded-full shadow-sm"
                style={{ animationDuration: '0.3s' }}
              >
                <span className="text-sm">{message.reaction}</span>
                <span className="text-[10px] text-pink-500 font-medium">+1 MIM</span>
              </div>
            )}
          </div>
          {/* 읽음 표시 + MIM */}
          <div className="flex items-center gap-1.5 mr-1">
            {message.isRead && (
              <span className="text-[10px] text-gray-400">
                {idol.language === 'ja' ? '既読' : '읽음'}
              </span>
            )}
            {message.expGained && message.expGained > 0 && (
              <span 
                className="text-[10px] font-bold animate-mim-glow"
                style={{ color: idol.themeColor }}
              >
                ✨ +{message.expGained} MIM
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 과거 메시지 (애니메이션 없음)
  if (!shouldAnimate || phase === 'complete') {
    const displayParts = phase === 'complete' && completedBubbles.length > 0 
      ? completedBubbles 
      : bubbleParts;
    
    if (displayParts.length === 0) {
      return null;
    }

    return (
      <div className="flex gap-2.5 mb-3">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-1 shadow-sm overflow-hidden ring-1 ring-black/5"
          style={{
            background: `linear-gradient(135deg, ${idol.themeColor}, ${idol.themeColorSecondary})`,
          }}
        >
          {idol.profileImageUrl ? (
            <img src={idol.profileImageUrl} alt={idol.nameKo} className="w-full h-full object-cover" />
          ) : (
            idol.nameKo.slice(0, 1)
          )}
        </div>
        <div className="max-w-[78%]">
          <div className="text-[11px] text-gray-400 mb-0.5 ml-1 font-medium">{idol.nameKo}</div>
          <div className="flex flex-col gap-1.5 items-start">
            {displayParts.map((part, idx) => (
              <div
                key={idx}
                className="w-fit max-w-full px-4 py-2.5 rounded-2xl rounded-tl-sm text-[15px] leading-relaxed shadow-sm text-gray-800"
                style={{
                  backgroundColor: `${idol.themeColor}08`,
                  border: `1px solid ${idol.themeColor}18`,
                }}
              >
                {parseInstagramHandles(part)}
              </div>
            ))}
            {/* MIM 획득 표시 */}
            {message.expGained && message.expGained > 0 && (
              <span 
                className="text-[10px] font-bold ml-1 animate-mim-glow"
                style={{ color: idol.themeColor }}
              >
                ✨ +{message.expGained} MIM
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 스트리밍 중: 타이핑 인디케이터만
  if (phase === 'streaming' || isNew) {
    return (
      <div className="flex gap-2.5 mb-3 animate-bubble-in">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-1 shadow-sm overflow-hidden ring-1 ring-black/5"
          style={{
            background: `linear-gradient(135deg, ${idol.themeColor}, ${idol.themeColorSecondary})`,
          }}
        >
          {idol.profileImageUrl ? (
            <img src={idol.profileImageUrl} alt={idol.nameKo} className="w-full h-full object-cover" />
          ) : (
            idol.nameKo.slice(0, 1)
          )}
        </div>
        <div className="max-w-[78%]">
          <div className="text-[11px] text-gray-400 mb-0.5 ml-1 font-medium">{idol.nameKo}</div>
          <div
            className="w-fit px-4 py-2.5 rounded-2xl rounded-tl-sm shadow-sm"
            style={{
              backgroundColor: `${idol.themeColor}08`,
              border: `1px solid ${idol.themeColor}18`,
            }}
          >
            <TypingDots color={idol.themeColor} />
          </div>
        </div>
      </div>
    );
  }

  // 타이핑 애니메이션 진행 중
  const parts = finalBubblePartsRef.current;
  const isInDelay = phase.startsWith('delay-');

  return (
    <div className="flex gap-2.5 mb-3 animate-bubble-in">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-1 shadow-sm overflow-hidden ring-1 ring-black/5"
        style={{
          background: `linear-gradient(135deg, ${idol.themeColor}, ${idol.themeColorSecondary})`,
        }}
      >
        {idol.profileImageUrl ? (
          <img src={idol.profileImageUrl} alt={idol.nameKo} className="w-full h-full object-cover" />
        ) : (
          idol.nameKo.slice(0, 1)
        )}
      </div>
      <div className="max-w-[78%]">
        <div className="text-[11px] text-gray-400 mb-0.5 ml-1 font-medium">{idol.nameKo}</div>
        <div className="flex flex-col gap-1.5 items-start">
          {/* 완료된 버블들 */}
          {completedBubbles.map((part, idx) => (
            <div
              key={`completed-${idx}`}
              className="w-fit max-w-full px-4 py-2.5 rounded-2xl rounded-tl-sm text-[15px] leading-relaxed shadow-sm text-gray-800"
              style={{
                backgroundColor: `${idol.themeColor}08`,
                border: `1px solid ${idol.themeColor}18`,
              }}
            >
              {parseInstagramHandles(part)}
            </div>
          ))}
          
          {/* 현재 타이핑 중인 버블 */}
          {currentTypingIndex >= 0 && currentTypingIndex < parts.length && !isInDelay && parts[currentTypingIndex] && (
            <TypingBubble
              key={`typing-${currentTypingIndex}`}
              text={parts[currentTypingIndex]!}
              color={idol.themeColor}
              onComplete={() => handleBubbleComplete(currentTypingIndex)}
              onProgress={onBubbleReveal}
            />
          )}
          
          {/* 딜레이 중 타이핑 인디케이터 */}
          {isInDelay && (
            <div
              className="w-fit px-4 py-2.5 rounded-2xl rounded-tl-sm shadow-sm animate-bubble-in"
              style={{
                backgroundColor: `${idol.themeColor}08`,
                border: `1px solid ${idol.themeColor}18`,
              }}
            >
              <TypingDots color={idol.themeColor} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
