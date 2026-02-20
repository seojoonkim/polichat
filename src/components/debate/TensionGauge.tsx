import { useMemo } from 'react';

interface TensionGaugeProps {
  messages: { speaker: string; text: string }[];
  round: number;
  maxRound: number;
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

export default function TensionGauge({ messages, round, maxRound }: TensionGaugeProps) {
  const tension = useMemo(() => calcTension(messages, round, maxRound), [messages, round, maxRound]);

  const phase = tension < 33 ? 0 : tension < 66 ? 1 : 2;
  const emoji = phase === 0 ? '💬' : phase === 1 ? '⚡' : '🔥';
  const labels = ['탐색', '격돌', '최고조'];
  const colors = ['#D97706', '#EA580C', '#DC2626'];

  return (
    <div style={{ width: '100%', padding: '6px 16px 2px', marginBottom: 4 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 6,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            fontWeight: 700,
            color: colors[phase],
            background: `${colors[phase]}12`,
            border: `1px solid ${colors[phase]}35`,
            borderRadius: 999,
            padding: '4px 10px',
          }}
        >
          <span style={{ fontSize: 12 }}>{emoji}</span>
          {labels[phase]}
          <span style={{ opacity: 0.85 }}>
            ·
          </span>
          <span style={{ fontWeight: 600 }}>라운드 {round + 1}</span>
        </span>

        <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>
          긴장도 {tension}%
        </span>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        {labels.map((label, idx) => {
          const active = idx <= phase;
          const color = colors[idx];
          return (
            <div key={label} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 999,
                  background: active ? color : 'rgba(0,0,0,0.14)',
                  boxShadow: active ? `0 0 8px ${color}55` : 'none',
                  transition: 'all 0.3s ease',
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  color: active ? '#374151' : '#9CA3AF',
                  fontWeight: active ? 700 : 500,
                }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
