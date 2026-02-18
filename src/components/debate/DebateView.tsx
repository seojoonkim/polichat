import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';

// ─── 상수 ───────────────────────────────────────────────────────────────────

const TOPIC_ICONS: Record<string, React.ReactNode> = {
  redevelopment: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="10" width="7" height="11" rx="1"/><rect x="14" y="4" width="7" height="17" rx="1"/><path d="M17.5 1v3M15.5 2h4M6.5 7v3M5 8.5h3"/></svg>,
  gentrification: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21V9l6-5 6 5v12H3z"/><path d="M9 21v-6h0"/><path d="M18 9l4 4M22 9l-4 4"/><path d="M18 3h4v4"/></svg>,
  housing: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21V9l9-7 9 7v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-6h6v6"/></svg>,
  welfare: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7 7-7z"/><path d="M12 21C7 17 4 12 8 8"/></svg>,
  gap: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18"/><circle cx="12" cy="12" r="1"/><path d="M4 8h4l1.5 3L8 14H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><path d="M20 8h-4l-1.5 3 1.5 3h4a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1z"/></svg>,
  transport: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="16" rx="3"/><path d="M4 11h16"/><path d="M12 3v16"/><circle cx="7.5" cy="15.5" r="1"/><circle cx="16.5" cy="15.5" r="1"/><path d="M7 19l-2 2M17 19l2 2"/></svg>,
  environment: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c-4-3-8-7.5-8-12a8 8 0 0 1 16 0c0 4.5-4 9-8 12z"/><path d="M12 10c-2 0-3 1.5-3 3s2 4 3 5c1-1 3-2.5 3-5s-1-3-3-3z"/></svg>,
  youth: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="8" r="4"/><path d="M10 12c-4 0-7 2-7 5v2h14v-2c0-3-3-5-7-5z"/><path d="M19 2l1 2.5L22 6l-2 1.5L19 10l-1-2.5L16 6l2-1.5z"/></svg>,
  admin: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  branding: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c-1-4-1-8 0-12"/><path d="M10 22h4"/><ellipse cx="12" cy="8" rx="3" ry="5"/><path d="M9.5 3C8 4 7 6 7 8M14.5 3c1.5 1 2.5 3 2.5 5"/><circle cx="12" cy="2" r="1"/></svg>,
};

const TOPICS = [
  { id: 'redevelopment', label: '재개발 vs 도시재생' },
  { id: 'gentrification', label: '젠트리피케이션 대응' },
  { id: 'housing', label: '주거 정책 방향' },
  { id: 'welfare', label: '복지: 선별 vs 보편' },
  { id: 'gap', label: '강남북 격차 해소' },
  { id: 'transport', label: '교통 인프라' },
  { id: 'environment', label: '환경·탄소중립' },
  { id: 'youth', label: '청년 정책' },
  { id: 'admin', label: '행정 혁신' },
  { id: 'branding', label: '도시 브랜딩' },
];

const OSH_COLOR = '#C9151E';
const JWO_COLOR = '#004EA2';

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface DebateMessage {
  speaker: 'ohsehoon' | 'jungwono';
  text: string;
  timestamp: number;
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

function splitIntoBubbles(text: string): string[] {
  const sentences = text.split(/(?<=[.!?。])\s+/).filter(s => s.trim().length > 5);
  if (sentences.length <= 1) return [text];

  const bubbles: string[] = [];
  let current = '';
  for (const s of sentences) {
    if (current.length > 0 && current.length + s.length > 60) {
      bubbles.push(current.trim());
      current = s;
    } else {
      current += (current ? ' ' : '') + s;
    }
  }
  if (current) bubbles.push(current.trim());
  return bubbles.slice(0, 3);
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default function DebateView() {
  const navigate = useNavigate();

  // 설정 상태
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  // 토론 상태
  const [phase, setPhase] = useState<Phase>('setup');
  const [messages, setMessages] = useState<DebateMessage[]>([]);
  const [currentSpeaker, setCurrentSpeaker] = useState<'ohsehoon' | 'jungwono' | null>(null);
  const [currentText, setCurrentText] = useState('');
  const [round, setRound] = useState(0); // 0~9 (총 10라운드)
  const [judgment, setJudgment] = useState<Judgment | null>(null);

  // 실행 취소용 ref
  const abortRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // ─── 캐시 조회 ─────────────────────────────────────────────────────────────

  const fetchCache = async (topic: string): Promise<{ messages: DebateMessage[]; judgment: Judgment | null } | null> => {
    try {
      const res = await fetch(`/api/debate-cache?topic=${encodeURIComponent(topic)}&style=free`);
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

  const replayDebate = async (cachedMessages: DebateMessage[], cachedJudgment?: Judgment | null) => {
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
        const delay = ['.', '!', '?', ','].includes(char) ? 80 : 25 + Math.random() * 15;
        await sleep(delay);
      }

      if (abortRef.current) break;

      // 완료된 메시지를 목록에 추가
      setMessages((prev) => [...prev, { speaker: msg.speaker, text: msg.text, timestamp: msg.timestamp }]);
      setCurrentText('');
      scrollToBottom();
      await sleep(900);
    }

    if (!abortRef.current) {
      setCurrentSpeaker(null);
      if (cachedJudgment) {
        setJudgment(cachedJudgment);
        setPhase('result');
      } else {
        await requestJudgment(cachedMessages);
      }
    }
  };

  // ─── SSE 스트리밍으로 1라운드 생성 ────────────────────────────────────────

  const streamRound = async (
    speaker: 'ohsehoon' | 'jungwono',
    topic: string,
    opponentLastMessage: string
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      let fullText = '';

      fetch('/api/debate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, speaker, opponentLastMessage }),
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

  const runLiveDebate = async (topic: string) => {
    abortRef.current = false;
    setMessages([]);
    setCurrentText('');

    const allMessages: DebateMessage[] = [];
    let lastText = '';

    for (let i = 0; i < 10; i++) {
      if (abortRef.current) break;

      const speaker: 'ohsehoon' | 'jungwono' = i % 2 === 0 ? 'ohsehoon' : 'jungwono';
      setRound(i);
      setCurrentSpeaker(speaker);
      setCurrentText('');

      await sleep(500);

      try {
        const text = await streamRound(speaker, topic, lastText);
        if (abortRef.current) break;

        const bubbles = splitIntoBubbles(text);

        for (const bubbleText of bubbles) {
          if (abortRef.current) break;
          setCurrentSpeaker(speaker);
          setCurrentText('');

          let displayed = '';
          for (const char of bubbleText) {
            if (abortRef.current) break;
            displayed += char;
            setCurrentText(displayed);
            await sleep(120);
          }

          if (abortRef.current) break;

          const msg: DebateMessage = { speaker, text: bubbleText, timestamp: Date.now() };
          allMessages.push(msg);
          setMessages((prev) => [...prev, msg]);
          setCurrentText('');
          scrollToBottom();

          await sleep(400);
        }

        lastText = text;

        await sleep(400);
      } catch (e) {
        console.error('[debate] Stream error:', e);
        break;
      }
    }

    setCurrentSpeaker(null);

    if (!abortRef.current && allMessages.length > 0) {
      // 판정 먼저 받고 캐시에 함께 저장
      const judgeResult = await requestJudgment(allMessages);

      // 캐시 저장 (판정 포함, 비동기, 실패해도 무시)
      fetch('/api/debate-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, style: 'free', messages: allMessages, judgment: judgeResult }),
      }).catch(() => {});
    }
  };

  // ─── 판정 요청 ─────────────────────────────────────────────────────────────

  const requestJudgment = async (msgs: DebateMessage[]): Promise<Judgment | null> => {
    setPhase('judging');
    try {
      const topicLabel =
        TOPICS.find((t) => t.id === selectedTopic)?.label || selectedTopic || '';
      const res = await fetch('/api/debate-judge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topicLabel, messages: msgs }),
      });
      const data = await res.json();
      setJudgment(data);
      return data as Judgment;
    } catch (e) {
      console.error('[debate-judge] Error:', e);
      return null;
    } finally {
      setPhase('result');
    }
  };

  // ─── 토론 시작 ─────────────────────────────────────────────────────────────

  const startDebate = async () => {
    if (!selectedTopic) return;

    setPhase('running');
    setMessages([]);
    setCurrentText('');
    setRound(0);
    setJudgment(null);

    const topicLabel =
      TOPICS.find((t) => t.id === selectedTopic)?.label || selectedTopic;

    // 캐시 확인
    const cached = await fetchCache(topicLabel);
    if (cached) {
      await replayDebate(cached.messages, cached.judgment);
    } else {
      await runLiveDebate(topicLabel);
    }
  };

  // ─── 토론 종료 (강제) ──────────────────────────────────────────────────────

  const endDebate = async () => {
    abortRef.current = true;
    setCurrentSpeaker(null);
    setCurrentText('');
    if (messages.length > 0) {
      await requestJudgment(messages);
    } else {
      setPhase('setup');
    }
  };

  // ─── UI: 설정 화면 ─────────────────────────────────────────────────────────

  if (phase === 'setup') {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col overflow-y-auto" style={{ height: '100svh' }}>
        {/* 헤더 */}
        <div
          className="flex items-center gap-3 px-4 pb-4"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}
        >
          <button
            onClick={() => navigate('/')}
            className="text-white/60 hover:text-white transition-colors"
          >
            ← 뒤로
          </button>
          <h1 className="text-white font-bold text-lg">🥊 AI 토론 배틀</h1>
        </div>

        {/* 후보 미리보기 */}
        <div className="flex items-center justify-center gap-4 px-4 mb-3">
          <div className="flex flex-col items-center gap-0.5">
            <img
              src="/politicians/ohsehoon/profile.jpg"
              alt="오세훈"
              className="w-11 h-11 rounded-full object-cover border-2"
              style={{ borderColor: OSH_COLOR }}
            />
            <span className="text-white text-[11px] font-bold">오세훈</span>
          </div>
          <div className="text-yellow-400 font-black text-xl">VS</div>
          <div className="flex flex-col items-center gap-0.5">
            <img
              src="/politicians/jungwono/profile.jpg"
              alt="정원오"
              className="w-11 h-11 rounded-full object-cover border-2"
              style={{ borderColor: JWO_COLOR }}
            />
            <span className="text-white text-[11px] font-bold">정원오</span>
            <span className="text-white/40 text-[9px]">더불어민주</span>
          </div>
        </div>

        <div className="px-4 mb-2">
          <p className="text-white/70 text-sm font-semibold">📌 토론 주제를 선택하세요</p>
        </div>

        {/* 주제 그리드 */}
        <div className="px-4 grid grid-cols-2 gap-2">
          {TOPICS.map((topic) => (
            <button
              key={topic.id}
              onClick={() => setSelectedTopic(topic.id)}
              className="relative rounded-xl p-2.5 text-left transition-all duration-200 border flex items-center gap-2"
              style={{
                background:
                  selectedTopic === topic.id
                    ? 'linear-gradient(135deg, rgba(201,21,30,0.3), rgba(0,78,162,0.3))'
                    : 'rgba(255,255,255,0.05)',
                borderColor:
                  selectedTopic === topic.id ? 'rgba(255,215,0,0.6)' : 'rgba(255,255,255,0.1)',
                color: selectedTopic === topic.id ? 'rgba(255,215,0,0.9)' : 'rgba(255,255,255,0.5)',
              }}
            >
              <span className="flex-shrink-0">{TOPIC_ICONS[topic.id]}</span>
              <span className="text-white text-[15px] font-semibold leading-tight">{topic.label}</span>
              {selectedTopic === topic.id && (
                <span className="absolute top-1.5 right-1.5 text-yellow-400 text-xs">✓</span>
              )}
            </button>
          ))}
        </div>

        {/* 시작 버튼 */}
        <div className="p-4 mt-4">
          <button
            onClick={startDebate}
            disabled={!selectedTopic}
            className="w-full py-4 rounded-2xl font-bold text-white text-lg transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: selectedTopic
                ? 'linear-gradient(135deg, #C9151E, #8B0A10)'
                : 'rgba(255,255,255,0.1)',
            }}
          >
            🥊 자유 토론 시작!
          </button>
        </div>
      </div>
    );
  }

  // ─── UI: 토론 진행 + 결과 화면 ────────────────────────────────────────────

  const topicLabel = TOPICS.find((t) => t.id === selectedTopic)?.label || selectedTopic || '';
  const oshScore = judgment?.scores.ohsehoon.total ?? 0;
  const jwoScore = judgment?.scores.jungwono.total ?? 0;
  const totalScore = oshScore + jwoScore || 100;
  const oshPct = Math.round((oshScore / totalScore) * 100);
  const jwoPct = 100 - oshPct;

  return (
    <div
      className="bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col overflow-hidden"
      style={{ height: '100svh' }}
    >
      {/* 헤더 */}
      <div
        className="shrink-0 flex items-center justify-between px-4 pb-3 border-b"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)', borderColor: 'rgba(255,255,255,0.1)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-white font-bold text-sm truncate max-w-[180px]">
            🥊 {topicLabel}
          </span>
        </div>
        {phase === 'running' && (
          <div className="flex items-center gap-2">
            <span className="text-white/50 text-xs">
              {round + 1} / 10
            </span>
            <button
              onClick={endDebate}
              className="text-xs px-3 py-1 rounded-full border text-white/70 hover:text-white transition-colors"
              style={{ borderColor: 'rgba(255,255,255,0.2)' }}
            >
              종료
            </button>
          </div>
        )}
        {(phase === 'judging' || phase === 'result') && (
          <span className="text-yellow-400 text-xs font-bold">
            {phase === 'judging' ? '⏳ 판정 중...' : '🏆 결과'}
          </span>
        )}
      </div>

      {/* 진행률 바 */}
      {phase === 'running' && (
        <div className="h-1 bg-white/10">
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${((round + 1) / 10) * 100}%`,
              background: 'linear-gradient(90deg, #C9151E, #004EA2)',
            }}
          />
        </div>
      )}

      {/* 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* 완료된 발언들 */}
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}

        {/* 현재 타이핑 중인 발언 */}
        {phase === 'running' && currentSpeaker && (
          <MessageBubble
            msg={{ speaker: currentSpeaker, text: currentText, timestamp: Date.now() }}
            isActive
          />
        )}

        {/* 판정 중 */}
        {phase === 'judging' && (
          <div className="text-center py-8">
            <div className="text-white/60 text-sm animate-pulse">⚖️ AI 심판이 판정 중입니다...</div>
          </div>
        )}

        {/* 판정 결과 */}
        {phase === 'result' && judgment && (
          <JudgmentCard judgment={judgment} oshPct={oshPct} jwoPct={jwoPct} />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 하단 액션 */}
      {phase === 'result' && (
        <div className="p-4 flex gap-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
          <button
            onClick={() => {
              setPhase('setup');
              setMessages([]);
              setCurrentText('');
              setJudgment(null);
              setRound(0);
            }}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-white border transition-colors hover:bg-white/10"
            style={{ borderColor: 'rgba(255,255,255,0.2)' }}
          >
            🔄 다시 토론
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-white border transition-colors hover:bg-white/10"
            style={{ borderColor: 'rgba(255,255,255,0.2)' }}
          >
            🏠 홈으로
          </button>
        </div>
      )}
    </div>
  );
}

// ─── 말풍선 컴포넌트 ──────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  isActive = false,
}: {
  msg: DebateMessage;
  isActive?: boolean;
}) {
  const isOsh = msg.speaker === 'ohsehoon';
  const color = isOsh ? OSH_COLOR : JWO_COLOR;
  const name = isOsh ? '오세훈 시장' : '정원오';
  const imgSrc = isOsh
    ? '/politicians/ohsehoon/profile.jpg'
    : '/politicians/jungwono/profile.jpg';
  const bubbleBg = isOsh ? 'rgba(229,62,62,0.25)' : 'rgba(0,78,162,0.25)';

  return (
    <div
      className={`flex items-end gap-2 ${isOsh ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* 아바타 */}
      <img
        src={imgSrc}
        alt={name}
        className="w-8 h-8 rounded-full object-cover border flex-shrink-0"
        style={{ borderColor: `${color}60` }}
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />

      {/* 말풍선 */}
      <div className="max-w-[75%]">
        <span
          className={`text-[11px] font-bold block mb-1 ${isOsh ? 'text-right' : 'text-left'}`}
          style={{ color }}
        >
          {name}
          {isActive && (
            <span className="text-white/40 animate-pulse ml-1">💬</span>
          )}
        </span>
        <div
          className="rounded-2xl px-4 py-3 transition-all duration-300"
          style={{
            background: bubbleBg,
            boxShadow: isActive ? `0 0 16px ${color}30` : 'none',
          }}
        >
          <p className="text-white/90 text-[15px] leading-relaxed">
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

// ─── 판정 카드 컴포넌트 ────────────────────────────────────────────────────────

function JudgmentCard({
  judgment,
  oshPct,
  jwoPct,
}: {
  judgment: Judgment;
  oshPct: number;
  jwoPct: number;
}) {
  const isOshWinner = judgment.winner === 'ohsehoon';
  const winnerName = isOshWinner ? '오세훈' : '정원오';
  const winnerColor = isOshWinner ? OSH_COLOR : JWO_COLOR;

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
        background: 'rgba(255,255,255,0.05)',
        borderColor: `${winnerColor}40`,
      }}
    >
      <div className="text-center mb-4">
        <div className="text-white/60 text-xs mb-1">🏆 AI 판정 결과</div>
        <div className="text-xl font-black" style={{ color: winnerColor }}>
          승자: {winnerName} 👑
        </div>
      </div>

      {/* 점수 비율 바 */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1">
          <span style={{ color: OSH_COLOR }} className="font-bold">
            오세훈 {oshPct}%
          </span>
          <span style={{ color: JWO_COLOR }} className="font-bold">
            {jwoPct}% 정원오
          </span>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden">
          <div style={{ width: `${oshPct}%`, background: OSH_COLOR }} />
          <div style={{ width: `${jwoPct}%`, background: JWO_COLOR }} />
        </div>
      </div>

      {/* 항목별 점수 */}
      <div className="space-y-2 mb-4">
        {scoreItems.map((item) => {
          const oshScore = judgment.scores.ohsehoon[item.key];
          const jwoScore = judgment.scores.jungwono[item.key];
          return (
            <div key={item.key}>
              <div className="flex justify-between text-xs text-white/60 mb-1">
                <span>{item.label}</span>
                <span>
                  <span style={{ color: OSH_COLOR }}>{oshScore}</span>
                  {' : '}
                  <span style={{ color: JWO_COLOR }}>{jwoScore}</span>
                </span>
              </div>
              <div className="flex h-1.5 rounded-full overflow-hidden bg-white/10">
                <div
                  style={{
                    width: `${(oshScore / (oshScore + jwoScore)) * 100}%`,
                    background: OSH_COLOR,
                  }}
                />
                <div
                  style={{
                    width: `${(jwoScore / (oshScore + jwoScore)) * 100}%`,
                    background: JWO_COLOR,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* 총평 */}
      <div
        className="rounded-xl p-3 text-sm text-white/80 leading-relaxed"
        style={{ background: 'rgba(255,255,255,0.05)' }}
      >
        <div className="text-xs text-white/40 mb-1">💬 AI 심판 총평</div>
        {judgment.reason}
      </div>
    </div>
  );
}
