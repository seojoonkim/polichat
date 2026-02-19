import { useEffect, useRef, useState, useCallback } from 'react';
import type { PoliticianMeta } from '@/types/politician';
import { useChatStore } from '@/stores/chat-store';
import DebateBanner from '@/components/debate/DebateBanner';

interface Props {
  politicians: PoliticianMeta[];
}

// 홈 화면에서 html/body/#root scroll 허용 (채팅 화면은 자체 fixed 레이아웃)
function useBodyScrollUnlock() {
  useEffect(() => {
    const root = document.getElementById('root');
    const targets = [document.documentElement, document.body, root].filter(Boolean) as HTMLElement[];
    const saved = targets.map(el => ({ overflow: el.style.overflow, position: el.style.position }));

    targets.forEach(el => {
      el.style.overflow = 'visible';
      el.style.position = 'static';
    });
    document.documentElement.style.overflowY = 'auto';

    return () => {
      targets.forEach((el, i) => {
        el.style.overflow = saved[i].overflow;
        el.style.position = saved[i].position;
      });
      document.documentElement.style.overflowY = '';
    };
  }, []);
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
    const msg = messages![msgIndexRef.current % messages!.length];
    if (!msg) return;
    let charIdx = 0;
    setIsTyping(true);

    const typeInterval = setInterval(() => {
      charIdx++;
      setText(`"${msg.slice(0, charIdx)}"`);
      if (charIdx >= msg.length) {
        clearInterval(typeInterval);
        setIsTyping(false);
        // Wait 3s, then clear and move to next
        setTimeout(() => {
          setText('');
          msgIndexRef.current++;
          // Small delay before next message starts
          setTimeout(() => runLoop(), 300);
        }, 3000);
      }
    }, 120);

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
  if (!text) return <p className="typing-preview idle text-xs text-slate-400 mb-2 truncate">&nbsp;</p>;
  return (
    <p className={`typing-preview ${isTyping ? 'typing' : 'idle'} text-xs text-slate-400 mb-2 truncate overflow-hidden`}>
      {text}
    </p>
  );
}

export default function PoliticianSelector({ politicians }: Props) {
  useBodyScrollUnlock();
  const setCurrentPolitician = useChatStore((s) => s.setCurrentPolitician);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  // 페이지 로드 즉시 모든 카드 stagger reveal (스크롤 불필요)
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    cardsRef.current.forEach((el) => {
      if (!el) return;
      const delay = Number(el.dataset.revealDelay || '0');
      const t = setTimeout(() => el.classList.add('revealed'), delay);
      timers.push(t);
    });
    return () => timers.forEach(clearTimeout);
  }, [politicians]);

  return (
    <div style={{ background: '#0D0F1A', minHeight: '100vh' }}>
    <div className="polichat-bg overflow-x-hidden relative" style={{ maxWidth: '700px', margin: '0 auto', minHeight: '100svh' }}>
      {/* Mesh gradient background */}
      <div className="policy-pattern" />

      <div
        className="mx-auto px-4 pt-10 pb-8 relative z-10"
        style={{ maxWidth: '700px' }}
      >
        {/* Hero */}
        <div className="text-center mb-8">
          {/* Logo */}
          <div className="flex items-center justify-center gap-1 mb-5 animate-fade-in">
            <img src="/logo.svg" alt="Polichat" className="w-14 h-14" />
            <h1
              className="logo-text-gradient"
              style={{
                fontFamily: "'Rammetto One', sans-serif",
                fontWeight: 400,
                fontSize: '42px',
                letterSpacing: '-0.01em',
                lineHeight: 1,
              }}
            >
              Polichat
            </h1>
          </div>

          {/* Hero tagline */}
          <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center justify-center gap-2.5 mb-3">
              <h2
                style={{
                  fontFamily: "'SUITE Variable', sans-serif",
                  fontWeight: 800,
                  fontSize: '19px',
                  letterSpacing: '-0.03em',
                  color: '#1A0845',
                }}
              >
                AI 정치인과 직접 대화하세요
              </h2>
              <div className="live-badge inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="live-dot absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
                <span className="text-[10px] font-bold text-slate-600 tracking-wider">LIVE</span>
              </div>
            </div>
            <p className="text-[13px] text-gray-500 leading-relaxed max-w-[280px] mx-auto">
              공약·경력·발언을 학습한 AI — 정책 질문부터 일상 대화까지
            </p>
          </div>
        </div>

        {/* 토론 배틀 배너 */}
        <div className="animate-fade-in-up space-y-2" style={{ animationDelay: '0.12s' }}>
          <div className="mb-2">
            <p className="text-[13px] font-bold text-gray-700 tracking-wide uppercase" style={{ letterSpacing: '0.06em' }}>⚔️ AI 토론 시뮬레이션</p>
          </div>
          <DebateBanner debateType="seoul" />
          <DebateBanner debateType="national" />
        </div>

        {/* Section title */}
        <div className="mb-3 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
          <p className="text-[13px] font-bold text-gray-700 tracking-wide uppercase" style={{ letterSpacing: '0.06em' }}>💬 1:1 AI 대화</p>
        </div>

        {/* Politician Cards */}
        <div className="space-y-3">
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
                  className="pc-card-interactive w-full overflow-hidden"
                >
                  <div className="flex items-center gap-4 px-4 py-3.5">
                    {/* Profile circle with color ring */}
                    <div className="relative shrink-0">
                      <div
                        className="w-[66px] h-[66px] rounded-full overflow-hidden"
                        style={{
                          boxShadow: `0 0 0 2.5px white, 0 0 0 5px ${politician.themeColor}80`,
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
                        <div
                          className={`${politician.profileImageUrl ? 'hidden' : ''} w-full h-full flex items-center justify-center text-white text-xl font-bold`}
                          style={{ background: `linear-gradient(135deg, ${politician.themeColor}, ${politician.themeColorSecondary})` }}
                        >
                          {getInitials(politician.nameKo)}
                        </div>
                      </div>
                      {/* Online dot */}
                      <span
                        className="online-indicator absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white"
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-bold text-[18px] text-gray-900 truncate">
                          {politician.nameKo}
                        </h3>
                        <span
                          className="px-2 py-0.5 text-[11px] font-bold rounded-full shrink-0 whitespace-nowrap"
                          style={{
                            backgroundColor: `${politician.themeColor}15`,
                            color: politician.themeColor,
                          }}
                        >
                          {politician.group}
                        </span>
                      </div>
                      <p className="text-[13px] text-gray-500 line-clamp-1 mb-1.5 leading-snug">
                        {politician.tagline}
                      </p>
                      <TypingPreview name={politician.nameKo} />
                    </div>

                    {/* Chevron arrow */}
                    <div className="shrink-0 pl-1 text-gray-300 transition-all duration-300 group-hover:text-gray-500 group-hover:translate-x-1">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
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
    </div>
  );
}
