import { useEffect, useRef, useState } from 'react';

interface InterjectionProps {
  streamingText: string;
  opponentSpeaker: string;
  isStreaming: boolean;
  align: 'left' | 'right'; // 상대편 위치
}

const SPEAKER_SHORT_NAMES: Record<string, string> = {
  ohsehoon:    '오세훈',
  jungwono:    '정원오',
  jungcr:      '정청래',
  jangdh:      '장동혁',
  leejunseok:  '이준석',
  jeonhangil:  '전한길',
  kimeoojun:   '김어준',
  jinjungkwon: '진중권',
  handoonghoon:'한동훈',
  hongjunpyo:  '홍준표',
  kiminseok:   '김민석',
};

const INTERJECTIONS: Record<string, string[]> = {
  ohsehoon:    ['그건 사실이 아닙니다!', '잠깐만요!', '근거를 대세요!', '착각하고 계시네요.'],
  jungwono:    ['아닙니다!', '현장을 모르시는 거예요!', '주민들한테 물어보세요!', '그게 다가 아닙니다!'],
  jungcr:      ['천만에요!', '거짓입니다!', '명명백백한 거짓말!', '국민이 다 보고 있습니다!'],
  jangdh:      ['법적 근거가 없습니다.', '사실 왜곡입니다.', '수치를 확인하십시오.', '그건 다른 문제입니다.'],
  leejunseok:  ['그건 논리적으로 안 맞죠.', '출처가 어디입니까?', '팩트체크 하시죠.', '웃기시네요.'],
  jeonhangil:  ['거짓말!', '그건 왜곡입니다!', '국민이 판단합니다!', '역사가 증명할 겁니다!'],
  kimeoojun:   ['맥락을 빼셨네요.', '그게 다가 아닌데...', '잠깐만요.', '핵심을 비켜가시는데요.'],
  jinjungkwon: ['웃기는 소리.', '논리가 왜 그러세요?', '내로남불이죠.', '비약이 심하시네요.'],
};

const TRIGGER_KEYWORDS = ['거짓', '실패', '사기', '위선', '배신', '무능', '파탄', '폭탄', '기만', '황당', '부끄럽', '음모', '거짓말'];

export default function Interjection({ streamingText, opponentSpeaker, isStreaming, align }: InterjectionProps) {
  const [text, setText] = useState<string | null>(null);
  const shownCountRef = useRef(0);
  const lastLenRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 스트리밍 종료 시 초기화
  useEffect(() => {
    if (!isStreaming) {
      shownCountRef.current = 0;
      lastLenRef.current = 0;
    }
  }, [isStreaming]);

  // 50자 단위로 키워드 체크
  useEffect(() => {
    if (!isStreaming || !streamingText) return;
    if (shownCountRef.current >= 2) return; // 세션당 최대 2회

    const chunk = streamingText.slice(lastLenRef.current);
    lastLenRef.current = streamingText.length;
    if (!chunk || chunk.length < 10) return;

    const triggered = TRIGGER_KEYWORDS.some(kw => chunk.includes(kw));
    if (!triggered) return;

    // 이미 표시 중이면 스킵
    if (text) return;

    const pool = INTERJECTIONS[opponentSpeaker] ?? ['잠깐만요!'];
    const chosen = pool[Math.floor(Math.random() * pool.length)] ?? '잠깐만요!';
    setText(chosen);
    shownCountRef.current += 1;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setText(null), 2200);
  }, [streamingText.length > 50 ? Math.floor(streamingText.length / 50) : 0]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  if (!text) return null;

  const isLeft = align === 'left';
  const speakerLabel = SPEAKER_SHORT_NAMES[opponentSpeaker] ?? opponentSpeaker;
  return (
    <div style={{
      position: 'absolute',
      top: -42,
      [isLeft ? 'left' : 'right']: 4,
      display: 'flex',
      flexDirection: 'column',
      alignItems: isLeft ? 'flex-start' : 'flex-end',
      animation: 'interjectionPop 2.2s ease-in-out forwards',
      zIndex: 20,
    }}>
      {/* 화자 이름 */}
      <span style={{
        fontSize: 10,
        fontWeight: 700,
        color: 'rgba(200,210,240,0.7)',
        marginBottom: 2,
        paddingLeft: isLeft ? 6 : 0,
        paddingRight: isLeft ? 0 : 6,
      }}>
        {speakerLabel}
      </span>
      <div style={{
        background: 'rgba(30,30,40,0.95)',
        color: '#f1f5f9',
        border: '1px solid rgba(255,255,255,0.15)',
        padding: '5px 12px',
        borderRadius: 14,
        fontSize: 12,
        fontWeight: 700,
        boxShadow: '0 3px 12px rgba(0,0,0,0.35)',
        whiteSpace: 'nowrap',
      }}>
      {text}
      </div>
      <style>{`
        @keyframes interjectionPop {
          0%   { opacity: 0; transform: translateY(8px) scale(0.9); }
          12%  { opacity: 1; transform: translateY(0) scale(1.05); }
          80%  { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-4px) scale(0.95); }
        }
      `}</style>
    </div>
  );
}
