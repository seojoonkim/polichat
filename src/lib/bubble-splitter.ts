export const BUBBLE_CONFIG = {
  MAX_BUBBLES: 3,
  MAX_SENTENCES_PER_BUBBLE: 2,
  MIN_BUBBLE_LENGTH: 25,
} as const;

/** 완성된 텍스트를 말풍선 배열로 분할 (use-chat.ts용) */
export function splitIntoBubbles(text: string): string[] {
  const cleaned = text.replace(/\*\*(.*?)\*\*/g, '$1').trim();

  if (cleaned.includes('||')) {
    const parts = cleaned.split('||').map((s) => s.trim()).filter((s) => s.length > 0);
    return parts.length > 0 ? parts : [cleaned];
  }

  return [cleaned];
}

/**
 * 스트리밍 완료 후 전체 텍스트를 문장 단위로 말풍선 배열로 분리
 */
export function splitStreamedText(text: string): string[] {
  const { MAX_BUBBLES, MIN_BUBBLE_LENGTH } = BUBBLE_CONFIG;
  const cleaned = text.replace(/\|\|/g, ' ').replace(/\|/g, '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];

  const ends: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i] ?? '';
    const prevCh = cleaned[i - 1] ?? '';
    const nextCh = cleaned[i + 1] ?? '';
    if (i < 5) continue;

    if (ch === '.' || ch === '!' || ch === '?') {
      if (ch === '.' && /\d/.test(prevCh)) continue;
      ends.push(i + 1);
      continue;
    }

    if (/[다요죠네]/.test(ch)) {
      if (/[는은이가을를와과도로에서으로의하여해서므로지만아어거기]/.test(nextCh)) continue;
      ends.push(i + 1);
    }
  }

  if (ends.length === 0) return [cleaned];

  const wantedSplits = Math.min(ends.length, MAX_BUBBLES - 1);
  const step = ends.length / (wantedSplits + 1);
  const splitPoints: number[] = [];
  for (let k = 1; k <= wantedSplits; k++) {
    const idx = Math.min(Math.round(step * k) - 1, ends.length - 1);
    const point = ends[idx];
    if (point !== undefined && !splitPoints.includes(point)) {
      splitPoints.push(point);
    }
  }
  splitPoints.sort((a, b) => a - b);

  const parts: string[] = [];
  let start = 0;

  for (const sp of splitPoints) {
    const raw = cleaned.slice(start, sp).trim();
    const part = raw.replace(/^[.!?\s]+/, '').trim();
    if (part) parts.push(part);
    start = sp;
    while (start < cleaned.length && cleaned[start] === ' ') start++;
  }

  const lastRaw = cleaned.slice(start).trim();
  const lastPart = lastRaw.replace(/^[.!?\s]+/, '').trim();
  if (lastPart) parts.push(lastPart);

  const merged: string[] = [];
  for (const part of parts) {
    const last = merged[merged.length - 1];
    if (last !== undefined && last.length < MIN_BUBBLE_LENGTH) {
      merged[merged.length - 1] = last + ' ' + part;
    } else {
      merged.push(part);
    }
  }

  const result = merged.filter((b) => b.length > 0).slice(0, MAX_BUBBLES);
  return result.length > 0 ? result : [cleaned];
}

/**
 * 스트리밍 중 문장 끝 감지 (DebateView.tsx용)
 *
 * 보수적 판단 기준 — false positive 방지:
 * - "시대의 요"처럼 단어 중간 "요"는 분리 안 함
 * - 반드시 동사/형용사 어미 패턴 확인 후 분리
 */
export function isSentenceEnd(text: string): boolean {
  const trimmed = text.trimEnd();
  if (trimmed.length < BUBBLE_CONFIG.MIN_BUBBLE_LENGTH) return false;

  // 괄호로 시작하는 내용은 분리 안 함 (주석성 발언 — 하나의 버블로 유지)
  if (trimmed.trimStart().startsWith('(')) return false;

  // 이모지 바로 앞에서 분리 안 함
  const emojiRegex = /\p{Emoji}/u;
  if (trimmed.length >= 2 && emojiRegex.test(trimmed.slice(-2, -1))) return false;

  // ── 마침표 / 느낌표 / 물음표 ──────────────────────────────────────────
  if (/[.!?]$/.test(trimmed)) {
    // 소수점 제외: "40.3" 같은 경우
    if (trimmed.endsWith('.') && /\d/.test(trimmed[trimmed.length - 2] ?? '')) return false;
    return true;
  }

  // ── 한국어 확실한 종결어미 ─────────────────────────────────────────────
  // 습니다 / 니다 / 겠습니다 / 것입니다
  if (/(?:습니다|겠습니다|것입니다|니다)$/.test(trimmed)) return true;

  // ── 요: 동사/형용사 어미 패턴만 허용 ──────────────────────────────────
  // 아요/어요/여요/봐요/줘요/해요/이에요/세요/이요 등
  // "시대의 요", "필요", "중요" 같은 단어 중간은 제외됨
  if (/[아어여봐줘해세이에]요$/.test(trimmed)) return true;

  // ── 죠: 하죠/되죠/있죠 등 (앞에 한글 있어야 함) ───────────────────────
  if (/[가-힣]죠$/.test(trimmed)) return true;

  // ── 네요: 종결 ────────────────────────────────────────────────────────
  if (/네요$/.test(trimmed)) return true;

  // ── 단독 "다": 있다/없다/한다/된다 등 (앞에 한글 있어야 함) ─────────────
  if (/[가-힣]다$/.test(trimmed)) return true;

  return false;
}
