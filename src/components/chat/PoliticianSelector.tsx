import { useEffect, useRef, useState, useCallback } from 'react';
import type { PoliticianMeta } from '@/types/politician';
import { useChatStore } from '@/stores/chat-store';

interface Props {
  politicians: PoliticianMeta[];
}

function getInitials(name: string): string {
  return name.slice(0, 1);
}

const TYPING_MESSAGES: Record<string, string[]> = {
  '이재명': [
    '무엇이든 물어보세요.',
    '경제 정책이 궁금하시면 말씀하세요.',
    '국민 여러분과 소통하겠습니다.',
    '일자리 정책에 대해 이야기해요.',
  ],
  '김문수': [
    '반갑습니다. 정책에 대해 이야기해요.',
    '국가 경쟁력 강화 방안을 논의해요.',
    '교육 정책이 궁금하시면 물어보세요.',
    '자유롭게 질문해주세요.',
  ],
  '이준석': [
    '솔직한 대화 좋아합니다.',
    '청년 정책에 대해 물어보세요.',
    '무엇이든 직설적으로 답할게요.',
    '정치 개혁, 같이 이야기해요.',
  ],
  '권영세': [
    '궁금한 점이 있으신가요?',
    '외교 안보 정책을 이야기해요.',
    '통일 문제에 대해 논의해볼까요?',
    '자유롭게 질문해주세요.',
  ],
  _default: [
    '안녕하세요! 대화를 시작해보세요.',
    '정책에 대해 물어보세요.',
    '궁금한 점이 있으신가요?',
    '자유롭게 질문해주세요.',
  ],
};

function useTypingLoop(name: string) {
  const messages = TYPING_MESSAGES[name] || TYPING_MESSAGES._default;
  const [text, setText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const msgIndexRef = useRef(0);

  const runLoop = useCallback(() => {
    const msg = messages[msgIndexRef.current % messages.length];
    let charIdx = 0;
    setIsTyping(true);

    const typeInterval = setInterval(() => {
      charIdx++;
      setText(`"${msg.slice(0, charIdx)}"`);
      if (charIdx >= msg.length) {
        clearInterval(typeInterval);
        setIsTyping(false);
        // Wait 2s, then clear and move to next
        setTimeout(() => {
          setText('');
          msgIndexRef.current++;
          // Small delay before next message starts
          setTimeout(() => runLoop(), 300);
        }, 2000);
      }
    }, 80);

    return () => clearInterval(typeInterval);
  }, [messages]);

  useEffect(() => {
    // Initial delay before starting
    const timeout = setTimeout(() => runLoop(), 800 + Math.random() * 600);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { text, isTyping };
}

function TypingPreview({ name }: { name: string }) {
  const { text, isTyping } = useTypingLoop(name);
  if (!text) return <p className="typing-preview idle text-xs text-slate-400 mb-2">&nbsp;</p>;
  return (
    <p className={`typing-preview ${isTyping ? 'typing' : 'idle'} text-xs text-slate-400 mb-2`}>
      {text}
    </p>
  );
}

export default function PoliticianSelector({ politicians }: Props) {
  const setCurrentPolitician = useChatStore((s) => s.setCurrentPolitician);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  // IntersectionObserver for staggered reveal
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const delay = el.dataset.revealDelay || '0';
            setTimeout(() => {
              el.classList.add('revealed');
            }, Number(delay));
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -30px 0px' }
    );

    cardsRef.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [politicians]);

  return (
    <div className="polichat-bg h-[100svh] overflow-y-auto overflow-x-hidden relative hide-scrollbar">
      {/* Mesh gradient background */}
      <div className="policy-pattern" />

      <div
        className="mx-auto px-4 pt-10 pb-8 relative z-10"
        style={{ maxWidth: '600px' }}
      >
        {/* Hero */}
        <div className="text-center mb-10">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-5 animate-fade-in">
            <img src="/logo.svg" alt="Polichat" className="w-14 h-14" />
            <h1 className="text-4xl logo-text-gradient">
              Polichat
            </h1>
          </div>

          {/* LIVE Badge */}
          <div
            className="animate-fade-in-up flex justify-center mb-4"
            style={{ animationDelay: '0.05s' }}
          >
            <div className="live-badge inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold text-slate-700">
              <span className="relative flex h-2.5 w-2.5">
                <span className="live-dot absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              LIVE · 실시간 대화 가능
            </div>
          </div>

          {/* Hero Message */}
          <div
            className="animate-fade-in-up"
            style={{ animationDelay: '0.1s' }}
          >
            <p className="text-xl font-bold text-slate-800 tracking-tight mb-3">
              정치인에게 직접 물어보세요
            </p>
            <p className="text-sm text-slate-600 leading-relaxed max-w-sm mx-auto">
              AI가 공약, 경력, 발언을 학습했습니다
              <br />
              <span className="text-slate-500">정책 질문부터 일상 대화까지 자유롭게</span>
            </p>
          </div>

          {/* Feature badges - glassmorphism */}
          <div
            className="flex items-center justify-center gap-2 mt-5 flex-wrap animate-fade-in-up"
            style={{ animationDelay: '0.2s' }}
          >
            <span className="feature-badge-glass px-3 py-1.5 text-slate-700 text-xs font-semibold rounded-full">
              📋 실제 공약 기반
            </span>
            <span className="feature-badge-glass px-3 py-1.5 text-slate-700 text-xs font-semibold rounded-full">
              💬 실시간 대화
            </span>
            <span className="feature-badge-glass px-3 py-1.5 text-slate-700 text-xs font-semibold rounded-full">
              🔒 프라이버시 보호
            </span>
          </div>
        </div>

        {/* Section title */}
        <div className="mb-4 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
          <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider">
            대화 상대 선택
          </h2>
        </div>

        {/* Politician Cards */}
        <div className="space-y-4">
          {politicians.map((politician, index) => (
            <div
              key={politician.id}
              ref={(el) => { cardsRef.current[index] = el; }}
              className="reveal-card"
              data-reveal-delay={index * 100}
            >
              <button
                onClick={() => setCurrentPolitician(politician.id)}
                className="w-full text-left group"
              >
                <div
                  className="politician-card rounded-2xl overflow-hidden"
                  style={{
                    ['--pol-color' as string]: politician.themeColor,
                    ['--pol-color-secondary' as string]: politician.themeColorSecondary,
                    ['--pol-glow' as string]: `${politician.themeColor}25`,
                  }}
                >
                  <div className="flex items-stretch">
                    {/* Avatar with glow ring */}
                    <div
                      className="politician-image glow-ring w-28 aspect-square flex items-center justify-center text-white text-2xl font-bold shrink-0"
                      style={{
                        background: `linear-gradient(145deg, ${politician.themeColor}, ${politician.themeColorSecondary})`,
                        ['--glow-color' as string]: `${politician.themeColor}40`,
                      }}
                    >
                      {politician.profileImageUrl ? (
                        <img
                          src={politician.profileImageUrl}
                          alt={politician.nameKo}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <span className={politician.profileImageUrl ? 'hidden' : ''}>
                        {getInitials(politician.nameKo)}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 p-4 flex flex-col justify-center min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-lg text-slate-900 truncate">
                          {politician.nameKo}
                        </h3>
                        <span
                          className="px-2 py-0.5 text-xs font-semibold rounded-full shrink-0"
                          style={{
                            backgroundColor: `${politician.themeColor}20`,
                            color: politician.themeColor,
                          }}
                        >
                          {politician.group}
                        </span>
                        {/* Online indicator */}
                        <span className="online-indicator w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
                      </div>

                      <p className="text-sm text-slate-600 line-clamp-1 mb-1.5">
                        {politician.tagline}
                      </p>

                      {/* Typing preview - JS driven loop */}
                      <TypingPreview name={politician.nameKo} />
                    </div>
                  </div>
                </div>
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className="mt-8 pb-4 text-center animate-fade-in-up"
          style={{ animationDelay: '0.4s' }}
        >
          <p className="text-xs text-slate-500 leading-relaxed">
            AI가 생성한 응답입니다. 실제 정치인의 발언이 아닙니다.
            <br />
            <span className="text-slate-400">정책 정보는 공식 자료를 참고해 주세요.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
