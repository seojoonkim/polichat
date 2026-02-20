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
        el.style.overflow = saved[i]?.overflow ?? '';
        el.style.position = saved[i]?.position ?? '';
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
  if (!text) return <p className="typing-preview idle text-xs text-slate-600 mb-2 truncate">&nbsp;</p>;
  return (
    <p className={`typing-preview ${isTyping ? 'typing' : 'idle'} text-xs text-slate-600 mb-2 truncate overflow-hidden`}>
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
          <div className="flex items-center justify-center gap-2 mb-5 animate-fade-in">
            <img src="/logo.svg" alt="Polichat" className="w-14 h-14" />
            <div className="flex items-baseline gap-0.5">
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
              <span
                style={{
                  fontSize: '19px',
                  fontFamily: "'Pretendard Variable', sans-serif",
                  fontWeight: 700,
                  color: '#7C3AED',
                  opacity: 0.85,
                  marginBottom: '2px',
                }}
              >.kr</span>
            </div>
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
            <p className="text-[13px] font-bold text-gray-700 tracking-wide uppercase flex items-center gap-1.5" style={{ letterSpacing: '0.06em' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/>
                <line x1="13" y1="19" x2="19" y2="13"/>
                <line x1="16" y1="16" x2="20" y2="20"/>
                <line x1="19" y1="21" x2="21" y2="19"/>
                <polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/>
                <line x1="5" y1="14" x2="9" y2="18"/>
                <line x1="7" y1="21" x2="9" y2="19"/>
              </svg>
              AI 토론 시뮬레이션
            </p>
          </div>
          <DebateBanner debateType="seoul" />
          <DebateBanner debateType="national" />
          <DebateBanner debateType="leejeon" />
          <DebateBanner debateType="kimjin" />
        </div>

        {/* Section title */}
        <div className="mb-3 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
          <p className="text-[13px] font-bold text-gray-700 tracking-wide uppercase flex items-center gap-1.5" style={{ letterSpacing: '0.06em' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              <circle cx="9" cy="10" r="0.8" fill="currentColor"/>
              <circle cx="12" cy="10" r="0.8" fill="currentColor"/>
              <circle cx="15" cy="10" r="0.8" fill="currentColor"/>
            </svg>
            1:1 AI 대화
          </p>
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
                  style={{ background: `linear-gradient(135deg, ${politician.themeColor}40 0%, ${politician.themeColor}10 60%)` }}
                >
                  <div className="flex items-center gap-4 px-4 py-3.5">
                    {/* Profile circle with color ring */}
                    <div className="relative shrink-0">
                      <div
                        className="w-[69px] h-[69px] rounded-full overflow-hidden"
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
                      <p className="text-[13px] text-gray-700 line-clamp-1 mb-1.5 leading-snug">
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
          className="mt-8 pb-6 px-4 animate-fade-in-up"
          style={{ animationDelay: '0.4s' }}
        >
          <div className="px-2 py-2 text-center">
            <p className="text-[13px] leading-relaxed" style={{ color: '#2D0B6B' }}>
              ⚠️ 본 서비스에서 제공되는 모든 대화와 토론 콘텐츠는 인공지능(AI) 기술을 통해 생성된 가상의 시뮬레이션 결과물입니다. 해당 콘텐츠는 각 정치인의 공개된 과거 발언 및 언론 보도 등을 기반으로 학습된 모델이 생성한 것이나, 이는 실제 인물의 현재 의지나 공식적인 견해를 대변하지 않으며 실제 입장과 상당한 차이가 있을 수 있습니다. 또한, 인공지능 기술의 특성상 생성 과정에서 사실과 다른 허구의 내용이나 왜곡 및 과장된 표현이 포함될 수 있으므로, 본 서비스의 내용을 공식적인 근거로 인용하거나 절대적인 사실로 신뢰하지 마시기 바랍니다. 서비스 이용 중 발생하는 오해나 사용자의 판단에 따른 결과에 대해 운영측은 어떠한 법적 책임도 지지 않으며, 정확한 정보 확인이 필요한 사안은 반드시 공식적인 경로를 통해 재확인하시길 권고드립니다.
            </p>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
