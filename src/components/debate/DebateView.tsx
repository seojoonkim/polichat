import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { PROMPT_VERSION } from '@/constants/debate-config';
import { isSentenceEnd, BUBBLE_CONFIG } from '@/lib/bubble-splitter';
import { getRandomAction } from '@/lib/debate-actions';
import PolichatLogoSpinner from '@/components/common/PolichatLogoSpinner';
import TensionGauge, { calcTension } from './TensionGauge';
import AudienceReaction from './AudienceReaction';
import Interjection from './Interjection';

// ─── 타입 ────────────────────────────────────────────────────────────────────

export type DebateType = 'seoul' | 'national' | 'leejeon' | 'kimjin' | 'hanhong';

// ─── 설정 상수 ────────────────────────────────────────────────────────────────

export const DEBATE_CONFIGS = {
  seoul: {
    speakerA: 'ohsehoon' as const,
    speakerB: 'jungwono' as const,
    speakerAName: '오세훈 시장',
    speakerBName: '정원오 구청장',
    speakerAColor: '#E61E2B',
    speakerBColor: '#004EA2',
    topics: [
      { id: 'free', label: '자유토론' },
      { id: 'redevelopment', label: '재개발 vs 도시재생' },
      { id: 'gentrification', label: '젠트리피케이션 대응' },
      { id: 'housing', label: '주거 정책 방향' },
      { id: 'welfare', label: '복지: 선별 vs 보편' },
      { id: 'gangnam-gap', label: '강남북 격차 해소' },
      { id: 'transport', label: '교통 인프라' },
      { id: 'environment', label: '환경·탄소중립' },
      { id: 'youth', label: '청년 정책' },
      { id: 'admin', label: '행정 혁신' },
      { id: 'branding', label: '도시 브랜딩' },
      { id: 'edu-gap', label: '교육 격차 해소' },
      { id: 'small-biz', label: '소상공인 지원' },
      { id: 'safety', label: '치안·안전 정책' },
      { id: 'culture', label: '문화·관광 육성' },
    ],
  },
  national: {
    speakerA: 'jungcr' as const,
    speakerB: 'jangdh' as const,
    speakerAName: '정청래 대표',
    speakerBName: '장동혁 대표',
    speakerAColor: '#004EA2',
    speakerBColor: '#C9151E',
    topics: [
      { id: 'free', label: '자유토론' },
      { id: 'economy', label: '경제·민생 위기' },
      { id: 'prosecution', label: '검찰·사법 개혁' },
      { id: 'north-korea', label: '대북·외교 정책' },
      { id: 'real-estate', label: '부동산·주거 정책' },
      { id: 'education', label: '교육 개혁' },
      { id: 'ai-industry', label: 'AI·디지털 산업' },
      { id: 'pension', label: '연금·복지 개혁' },
      { id: 'us-alliance', label: '한미동맹·트럼프 대응' },
      { id: 'media-freedom', label: '언론·표현의 자유' },
      { id: 'election-reform', label: '선거제도 개혁' },
      { id: 'tax-biz', label: '기업·세금 정책' },
    ],
  },
  leejeon: {
    speakerA: 'leejunseok' as const,
    speakerB: 'jeonhangil' as const,
    speakerAName: '이준석 대표',
    speakerBName: '전한길',
    speakerAColor: '#FF6B35',
    speakerBColor: '#C9151E',
    topics: [
      { id: 'free', label: '자유토론' },
      { id: 'election-fraud', label: '부정선거론' },
      { id: 'conservative-identity', label: '보수의 정체성' },
      { id: 'yoon-impeachment', label: '윤석열 탄핵' },
      { id: 'gender-feminism', label: '젠더·페미니즘' },
      { id: 'controversies', label: '논란·의혹' },
    ],
  },
  kimjin: {
    speakerA: 'kimeoojun' as const,
    speakerB: 'jinjungkwon' as const,
    speakerAName: '김어준',
    speakerBName: '진중권',
    speakerAColor: '#5A5A5A',
    speakerBColor: '#5A5A5A',
    topics: [
      { id: 'free', label: '자유토론' },
      { id: 'cho-justice', label: '조국·사법정의' },
      { id: 'lee-minjoo', label: '이재명과 민주당' },
      { id: 'election-fraud', label: '부정선거론' },
      { id: 'prosecution', label: '검찰개혁' },
      { id: 'media', label: '언론과 미디어' },
      { id: 'moon-gov', label: '문재인 정부 평가' },
      { id: 'hypocrisy', label: '진보의 배신·내로남불' },
      { id: 'democracy', label: '한국 민주주의의 미래' },
    ],
    styles: ['policy', 'emotional', 'consensus'] as const,
  },
  hanhong: {
    speakerA: 'handoonghoon' as const,
    speakerB: 'hongjunpyo' as const,
    speakerAName: '한동훈',
    speakerBName: '홍준표',
    speakerAColor: '#C9151E',
    speakerBColor: '#8B0000',
    topics: [
      { id: 'free', label: '자유토론' },
      { id: 'party-reform', label: '국민의힘 쇄신 vs 정통 보수' },
      { id: 'yoon-eval', label: '윤석열 정부 평가와 책임론' },
      { id: 'presidential', label: '차기 대선 전략과 후보론' },
      { id: 'prosecution', label: '검찰 권력과 사법 개혁' },
      { id: 'economy', label: '경제 정책 방향' },
      { id: 'diplomacy', label: '대북·외교 정책' },
      { id: 'constitution', label: '개헌 및 정치 제도 개혁' },
      { id: 'decentralization', label: '지방 분권과 균형 발전' },
    ],
  },
} as const;

// ─── 상수 ───────────────────────────────────────────────────────────────────

// TOPIC_ICONS는 현재 사용되지 않음 (텍스트만 표시)
// const TOPIC_ICONS: Record<string, React.ReactNode> = { ... };

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface DebateMessage {
  speaker: string;
  text: string;
  timestamp: number;
  isTopicChange?: boolean;
}

interface DebateViewProps {
  debateType?: DebateType;
  dynamicKB?: any;
  issueTitle?: string;
  autoStart?: boolean;
}

interface Judgment {
  winner: 'ohsehoon' | 'jungwono';
  scores: {
    ohsehoon: { logic: number; specificity: number; persuasion: number; feasibility: number; total: number };
    jungwono: { logic: number; specificity: number; persuasion: number; feasibility: number; total: number };
  };
  reason: string;
}

type Phase = 'setup' | 'coinflip' | 'running' | 'judging' | 'result' | 'finished';

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 문장 끝 마침표 보장
const ensurePunctuation = (text: string): string => {
  const t = text.trim();
  if (!t) return t;
  // 행동 묘사로 끝나는 경우 (괄호 안) → 그대로
  if (/\)$/.test(t)) return t;
  // 이미 구두점으로 끝남
  if (/[.!?]$/.test(t)) return t;
  // 한국어 종결어미로 끝남 → 마침표 추가
  if (/[다요죠네까]$/.test(t)) return t + '.';
  return t + '.';
};

// 행동 묘사 제거 후 문장 끝 감지 (행동묘사 뒤 본문 이어질 때 대응)
const stripActionForSentenceEnd = (text: string): string => {
  return text.replace(/^\([^)]+\)\s*/, '');
};

const calcHighlightScore = (text: string): number => {
  const hotwords = ['거짓', '증거', '팩트', '사기', '126건', '탄핵', '위헌', '만장일치', '국민'];
  let score = 0;
  for (const word of hotwords) {
    if (text.includes(word)) score += 10;
  }
  if (/\d/.test(text)) score += 5;
  score += Math.min(20, text.length / 10);
  return score;
};

const getTypingMs = (text: string): number => {
  const angryKeywords = ['거짓', '말이 됩니까', '황당', '사기', '위선', '기만'];
  const coldKeywords = ['당연히', '웃기는', '물론이죠', '아,', '뭐,'];
  if (angryKeywords.some((word) => text.includes(word))) return 28;
  if (coldKeywords.some((word) => text.includes(word))) return 68;
  return 45;
};

// 상대 발언에서 가장 반박하기 좋은 문장 1개 추출 (B)
function extractKeyClaimClient(text: string): string | null {
  if (!text) return null;
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
  const withData = sentences.find(s => /\d+[\.,]?\d*\s*(%|조|억|만|건|명|년|위|배|점)/.test(s));
  if (withData) return withData.slice(0, 80);
  const withAttack = sentences.find(s => /의혹|막말|거짓|실패|비리|위선|모순|증명|해명/.test(s));
  if (withAttack) return withAttack.slice(0, 80);
  return sentences[0]?.slice(0, 80) || null;
}

// 오래된 발언들에서 핵심 요약 생성 (컨텍스트 압축용)
const RECENT_WINDOW = 20; // verbatim으로 전달할 최근 발언 수
function buildDebateSummary(
  olderMessages: DebateMessage[],
  cfg: { speakerA: string; speakerB: string; speakerAName: string; speakerBName: string },
): string {
  if (olderMessages.length === 0) return '';
  const extract = (text: string) => text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 6)[0]?.slice(0, 60) || '';
  const byA = olderMessages.filter(m => m.speaker === cfg.speakerA).map(m => extract(m.text)).filter(Boolean).slice(0, 5);
  const byB = olderMessages.filter(m => m.speaker === cfg.speakerB).map(m => extract(m.text)).filter(Boolean).slice(0, 5);
  return `(이전 ${olderMessages.length}개 발언 압축)\n${cfg.speakerAName} 주요 주장: ${byA.join(' / ')}\n${cfg.speakerBName} 주요 주장: ${byB.join(' / ')}`;
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default function DebateView({ debateType = 'seoul', dynamicKB, issueTitle, autoStart }: DebateViewProps) {
  const navigate = useNavigate();
  const config = DEBATE_CONFIGS[debateType];

  // 설정 상태
  const [selectedTopic, setSelectedTopic] = useState<string>('free');
  const [_selectedStyle, setSelectedStyle] = useState<'policy' | 'emotional' | 'consensus'>('policy');
  // 이슈 토론 모드: 항상 policy 스타일 (주제 집중). 일반 토론: leejeon이면 emotional 고정
  const selectedStyle = issueTitle ? 'policy' : (debateType === 'leejeon' ? 'emotional' : _selectedStyle);

  // 토론 상태
  const [phase, setPhase] = useState<Phase>('setup');
  const [messages, setMessages] = useState<DebateMessage[]>([]);
  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);
  const [currentText, setCurrentText] = useState('');
  const [_round, setRound] = useState(0); // 0~29 (최대 30라운드, 타이머로 제한)
  const [judgment, setJudgment] = useState<Judgment | null>(null);
  const [coinFlipStage, setCoinFlipStage] = useState<'spinning' | 'revealed' | 'idle'>('idle');
  const [coinFlipWinner, setCoinFlipWinner] = useState<{ key: string; name: string } | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300); // 5분 = 300초
  const timeLeftRef = useRef(300); // 최신 timeLeft를 항상 참조
  const [audienceReactionTrigger, setAudienceReactionTrigger] = useState(0); // 관중 반응 트리거
  const tension = useMemo(() => calcTension(messages, _round, 30), [messages, _round]);

  const topHighlights = useMemo(() => {
    const scoreWithLabel = messages
      .filter((m) => m.speaker !== '__moderator__' && m.text.length >= 40)
      .map((m) => ({
        msg: m,
        speakerName: m.speaker === config.speakerA
          ? config.speakerAName
          : m.speaker === config.speakerB
            ? config.speakerBName
            : m.speaker,
        score: calcHighlightScore(m.text),
        preview: m.text.slice(0, 120),
      }))
      .sort((a, b) => b.score - a.score || b.msg.text.length - a.msg.text.length);
    return scoreWithLabel.slice(0, 3);
  }, [messages, config.speakerA, config.speakerB, config.speakerAName, config.speakerBName]);

  const speakerARound = useMemo(() => {
    return messages.filter(
      (msg) => msg.speaker !== '__moderator__' && msg.speaker === config.speakerA && !msg.isTopicChange,
    ).length;
  }, [messages, config.speakerA]);

  const actBg = speakerARound <= 4 ? 'from-slate-50 to-slate-100' : speakerARound <= 8 ? 'from-amber-50 to-orange-50' : 'from-red-50 to-rose-100';
  const actBgClass = `bg-gradient-to-b ${actBg} transition-all duration-[2000ms]`;

// 언론사 + 정부/공공기관 + 연구기관 + 여론조사기관
const FACT_CHECK_SOURCES = [
  // 언론사
  'AP통신', '연합뉴스', '조선일보', '한겨레', 'YTN', 'KBS', 'MBC', 'SBS', '헤럴드경제', '뉴스1',
  '동아일보', '중앙일보', '한국일보', 'JTBC', 'TV조선', '채널A', 'MBN', '경향신문',
  // 정부/공공기관
  '통계청', '한국은행', '국토교통부', '기획재정부', '보건복지부', '교육부', '국방부', '외교부',
  '한국환경공단', '환경부', '행정안전부', '산업통상자원부', '고용노동부', '국세청',
  '서울시', '경기도', '부산시', '인천시',
  // 부동산/주택
  '한국부동산원', '한국토지주택공사', 'LH', '주택도시보증공사', 'HUG',
  // 연구기관
  'KDI', 'KIEP', '한국경제연구원', '국회예산정책처', '국회입법조사처', '국책연구원',
  '서울연구원', '국토연구원', '한국노동연구원', '한국보건사회연구원',
  // 국제기관
  'OECD', 'IMF', '세계은행', 'UN', 'WHO',
  // 사법/선거
  '선관위', '중앙선거관리위원회', '헌법재판소', '대법원', '검찰청',
  // 여론조사
  '한국갤럽', '리얼미터', '엠브레인', 'NBS', '여론조사',
];

function detectFacts(text: string): { label: string; subtitle: string; detail: string } | null {
  // 1순위: 명시적 출처 패턴 "(출처: 기관명 자료명 연도)" 감지
  const explicitMatch = text.match(/\(출처:\s*([^)]+)\)/);
  if (explicitMatch) {
    const raw = explicitMatch[1].trim();
    const dateM = raw.match(/\d{4}년(?:\s*\d{1,2}월)?/);
    const dateStr = dateM ? dateM[0] : '';
    const label = dateStr ? raw.replace(dateStr, '').trim().replace(/\s+$/, '') : raw;
    const pct = text.match(/\d+(?:\.\d+)?%/);
    const rnk = text.match(/\d+위/);
    return { label: label.slice(0, 35), subtitle: dateStr, detail: pct ? pct[0] : rnk ? rnk[0] : '' };
  }

  // 2순위: FACT_CHECK_SOURCES 키워드 매칭
  const sourceHit = FACT_CHECK_SOURCES.find((s) => text.includes(s));
  if (!sourceHit) return null;

  // 출처 키워드 이후 최대 25자에서 자료명 추출 (조사/동사 이전까지)
  const pos = text.indexOf(sourceHit);
  const after = text.slice(pos + sourceHit.length, pos + sourceHit.length + 35);
  const reportMatch = after.match(/^[은는이가의에서\s]*([가-힣A-Za-z0-9·\s]{2,20}(?:보고서|조사|자료|통계|발표|기준|지수|지표|현황|동향|백서|계획))/);
  const reportName = reportMatch ? reportMatch[1].trim() : '';
  const label = reportName ? `${sourceHit} ${reportName}` : sourceHit;

  // 날짜 추출 (연도+월 우선, 연도만 fallback)
  const yearMonthMatch = text.match(/\d{4}년\s*\d{1,2}월/);
  const yearMatch = text.match(/\d{4}년/);
  const dateStr = yearMonthMatch ? yearMonthMatch[0] : yearMatch ? yearMatch[0] : '';

  // 수치 (%, 위, 조원, 만명 등)
  const percentMatch = text.match(/\d+(?:\.\d+)?%/);
  const rankMatch = text.match(/\d+위/);
  const stat = percentMatch ? percentMatch[0] : rankMatch ? rankMatch[0] : '';

  // 출처만 있어도 표시 (날짜 없어도 OK)
  return { label, subtitle: dateStr, detail: stat };
}

  // 실행 취소용 ref
  const abortRef = useRef(false);
  const activeAbortCtrlRef = useRef<AbortController | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const freeTopicRef = useRef<string>('');
  const topicChangedRef = useRef(false);
  const pendingTopicChangeRef = useRef<string | null>(null); // 라운드 끝난 후 처리할 주제 전환
  const speakerOrderRef = useRef<[string, string]>([config.speakerA, config.speakerB]);
  const speakerIndexRef = useRef(0); // 순번 카운터 (주제 전환 시 리셋)

  // 기억력 강화 ref (A+B+C)
  const usedArgCountRef = useRef<Record<string, number>>({}); // A: 스피커별 소비 논거 카운터
  const opponentClaimRef = useRef<string | null>(null);       // B: 다음 턴 반박 의무 주장
  const lastAnglesRef = useRef<Record<string, string[]>>({});  // C: 스피커별 최근 사용 각도 (2개)
  const usedActionsRef = useRef<Set<string>>(new Set());       // 행동 묘사 중복 방지용

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // 완료된 말풍선 추가 시 → 부드럽게 스크롤
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom('smooth');
    }
  }, [messages, scrollToBottom]);

  // 새 화자 시작 시 → 즉시 스크롤 (말풍선 틀 + 얼굴 바로 보이게)
  useEffect(() => {
    if (currentSpeaker) {
      scrollToBottom('smooth');
    }
  }, [currentSpeaker, scrollToBottom]);

  // 타이핑 중 글자 추가 시 → 즉시 스크롤 (말풍선 높이 변화 따라가기)
  useEffect(() => {
    if (currentText && !scrollRafRef.current) {
      scrollRafRef.current = requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
        scrollRafRef.current = null;
      });
    }
  }, [currentText]);

  useEffect(() => {
    return () => {
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
      // unmount 시 진행 중인 fetch 및 토론 루프 중단
      abortRef.current = true;
      activeAbortCtrlRef.current?.abort();
    };
  }, []);

  // ─── 타이머 ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'running') {
      setTimeLeft(300);
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          abortRef.current = true;
          timeLeftRef.current = 0;
          return 0;
        }
        timeLeftRef.current = next;
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase]);

  // 타이머가 0이 되면 토론 종료
  useEffect(() => {
    if (phase === 'running' && timeLeft === 0) {
      abortRef.current = true;
      setCurrentSpeaker(null);
      setCurrentText('');
      setPhase('finished');
    }
  }, [timeLeft, phase]);

  // 자유토론: 100초마다 랜덤 주제 전환 — 모든 debateType 공통
  useEffect(() => {
    if (selectedTopic !== 'free' || phase !== 'running') return;

    const elapsed = 300 - timeLeft; // 경과 시간(초)
    if (elapsed > 0 && elapsed % 100 === 0 && elapsed < 300) {
      const realTopics = config.topics.filter(t => t.id !== 'free');
      const candidates = realTopics.filter(t => t.label !== freeTopicRef.current);
      const pool = candidates.length > 0 ? candidates : realTopics;
      const next = pool[Math.floor(Math.random() * pool.length)];
      if (!next) return;

      freeTopicRef.current = next.label;
      topicChangedRef.current = true;
      pendingTopicChangeRef.current = next.label;
    }
  }, [timeLeft, selectedTopic, phase, config]);

  // ─── 캐시 조회 ─────────────────────────────────────────────────────────────

  const fetchCache = async (topic: string, style: string): Promise<{ messages: DebateMessage[]; judgment: Judgment | null } | null> => {
    // 이슈 토론 모드: 매번 새 이슈이므로 캐시 사용 안 함
    if (issueTitle) return null;
    try {
      const res = await fetch(
        `/api/debate-cache?topic=${encodeURIComponent(topic)}&style=${encodeURIComponent(style)}&debateType=${debateType}&pv=${PROMPT_VERSION}`
      );
      const data = await res.json();
      if (data.cached?.messages?.length > 0) {
        return {
          messages: data.cached.messages as DebateMessage[],
          judgment: data.cached.judgment as Judgment | null,
        };
      }
      return null;
    } catch {
      return null;
    }
  };

  // ─── 캐시 재생 ─────────────────────────────────────────────────────────────

  const replayDebate = async (cachedMessages: DebateMessage[], _cachedJudgment?: Judgment | null) => {
    abortRef.current = false;
    setMessages([]);
    setCurrentText('');

    for (let i = 0; i < cachedMessages.length; i++) {
      if (abortRef.current) break;
      const msg = cachedMessages[i];
      if (!msg) continue;

      setRound(i);
      setCurrentSpeaker(msg.speaker);
      setCurrentText('');
      await sleep(600);

      // 글자 단위 타이핑 (30ms 간격)
      let displayed = '';
      for (const char of msg.text) {
        if (abortRef.current) break;
        displayed += char;
        setCurrentText(displayed);
        const delay = ['.', '!', '?', ','].includes(char) ? 220 : 110;
        await sleep(delay);
      }

      if (abortRef.current) break;

      // 완료된 메시지를 목록에 추가
      setCurrentText('');
      setCurrentSpeaker(null); // 다음 화자 전환 전 인디케이터 제거
      setMessages((prev) => [...prev, { speaker: msg.speaker, text: msg.text, timestamp: msg.timestamp }]);
      scrollToBottom();
      await sleep(900);
    }

    if (!abortRef.current) {
      setCurrentSpeaker(null);
      // 판정 없이 종료 — finished로 이동
      setPhase('finished');
    }
  };

  // ─── SSE 스트리밍으로 1라운드 생성 ────────────────────────────────────────

  const streamRound = async (
    speaker: string,
    topic: string,
    opponentLastMessage: string,
    style: string,
    requestId: string,
    onToken?: (text: string) => Promise<void> | void,
    recentHistory?: DebateMessage[],
    opts?: { usedArgCount?: number; mustRebutClaim?: string | null; lastAngles?: string[]; debateSummary?: string; timeLeft?: number }
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      let fullText = '';
      let firstTokenReceived = false;

      // ── 타임아웃 설정 ──────────────────────────────────────────────────────
      const abortCtrl = new AbortController();
      activeAbortCtrlRef.current = abortCtrl;

      // 25초 내 첫 토큰 미수신 시 abort (Phase 1+2로 프롬프트 길어져서 API 레이턴시 증가)
      const firstTokenTimeout = setTimeout(() => {
        if (!firstTokenReceived) {
          abortCtrl.abort();
          reject(new Error('First token timeout'));
        }
      }, 25000);

      // 전체 스트림 90초 hard limit (onToken sleep 포함한 전체 처리 시간 여유 확보)
      const hardTimeout = setTimeout(() => {
        abortCtrl.abort();
        reject(new Error('Stream hard timeout'));
      }, 150000);

      const cleanup = () => {
        clearTimeout(firstTokenTimeout);
        clearTimeout(hardTimeout);
        activeAbortCtrlRef.current = null;
      };

      fetch('/api/debate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          topic, speaker, opponentLastMessage, style, debateType,
          speakerA: config.speakerA,
          dynamicKB,
          timeLeft: opts?.timeLeft ?? timeLeftRef.current,
          recentHistory: recentHistory ?? [],
          debateSummary: opts?.debateSummary,
          usedArgCount: opts?.usedArgCount ?? 0,
          mustRebutClaim: opts?.mustRebutClaim ?? null,
          lastAngles: opts?.lastAngles ?? [],
        }),
        signal: abortCtrl.signal,
      })
        .then(async (res) => {
          if (!res.ok) {
            const errText = await res.text().catch(() => '');
            let errMsg = `HTTP ${res.status}`;
            try {
              const parsed = JSON.parse(errText);
              if (parsed?.error) {
                errMsg = `${errMsg}: ${typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error)}`;
              }
              if (parsed?.requestId) {
                errMsg = `${errMsg} (${parsed.requestId})`;
              }
            } catch {
              if (errText) {
                errMsg = `${errMsg}: ${errText.slice(0, 200)}`;
              }
            }
            cleanup();
            reject(new Error(errMsg));
            return;
          }
          const reader = res.body!.getReader();
          const decoder = new TextDecoder();
          let buf = '';

          const pump = async (): Promise<void> => {
            const { done, value } = await reader.read();
            if (done) {
              cleanup();
              resolve(fullText);
              return;
            }

            buf += decoder.decode(value, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop() || '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();
              if (!data || data === '[DONE]') continue;
              try {
                const json = JSON.parse(data);
                if (json.error) {
                  cleanup();
                  reject(new Error(json.error));
                  return;
                }
                // META 이벤트: 논거 카운터 + 사용 각도 업데이트 (A+C)
                if (json.meta) {
                  if (json.meta.nextArgCount !== undefined) {
                    usedArgCountRef.current[speaker] = json.meta.nextArgCount;
                  }
                  if (json.meta.usedAngle) {
                    const prev = lastAnglesRef.current[speaker] || [];
                    lastAnglesRef.current[speaker] = [...prev, json.meta.usedAngle].slice(-2);
                  }
                  continue;
                }
                if (json.text) {
                  if (!firstTokenReceived) {
                    firstTokenReceived = true;
                    clearTimeout(firstTokenTimeout); // 첫 토큰 도착 → 타임아웃 해제
                  }
                  fullText += json.text;
                  if (abortRef.current) {
                    cleanup();
                    void reader.cancel();
                    resolve(fullText); // 데드락 방지: abort 시에도 Promise 정상 종료
                    return;
                  }
                  await onToken?.(json.text);
                }
              } catch {
                // skip malformed
              }
            }

            return pump();
          };

          pump().catch((err) => { cleanup(); reject(err); });
        })
        .catch((err) => { cleanup(); reject(err); });
    });
  };

  const summarizeDebateError = (err: unknown): string => {
    if (typeof err === 'string') return err.slice(0, 280);
    if (err instanceof Error) return err.message || 'Unknown error';
    try {
      return JSON.stringify(err).slice(0, 280);
    } catch {
      return String(err);
    }
  };

  // ─── 실시간 생성 모드 ──────────────────────────────────────────────────────

  const runLiveDebate = async (initialTopic: string, style: string, speakerOrder?: [string, string]) => {
    abortRef.current = false;
    setMessages([]);
    setCurrentText('');

    // 스피커 순서 초기화
    speakerOrderRef.current = speakerOrder || [config.speakerA, config.speakerB];
    speakerIndexRef.current = 0;
    pendingTopicChangeRef.current = null;

    // 기억력 강화 ref 초기화 (새 토론 시작마다 리셋)
    usedArgCountRef.current = {};
    opponentClaimRef.current = null;
    lastAnglesRef.current = {};
    usedActionsRef.current = new Set();

    const allMessages: DebateMessage[] = [];
    let lastText = '';

    for (let i = 0; i < 30; i++) {
      if (abortRef.current) break;

      const speaker: string = speakerOrderRef.current[speakerIndexRef.current % 2] as string;
      speakerIndexRef.current++;
      setRound(i);
      setCurrentSpeaker(speaker);
      setCurrentText('');

      // 라운드 실행 (API 오류 시 1회 재시도)
      let roundSuccess = false;
      const messagesSnapshotLength = allMessages.length; // 이 라운드 시작 전 스냅샷

      // 스트리밍 상태 변수: try 밖에 선언해서 catch에서도 접근 가능
      let streamedText = '';
      let currentBubble = '';
      let bubbleCount = 0;

      for (let attempt = 0; attempt < 3 && !roundSuccess; attempt++) {
        if (attempt > 0) {
          // 재시도 전: 이미 표시된 버블은 유지 — 로컬 변수만 초기화
          // (allMessages.splice 제거 — "나오다 없어져" 버그 원인이었음)
          setCurrentText('');
          streamedText = '';
          currentBubble = '';
          bubbleCount = 0;
          await sleep(500);
          if (abortRef.current) break;
        }

        try {
          // 주제 전환 직후 라운드 → lastText 초기화 (이전 주제 맥락 제거)
          if (topicChangedRef.current) {
            lastText = '';
            topicChangedRef.current = false;
          }

          const currentTopic = selectedTopic === 'free' ? freeTopicRef.current : initialTopic;

          // 최근 20개 verbatim + 이전 발언은 요약 압축
          const olderMessages = allMessages.length > RECENT_WINDOW ? allMessages.slice(0, -RECENT_WINDOW) : [];
          const debateSummary = olderMessages.length > 0 ? buildDebateSummary(olderMessages, config) : undefined;
          const recentHistory = allMessages.slice(-RECENT_WINDOW);
          const historyForRound = attempt > 0 ? recentHistory.slice(-6) : recentHistory;

          const CHUNK_DEDUP_MIN_OVERLAP = 6;

          const removeReplayFromChunk = (incoming: string): string => {
            if (!incoming) return '';
            const maxOverlap = Math.min(incoming.length, currentBubble.length);
            for (let i = maxOverlap; i >= CHUNK_DEDUP_MIN_OVERLAP; i--) {
              if (currentBubble.endsWith(incoming.slice(0, i))) {
                return incoming.slice(i);
              }
            }
            return incoming;
          };

          const flushCurrentBubble = async () => {
            const raw = currentBubble.trim();
            if (!raw) return;
            const bubble = ensurePunctuation(raw);
            const msg: DebateMessage = { speaker, text: bubble, timestamp: Date.now() };
            allMessages.push(msg);
            setMessages((prev) => [...prev, msg]);
            scrollToBottom();
            setCurrentText('');
            currentBubble = '';
            bubbleCount++;
            await sleep(900);
          };

          // 30% 확률 행동 묘사 삽입 플래그
          let shouldInsertAction = Math.random() < 0.3;
          let actionInserted = false;

          // 한국어 연결어 — "다" 뒤에 이 글자들이 오면 문장이 아직 끝나지 않은 것 (예: 하락했다는 점은)
          const KR_CONNECTOR = /^[는은이가을를와과도고로에서으로의하여해서므로지만]/; // "고" 추가: 있다고/됐다고 연결어 처리
          let pendingFlush = false;  // "다"로 끝났지만 다음 글자 보고 결정

          const appendTextChunk = async (segment: string) => {
            if (!segment) return;
            for (const char of segment) {
              if (abortRef.current) return;
              streamedText += char;

              // pendingFlush 중: 다음 글자가 연결어면 flush 취소, 아니면 즉시 flush
              if (pendingFlush) {
                pendingFlush = false;
                // 연결어 OR 닫는 따옴표 → flush 취소 (인용문 내부 "수치?", "말씀?" 패턴)
                if (KR_CONNECTOR.test(char) || char === '"' || char === '\u201C' || char === '\u201D') {
                  currentBubble += char;
                  setCurrentText(currentBubble);
                  await sleep(getTypingMs(currentBubble));
                  continue;
                } else {
                  // 실제 문장 끝 → flush 후 이 글자 새 버블 시작
                  await flushCurrentBubble();
                  if (currentBubble.length === 0 && /^[.!?\s]$/.test(char)) continue;
                }
              }

              // 새 버블 시작 시: 선행 구두점(마침표 등) 스킵
              if (currentBubble.length === 0 && /^[.!?\s]$/.test(char)) continue;

              // 첫 버블에 행동 묘사 삽입 (AI가 이미 괄호로 시작하지 않은 경우만)
              if (shouldInsertAction && !actionInserted && bubbleCount === 0 && currentBubble.length === 0 && char !== '(') {
                const action = getRandomAction(usedActionsRef.current, speaker);
                currentBubble = action + ' ';
                actionInserted = true;
              }

              currentBubble += char;
              setCurrentText(currentBubble);
              await sleep(getTypingMs(currentBubble));

              // 실시간 문장 끝 감지 → 버블 flush 대기
              const textForEnd = stripActionForSentenceEnd(currentBubble);
              if (
                bubbleCount < BUBBLE_CONFIG.MAX_BUBBLES - 1 &&
                textForEnd.length >= BUBBLE_CONFIG.MIN_BUBBLE_LENGTH &&
                isSentenceEnd(textForEnd) &&
                !textForEnd.trimStart().startsWith('(')
              ) {
                // "다" 또는 "?" 로 끝나는 경우: 다음 글자 보고 결정
                // "?": 인용문 내부일 수 있음 ("수치가 어디입니까?" 뒤에 "라고 하셨는데" 패턴)
                if (/[다?]$/.test(textForEnd)) {
                  pendingFlush = true;
                } else {
                  // . ! 요/죠/네요로 끝나는 경우: 즉시 flush
                  await flushCurrentBubble();
                }
              }
            }
          };

          // B: 상대 주장 반박 의무화 — 내 턴이면 상대(lastText)의 핵심 주장 전달
          const mustRebutClaim = lastText ? opponentClaimRef.current : null;
          const reqId = `c-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
          const text = await streamRound(speaker, currentTopic, lastText, style, reqId, async (chunk) => {
            if (abortRef.current) return;
            // 스트리밍 중: || 구분자 무시, 단순 텍스트 누적 + 타이핑 효과
            const incoming = removeReplayFromChunk(chunk.replace(/\r/g, '').replace(/\|\|/g, '').replace(/\|/g, ''));
            await appendTextChunk(incoming);
          }, historyForRound, {
            usedArgCount: usedArgCountRef.current[speaker] ?? 0,
            mustRebutClaim,
            lastAngles: lastAnglesRef.current[speaker] ?? [],
            debateSummary,
            timeLeft: timeLeftRef.current,
          });

          if (abortRef.current) break;

          const finalText = `${text}`.replace(/\|\|/g, '').replace(/\|/g, '').trim();

          // 스트리밍 완료 → 남은 텍스트 마지막 버블로 flush
          setCurrentSpeaker(null);
          if (currentBubble.trim()) {
            const lastBubbleText = ensurePunctuation(currentBubble.trim());
            const lastMsg: DebateMessage = { speaker, text: lastBubbleText, timestamp: Date.now() };
            allMessages.push(lastMsg);
            setMessages((prev) => [...prev, lastMsg]);
            setCurrentText('');
            currentBubble = '';
            scrollToBottom();
          } else {
            setCurrentText('');
          }

          scrollToBottom();
          lastText = finalText;
          // B: 방금 발언(text)에서 다음 턴 상대방이 반박할 핵심 주장 추출
          opponentClaimRef.current = extractKeyClaimClient(finalText);
          // 관중 반응 트리거 (새 메시지 완료마다)
          setAudienceReactionTrigger(prev => prev + 1);
          roundSuccess = true;

          await sleep(900);
        } catch (e) {
          const debErr = summarizeDebateError(e);
          console.error(`[debate] Stream error (attempt ${attempt + 1}):`, debErr);
          // 이미 커밋된 버블 있거나, 스트리밍 중 partial text가 있으면 부분 성공 처리
          // → 화면에서 사라지지 않음 ("보이다 사라짐" 버그 방지)
          const hasPartial = allMessages.length > messagesSnapshotLength || streamedText.trim().length > 0;
          if (hasPartial) {
            // 현재 스트리밍 중이던 텍스트도 커밋 (버블로 확정)
            if (currentBubble.trim()) {
              const msg: DebateMessage = { speaker, text: currentBubble.trim(), timestamp: Date.now() }; 
              allMessages.push(msg);
              setMessages((prev) => [...prev, msg]);
            }
            lastText = streamedText || lastText;
            setCurrentText('');
            setCurrentSpeaker(null);
            scrollToBottom();
            opponentClaimRef.current = extractKeyClaimClient(lastText);
            setAudienceReactionTrigger(prev => prev + 1);
            const partialErrMsg: DebateMessage = {
              speaker: "__moderator__",
              text: `(잠시 네트워크 상태가 좋지 않아 발언이 중단됐습니다. 토론을 계속합니다.)`,
              timestamp: Date.now(),
            };
            allMessages.push(partialErrMsg);
            setMessages((prev) => [...prev, partialErrMsg]);
            roundSuccess = true;
            await sleep(900);
          } else {
            // 완전 실패 여유: 공백 구간을 만들지 않도록 fallback 말풍선 추가하고 다음 턴으로 진행
            const fallbackText = `(잠시 생각을 가다듬으며 다음 발언을 준비합니다...)`;
            const fallbackMsg: DebateMessage = { speaker: '__moderator__', text: fallbackText, timestamp: Date.now() };
            allMessages.push(fallbackMsg);
            setMessages((prev) => [...prev, fallbackMsg]);
            lastText = opponentClaimRef.current || lastText;
            setCurrentText('');
            setCurrentSpeaker(null);
            scrollToBottom();
            setAudienceReactionTrigger((prev) => prev + 1);
            roundSuccess = true;
            await sleep(900);
          }
        }
      }

      // 2회 모두 실패 → 해당 라운드 스킵, 빈 화면 없이 다음 화자로
      if (!roundSuccess && !abortRef.current) {
        setCurrentText('');
        setCurrentSpeaker(null);
        await sleep(500);
      }

      if (abortRef.current) break;

      // 사회자 AI 개입 (6라운드마다)
      if (roundSuccess && !abortRef.current && (i + 1) % 6 === 0 && i > 0) {
        try {
          const modRes = await fetch('/api/debate-moderator', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: allMessages.slice(-6),
              currentTopic: issueTitle || (selectedTopic === 'free' ? freeTopicRef.current : initialTopic),
              debateType,
              dynamicKB: dynamicKB || undefined,
            }),
          });
          if (modRes.ok) {
            const modData = await modRes.json();
            if (modData.text) {
              const modMsg: DebateMessage = {
                speaker: '__moderator__',
                text: `🎙️ ${modData.text}`,
                timestamp: Date.now(),
              };
              allMessages.push(modMsg);
              setMessages(prev => [...prev, modMsg]);
              scrollToBottom();
              // 사회자 타이핑 완료까지 대기: 시작딜레이(120) + 글자수×52ms + 여유(1000)
              const modWait = 120 + modMsg.text.length * 52 + 1000;
              await sleep(modWait);
            }
          }
        } catch (_e) {
          // 사회자 실패는 조용히 스킵
        }
      }

      // 라운드 끝난 후 펜딩 주제 전환 처리
      if (pendingTopicChangeRef.current && roundSuccess) {
        const newTopic = pendingTopicChangeRef.current;
        pendingTopicChangeRef.current = null;
        lastText = '';
        topicChangedRef.current = false;

        // 주제 전환 카드 삽입
        const changeMsg: DebateMessage = {
          speaker: config.speakerA,
          text: newTopic,
          timestamp: Date.now(),
          isTopicChange: true,
        };
        allMessages.push(changeMsg);
        setMessages(prev => [...prev, changeMsg]);
        scrollToBottom();

        // 선공/후공 스왑
        speakerOrderRef.current = [speakerOrderRef.current[1], speakerOrderRef.current[0]];
        speakerIndexRef.current = 0;

        // 드라마틱한 주제 전환 pause
        await sleep(1800);
      }
    }

    setCurrentSpeaker(null);

    if (!abortRef.current && allMessages.length > 0) {
      // 이슈 토론 모드는 캐시 저장 안 함 (오염 방지)
      if (!issueTitle) {
        fetch('/api/debate-cache', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic: initialTopic, style, messages: allMessages, judgment: null, promptVersion: PROMPT_VERSION }),
        }).catch(() => {});
      }
      // 30라운드 정상 완료 시 finished 단계로 전환
      setPhase('finished');
    }
  };

  // ─── 판정 요청 ─────────────────────────────────────────────────────────────

  // requestJudgment 제거됨 — 판정 기능 비활성화

  // ─── 토론 시작 ─────────────────────────────────────────────────────────────

  const startDebate = async () => {
    let topicLabel: string;
    // 오늘의 이슈 모드: issueTitle을 토론 주제로 사용
    if (issueTitle) {
      topicLabel = issueTitle;
    } else if (selectedTopic === 'free') {
      const realTopics = config.topics.filter(t => t.id !== 'free');
      const first = realTopics[Math.floor(Math.random() * realTopics.length)];
      if (!first) {
        topicLabel = config.topics[1]?.label || 'free';
        freeTopicRef.current = config.topics[1]?.label || 'free';
      } else {
        freeTopicRef.current = first.label;
        topicLabel = first.label;
      }
    } else {
      topicLabel = config.topics.find(t => t.id === selectedTopic)?.label || selectedTopic || '';
    }

    // 동전던지기로 선공 결정
    const coinSide = Math.random() < 0.5;
    const firstKey = coinSide ? config.speakerA : config.speakerB;
    const secondKey = coinSide ? config.speakerB : config.speakerA;
    const firstName = coinSide ? config.speakerAName : config.speakerBName;
    const speakerOrder: [string, string] = [firstKey, secondKey];

    setMessages([]);
    setCurrentText('');
    setCurrentSpeaker(null);
    setRound(0);
    setJudgment(null);

    // 동전 애니메이션
    setCoinFlipWinner({ key: firstKey, name: firstName });
    setCoinFlipStage('spinning');
    setPhase('coinflip');

    await sleep(1600);
    setCoinFlipStage('revealed');
    await sleep(1800);

    setPhase('running');
    setTimeLeft(300);
    setCoinFlipStage('idle');
    setCurrentSpeaker(firstKey); // 코인 직후 첫 화자 TypingIndicator 즉시 표시

    // 캐시 확인
    const cached = await fetchCache(topicLabel, selectedStyle);
    if (cached) {
      await replayDebate(cached.messages, cached.judgment);
    } else {
      await runLiveDebate(topicLabel, selectedStyle, speakerOrder);
    }
  };

  // ─── 토론 종료 (강제) ──────────────────────────────────────────────────────

  const endDebate = () => {
    abortRef.current = true;
    activeAbortCtrlRef.current?.abort(); // fetch 즉시 취소 (데드락 방지)
    setCurrentSpeaker(null);
    setCurrentText('');
    setMessages([]);
    setJudgment(null);
    setRound(0);
    setTimeLeft(300);
    // autoStart(이슈 탭 진입)면 종료 시 홈으로 이동 (무한 로딩 방지)
    if (autoStart) {
      navigate('/');
      return;
    }
    setPhase('setup');
  };

  // autoStart: 이슈 탭에서 바로 정책토론 시작
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (!autoStart || autoStartedRef.current || phase !== 'setup') return;
    autoStartedRef.current = true;
    const t = setTimeout(() => { startDebate(); }, 100);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, phase]);

  const handleShareResult = async () => {
    const topLines = topHighlights.slice(0, 2).map((item, idx) => {
      const rank = idx + 1;
      return `${rank}위 ${item.speakerName}: ${item.preview}`;
    });
    const shareText = [
      '폴리챗 토론 결과',
      ...topLines,
      'polichat.kr에서 직접 토론 관람!',
      '#폴리챗 #AI토론',
    ].join('\n');

    if (navigator.share) {
      try {
        await navigator.share({ text: shareText });
        return;
      } catch (_e) {
        // share 취소/실패는 fallback으로 이어감
      }
    }

    try {
      await navigator.clipboard.writeText(shareText);
      alert('공유 텍스트가 클립보드에 복사되었습니다.');
    } catch (_e) {
      alert('공유를 지원하지 않습니다. 텍스트를 수동으로 복사해 주세요.');
    }
  };

  // finished: 하이라이트 + 공유 기능 표시

  // ─── UI: 설정 화면 ─────────────────────────────────────────────────────────

  if (phase === 'setup') {
    // autoStart: 설정 화면 건너뛰고 즉시 토론 시작 대기 (깜빡임 방지)
    if (autoStart) {
      return (
        <div className="app-bg flex items-center justify-center" style={{ height: '100svh' }}>
          <PolichatLogoSpinner message="토론 준비 중..." dark />
        </div>
      );
    }
    return (
      <div className="app-bg flex flex-col overflow-y-auto" style={{ height: '100svh', maxWidth: '700px', margin: '0 auto', width: '100%', WebkitOverflowScrolling: 'touch' }}>
        {/* 헤더 */}
        <div
          className="flex items-center gap-3 px-4 pb-4"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}
        >
          <button
            onClick={() => navigate('/')}
            className="text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1 whitespace-nowrap text-sm font-medium"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            뒤로
          </button>
          <h1 className="text-gray-800 font-bold text-base tracking-tight">
            AI 토론배틀
          </h1>
        </div>

        {/* 후보 미리보기 */}
        <div className="flex items-center px-4 mb-3">
          <div className="flex-1 flex flex-col items-center gap-1">
            <img
              src={`/politicians/${config.speakerA}/profile.jpg`}
              alt={config.speakerAName}
              className="w-24 h-24 rounded-full object-cover border-2"
              style={{ borderColor: config.speakerAColor }}
            />
            <span className="text-gray-800 text-sm font-bold">{config.speakerAName.split(' ')[0]}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'rgba(255,255,255,0.92)', color: config.speakerAColor, border: `1px solid ${config.speakerAColor}80` }}>{{ seoul: '국민의힘', national: '더불어민주당', leejeon: '개혁신당', kimjin: '정치비평가', hanhong: '국민의힘' }[debateType]}</span>
          </div>
          <div className="w-12 flex-shrink-0 text-center text-yellow-400 font-black text-2xl">VS</div>
          <div className="flex-1 flex flex-col items-center gap-1">
            <img
              src={`/politicians/${config.speakerB}/profile.jpg`}
              alt={config.speakerBName}
              className="w-24 h-24 rounded-full object-cover border-2"
              style={{ borderColor: config.speakerBColor }}
            />
            <span className="text-gray-800 text-sm font-bold">{config.speakerBName.split(' ')[0]}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'rgba(255,255,255,0.92)', color: config.speakerBColor, border: `1px solid ${config.speakerBColor}80` }}>{{ seoul: '더불어민주당', national: '국민의힘', leejeon: '국민의힘', kimjin: '정치비평가', hanhong: '국민의힘' }[debateType]}</span>
          </div>
        </div>

        {/* 이슈 모드: 주제 선택 대신 이슈 제목 표시 */}
        {issueTitle ? (
          <div className="px-4 mb-4">
            <p className="pc-section-label flex items-center gap-1.5 mb-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v2"/><path d="M4 22a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/></svg>
              오늘의 이슈
            </p>
            <div className="rounded-xl px-4 py-3 border" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(99,102,241,0.08))', borderColor: 'rgba(124,58,237,0.4)' }}>
              <div className="text-gray-800 font-bold text-sm leading-snug">📰 {issueTitle}</div>
            </div>
          </div>
        ) : (
        <>
        <div className="px-4 mb-2">
          <p className="pc-section-label flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>
            토론 주제를 선택하세요
          </p>
        </div>

        {/* 주제 그리드 */}
        <div className="px-4 grid grid-cols-3 gap-2 mb-4">
          {config.topics.map((topic) => (
            <button
              key={topic.id}
              onClick={() => setSelectedTopic(topic.id)}
              className="relative rounded-xl px-1.5 text-center transition-all duration-200 border flex flex-col items-center justify-center"
              style={{
                height: '58px',
                background: selectedTopic === topic.id ? 'rgba(99,102,241,0.1)' : 'white',
                borderColor: selectedTopic === topic.id ? 'rgba(99,102,241,0.5)' : 'rgba(0,0,0,0.07)',
                boxShadow: selectedTopic === topic.id ? '0 0 0 2px rgba(99,102,241,0.15)' : '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              {topic.id === 'free' ? (
                <span className="flex flex-col items-center gap-0.5">
                  <span className="flex items-center gap-1 text-gray-800 text-[12px] font-semibold">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="3"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/><circle cx="16" cy="8" r="1.5" fill="currentColor"/><circle cx="8" cy="16" r="1.5" fill="currentColor"/><circle cx="16" cy="16" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>
                    자유토론
                  </span>
                  <span className="text-gray-500 text-[10px]">100초마다 전환</span>
                </span>
              ) : (
                <span className="text-gray-800 text-[12px] font-semibold leading-tight">{topic.label}</span>
              )}
              {selectedTopic === topic.id && (
                <span className="absolute top-1.5 right-1.5 text-purple-500 flex items-center">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </span>
              )}
            </button>
          ))}
        </div>
        </> )}

        {/* 토론 방식 선택 — leejeon은 감정토론 고정 */}
        {debateType === 'leejeon' ? (
          <div className="px-4 mb-4">
            <p className="pc-section-label flex items-center gap-1.5 mb-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              토론 방식
            </p>
            <div className="rounded-xl px-4 py-3 text-center border" style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(249,115,22,0.08))', borderColor: 'rgba(239,68,68,0.4)' }}>
              <div className="text-gray-800 font-bold text-sm flex items-center justify-center gap-1">🔥 감정 토론 (고정)</div>
              <div className="text-gray-500 text-[10px] mt-0.5">이준석 vs 전한길은 격렬 공격 스타일만 지원합니다</div>
            </div>
          </div>
        ) : (
        <>
        <div className="px-4 mb-2">
          <p className="pc-section-label flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
            토론 방식을 선택하세요
          </p>
        </div>

        <div className="px-4 grid grid-cols-3 gap-2 mb-4">
          <button
            onClick={() => setSelectedStyle('policy')}
            className="relative rounded-xl px-1.5 py-[10px] text-center transition-all duration-200 border"
            style={{
              background: selectedStyle === 'policy' ? 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))' : 'white',
              borderColor: selectedStyle === 'policy' ? 'rgba(99,102,241,0.5)' : 'rgba(0,0,0,0.07)',
              boxShadow: selectedStyle === 'policy' ? '0 0 0 2px rgba(99,102,241,0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <div className="text-gray-800 font-bold text-sm flex items-center justify-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              정책 토론
            </div>
            <div className="text-gray-600 text-[10px] text-center mt-0.5">수치·공약 중심</div>
            {selectedStyle === 'policy' && (
              <span className="absolute top-1.5 right-1.5 text-purple-400 flex items-center justify-center">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </span>
            )}
          </button>

          <button
            onClick={() => setSelectedStyle('emotional')}
            className="relative rounded-xl px-1.5 py-[10px] text-center transition-all duration-200 border"
            style={{
              background: selectedStyle === 'emotional' ? 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))' : 'white',
              borderColor: selectedStyle === 'emotional' ? 'rgba(99,102,241,0.5)' : 'rgba(0,0,0,0.07)',
              boxShadow: selectedStyle === 'emotional' ? '0 0 0 2px rgba(99,102,241,0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <div className="text-gray-800 font-bold text-sm flex items-center justify-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              감정 토론
            </div>
            <div className="text-gray-600 text-[10px] text-center mt-0.5">격렬 공격 스타일</div>
            {selectedStyle === 'emotional' && (
              <span className="absolute top-1.5 right-1.5 text-purple-400 flex items-center justify-center">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </span>
            )}
          </button>

          <button
            onClick={() => setSelectedStyle('consensus')}
            className="relative rounded-xl px-1.5 py-[10px] text-center transition-all duration-200 border"
            style={{
              background: selectedStyle === 'consensus' ? 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))' : 'white',
              borderColor: selectedStyle === 'consensus' ? 'rgba(99,102,241,0.5)' : 'rgba(0,0,0,0.07)',
              boxShadow: selectedStyle === 'consensus' ? '0 0 0 2px rgba(99,102,241,0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <div className="text-gray-800 font-bold text-sm flex items-center justify-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              합의 도출
            </div>
            <div className="text-gray-600 text-[10px] text-center mt-0.5">접점·타협안 제시</div>
            {selectedStyle === 'consensus' && (
              <span className="absolute top-1.5 right-1.5 text-purple-400 flex items-center justify-center">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </span>
            )}
          </button>
        </div>
        </>
        )}

        {/* 시작 버튼 */}
        <div className="p-4">
          <button
            onClick={startDebate}
            disabled={issueTitle ? !selectedStyle : (!selectedTopic || !selectedStyle)}
            className="w-full py-4 rounded-2xl font-bold text-white text-[16px] tracking-tight transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
            }}
          >
            {selectedStyle === 'policy' ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                정책 토론 시작!
              </>
            ) : selectedStyle === 'emotional' ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                감정 토론 시작!
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                합의 도출 시작!
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ─── UI: 토론 진행 + 결과 화면 ────────────────────────────────────────────

  const topicLabel = issueTitle
    ? issueTitle
    : selectedTopic === 'free'
      ? (freeTopicRef.current || '자유토론')
      : (config.topics.find(t => t.id === selectedTopic)?.label || selectedTopic || '');
  const oshScore = judgment?.scores.ohsehoon?.total ?? 0;
  const jwoScore = judgment?.scores.jungwono?.total ?? 0;
  const totalScore = oshScore + jwoScore || 100;
  const oshPct = Math.round((oshScore / totalScore) * 100);
  const jwoPct = 100 - oshPct;

  return (
    <div
      className={`app-bg fixed top-0 left-0 right-0 flex flex-col overflow-hidden ${actBgClass}`}
      style={{ height: '100svh', maxWidth: '700px', margin: '0 auto', bottom: 0 }}
    >
      {/* 헤더 */}
      <div
        className="shrink-0 flex items-center justify-between px-4 pb-3 border-b"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)', borderColor: 'rgba(0,0,0,0.1)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-gray-800 font-extrabold text-base truncate max-w-[200px]">
            🥊 {topicLabel}
          </span>
        </div>
        {(phase === 'running' || phase === 'coinflip') && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-gray-200 rounded-full px-3 h-8">
              <span className="text-purple-600 text-xs font-semibold">남은 시간</span>
              <span className="text-gray-800 font-bold text-base font-mono tracking-wide">
                {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
              </span>
            </div>
            <button
              onClick={() => setShowExitModal(true)}
              className="text-xs px-3 h-8 rounded-full border text-gray-600 hover:text-gray-800 transition-colors"
              style={{ borderColor: 'rgba(0,0,0,0.1)' }}
            >
              종료
            </button>
          </div>
        )}
        {phase === 'finished' && (
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-sm font-semibold">🏁 종료</span>
            <button
              onClick={endDebate}
              className="text-xs px-3 h-8 rounded-full border text-gray-600 hover:text-gray-800 transition-colors"
              style={{ borderColor: 'rgba(0,0,0,0.1)' }}
            >
              나가기
            </button>
          </div>
        )}
        {(phase === 'judging' || phase === 'result') && (
          <span className="text-yellow-400 text-sm font-bold flex items-center gap-1">
            {phase === 'judging' ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5"/></svg>
                판정 중...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>
                결과
              </>
            )}
          </span>
        )}
      </div>

      {/* 진행률 바 — 남은 시간 표시 (왼쪽에서 오른쪽으로 줄어듦) */}
      {phase === 'running' && (
        <>
          {/* 통합 단계 + 타이머 게이지 */}
          {phase === 'running' && (
            <TensionGauge
              messages={messages}
              round={_round}
              maxRound={30}
              timeLeft={timeLeft}
              totalTime={300}
            />
          )}
        </>
      )}

      {/* 스크롤 영역 */}
      {/* 동전던지기 오버레이 */}
      {/* 종료 확인 모달 */}
      {showExitModal && (
        <div
          className="absolute inset-0 z-[60] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl px-6 py-6 mx-6 w-full max-w-xs flex flex-col items-center"
            style={{ animation: 'fadeInUp 0.2s ease' }}
          >
            <div className="text-2xl mb-3">⚠️</div>
            <p className="text-gray-900 font-bold text-base mb-1 text-center">토론을 종료할까요?</p>
            <p className="text-gray-500 text-sm mb-5 text-center">지금까지의 내용이 모두 사라집니다.</p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setShowExitModal(false)}
                className="flex-1 py-2.5 rounded-xl border text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                style={{ borderColor: 'rgba(0,0,0,0.12)' }}
              >
                취소
              </button>
              <button
                onClick={() => { setShowExitModal(false); endDebate(); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-colors"
                style={{ background: '#E53E3E' }}
              >
                종료
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === 'coinflip' && coinFlipWinner && (
        <div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: 'rgba(10,10,20,0.92)', backdropFilter: 'blur(6px)' }}
        >
          <p className="text-white/50 text-xs mb-8 tracking-[0.2em] uppercase">선공 결정 중</p>

          <div className="flex items-center gap-10 mb-8">
            {/* Speaker A */}
            <div className={`flex flex-col items-center transition-all duration-700 ${
              coinFlipStage === 'revealed'
                ? coinFlipWinner.key === config.speakerA
                  ? 'scale-125 opacity-100'
                  : 'opacity-25 scale-90'
                : 'opacity-100'
            }`}>
              <img
                src={`/politicians/${config.speakerA}/profile.jpg`}
                className="w-20 h-20 rounded-full border-[3px] object-cover"
                style={{ borderColor: config.speakerAColor }}
              />
              <span className="text-white text-sm mt-2 font-semibold">{config.speakerAName.split(' ')[0]}</span>
            </div>

            {/* 3D 동전 + 궤도 링 */}
            <div style={{ position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {/* 궤도 링 (Saturn-style, 기울어진 타원) */}
              {coinFlipStage === 'spinning' && (
                <div style={{
                  position: 'absolute',
                  width: 148,
                  height: 148,
                  border: '2.5px solid rgba(200,210,230,0.55)',
                  borderRadius: '50%',
                  boxShadow: '0 0 10px rgba(180,200,255,0.25)',
                  animation: 'orbitRing 1.8s linear infinite',
                  transformOrigin: 'center center',
                  pointerEvents: 'none',
                }} />
              )}
              <div style={{ perspective: '400px' }}>
                <div
                  style={{
                    width: 96,
                    height: 96,
                    position: 'relative',
                    transformStyle: 'preserve-3d',
                    animation: coinFlipStage === 'spinning' ? 'coinSpin3D 0.45s linear infinite' : 'none',
                    transition: coinFlipStage === 'revealed' ? 'transform 0.6s ease-out' : 'none',
                    transform: coinFlipStage === 'revealed'
                      ? (coinFlipWinner?.key === config.speakerA ? 'rotateY(0deg)' : 'rotateY(180deg)')
                      : undefined,
                  }}
                >
                  {/* 앞면: Speaker A — 실버 */}
                  <div style={{
                    position: 'absolute', inset: 0,
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    border: '4px solid #C8D0DC',
                    boxShadow: '0 0 22px rgba(180,200,230,0.7), inset 0 0 12px rgba(200,215,240,0.35)',
                  }}>
                    <img
                      src={`/politicians/${config.speakerA}/profile.jpg`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(1) contrast(1.1)' }}
                      alt={config.speakerAName}
                    />
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'radial-gradient(circle at 30% 25%, rgba(230,240,255,0.3) 0%, rgba(100,120,160,0.12) 100%)',
                    }} />
                  </div>

                  {/* 뒷면: Speaker B — 실버 */}
                  <div style={{
                    position: 'absolute', inset: 0,
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    border: '4px solid #C8D0DC',
                    boxShadow: '0 0 22px rgba(180,200,230,0.7), inset 0 0 12px rgba(200,215,240,0.35)',
                  }}>
                    <img
                      src={`/politicians/${config.speakerB}/profile.jpg`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(1) contrast(1.1)' }}
                      alt={config.speakerBName}
                    />
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'radial-gradient(circle at 30% 25%, rgba(230,240,255,0.3) 0%, rgba(100,120,160,0.12) 100%)',
                    }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Speaker B */}
            <div className={`flex flex-col items-center transition-all duration-700 ${
              coinFlipStage === 'revealed'
                ? coinFlipWinner.key === config.speakerB
                  ? 'scale-125 opacity-100'
                  : 'opacity-25 scale-90'
                : 'opacity-100'
            }`}>
              <img
                src={`/politicians/${config.speakerB}/profile.jpg`}
                className="w-20 h-20 rounded-full border-[3px] object-cover"
                style={{ borderColor: config.speakerBColor }}
              />
              <span className="text-white text-sm mt-2 font-semibold">{config.speakerBName.split(' ')[0]}</span>
            </div>
          </div>

          {coinFlipStage === 'revealed' && (
            <div className="text-center" style={{ animation: 'fadeInUp 0.4s ease' }}>
              <p className="text-white text-xl font-bold">{coinFlipWinner.name}</p>
              <p className="text-white/60 text-sm mt-1">이 먼저 발언합니다 ⚡</p>
            </div>
          )}

          <style>{`
            @keyframes coinSpin3D {
              0%   { transform: rotateY(0deg); }
              100% { transform: rotateY(360deg); }
            }
            @keyframes orbitRing {
              0%   { transform: rotateX(72deg) rotateZ(0deg); }
              100% { transform: rotateX(72deg) rotateZ(360deg); }
            }
            @keyframes fadeInUp {
              from { opacity: 0; transform: translateY(12px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* 완료된 발언들 */}
        {messages.map((msg, i) => {
          const isLast = i === messages.length - 1;
          const isSpeakerA = msg.speaker === config.speakerA;
          // 이미 표시된 출처 Set (반복 방지)
          const shownSources = new Set(
            messages.slice(0, i)
              .map(m => detectFacts(m.text || '')?.label)
              .filter(Boolean)
          );
          const rawFact = detectFacts(msg.text || '');
          const factLabel = rawFact && !shownSources.has(rawFact.label) ? rawFact : null;
          // 사회자 메시지 특수 처리 — 타이핑 효과
          if (msg.speaker === '__moderator__') {
            return <ModeratorMessage key={i} text={msg.text} />;
          }
          return (
            <div
              key={i}
              className={`flex flex-col ${isSpeakerA ? 'items-end' : 'items-start'}`}
              style={{ position: 'relative' }}
            >
              <MessageBubble msg={msg} config={config} />
              {/* 출처 카드: 기관명·자료명·날짜 — 토론 내 최초 1회만 */}
              {factLabel && !msg.isTopicChange && (
                <div
                  className={`mt-1 inline-flex items-center gap-1.5 rounded-md bg-slate-100/80 px-2.5 py-1 ${isSpeakerA ? 'mr-11' : 'ml-11'}`}
                >
                  <span className="text-[9px] opacity-60">📚</span>
                  <span className="text-[10px] font-semibold text-slate-600">
                    {factLabel.label}
                  </span>
                  {factLabel.subtitle && (
                    <span className="text-[10px] text-slate-400">
                      ({factLabel.subtitle})
                    </span>
                  )}
                  {factLabel.detail && (
                    <span className="text-[10px] font-bold text-slate-700 ml-0.5">
                      {factLabel.detail}
                    </span>
                  )}
                </div>
              )}
              {/* 관중 반응 (마지막 완료 메시지에만) */}
              {isLast && phase === 'running' && (
              <AudienceReaction
                  messageText={msg.text}
                  tension={tension}
                  trigger={audienceReactionTrigger}
                />
              )}
            </div>
          );
        })}

        {/* 현재 발화자 — 대기 중(로딩) 또는 타이핑 중 */}
        {phase === 'running' && currentSpeaker && (() => {
          // 말풍선 분리 전환 중: currentText가 방금 커밋된 메시지와 동일하면 라이브 버블 숨김 (깜빡임 방지)
          const lastMsg = messages[messages.length - 1];
          const isJustCommitted = currentText.trim().length > 0 && lastMsg?.text === currentText.trim();
          // 상대편 위치 계산 (끼어들기용)
          const opponentSpeaker = currentSpeaker === config.speakerA ? config.speakerB : config.speakerA;
          const isCurrentA = currentSpeaker === config.speakerA;

          if (currentText && !isJustCommitted) {
            return (
              <div style={{ position: 'relative' }}>
                <MessageBubble
                  msg={{ speaker: currentSpeaker, text: currentText, timestamp: Date.now() }}
                  isActive
                  config={config}
                />
                {/* 상대방 끼어들기 */}
                <Interjection
                  streamingText={currentText}
                  opponentSpeaker={opponentSpeaker}
                  isStreaming={true}
                  align={isCurrentA ? 'left' : 'right'}
                />
              </div>
            );
          }
          // 새 화자 첫 등장 시에만 TypingIndicator 표시 (같은 화자 전환 중엔 숨김)
          if (!lastMsg || lastMsg.speaker !== currentSpeaker) {
            return <TypingIndicator speaker={currentSpeaker} config={config} />;
          }
          return null;
        })()}

        {/* 판정 중 */}
        {phase === 'judging' && (
          <div className="text-center py-8">
            <div className="text-gray-600 text-sm animate-pulse">⚖️ AI 심판이 판정 중입니다...</div>
          </div>
        )}

        {/* 판정 결과 */}
        {phase === 'result' && judgment && (
          <JudgmentCard judgment={judgment} oshPct={oshPct} jwoPct={jwoPct} config={config} />
        )}

        {phase === 'finished' && (
          <div className="rounded-2xl bg-black/30 border-l-4 border-orange-400 px-4 py-3 space-y-2 text-white">
            <div className="font-bold text-[16px]">🏆 토론 하이라이트</div>
            {topHighlights.length > 0 ? (
              <div className="space-y-2">
                {topHighlights.map((item, idx) => (
                  <div
                    key={`${item.msg.speaker}-${item.msg.timestamp}-${idx}`}
                    className="rounded-xl bg-white/10 p-3 text-sm"
                  >
                    <div className="font-semibold mb-1">
                      {idx + 1}위 · {item.speakerName}
                    </div>
                    <p className="text-xs text-white/85 leading-relaxed">
                      {item.preview}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-white/75">하이라이트가 충분하지 않습니다.</div>
            )}
            <button
              onClick={handleShareResult}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-white border border-orange-300/40"
              style={{ background: 'rgba(234, 88, 12, 0.2)' }}
            >
              📤 카카오톡/인스타에 공유하기
            </button>
          </div>
        )}

        <div ref={messagesEndRef} className="h-16" />
      </div>

      {/* 하단 액션 */}
      {phase === 'result' && (
        <div className="p-4 flex gap-2 border-t" style={{ borderColor: 'rgba(0,0,0,0.1)' }}>
          <button
            onClick={() => {
              setPhase('setup');
              setMessages([]);
              setCurrentText('');
              setJudgment(null);
              setRound(0);
              setTimeLeft(300);
            }}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-gray-800 border transition-colors hover:bg-gray-100 flex items-center justify-center gap-2"
            style={{ borderColor: 'rgba(0,0,0,0.1)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.6"/></svg>
            다시 토론
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-gray-800 border transition-colors hover:bg-gray-100 flex items-center justify-center gap-2"
            style={{ borderColor: 'rgba(0,0,0,0.1)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            홈으로
          </button>
        </div>
      )}


    </div>
  );
}

// ─── 행동 묘사 이탤릭 렌더링 ──────────────────────────────────────────────────

function renderBubbleText(text: string): React.ReactNode {
  if (!text || text === '\u00A0') return text;
  // 스트리밍 중: 아직 닫히지 않은 괄호로 시작하는 경우 (예: "(마이크를 가까이 당기며")
  // `)` 없으면 전체를 이탤릭으로 처리 → 완성 시 번쩍임 방지
  if (/^\([^)]*$/.test(text)) {
    return <em className="italic">{text}</em>;
  }
  // 완성된 (행동 묘사) 패턴을 이탤릭으로 렌더링
  const parts = text.split(/(\([^)]+\))/g);
  if (parts.length <= 1) return text;
  return parts.map((part, i) => {
    if (/^\([^)]+\)$/.test(part)) {
      return <em key={i} className="italic">{part}</em>;
    }
    return <span key={i}>{part}</span>;
  });
}

// ─── 말풍선 컴포넌트 ──────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  isActive = false,
  config,
}: {
  msg: DebateMessage;
  isActive?: boolean;
  config: typeof DEBATE_CONFIGS[DebateType];
}) {
  const isA = msg.speaker === config.speakerA;
  const color = isA ? config.speakerAColor : config.speakerBColor;
  const name = isA ? config.speakerAName : config.speakerBName;
  const imgSrc = isA
    ? `/politicians/${config.speakerA}/profile.jpg`
    : `/politicians/${config.speakerB}/profile.jpg`;
  const bubbleBg = isA 
    ? `${config.speakerAColor}20` 
    : `${config.speakerBColor}20`;

  // 주제 전환 카드 — 게임스럽게
  if (msg.isTopicChange) {
    return (
      <div className="flex justify-center items-center py-6 px-2">
        <div
          className="w-full rounded-2xl overflow-hidden text-center"
          style={{
            background: 'linear-gradient(135deg, #1a0533 0%, #2d1060 50%, #1a0533 100%)',
            boxShadow: '0 0 40px rgba(139,92,246,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
          }}
        >
          {/* 상단 스트라이프 */}
          <div style={{ height: '3px', background: 'linear-gradient(90deg, transparent, #a855f7, #ec4899, #a855f7, transparent)' }} />

          <div className="px-6 py-5">
            <div
              className="text-xs font-black tracking-[0.3em] mb-2"
              style={{ color: 'rgba(216,180,254,0.7)' }}
            >
              ⚡ TOPIC CHANGE ⚡
            </div>

            <div
              className="text-white font-black text-xl leading-tight mb-1"
              style={{ textShadow: '0 0 20px rgba(216,180,254,0.8)' }}
            >
              {msg.text}
            </div>

            <div
              className="text-xs mt-3 font-semibold tracking-widest"
              style={{ color: 'rgba(196,181,253,0.6)' }}
            >
              — 새 라운드 시작 · 선공 교체 —
            </div>
          </div>

          {/* 하단 스트라이프 */}
          <div style={{ height: '3px', background: 'linear-gradient(90deg, transparent, #ec4899, #a855f7, #ec4899, transparent)' }} />
        </div>

        <style>{`
          @keyframes topicReveal {
            0% { opacity: 0; transform: scale(0.85) translateY(10px); }
            60% { transform: scale(1.03) translateY(-2px); }
            100% { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div
      className={`flex items-end gap-2 ${isA ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* 아바타 */}
      <img
        src={imgSrc}
        alt={name}
        className="w-10 h-10 rounded-full object-cover border flex-shrink-0"
        style={{ borderColor: `${color}60` }}
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />

      {/* 말풍선 */}
      <div className="max-w-[75%]">
        <span
          className={`text-[12px] font-bold block mb-1 flex items-center gap-1 ${isA ? 'justify-end' : 'justify-start'}`}
          style={{ color }}
        >
          {name}
          {isActive && (
            <svg
              width="15" height="15" viewBox="0 0 24 24" fill="currentColor"
              stroke="none"
              style={{ color, filter: `drop-shadow(0 0 4px ${color}99)`, animation: 'speakingPop 0.7s ease-in-out infinite alternate' }}
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          )}
        </span>
        <div
          className="rounded-2xl px-4 py-3 transition-all duration-300"
          style={{
            background: bubbleBg,
            border: `1px solid ${color}25`,
          }}
        >
          <p className="text-gray-800 text-[16px] leading-relaxed" style={{ color: '#1e293b' }}>
            {renderBubbleText(msg.text || '\u00A0')}
            {isActive && (
              <span
                className="inline-block w-0.5 h-4 ml-0.5 align-middle animate-pulse"
                style={{ background: color }}
              />
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── 타이핑 인디케이터 컴포넌트 ──────────────────────────────────────────────────

function TypingIndicator({
  speaker,
  config,
}: {
  speaker: string;
  config: typeof DEBATE_CONFIGS[DebateType];
}) {
  const isA = speaker === config.speakerA;
  const color = isA ? config.speakerAColor : config.speakerBColor;
  const name = isA ? config.speakerAName : config.speakerBName;
  const imgSrc = isA
    ? `/politicians/${config.speakerA}/profile.jpg`
    : `/politicians/${config.speakerB}/profile.jpg`;
  const bubbleBg = isA 
    ? `${config.speakerAColor}26` 
    : `${config.speakerBColor}26`;

  return (
    <div className={`flex items-end gap-2 ${isA ? 'flex-row-reverse' : 'flex-row'}`}>
      <img
        src={imgSrc}
        alt={name}
        className="w-10 h-10 rounded-full object-cover border flex-shrink-0"
        style={{ borderColor: `${color}60` }}
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
      <div className="max-w-[75%]">
        <span
          className={`text-[12px] font-bold block mb-1 ${isA ? 'text-right' : 'text-left'}`}
          style={{ color }}
        >
          {name}
        </span>
        <div
          className="rounded-2xl px-4 py-3"
          style={{ background: bubbleBg, border: `1px solid ${color}25` }}
        >
          <div className="flex gap-1.5 items-center h-5">
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="w-2 h-2 rounded-full animate-bounce"
                style={{ background: `${color}cc`, animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 판정 카드 컴포넌트 ────────────────────────────────────────────────────────

function JudgmentCard({
  judgment,
  oshPct,
  jwoPct,
  config,
}: {
  judgment: Judgment;
  oshPct: number;
  jwoPct: number;
  config: typeof DEBATE_CONFIGS[DebateType];
}) {
  const isAWinner = judgment.winner === config.speakerA;
  const winnerName = isAWinner ? config.speakerAName : config.speakerBName;
  const winnerColor = isAWinner ? config.speakerAColor : config.speakerBColor;
  const colorA = config.speakerAColor as string;
  const colorB = config.speakerBColor as string;

  const scoreItems = [
    { label: '논리력', key: 'logic' as const },
    { label: '구체성', key: 'specificity' as const },
    { label: '설득력', key: 'persuasion' as const },
    { label: '실현가능', key: 'feasibility' as const },
  ];

  return (
    <div
      className="rounded-2xl p-4 border mt-2"
      style={{
        background: 'rgba(0,0,0,0.03)',
        borderColor: `${winnerColor}40`,
      }}
    >
      <div className="text-center mb-4">
        <div className="text-gray-600 text-xs mb-1 flex items-center justify-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>
          AI 판정 결과
        </div>
        <div className="text-xl font-black" style={{ color: winnerColor }}>
          승자: {winnerName}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="inline-block ml-1"><path d="M13 2l3.293 3.293a1 1 0 0 1 .083 1.32l-.83.828a1 1 0 0 1-1.402 0l-4.584-4.584a2 2 0 0 1 2.34-3.157z"/><path d="M2 11a1 1 0 0 1 1-1h3v2H3a1 1 0 0 1-1-1z"/><path d="M21 11a1 1 0 0 0-1-1h-3v2h3a1 1 0 0 0 1-1z"/><path d="M13 20l3-3h-6l3 3z"/></svg>
        </div>
      </div>

      {/* 점수 비율 바 */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1">
          <span style={{ color: colorA }} className="font-bold">
            {config.speakerAName} {oshPct}%
          </span>
          <span style={{ color: colorB }} className="font-bold">
            {jwoPct}% {config.speakerBName}
          </span>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden">
          <div style={{ width: `${oshPct}%`, background: colorA }} />
          <div style={{ width: `${jwoPct}%`, background: colorB }} />
        </div>
      </div>

      {/* 항목별 점수 */}
      <div className="space-y-2 mb-4">
        {scoreItems.map((item) => {
          const oshScore = judgment.scores.ohsehoon[item.key];
          const jwoScore = judgment.scores.jungwono[item.key];
          return (
            <div key={item.key}>
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>{item.label}</span>
                <span>
                  <span style={{ color: colorA }}>{oshScore}</span>
                  {' : '}
                  <span style={{ color: colorB }}>{jwoScore}</span>
                </span>
              </div>
              <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-200">
                <div
                  style={{
                    width: `${(oshScore / (oshScore + jwoScore)) * 100}%`,
                    background: colorA,
                  }}
                />
                <div
                  style={{
                    width: `${(jwoScore / (oshScore + jwoScore)) * 100}%`,
                    background: colorB,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* 총평 */}
      <div
        className="rounded-xl p-3 text-sm text-gray-700 leading-relaxed"
        style={{ background: 'rgba(0,0,0,0.03)' }}
      >
        <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          AI 심판 총평
        </div>
        {judgment.reason}
      </div>
    </div>
  );
}

// ─── 사회자 타이핑 컴포넌트 ────────────────────────────────────────────────────

function ModeratorMessage({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    let i = 0;
    const tick = () => {
      if (i >= text.length) { setDone(true); return; }
      setDisplayed(text.slice(0, i + 1));
      i++;
      setTimeout(tick, 52);
    };
    const start = setTimeout(tick, 120); // 약간 딜레이 후 시작
    return () => clearTimeout(start);
  }, [text]);

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(30,30,60,0.9), rgba(22,33,62,0.95))',
      border: '1px solid rgba(200,210,240,0.15)',
      borderRadius: 14,
      padding: '12px 16px',
      margin: '8px 4px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
    }}>
      <img
        src="/moderator-sonseokhe.jpg"
        alt="사회자 손석희"
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
          border: '2px solid rgba(200,210,240,0.4)',
          boxShadow: '0 0 12px rgba(150,180,255,0.25)',
        }}
      />
      <span style={{ fontSize: 17, color: '#cbd5e1', fontStyle: 'italic', lineHeight: 1.6 }}>
        {displayed}
        {!done && (
          <span
            style={{
              display: 'inline-block',
              width: 2,
              height: 14,
              background: '#94a3b8',
              marginLeft: 2,
              verticalAlign: 'middle',
              animation: 'cursorblink 0.7s steps(1) infinite',
            }}
          />
        )}
      </span>
      <style>{`@keyframes cursorblink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  );
}
