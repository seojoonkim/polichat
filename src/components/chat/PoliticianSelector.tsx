import { TaglineRenderer } from '@/components/common/TaglineRenderer';
import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import type { PoliticianMeta } from '@/types/politician';
import { useChatStore } from '@/stores/chat-store';
import DebateBanner from '@/components/debate/DebateBanner';
import { useNavigate } from 'react-router';

interface Props {
  politicians: PoliticianMeta[];
}

interface IssueHeadline {
  title: string;
}

type TabId = 'battle' | 'chat' | 'issue';

interface IssueHistoryItem {
  date: string;
  title: string;
  matchups?: string[];
}

type TabItem = {
  id: TabId;
  label: string;
  icon: (active: boolean) => ReactNode;
};

const TABS: TabItem[] = [
  {
    id: 'battle',
    label: 'AI 5분 토론',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#7c3aed' : '#71717a'} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 17.5L3 6V3h3l11.5 11.5"/>
        <path d="M13 19l6-6M16 16l4 4M19 21l2-2"/>
        <path d="M14.5 6.5L18 3h3v3L9.5 17.5"/>
        <path d="M5 14l4 4M7 21l2-2"/>
      </svg>
    ),
  },
  {
    id: 'chat',
    label: 'AI 1:1 대화',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#7c3aed' : '#71717a'} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    id: 'issue',
    label: '오늘의 이슈로 AI 토론',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#7c3aed' : '#71717a'} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
      </svg>
    ),
  },
];

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
  if (!text) return <p className="typing-preview idle text-xs text-white/60 mb-2 truncate">&nbsp;</p>;
  return (
    <p className={`typing-preview ${isTyping ? 'typing' : 'idle'} text-xs text-white/60 mb-2 truncate overflow-hidden`}>
      {text}
    </p>
  );
}

export default function PoliticianSelector({ politicians }: Props) {
  useBodyScrollUnlock();
  const setCurrentPolitician = useChatStore((s) => s.setCurrentPolitician);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('battle');
  const [heroIssue, setHeroIssue] = useState<IssueHeadline | null>(null);
  const [heroVisible, setHeroVisible] = useState(true);
  const [issueError, setIssueError] = useState(false);
  const [issueHistory, setIssueHistory] = useState<IssueHistoryItem[]>([]);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(() => {
    const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return new Set([today]);
  });
  const toggleDate = (date: string) => setExpandedDates(prev => {
    const next = new Set(prev);
    if (next.has(date)) next.delete(date); else next.add(date);
    return next;
  });
  const todayKST = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const issueTypes = [
    { value: 'seoul',    nameA: '오세훈', nameB: '정원오',  imgA: '/politicians/ohsehoon/profile.jpg',    imgB: '/politicians/jungwono/profile.jpg' },
    { value: 'national', nameA: '정청래', nameB: '장동혁',  imgA: '/politicians/jungcr/profile.jpg',      imgB: '/politicians/jangdh/profile.jpg' },
    { value: 'leejeon',  nameA: '이준석', nameB: '전한길',  imgA: '/politicians/leejunseok/profile.jpg',  imgB: '/politicians/jeonhangil/profile.jpg' },
    { value: 'kimjin',   nameA: '김어준', nameB: '진중권',  imgA: '/politicians/kimeoojun/profile.jpg',   imgB: '/politicians/jinjungkwon/profile.jpg' },
    { value: 'hanhong',  nameA: '한동훈', nameB: '홍준표',  imgA: '/politicians/handoonghoon/profile.jpg',imgB: '/politicians/hongjunpyo/profile.jpg' },
  ];

  // 페이지 로드 즉시 모든 카드 stagger reveal (스크롤 불필요)
  useEffect(() => {
    if (activeTab !== 'chat') return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const kickoff = setTimeout(() => {
      cardsRef.current.forEach((el) => {
        if (!el) return;
        el.classList.remove('revealed');
        const delay = Number(el.dataset.revealDelay || '0');
        const t = setTimeout(() => el.classList.add('revealed'), delay + 50);
        timers.push(t);
      });
    }, 10);
    timers.push(kickoff);
    return () => timers.forEach(clearTimeout);
  }, [politicians, activeTab]);

  useEffect(() => {
    const controller = new AbortController();
    // issue-history를 최초 마운트 시 즉시 병렬 fetch (빠른 로딩)
    fetch('/api/issue-history?all=1')
      .then((r) => r.json())
      .then((data) => { if (data?.issues?.length) setIssueHistory(data.issues); })
      .catch(() => {});
    const loadIssues = async () => {
      try {
          const res = await fetch('/api/issues', { signal: controller.signal });
        if (!res.ok) {
          throw new Error('fetch failed');
        }
        const data = await res.json();
        const first = (data?.issues || [])[0];
        if (!controller.signal.aborted && first?.title) {
          setHeroIssue({ title: first.title });

          // 백그라운드에서 모든 매치업 타입 프리패치 (silent)
          const prefetchTypes = ['seoul', 'national', 'leejeon', 'kimjin', 'hanhong'];
          prefetchTypes.forEach(t => {
            const lsKey = 'pc_issue_kb_' + t + '_' + first.title.slice(0, 50);
            try {
              const cached = localStorage.getItem(lsKey);
              if (cached) {
                const parsed = JSON.parse(cached);
                if (Date.now() - parsed.ts < 2 * 60 * 60 * 1000) return;
              }
            } catch {}
            fetch('/api/issue-research?issue=' + encodeURIComponent(first.title) + '&type=' + t)
              .then(r => r.json())
              .then(data => {
                if (data.dynamicKB) {
                  try {
                    localStorage.setItem(lsKey, JSON.stringify({ data: data.dynamicKB, ts: Date.now() }));
                  } catch {}
                }
              })
              .catch(() => {});
          });
        }
      } catch {
        setIssueError(true);
      }
    };

    loadIssues();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (issueError) {
      setHeroVisible(false);
    }
  }, [issueError]);

  const switchTab = (tab: TabId) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div style={{ background: '#F7F8F8', minHeight: '100vh' }}>
    <div className="polichat-bg overflow-x-hidden relative" style={{ maxWidth: '700px', margin: '0 auto', minHeight: '100svh' }}>
      {/* Mesh gradient background */}
      <div className="policy-pattern" />
      <style>{`
        @keyframes matchTeaserShimmer {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>

      <div
        className="mx-auto px-4 pt-5 pb-8 relative z-10"
        style={{ maxWidth: '700px' }}
      >
        {/* Hero */}
        <div className="text-center mb-4">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-5 animate-fade-in">
            <img src="/logo.svg" alt="Polichat" className="w-12 h-12" />
            <div className="flex items-baseline gap-0.5">
              <h1
                className="logo-text-gradient"
                style={{
                  fontFamily: "'Rammetto One', sans-serif",
                  fontWeight: 400,
                  fontSize: '30px',
                  letterSpacing: '-0.01em',
                  lineHeight: 1,
                }}
              >
                Polichat
              </h1>
              <span
                style={{
                  fontSize: '17px',
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
            <div className="flex items-center justify-center gap-2.5 mb-2">
              <h2
                style={{
                  fontFamily: "'SUITE Variable', sans-serif",
                  fontWeight: 800,
                  fontSize: '16px',
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
            <p className="hidden text-[13px] text-gray-500 leading-relaxed max-w-[280px] mx-auto">
              공약·경력·발언을 학습한 AI — 정책 질문부터 일상 대화까지
            </p>
          </div>
        </div>

        {/* ── 탭 바 ─────────────────────────────────────────── */}
        <div className="sticky top-0 z-30 bg-transparent border-b border-gray-200/50">
          <div className="flex">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => switchTab(tab.id)}
                  className={`flex-1 flex flex-col items-center gap-1.5 pt-3.5 pb-3 relative transition-colors duration-200`}
                >
                  {tab.icon(isActive)}
                  <span className={`text-[14px] font-bold tracking-tight ${isActive ? 'text-violet-700' : 'text-gray-600'}`}>
                    {tab.label}
                  </span>
                  {isActive && (
                    <span className="absolute bottom-0 left-3 right-3 h-[3px] bg-violet-600 rounded-full" />
                  )}
                  {tab.id === 'issue' && heroIssue && !isActive && (
                    <span className="absolute top-2 right-[calc(50%-14px)] w-2 h-2 bg-red-500 rounded-full border border-white" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 이슈 티저 카드 */}
        {activeTab !== 'issue' && heroVisible && heroIssue?.title && (
          <button
            onClick={() => switchTab('issue')}
            className="w-full mt-4 mb-1 flex items-center gap-2.5 px-4 py-3 rounded-2xl text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #9333ea 100%)',
              border: '1px solid #6d28d9',
              boxShadow: '0 4px 14px rgba(109,40,217,0.35)',
            }}
          >
            <span className="text-sm shrink-0">🔥</span>
            <span className="text-xs font-semibold text-white flex-1 leading-snug line-clamp-2">
              {heroIssue.title}
            </span>
            <span className="shrink-0 text-[10px] font-bold text-purple-900 bg-white/90 px-2 py-0.5 rounded-full whitespace-nowrap">이슈 토론 &gt;</span>
          </button>
        )}

        {activeTab === 'battle' && (
          <div id="debate-battle" className="animate-fade-in-up space-y-2 pt-3" style={{ animationDelay: '0.12s' }}>
            <DebateBanner debateType="seoul" />
            <DebateBanner debateType="national" />
            <DebateBanner debateType="leejeon" />
            <DebateBanner debateType="kimjin" />
            <DebateBanner debateType="hanhong" />

            <div
              className="relative overflow-hidden rounded-2xl mb-5 bg-gradient-to-br from-slate-800 to-slate-900 cursor-default"
              style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12)' }}
            >
              {/* shimmer */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-30" style={{ animation: 'matchTeaserShimmer 2s linear infinite' }} />
              </div>
              {/* 매치업 레이아웃 — 3열 균등 분할 */}
              <div className="relative grid grid-cols-3 items-center px-6 py-4">
                {/* 왼쪽 ? */}
                <div className="flex justify-center">
                  <div className="w-9 h-9 rounded-full bg-slate-600/50 border-2 border-dashed border-slate-400/50 flex items-center justify-center">
                    <span className="text-base font-black text-slate-400">?</span>
                  </div>
                </div>
                {/* VS + 텍스트 */}
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[18px] font-black text-slate-400 leading-none">VS</span>
                  <span className="text-[11px] font-bold text-slate-300 mt-0.5">곧 공개</span>
                  <span className="text-[10px] text-slate-500">다음 대결 준비 중...</span>
                </div>
                {/* 오른쪽 ? */}
                <div className="flex justify-center">
                  <div className="w-9 h-9 rounded-full bg-slate-600/50 border-2 border-dashed border-slate-400/50 flex items-center justify-center">
                    <span className="text-base font-black text-slate-400">?</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
          <>
            {/* Politician Cards */}
            <div className="space-y-3 pt-3">
              {politicians.map((politician, index) => (
                <div
                  key={politician.id}
                  ref={(el) => { cardsRef.current[index] = el; }}
                  className="reveal-card"
                  data-reveal-delay={index * 40}
                >
                  <button
                    onClick={() => setCurrentPolitician(politician.id)}
                    className="w-full text-left group"
                  >
                    <div
                      className="pc-card-interactive w-full overflow-hidden rounded-2xl relative"
                      style={{ background: 'linear-gradient(120deg, #1e293b 0%, #0f172a 50%, #1e293b 100%)' }}
                    >
                      {/* 당색 radial glow 오버레이 */}
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{ background: `radial-gradient(ellipse 80% 100% at 15% 50%, ${politician.themeColor}45 0%, transparent 60%)` }}
                      />
                      <div className="relative flex items-center gap-5 px-5 py-4">
                        {/* Profile circle with battle-style glow ring */}
                        <div className="relative shrink-0">
                          <div
                            className="w-[85px] h-[85px] rounded-full overflow-hidden"
                            style={{
                              boxShadow: `0 0 0 2.5px ${politician.themeColor}CC, 0 4px 20px ${politician.themeColor}60`,
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
                            <h3 className="font-bold text-[20px] text-white truncate">
                              {politician.nameKo}
                            </h3>
                            <span
                              className="px-2 py-0.5 text-[11px] font-bold rounded-full shrink-0 whitespace-nowrap"
                              style={{
                                background: 'rgba(255,255,255,0.92)',
                                color: politician.themeColor,
                                border: `1px solid ${politician.themeColor}80`,
                              }}
                            >
                              {politician.group}
                            </span>
                          </div>
                          <p className="text-[13px] text-white/70 line-clamp-1 mb-1.5 leading-snug">
                            <TaglineRenderer text={politician.tagline} />
                          </p>
                          <TypingPreview name={politician.nameKo} />
                        </div>

                        {/* Chevron arrow */}
                        <div className="shrink-0 pl-1 text-white/50 transition-all duration-300 group-hover:text-white/80 group-hover:translate-x-1">
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

          </>
        )}

        {activeTab === 'issue' && (
          <div className="px-4 py-4 space-y-4">
            {(() => {
              const displayList = [...(issueHistory.length > 0
                ? issueHistory
                : heroIssue?.title
                  ? [{ date: todayKST, title: heroIssue.title, matchups: [] as string[] }]
                  : [])
              ].sort((a, b) => b.date.localeCompare(a.date));

              if (displayList.length === 0) {
                return <div className="py-8 flex justify-center"><div className="w-6 h-6 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin"/></div>;
              }

              return displayList.map((dayIssue) => {
                const isExpanded = expandedDates.has(dayIssue.date);
                const dateParts = dayIssue.date.split('-');
                const calYear = dateParts[0] || '';
                const calMonth = parseInt(dateParts[1] || '0', 10);
                const calDay = parseInt(dateParts[2] || '0', 10);
                const monthNames = ['','JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
                const calMonthName = monthNames[calMonth] || '';

                return (
                  <div key={dayIssue.date} className="rounded-2xl overflow-hidden shadow-sm" style={{background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)'}}>
                    {/* 헤더 — 클릭 시 토론자 펼침/접힘 */}
                    <div
                      className="px-4 py-3 flex items-center gap-3 cursor-pointer active:opacity-90 transition-opacity"
                      onClick={() => toggleDate(dayIssue.date)}
                    >
                      {/* 달력 뱃지 — 정사각형, 연도월 위/날짜 아래 */}
                      <div className="shrink-0 flex flex-col rounded-xl overflow-hidden shadow-md" style={{width: '52px', height: '52px', border: '1px solid rgba(167,139,250,0.4)'}}>
                        <div className="flex-[2] flex items-center justify-center text-[8px] font-black tracking-wide text-white" style={{background: '#4c1d95'}}>
                          {calYear} {calMonthName}
                        </div>
                        <div className="flex-[3] flex items-center justify-center bg-white">
                          <span className="text-[21px] font-black text-gray-900 leading-none">{calDay}</span>
                        </div>
                      </div>
                      {/* 제목 */}
                      <p className="text-[18px] font-bold text-white leading-snug flex-1">{dayIssue.title}</p>
                      {/* 화살표 */}
                      <span className="shrink-0 text-white/50 text-xs" style={{transition: 'transform 0.2s', display: 'inline-block', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'}}>▼</span>
                    </div>

                    {/* 아코디언 — 카드에 물린 토론자 목록 */}
                    {isExpanded && (
                      <div className="mx-2 mb-2 rounded-xl overflow-hidden divide-y divide-white/10" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        {(dayIssue.matchups && dayIssue.matchups.length > 0
                          ? issueTypes.filter(t => dayIssue.matchups!.includes(t.value))
                          : issueTypes
                        ).map((item) => (
                          <button
                            key={item.value}
                            onClick={() => navigate(`/debate?type=${item.value}&autostart=1`, { state: { issue: dayIssue.title } })}
                            className="w-full flex items-center px-3 py-2.5 bg-white/5 hover:bg-white/10 active:bg-white/15 transition-colors"
                          >
                            {/* 중앙 정렬 매치업 */}
                            <div className="flex-1 flex items-center justify-center gap-2">
                              <div className="flex items-center gap-1.5">
                                <img src={item.imgA} alt={item.nameA} className="w-9 h-9 rounded-full object-cover border-2 border-white/30 shadow-sm" onError={(e) => { e.currentTarget.style.display='none'; }} />
                                <span className="text-[14px] font-bold text-white">{item.nameA}</span>
                              </div>
                              <span className="text-[10px] font-bold text-white/40 px-0.5">VS</span>
                              <div className="flex items-center gap-1.5">
                                <img src={item.imgB} alt={item.nameB} className="w-9 h-9 rounded-full object-cover border-2 border-white/30 shadow-sm" onError={(e) => { e.currentTarget.style.display='none'; }} />
                                <span className="text-[14px] font-bold text-white">{item.nameB}</span>
                              </div>
                            </div>
                            <span
                              className="shrink-0 text-xs font-bold ml-2 rounded-full px-3 py-1"
                              style={{
                                background: 'rgba(255,215,0,0.15)',
                                border: '1px solid rgba(255,215,0,0.5)',
                                color: '#FFD700',
                              }}
                            >시작 ›</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* ── 면책 문구 — 모든 탭 공통 하단 ── */}
        <div className="mt-4 mb-6 px-4">
          <p className="text-[12px] text-violet-400 leading-relaxed">
            ⚠️ 본 서비스에서 제공되는 모든 대화와 토론 콘텐츠는 인공지능(AI) 기술을 통해 생성된 가상의 시뮬레이션 결과물입니다. 해당 콘텐츠는 각 정치인의 공개된 과거 발언 및 언론 보도 등을 기반으로 학습된 모델이 생성한 것이나, 이는 실제 인물의 현재 의지나 공식적인 견해를 대변하지 않으며 실제 입장과 상당한 차이가 있을 수 있습니다. 또한, 인공지능 기술의 특성상 생성 과정에서 사실과 다른 허구의 내용이나 왜곡 및 과장된 표현이 포함될 수 있으므로, 본 서비스의 내용을 공식적인 근거로 인용하거나 절대적인 사실로 신뢰하지 마시기 바랍니다. 서비스 이용 중 발생하는 오해나 사용자의 판단에 따른 결과에 대해 운영측은 어떠한 법적 책임도 지지 않으며, 정확한 정보 확인이 필요한 사안은 반드시 공식적인 경로를 통해 재확인하시길 권고드립니다.
          </p>
        </div>
      </div>
    </div>
    </div>
  );
}
