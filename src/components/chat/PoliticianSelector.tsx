import { TaglineRenderer } from '@/components/common/TaglineRenderer';
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
    '국민이 먼저입니다.',
    '먹고 사는 문제, 같이 풀어봐요.',
    '기본소득, 이야기해볼까요?',
    '불평등 어떻게 해결할까요?',
  ],
  '김민석': [
    '약자의 눈으로 정책을 봅니다.',
    '근거 있는 확신으로 말씀드릴게요.',
    '민생 현안 뭐든 물어보세요.',
    '총리실에서 직접 답합니다.',
  ],
  '정청래': [
    '민심을 이기는 정권은 없습니다.',
    '할 말은 해야죠, 물어보세요.',
    '민주주의가 뭔지 같이 생각해봐요.',
    '팩트로 이야기합니다.',
  ],
  '장동혁': [
    '법치주의, 타협 없습니다.',
    '상식이 통하는 정치 해야죠.',
    '대안 있는 야당이 되겠습니다.',
    '뭐든 솔직하게 물어보세요.',
  ],
  '오세훈': [
    '서울을 세계 1등 도시로.',
    '도시 개발, 궁금한 거 물어보세요.',
    '공정한 서울 만들겠습니다.',
    '서울 시민을 위해 답하겠습니다.',
  ],
  '정원오': [
    '현장에서 답을 찾습니다.',
    '성동구 정책 뭐든 물어보세요.',
    '늘 곁에서 힘이 되겠습니다.',
    '소통이 혁신입니다.',
  ],
  '이준석': [
    '데이터로 말합니다.',
    '청년 정치, 왜 필요한지 얘기해요.',
    '능력주의, 동의하세요?',
    '직설적으로 답하겠습니다.',
  ],
  '전한길': [
    '이 나라 지키려면 싸워야 합니다.',
    '진짜 보수가 뭔지 얘기해봐요.',
    '역사 왜곡, 그냥 못 넘깁니다.',
    '자유대한민국 수호, 함께해요.',
  ],
  '김어준': [
    '맥락부터 같이 봐야 합니다.',
    '언론이 말 안 하는 것들 얘기해요.',
    '왜 그랬을까, 같이 생각해봐요.',
    '제가 보기엔... 좀 달라요.',
  ],
  '진중권': [
    '틀린 건 틀렸다고 합니다.',
    '진영 논리, 저는 안 합니다.',
    '불편해도 솔직하게 얘기해요.',
    '미학적으로 접근해볼까요?',
  ],
  '한동훈': [
    '국민 눈높이에서 생각합니다.',
    '공정한 법 집행, 타협 없어요.',
    '변화는 내부에서 시작됩니다.',
    '정치는 결국 신뢰입니다.',
  ],
  '홍준표': [
    '소신은 바꾸지 않습니다.',
    '40년 정치, 아는 만큼 말해요.',
    '강한 보수가 나라를 지킵니다.',
    '직설이 제 스타일입니다.',
  ],
  '김문수': [
    '자유가 최고의 가치입니다.',
    '국가 경쟁력, 같이 이야기해요.',
    '반공 정신, 왜 중요한지 얘기해요.',
    '노동 현장 누구보다 잘 압니다.',
  ],
  _default: [
    '안녕하세요! 대화를 시작해보세요.',
    '무엇이든 물어보세요.',
    '솔직하게 답해드리겠습니다.',
    '같이 이야기해봐요.',
  ],
};

function useTypingLoop(name: string) {
  const messages = TYPING_MESSAGES[name] || TYPING_MESSAGES._default;
  const [text, setText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const msgIndexRef = useRef(0);
  const cancelledRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout | typeof setInterval>[]>([]);

  const addTimer = useCallback((id: ReturnType<typeof setTimeout | typeof setInterval>) => {
    timersRef.current.push(id);
    return id;
  }, []);

  const runLoop = useCallback(() => {
    if (cancelledRef.current) return;
    const msg = messages![msgIndexRef.current % messages!.length];
    if (!msg) return;
    let charIdx = 0;
    setIsTyping(true);

    const typeInterval = addTimer(setInterval(() => {
      if (cancelledRef.current) { clearInterval(typeInterval); return; }
      charIdx++;
      setText(`"${msg.slice(0, charIdx)}"`);
      if (charIdx >= msg.length) {
        clearInterval(typeInterval);
        setIsTyping(false);
        addTimer(setTimeout(() => {
          if (cancelledRef.current) return;
          setText('');
          msgIndexRef.current++;
          addTimer(setTimeout(() => runLoop(), 300));
        }, 3000));
      }
    }, 120));
  }, [messages, addTimer]);

  useEffect(() => {
    cancelledRef.current = false;
    timersRef.current = [];
    const timeout = setTimeout(() => runLoop(), 800 + Math.random() * 600);
    timersRef.current.push(timeout);
    return () => {
      cancelledRef.current = true;
      timersRef.current.forEach(id => clearTimeout(id as ReturnType<typeof setTimeout>));
      timersRef.current = [];
    };
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
              AI 5분 토론
            </p>
          </div>
          <DebateBanner debateType="seoul" />
          <DebateBanner debateType="national" />
          <DebateBanner debateType="leejeon" />
          <DebateBanner debateType="kimjin" />
          <DebateBanner debateType="hanhong" />
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
            AI 1:1 대화
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
                  className="pc-card-interactive w-full overflow-hidden rounded-2xl"
                  style={{ background: `linear-gradient(135deg, ${politician.themeColor}50 0%, ${politician.themeColor}20 50%, ${politician.themeColor}10 100%)` }}
                >
                  <div className="flex items-center gap-5 px-5 py-4">
                    {/* Profile circle with color ring */}
                    <div className="relative shrink-0">
                      <div
                        className="w-[85px] h-[85px] rounded-full overflow-hidden"
                        style={{
                          boxShadow: `0 0 0 3px white, 0 0 0 6px ${politician.themeColor}90, 0 8px 20px ${politician.themeColor}30`,
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
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-[20px] text-gray-950 truncate">
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
                        <TaglineRenderer text={politician.tagline} />
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

        {/* 면책 문구 - 박스 없이 텍스트만 */}
        <div className="mt-6 mb-4 px-4 text-left">
          <p className="text-[12px] text-gray-500 leading-relaxed">
            ⚠️ 본 서비스에서 제공되는 모든 대화와 토론 콘텐츠는 인공지능(AI) 기술을 통해 생성된 가상의 시뮬레이션 결과물입니다. 해당 콘텐츠는 각 정치인의 공개된 과거 발언 및 언론 보도 등을 기반으로 학습된 모델이 생성한 것이나, 이는 실제 인물의 현재 의지나 공식적인 견해를 대변하지 않으며 실제 입장과 상당한 차이가 있을 수 있습니다. 또한, 인공지능 기술의 특성상 생성 과정에서 사실과 다른 허구의 내용이나 왜곡 및 과장된 표현이 포함될 수 있으므로, 본 서비스의 내용을 공식적인 근거로 인용하거나 절대적인 사실로 신뢰하지 마시기 바랍니다. 서비스 이용 중 발생하는 오해나 사용자의 판단에 따른 결과에 대해 운영측은 어떠한 법적 책임도 지지 않으며, 정확한 정보 확인이 필요한 사안은 반드시 공식적인 경로를 통해 재확인하시길 권고드립니다.
          </p>
        </div>
      </div>
    </div>
    </div>
  );
}
