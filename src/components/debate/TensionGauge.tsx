import { useMemo } from 'react';

interface TensionGaugeProps {
  messages: { speaker: string; text: string }[];
  round: number;
  maxRound: number;
  timeLeft?: number;
  totalTime?: number;
}

const TENSION_KEYWORDS = {
  attack: ['거짓', '실패', '황당', '부끄럽', '웃기', '말이 됩니까', '사기', '기만', '위선', '배신', '음모', '폭탄', '거짓말', '뻔뻔'],
  emotional: ['분노', '충격', '경악', '한심', '치욕', '눈물', '울분', '부끄럽', '소름'],
  data_attack: ['반박', '팩트', '근거', '수치', '통계', '실제로는', '확인해보면', '데이터'],
};

export function calcTension(messages: { speaker: string; text: string }[], round: number, maxRound: number): number {
  const roundTension = Math.min(40, (round / maxRound) * 40);
  const recent = messages.slice(-6);
  let keywordScore = 0;
  for (const msg of recent) {
    for (const kw of TENSION_KEYWORDS.attack) {
      if (msg.text.includes(kw)) keywordScore += 5;
    }
    for (const kw of TENSION_KEYWORDS.emotional) {
      if (msg.text.includes(kw)) keywordScore += 3;
    }
    for (const kw of TENSION_KEYWORDS.data_attack) {
      if (msg.text.includes(kw)) keywordScore += 2;
    }
  }
  keywordScore = Math.min(40, keywordScore);
  let crossAttacks = 0;
  for (let i = 1; i < recent.length; i++) {
    if (recent[i]?.speaker !== recent[i - 1]?.speaker) crossAttacks++;
  }
  const crossScore = Math.min(20, crossAttacks * 4);
  return Math.min(100, Math.round(roundTension + keywordScore + crossScore));
}

const PHASES = [
  { label: '탐색', color: '#D97706', bg: '#FEF3C7', border: '#FCD34D' },
  { label: '격돌', color: '#EA580C', bg: '#FFEDD5', border: '#FB923C' },
  { label: '최고조', color: '#DC2626', bg: '#FEE2E2', border: '#F87171' },
];

export default function TensionGauge({
  messages,
  round,
  maxRound,
  timeLeft = 300,
  totalTime = 300,
}: TensionGaugeProps) {
  const tension = useMemo(() => calcTension(messages, round, maxRound), [messages, round, maxRound]);

  // 시간 기반 단계 (정확) — 3등분
  const elapsed = totalTime - timeLeft;
  const timePhase = elapsed < totalTime / 3 ? 0 : elapsed < (totalTime * 2) / 3 ? 1 : 2;
  const progressPct = Math.min(100, (elapsed / totalTime) * 100); // 0~100 경과 비율

  const current = PHASES[timePhase] ?? PHASES[0]!;

  // 각 세그먼트 fill 계산 (세그먼트 하나가 0~33.3% 영역)
  const segFill = (segIdx: number): number => {
    const segStart = (segIdx / 3) * 100;
    const segEnd = ((segIdx + 1) / 3) * 100;
    if (progressPct <= segStart) return 0;
    if (progressPct >= segEnd) return 100;
    return ((progressPct - segStart) / (segEnd - segStart)) * 100;
  };

  return (
    <div style={{ width: '100%', padding: '5px 16px 0' }}>
      {/* 라벨 행 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 13,
            fontWeight: 700,
            color: current.color,
            background: current.bg,
            border: `1px solid ${current.border}`,
            borderRadius: 999,
            padding: '3px 9px',
          }}
        >
          {timePhase === 0 ? '💬' : timePhase === 1 ? '⚡' : '🔥'}
          {current.label}
          <span style={{ opacity: 0.7 }}>·</span>
          <span style={{ fontWeight: 600 }}>라운드 {round + 1}</span>
        </span>
        <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>긴장도 {tension}%</span>
      </div>

      {/* 통합 3단계 프로그레스바 */}
      <div style={{ display: 'flex', height: 10, borderRadius: 8, overflow: 'hidden', gap: 2, position: 'relative' }}>
        {PHASES.map((ph, idx) => {
          const fill = segFill(idx);
          const isActive = idx === timePhase;
          return (
            <div
              key={ph.label}
              style={{
                flex: 1,
                position: 'relative',
                background: 'rgba(0,0,0,0.08)',
                borderRadius: idx === 0 ? '6px 0 0 6px' : idx === 2 ? '0 6px 6px 0' : 0,
                overflow: 'hidden',
              }}
            >
              {/* 채워진 부분 */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  height: '100%',
                  width: `${fill}%`,
                  background: ph.color,
                  opacity: isActive ? 1 : 0.7,
                  transition: 'width 1s linear',
                }}
              />
              {/* 세그먼트 라벨 (완료된 구간만 표시) */}
              {fill >= 100 && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.9)',
                    pointerEvents: 'none',
                  }}
                >
                  {ph.label}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
