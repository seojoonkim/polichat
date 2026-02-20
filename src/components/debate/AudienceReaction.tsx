import { useEffect, useState, useRef } from 'react';

interface AudienceReactionProps {
  messageText: string;
  tension: number;
  trigger: number; // 증가할 때마다 새 반응 트리거
}

interface FloatingEmoji {
  id: number;
  emoji: string;
  x: number;
}

const REACTION_RULES = [
  { keywords: ['거짓', '사기', '위선', '배신', '폭탄', '기만', '황당', '뻔뻔'],  emoji: '💥' },
  { keywords: ['조', '억', '만명', '%', '통계', '데이터', '수치', '팩트', '증거'], emoji: '😲' },
  { keywords: ['웃기', '실소', '명불허전', '창의적', '훌륭하십니다', '정말이요'], emoji: '🤣' },
  { keywords: ['국민', '민주주의', '역사', '대한민국', '수호'],                    emoji: '👏' },
  { keywords: ['분노', '참을 수', '화가', '치가 떨린'],                            emoji: '😤' },
];

function detectEmojis(text: string, tension: number): string[] {
  const found: string[] = [];
  for (const rule of REACTION_RULES) {
    if (rule.keywords.some(kw => text.includes(kw))) found.push(rule.emoji);
  }
  const count = tension > 66 ? 5 : tension > 33 ? 3 : 2;
  while (found.length < count) {
    found.push((['👏', '💥', '😲', '🤣'] as const)[Math.floor(Math.random() * 4)] ?? '👏');
  }
  return found.slice(0, count);
}

let uidCounter = 0;

export default function AudienceReaction({ messageText, tension, trigger }: AudienceReactionProps) {
  const [emojis, setEmojis] = useState<FloatingEmoji[]>([]);
  const prevTriggerRef = useRef(-1);

  useEffect(() => {
    if (trigger <= 0 || trigger === prevTriggerRef.current) return;
    prevTriggerRef.current = trigger;

    const detected = detectEmojis(messageText, tension);
    const newEmojis: FloatingEmoji[] = detected.map((emoji, i) => ({
      id: ++uidCounter,
      emoji,
      x: 10 + i * 18,
    }));
    setEmojis(prev => [...prev, ...newEmojis]);

    // 2.5초 후 제거
    const timer = setTimeout(() => {
      setEmojis(prev => prev.filter(e => !newEmojis.find(n => n.id === e.id)));
    }, 2500);
    return () => clearTimeout(timer);
  }, [trigger]);

  if (emojis.length === 0) return null;

  return (
    <div style={{ position: 'relative', height: 0, pointerEvents: 'none' }}>
      {emojis.map((e, i) => (
        <span
          key={e.id}
          style={{
            position: 'absolute',
            left: `${e.x}%`,
            bottom: 0,
            fontSize: 22,
            animation: `audienceFloat 2.3s ease-out forwards`,
            animationDelay: `${i * 0.12}s`,
            opacity: 0,
            userSelect: 'none',
          }}
        >
          {e.emoji}
        </span>
      ))}
      <style>{`
        @keyframes audienceFloat {
          0%   { transform: translateY(0) scale(0.8); opacity: 0; }
          15%  { opacity: 1; transform: translateY(-10px) scale(1.1); }
          80%  { opacity: 0.8; }
          100% { transform: translateY(-90px) scale(0.9); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
