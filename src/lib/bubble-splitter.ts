export const BUBBLE_CONFIG = {
  MAX_BUBBLES: 3,
  MAX_SENTENCES_PER_BUBBLE: 2,
  MIN_BUBBLE_LENGTH: 10,
  SENTENCE_END_REGEX: /[.!?다요죠네]$/,
} as const;

/** 완성된 텍스트를 말풍선 배열로 분할 (use-chat.ts용) */
export function splitIntoBubbles(text: string): string[] {
  const cleaned = text.replace(/\*\*(.*?)\*\*/g, '$1');

  if (cleaned.includes('||')) {
    return cleaned.split('||').map((s) => s.trim()).filter((s) => s.length > 0);
  }

  const allNumbers = cleaned.match(/\d+\.\s/g);
  if (allNumbers && allNumbers.length >= 2) {
    const parts = cleaned.split(/(?=\d+\.\s)/).map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts;
  }

  if (cleaned.length > 150) {
    const sentences = cleaned.split(/(?<=[다요죠네요\.!?])\s+/).filter((s) => s.trim());
    if (sentences.length >= 2) {
      const bubbles: string[] = [];
      let current = '';
      let count = 0;
      for (const sentence of sentences) {
        current += (current ? ' ' : '') + sentence;
        count++;
        if (count >= 2 && current.length >= 50) {
          bubbles.push(current.trim());
          current = '';
          count = 0;
        }
      }
      if (current.trim()) bubbles.push(current.trim());
      const validBubbles = bubbles.filter((b) => b.trim().length > 0);
      if (validBubbles.length > 1) return validBubbles;
    }
  }

  return [cleaned];
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
    const prevChar = trimmed.length >= 2 ? trimmed[trimmed.length - 2] : '';
    if (/\d/.test(prevChar)) return false;
  }

  return true;
}
