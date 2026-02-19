import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';

// ─── 타입 ────────────────────────────────────────────────────────────────────

export type DebateType = 'seoul' | 'national';

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
}

interface Judgment {
  winner: 'ohsehoon' | 'jungwono';
  scores: {
    ohsehoon: { logic: number; specificity: number; persuasion: number; feasibility: number; total: number };
    jungwono: { logic: number; specificity: number; persuasion: number; feasibility: number; total: number };
  };
  reason: string;
}

type Phase = 'setup' | 'running' | 'judging' | 'result';

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default function DebateView({ debateType = 'seoul' }: DebateViewProps) {
  const navigate = useNavigate();
  const config = DEBATE_CONFIGS[debateType];

  // 설정 상태
  const [selectedTopic, setSelectedTopic] = useState<string>(config.topics[1]?.id || 'free');
  const [selectedStyle, setSelectedStyle] = useState<'policy' | 'emotional' | 'consensus'>('policy');

  // 토론 상태
  const [phase, setPhase] = useState<Phase>('setup');
  const [messages, setMessages] = useState<DebateMessage[]>([]);
  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);
  const [currentText, setCurrentText] = useState('');
  const [_round, setRound] = useState(0); // 0~29 (최대 30라운드, 타이머로 제한)
  const [judgment, setJudgment] = useState<Judgment | null>(null);
  const [timeLeft, setTimeLeft] = useState(360); // 6분 = 360초

  // 실행 취소용 ref
  const abortRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const freeTopicRef = useRef<string>('');

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // 완료된 말풍선 추가 시 → 부드럽게 스크롤
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom('smooth');
    }
  }, [messages, scrollToBottom]);

  // 타이핑 중 글자 추가 시 → 즉시 스크롤 (말풍선 높이 변화 따라가기)
  useEffect(() => {
    if (currentText) {
      scrollToBottom('instant');
    }
  }, [currentText, scrollToBottom]);

  // ─── 타이머 ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'running') {
      setTimeLeft(180);
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          abortRef.current = true;
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase]);

  // 타이머가 0이 되면 토론 종료
  useEffect(() => {
    if (phase === 'running' && timeLeft === 0) {
      endDebate();
    }
  }, [timeLeft, phase]);

  // 자유토론: 240초, 120초에서 랜덤 주제 전환
  useEffect(() => {
    if (selectedTopic !== 'free' || phase !== 'running') return;
    if (timeLeft !== 120 && timeLeft !== 60) return;

    const realTopics = config.topics.filter(t => t.id !== 'free');
    const next = realTopics[Math.floor(Math.random() * realTopics.length)];
    if (!next) return;
    
    freeTopicRef.current = next.label;

    setMessages(prev => [...prev, {
      speaker: config.speakerA,
      text: `주제 전환! 새 주제: "${next.label}"`,
      timestamp: Date.now(),
      isTopicChange: true,
    }]);
  }, [timeLeft, selectedTopic, phase, config]);

  // ─── 캐시 조회 ─────────────────────────────────────────────────────────────

  const fetchCache = async (topic: string, style: string): Promise<{ messages: DebateMessage[]; judgment: Judgment | null } | null> => {
    try {
      const res = await fetch(
        `/api/debate-cache?topic=${encodeURIComponent(topic)}&style=${encodeURIComponent(style)}&debateType=${debateType}`
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
        const delay = ['.', '!', '?', ','].includes(char) ? 110 : 55;
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
      // 판정 없이 종료 — setup으로 복귀
      setPhase('setup');
    }
  };

  // ─── SSE 스트리밍으로 1라운드 생성 ────────────────────────────────────────

  const streamRound = async (
    speaker: string,
    topic: string,
    opponentLastMessage: string,
    style: string,
    onToken?: (text: string) => Promise<void> | void
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      let fullText = '';

      fetch('/api/debate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, speaker, opponentLastMessage, style, debateType }),
      })
        .then((res) => {
          const reader = res.body!.getReader();
          const decoder = new TextDecoder();
          let buf = '';

          const pump = async (): Promise<void> => {
            const { done, value } = await reader.read();
            if (done) {
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
                  reject(new Error(json.error));
                  return;
                }
                if (json.text) {
                  fullText += json.text;
                  if (abortRef.current) return;
                  await onToken?.(json.text);
                }
              } catch {
                // skip
              }
            }

            return pump();
          };

          pump().catch(reject);
        })
        .catch(reject);
    });
  };

  // ─── 실시간 생성 모드 ──────────────────────────────────────────────────────

  const runLiveDebate = async (initialTopic: string, style: string) => {
    abortRef.current = false;
    setMessages([]);
    setCurrentText('');

    const allMessages: DebateMessage[] = [];
    let lastText = '';

    for (let i = 0; i < 30; i++) {
      if (abortRef.current) break;

      const speaker = i % 2 === 0 ? config.speakerA : config.speakerB;
      setRound(i);
      setCurrentSpeaker(speaker);
      setCurrentText('');

      // sleep(500) 제거 - 스트리밍이 시작되면 바로 표시됨

      try {
        const currentTopic = selectedTopic === 'free' ? freeTopicRef.current : initialTopic;
        
        let streamedText = '';
        const text = await streamRound(speaker, currentTopic, lastText, style, async (chunk) => {
          if (abortRef.current) return;
          // 글자 단위로 딜레이를 주어 절반 속도로 표시
          for (const char of chunk) {
            if (abortRef.current) return;
            streamedText += char;
            setCurrentText(streamedText);
            await sleep(55); // 글자당 ~55ms (자연스러운 타이핑 속도)
          }
        });
        
        if (abortRef.current) break;

        // 스트리밍 완료 → 전체 텍스트를 하나의 말풍선으로 추가 (분리 X)
        setCurrentText('');
        setCurrentSpeaker(null);

        if (text.trim()) {
          const msg: DebateMessage = { speaker, text: text.trim(), timestamp: Date.now() };
          allMessages.push(msg);
          setMessages((prev) => [...prev, msg]);
        }

        scrollToBottom();
        lastText = text;
        
        await sleep(900); // 다음 화자 전 충분한 pause
      } catch (e) {
        console.error('[debate] Stream error:', e);
        break;
      }
    }

    setCurrentSpeaker(null);

    if (!abortRef.current && allMessages.length > 0) {
      // 캐시 저장 (판정 없이, 비동기, 실패해도 무시)
      fetch('/api/debate-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: initialTopic, style, messages: allMessages, judgment: null }),
      }).catch(() => {});
    }
  };

  // ─── 판정 요청 ─────────────────────────────────────────────────────────────

  // requestJudgment 제거됨 — 판정 기능 비활성화

  // ─── 토론 시작 ─────────────────────────────────────────────────────────────

  const startDebate = async () => {
    let topicLabel: string;
    if (selectedTopic === 'free') {
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

    setPhase('running');
    setMessages([]);
    setCurrentText('');
    setCurrentSpeaker('ohsehoon'); // 첫 발화자 미리 설정 → 빈 화면 방지
    setRound(0);
    setJudgment(null);
    setTimeLeft(180);

    // 캐시 확인
    const cached = await fetchCache(topicLabel, selectedStyle);
    if (cached) {
      await replayDebate(cached.messages, cached.judgment);
    } else {
      await runLiveDebate(topicLabel, selectedStyle);
    }
  };

  // ─── 토론 종료 (강제) ──────────────────────────────────────────────────────

  const endDebate = () => {
    abortRef.current = true;
    setCurrentSpeaker(null);
    setCurrentText('');
    setMessages([]);
    setJudgment(null);
    setRound(0);
    setTimeLeft(180);
    setPhase('setup');
  };

  // ─── UI: 설정 화면 ─────────────────────────────────────────────────────────

  if (phase === 'setup') {
    return (
      <div className="app-bg flex flex-col overflow-y-auto" style={{ minHeight: '100svh', maxWidth: '700px', margin: '0 auto', width: '100%' }}>
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
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'rgba(255,255,255,0.92)', color: config.speakerAColor, border: `1px solid ${config.speakerAColor}80` }}>{debateType === 'seoul' ? '국민의힘' : '더불어민주당'}</span>
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
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'rgba(255,255,255,0.92)', color: config.speakerBColor, border: `1px solid ${config.speakerBColor}80` }}>{debateType === 'seoul' ? '더불어민주당' : '국민의힘'}</span>
          </div>
        </div>

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
                  <span className="text-gray-500 text-[10px]">1분마다 전환</span>
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

        {/* 토론 방식 선택 */}
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

        {/* 시작 버튼 */}
        <div className="p-4">
          <button
            onClick={startDebate}
            disabled={!selectedTopic || !selectedStyle}
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

  const topicLabel = selectedTopic === 'free'
    ? (freeTopicRef.current || '자유토론')
    : (config.topics.find(t => t.id === selectedTopic)?.label || selectedTopic || '');
  const oshScore = judgment?.scores.ohsehoon?.total ?? 0;
  const jwoScore = judgment?.scores.jungwono?.total ?? 0;
  const totalScore = oshScore + jwoScore || 100;
  const oshPct = Math.round((oshScore / totalScore) * 100);
  const jwoPct = 100 - oshPct;

  return (
    <div
      className="app-bg fixed top-0 left-0 right-0 flex flex-col overflow-hidden"
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
        {phase === 'running' && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-gray-200 rounded-full px-3 py-1">
              {/* 타이머 SVG */}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600">
                <circle cx="12" cy="13" r="8"/>
                <path d="M12 9v4l2.5 2.5"/>
                <path d="M9 3h6"/>
                <path d="M12 3v2"/>
              </svg>
              <span className="text-gray-800 font-bold text-base font-mono tracking-wide">
                {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
              </span>
            </div>
            <button
              onClick={endDebate}
              className="text-xs px-3 py-1 rounded-full border text-gray-600 hover:text-gray-800 transition-colors"
              style={{ borderColor: 'rgba(0,0,0,0.1)' }}
            >
              종료
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
          <style>{`
            @keyframes timerWobble {
              0%, 100% { transform: rotate(0deg); }
              25% { transform: rotate(-22deg); }
              75% { transform: rotate(22deg); }
            }
            .timer-wobble { animation: timerWobble 0.45s ease-in-out infinite; }
          `}</style>
          <div className="relative bg-gray-200 flex justify-end overflow-visible" style={{ height: '3px' }}>
            <div
              className="h-full transition-all duration-1000 relative overflow-visible"
              style={{
                width: `${(timeLeft / 180) * 100}%`,
                background: 'linear-gradient(270deg, #A78BFA, #7C3AED)',
              }}
            >
              {/* 아이콘: 바의 왼쪽 끝(줄어드는 쪽)에 고정 */}
              <div
                className="absolute overflow-visible pointer-events-none"
                style={{ left: '-11px', top: '50%', transform: 'translateY(-50%)' }}
              >
                <div className="timer-wobble" style={{ background: 'var(--pc-bg, #F6F6FA)', borderRadius: '50%', padding: '1px', lineHeight: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="13" r="8"/>
                    <path d="M12 9v4l2.5 2.5"/>
                    <path d="M9 3h6"/>
                    <path d="M12 3v2"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* 완료된 발언들 */}
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} config={config} />
        ))}

        {/* 현재 발화자 — 대기 중(로딩) 또는 타이핑 중 */}
        {phase === 'running' && currentSpeaker && (
          currentText ? (
            <MessageBubble
              msg={{ speaker: currentSpeaker, text: currentText, timestamp: Date.now() }}
              isActive
              config={config}
            />
          ) : (
            <TypingIndicator speaker={currentSpeaker} config={config} />
          )
        )}

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

        <div ref={messagesEndRef} />
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
              setTimeLeft(180);
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

      {/* 면책 문구 */}
      <div className="text-center px-3 py-1.5 border-t" style={{ borderColor: 'rgba(0,0,0,0.06)', background: 'rgba(0,0,0,0.02)' }}>
        <p className="text-[10px] text-gray-400 leading-relaxed">
          이 서비스는 AI가 생성한 가상의 시뮬레이션으로, 실제 후보자 발언과 무관하며 선거운동 목적으로 제작되지 않았습니다.
          문제 제기 시 즉시 서비스를 중단합니다.
        </p>
      </div>
    </div>
  );
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

  // 주제 변경 메시지인 경우
  if (msg.isTopicChange) {
    return (
      <div className="flex justify-center items-center py-4">
        <div
          className="rounded-2xl px-6 py-3 text-center"
          style={{
            background: 'rgba(167, 139, 250, 0.1)',
            borderLeft: '3px solid rgba(167, 139, 250, 0.4)',
          }}
        >
          <p className="text-gray-800 text-sm leading-relaxed">{msg.text}</p>
        </div>
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
          <p className="text-gray-800 text-[15px] leading-relaxed" style={{ color: '#1e293b' }}>
            {msg.text || '\u00A0'}
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
