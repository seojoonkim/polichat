import { useEffect, useState } from 'react';
import type { ExpEvent } from '@/types/intimacy';

interface Props {
  event: ExpEvent | null;
  onDone: () => void;
}

// Confetti particles component - 더 화려하게!
function Confetti({ intensity = 'normal' }: { intensity?: 'normal' | 'high' | 'mega' }) {
  const count = intensity === 'mega' ? 15 : intensity === 'high' ? 11 : 7;
  return (
    <div className="absolute -top-3 left-0 right-0 flex justify-center pointer-events-none">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="confetti-particle" />
      ))}
    </div>
  );
}

// 별 반짝임 효과
function StarBurst({ count = 6 }: { count?: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="star-particle"
          style={{
            '--star-angle': `${(360 / count) * i}deg`,
            '--star-delay': `${i * 0.05}s`,
          } as React.CSSProperties}
        >
          ✦
        </span>
      ))}
    </div>
  );
}

// 플로팅 하트/스타 효과 (큰 획득 시)
function FloatingCelebration() {
  const items = ['💖', '⭐', '✨', '💫', '🌟', '💝'];
  return (
    <div className="absolute -top-8 left-1/2 -translate-x-1/2 pointer-events-none">
      {items.map((item, i) => (
        <span
          key={i}
          className="floating-celebration-item"
          style={{
            '--float-x': `${(i - 2.5) * 20}px`,
            '--float-delay': `${i * 0.08}s`,
          } as React.CSSProperties}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

export default function ExpToast({ event, onDone }: Props) {
  const [visible, setVisible] = useState(false);
  const [showEffects, setShowEffects] = useState(false);
  const [showStars, setShowStars] = useState(false);
  const [showFloating, setShowFloating] = useState(false);

  useEffect(() => {
    if (event) {
      setVisible(true);
      
      // 긍정적 이벤트일 때 효과들
      if (event.amount > 0) {
        setShowEffects(true);
        setTimeout(() => setShowEffects(false), 1200);
        
        // 2점 이상이면 별 효과
        if (event.amount >= 2) {
          setShowStars(true);
          setTimeout(() => setShowStars(false), 800);
        }
        
        // 3점 이상이면 플로팅 효과
        if (event.amount >= 3) {
          setShowFloating(true);
          setTimeout(() => setShowFloating(false), 1500);
        }
      }
      
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onDone, 300);
      }, 2500); // 조금 더 길게 보여줌
      return () => clearTimeout(timer);
    }
  }, [event, onDone]);

  if (!event) return null;

  const isPositive = event.amount > 0;
  const sign = isPositive ? '+' : '';
  
  // 이벤트 타입별 이모지
  const emoji = {
    message: '💬',
    daily_bonus: '🌟',
    reaction: '❤️',
    combo: '🔥',
    decay: '💔',
    leave: '👋',
    response_bonus: '✨',
  }[event.type];

  // 획득량에 따른 배경 그라데이션
  const getBgGradient = () => {
    if (!isPositive) return 'bg-gray-500';
    if (event.amount >= 4) return 'bg-gradient-to-r from-amber-400 via-pink-500 to-purple-600'; // 골드 느낌
    if (event.amount >= 3) return 'bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500';
    if (event.amount >= 2) return 'bg-gradient-to-r from-pink-500 to-purple-500';
    return 'bg-gradient-to-r from-pink-500 to-rose-400';
  };

  // 획득량에 따른 confetti 강도
  const getConfettiIntensity = () => {
    if (event.amount >= 4) return 'mega';
    if (event.amount >= 3) return 'high';
    return 'normal';
  };

  return (
    <div
      className={`
        fixed top-20 left-1/2 z-50
        px-5 py-2.5 rounded-full text-white font-bold text-sm
        flex items-center gap-2 overflow-visible
        ${getBgGradient()}
        ${visible ? 'animate-toast-celebrate' : 'opacity-0 -translate-y-4'}
        ${isPositive && visible ? 'animate-toast-glow' : ''}
        ${event.amount >= 3 && visible ? 'animate-toast-rainbow' : ''}
      `}
      style={{ transform: visible ? undefined : 'translateX(-50%) translateY(-20px)' }}
    >
      {/* Floating celebration for big gains */}
      {showFloating && <FloatingCelebration />}
      
      {/* Confetti effect */}
      {showEffects && <Confetti intensity={getConfettiIntensity()} />}
      
      {/* Star burst for 2+ points */}
      {showStars && <StarBurst count={event.amount >= 3 ? 8 : 6} />}
      
      {/* Shimmer overlay */}
      {isPositive && visible && (
        <div className="absolute inset-0 rounded-full animate-shimmer-sweep pointer-events-none" />
      )}
      
      {/* Ring pulse for big gains */}
      {event.amount >= 3 && visible && (
        <div className="absolute inset-0 rounded-full animate-ring-pulse pointer-events-none" />
      )}
      
      {/* Content */}
      <span className={`text-lg drop-shadow-sm ${isPositive && visible ? 'animate-emoji-bounce' : ''}`}>
        {emoji}
      </span>
      <span className={`relative ${isPositive && visible ? 'animate-number-pop' : ''}`}>
        {sign}{event.amount} MIM
      </span>
      
      {/* Extra sparkle for big gains */}
      {event.amount >= 3 && visible && (
        <span className="text-lg animate-spin-slow">🎉</span>
      )}
      {event.amount >= 4 && visible && (
        <span className="text-lg animate-bounce">💎</span>
      )}
    </div>
  );
}
