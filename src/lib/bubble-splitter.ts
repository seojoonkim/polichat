export const BUBBLE_CONFIG = {
  MAX_BUBBLES: 3,
  MAX_SENTENCES_PER_BUBBLE: 2,
  MIN_BUBBLE_LENGTH: 25, // 10 → 25: 너무 짧은 문장에서 분할하지 않기
  SENTENCE_END_REGEX: /[.!?다요죠네]$/,
} as const;

/** 완성된 텍스트를 말풍선 배열로 분할 (use-chat.ts용) */
export function splitIntoBubbles(text: string): string[] {
  const cleaned = text.replace(/\*\*(.*?)\*\*/g, '$1').trim();

  // 1:1 대화에서는 기본적으로 사용자 체감 UX를 위해 명시적 구분자만 분리.
  // (무분별한 자동 분할이 말풍선 깜박임/누락을 유발할 수 있음)
  if (cleaned.includes('||')) {
    const parts = cleaned.split('||').map((s) => s.trim()).filter((s) => s.length > 0);
    return parts.length > 0 ? parts : [cleaned];
  }

  return [cleaned];
}

/**
 * 스트리밍 완료 후 전체 텍스트를 문장 단위로 말풍선 배열로 분리
 *
 * Bug 1 대응: 마침표/!/?/한국어 종결 뒤에 공백 없이 다음 문장이 시작해도 경계 인식
 *   예) "합니다.2026년" → ["합니다.", "2026년..."]
 * Bug 2 대응: 마지막 조각은 마침표 없어도 반드시 버블로 emit
 *
 * - MAX_BUBBLES(3) 개 이하로 분리
 * - 각 버블은 MIN_BUBBLE_LENGTH(25)자 이상
 * - 한국어(다/요/죠/네) + 영어(.!?) 문장 종결 기준
 */
export function splitStreamedText(text: string): string[] {
  const { MAX_BUBBLES, MIN_BUBBLE_LENGTH } = BUBBLE_CONFIG;

  // || 마커 제거 및 공백 정리
  const cleaned = text.replace(/\|\|/g, ' ').replace(/\|/g, '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];

  // ─── 문장 경계(end index) 수집 ───────────────────────────────────────────
  // ends[i] = 분리 후 다음 문장이 시작할 인덱스 (경계 직후)
  const ends: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i] ?? '';
    const prevCh = cleaned[i - 1] ?? '';
    const nextCh = cleaned[i + 1] ?? '';

    // 최소 누적 길이 (너무 짧은 구간에서 분리 방지)
    if (i < 5) continue;

    // ── 영어/공통 구두점: . ! ? ──────────────────────────────────────────
    if (ch === '.' || ch === '!' || ch === '?') {
      // 소수점 제외: 앞 글자가 숫자이면 소수점
      if (ch === '.' && /\d/.test(prevCh)) continue;
      // Bug 1: 공백 없이 다음 문장이 이어져도 경계로 인식
      //   nextCh가 공백이든, 대문자·숫자·한글이든 무조건 경계
      ends.push(i + 1);
      continue;
    }

    // ── 한국어 종결어미: 다 / 요 / 죠 / 네 ────────────────────────────────
    if (/[다요죠네]/.test(ch)) {
      // 뒤에 조사/연결어가 오면 종결이 아님
      if (/[는은이가을를와과도로에서으로의하여해서므로지만아어거기]/.test(nextCh)) continue;
      // Bug 1: 뒤에 공백 없이 비공백 문자가 와도 종결로 인식
      //   (예: "합니다.세상이" → 다 뒤에 . 가 오므로 종결)
      ends.push(i + 1);
    }
  }

  // Bug 2: 경계가 전혀 없으면 전체를 하나의 버블로
  if (ends.length === 0) return [cleaned];

  // ─── (MAX_BUBBLES - 1)개의 분할점 선택 — 균등 분포 ────────────────────
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

  // ─── 분할점 기준으로 파트 추출 ──────────────────────────────────────────
  const parts: string[] = [];
  let start = 0;

  for (const sp of splitPoints) {
    const raw = cleaned.slice(start, sp).trim();
    // 선행 구두점 제거: 이전 분할에서 마침표가 앞에 남는 경우 (예: ".2026년..." → "2026년...")
    const part = raw.replace(/^[.!?\s]+/, '').trim();
    if (part) parts.push(part);
    start = sp;
    // 분할점 직후 공백 건너뜀
    while (start < cleaned.length && cleaned[start] === ' ') start++;
  }

  // Bug 2: 마지막 조각 — 마침표 없어도 반드시 포함
  const lastRaw = cleaned.slice(start).trim();
  const lastPart = lastRaw.replace(/^[.!?\s]+/, '').trim();
  if (lastPart) parts.push(lastPart);

  // ─── 너무 짧은 파트는 이전 파트에 병합 ────────────────────────────────
  const merged: string[] = [];
  for (const part of parts) {
    const last = merged[merged.length - 1];
    if (last !== undefined && last.length < MIN_BUBBLE_LENGTH) {
      merged[merged.length - 1] = last + ' ' + part;
    } else {
      merged.push(part);
    }
  }

  // Bug 2: 최종 결과가 비면 원본 전체 반환 (안전망)
  const result = merged.filter((b) => b.length > 0).slice(0, MAX_BUBBLES);
  return result.length > 0 ? result : [cleaned];
}

/** 스트리밍 중 문장 끝 감지 (DebateView.tsx용) */
export function isSentenceEnd(text: string): boolean {
  const trimmed = text.trimEnd();
  if (!BUBBLE_CONFIG.SENTENCE_END_REGEX.test(trimmed)) return false;
  if (trimmed.length < BUBBLE_CONFIG.MIN_BUBBLE_LENGTH) return false;

  // 마침표가 소수점인 경우 문장 끝으로 처리하지 않음
  // 예: "40.3%"에서 "40." → 앞 글자가 숫자이면 소수점
  const lastChar = trimmed[trimmed.length - 1];
  if (lastChar === '.') {
    const prevChar = (trimmed.length >= 2 ? trimmed[trimmed.length - 2] : '') || '';
    if (/\d/.test(prevChar)) return false;
  }

  // 이모지 뒤에 있으면 분할 안 함
  // 예: "보수의 대동이로 🤔" → 뒤에 내용이 더 올 가능성 높음
  const emojiRegex = /\p{Emoji}/u;
  if (trimmed.length >= 2) {
    const beforeLast = trimmed.slice(-2, -1);
    if (emojiRegex.test(beforeLast)) return false;
  }

  return true;
}
