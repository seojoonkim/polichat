import { useMemo } from 'react';

interface TensionGaugeProps {
  messages: { speaker: string; text: string }[];
  round: number;
  maxRound: number;
}

const TENSION_KEYWORDS = {
  attack:      ['거짓', '실패', '황당', '부끄럽', '웃기', '말이 됩니까', '사기', '기만', '위선', '배신', '음모', '폭탄', '거짓말', '뻔뻔'],
  emotional:   ['분노', '충격', '경악', '한심', '치욕', '눈물', '울분', '부끄럽', '소름'],
  data_attack: ['반박', '팩트', '근거', '수치', '통계', '실제로는', '확인해보면', '데이터'],
};

export function calcTension(messages: { speaker: string; text: string }[], round: number, maxRound: number): number {
  const roundTension = Math.min(40, (round / maxRound) * 40);
  const recent = messages.slice(-6);
  let keywordScore = 0;
  for (const msg of recent) {
    for (const kw of TENSION_KEYWORDS.attack)      { if (msg.text.includes(kw)) keywordScore += 5; }
    for (const kw of TENSION_KEYWORDS.emotional)   { if (msg.text.includes(kw)) keywordScore += 3; }
    for (const kw of TENSION_KEYWORDS.data_attack) { if (msg.text.includes(kw)) keywordScore += 2; }
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
  const color = tension < 33 ? '#FCD34D' : tension < 66 ? '#F97316' : '#EF4444';
  const flames = tension < 33 ? '🔥' : tension < 66 ? '🔥🔥' : '🔥🔥🔥';
  const label  = tension < 33 ? '탐색' : tension < 66 ? '격돌' : '결전';

  return (
    <div style={{ width: '100%', padding: '6px 16px 4px', marginBottom: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>
          {flames} {label}
        </span>
        <span style={{ fontSize: 11, color: '#888' }}>{tension}%</span>
      </div>
      <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
        <div style={{
          width: `${tension}%`,
          height: '100%',
          borderRadius: 3,
          background: `linear-gradient(90deg, #FCD34D, ${color})`,
          transition: 'width 0.6s ease, background 0.6s ease',
          boxShadow: tension > 66 ? `0 0 8px ${color}88` : 'none',
        }} />
      </div>
    </div>
  );
}
