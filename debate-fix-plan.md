# 폴리챗 토론 버그 수정 계획서

> 작성일: 2026-02-20 | 기반: debate-review.md (GPT-5.3-Codex-Spark 리뷰)

---

## 🔴 High Priority

### 이슈 1: 데드락 버그 (abortRef → Promise 미종료)

**현재 코드** (`DebateView.tsx:431-435`)
```ts
if (abortRef.current) {
  cleanup();
  return; // ← pump() 내부에서 return만 함. resolve/reject 호출 없음
}
```
`streamRound`이 반환하는 Promise가 영원히 pending → `runLiveDebate`의 `await streamRound(...)` 영구 대기 → 토론 멈춤.

**수정 방법**

Before (`DebateView.tsx:431-435`):
```ts
if (abortRef.current) {
  cleanup();
  return;
}
```

After:
```ts
if (abortRef.current) {
  cleanup();
  reader.cancel();
  resolve(fullText); // 지금까지 수집한 텍스트로 정상 종료
  return;
}
```

추가로, fetch의 `signal`에 이미 `abortCtrl`이 연결되어 있으므로, `endDebate()`에서 외부 abort도 트리거하도록 개선:

Before (`DebateView.tsx:680-682`):
```ts
const endDebate = () => {
  abortRef.current = true;
```

After:
```ts
const activeAbortCtrlRef = useRef<AbortController | null>(null);

const endDebate = () => {
  abortRef.current = true;
  activeAbortCtrlRef.current?.abort(); // fetch도 즉시 취소
```

그리고 `streamRound` 내부에서 `abortCtrl` 생성 직후:
```ts
activeAbortCtrlRef.current = abortCtrl;
```

**주의사항**
- `resolve(fullText)` 호출 시 부분 텍스트가 `runLiveDebate`로 전달됨 → 이미 `if (abortRef.current) break;` 체크가 있으므로 해당 텍스트는 무시됨. 안전.
- `.catch()` 대신 `resolve`를 쓰는 이유: abort는 에러가 아닌 사용자 의도적 중단이므로 reject보다 resolve가 적절.

---

### 이슈 2: 30라운드 종료 미작동

**현재 코드** (`DebateView.tsx:471-619`)
`for (let i = 0; i < 30; i++)` 루프 종료 후, 캐시 저장만 하고 함수 종료. `setPhase('finished')` 호출 없음.

`startDebate()`에서 `await runLiveDebate(...)` 반환 후에도 phase 전환 코드 없음 (`DebateView.tsx:674-676`).

**수정 방법**

`runLiveDebate` 함수 끝 (캐시 저장 블록 이후, 함수 닫기 전)에 추가:

Before (`DebateView.tsx:615` 부근, `runLiveDebate` 함수 끝):
```ts
    // 캐시 저장 (판정 없이, 비동기, 실패해도 무시)
    fetch('/api/debate-cache', { ... }).catch(() => {});
  }
};
```

After:
```ts
    // 캐시 저장
    fetch('/api/debate-cache', { ... }).catch(() => {});
  }

  // 정상 완료 시 (abort가 아닌 경우) finished 상태로 전환
  if (!abortRef.current && allMessages.length > 0) {
    setPhase('finished');
  }
};
```

**주의사항**
- `endDebate()`는 `setPhase('setup')`을 호출하므로 abort 종료와 충돌 없음.
- 캐시 저장 if문과 finished 전환 if문 조건이 동일하므로 합칠 수도 있으나, 가독성 위해 분리 유지.

---

### 이슈 3: 스트리밍 렌더 과부하

**현재 코드** (`DebateView.tsx:513-521`)
```ts
for (const char of chunk) {
  streamedText += char;
  currentBubble += char;
  setCurrentText(currentBubble);       // ← 매 글자마다 setState
  await sleep(document.hidden ? 0 : 55); // ← 55ms 딜레이
```

(`DebateView.tsx:195-200`) `currentText` 변경마다 `useEffect`로 `scrollToBottom('instant')` 호출.

**수정 방법**

#### 3-A: 배치 렌더링 (`DebateView.tsx:513-521`)

Before:
```ts
for (const char of chunk) {
  if (abortRef.current) return;
  streamedText += char;
  currentBubble += char;
  setCurrentText(currentBubble);
  await sleep(document.hidden ? 0 : 55);
```

After:
```ts
const BATCH_SIZE = 10;
let charBuf = '';
for (const char of chunk) {
  if (abortRef.current) return;
  streamedText += char;
  currentBubble += char;
  charBuf += char;
  
  if (charBuf.length >= BATCH_SIZE) {
    setCurrentText(currentBubble);
    charBuf = '';
    await sleep(document.hidden ? 0 : 55 * BATCH_SIZE);
  }
```

루프 후 잔여 flush:
```ts
if (charBuf.length > 0) {
  setCurrentText(currentBubble);
}
```

#### 3-B: 스크롤 쓰로틀 (`DebateView.tsx:195-200`)

Before:
```ts
useEffect(() => {
  if (currentText) {
    scrollToBottom('instant');
  }
}, [currentText, scrollToBottom]);
```

After:
```ts
const scrollRafRef = useRef<number | null>(null);

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
  };
}, []);
```

**주의사항**
- `BATCH_SIZE`를 10으로 설정하면 sleep 간격은 `55 * 10 = 550ms`가 되어 너무 김. 실제로는 `await sleep(document.hidden ? 0 : 100)` 정도로 조절 필요 (체감 타이핑 속도 유지).
- 말풍선 분할 로직(문장 끝 감지)이 `currentBubble`에 의존하므로, 문장 끝 감지도 배치 단위로 동작하게 됨 → 크게 영향 없음 (10자 안에 문장 끝이 있으면 그 배치에서 처리).

---

### 이슈 4: 컨텍스트 폭증

**현재 코드** (`DebateView.tsx:510`)
```ts
const recentHistory = [...allMessages]; // 전체 히스토리 전달
```
30라운드 × 평균 3 말풍선 = ~90개 메시지 전체가 매 API 호출마다 전달 → 토큰 폭증, 반복/할루시네이션 유도.

**수정 방법**

Before:
```ts
const recentHistory = [...allMessages]; // 전체 히스토리 전달 (처음부터 기억)
```

After:
```ts
// 최근 10개 발언만 전달 (컨텍스트 폭증 방지)
const recentHistory = allMessages.slice(-10);
```

주제 전환 시 초기화도 추가 — `topicChangedRef.current` 체크 블록(`DebateView.tsx:497-500`) 수정:

Before:
```ts
if (topicChangedRef.current) {
  lastText = '';
  topicChangedRef.current = false;
}
```

After:
```ts
if (topicChangedRef.current) {
  lastText = '';
  topicChangedRef.current = false;
  // 주제 전환 시 이전 맥락의 히스토리는 불필요 → 토론 카드 이후만 유지
  // (recentHistory는 allMessages.slice(-10)이므로 자연스럽게 최신만 포함)
}
```

**주의사항**
- 서버 API(`/api/debate`)의 `recentHistory` 처리 로직도 확인 필요 — 슬라이스된 히스토리를 받아도 프롬프트 구성에 문제 없는지.
- 10개가 적절한지는 테스트 필요. 각 발언이 2~3 말풍선이면 실제 3~5턴 분량.

---

## 🟡 Mid Priority

### 이슈 5: 캐시 key 강화

**현재 코드** (`DebateView.tsx:270-275`)
```ts
const res = await fetch(
  `/api/debate-cache?topic=${encodeURIComponent(topic)}&style=${encodeURIComponent(style)}&debateType=${debateType}`
);
```
`topic`, `style`, `debateType`만 캐시 키 → 프롬프트 변경, 지식베이스 업데이트 시 stale 캐시 반환.

**수정 방법**

상수 정의 추가 (파일 상단 또는 config):
```ts
const PROMPT_VERSION = 'v2'; // 프롬프트 변경 시 bump
```

Before:
```ts
`/api/debate-cache?topic=${encodeURIComponent(topic)}&style=${encodeURIComponent(style)}&debateType=${debateType}`
```

After:
```ts
`/api/debate-cache?topic=${encodeURIComponent(topic)}&style=${encodeURIComponent(style)}&debateType=${debateType}&pv=${PROMPT_VERSION}`
```

캐시 저장 시에도 동일 파라미터 추가 (`DebateView.tsx:612-616`):
```ts
body: JSON.stringify({ topic: initialTopic, style, messages: allMessages, judgment: null, promptVersion: PROMPT_VERSION }),
```

서버 API(`/api/debate-cache`)에서 `promptVersion`을 캐시 키에 포함하도록 수정 필요.

**주의사항**
- `knowledgeHash`는 지식베이스 내용의 해시값 → 별도 유틸 함수 필요. 초기엔 `PROMPT_VERSION`만으로 충분.
- 기존 캐시 무효화: 버전 bump하면 자동으로 miss됨.

---

### 이슈 6: 말풍선 분할 규칙 통일

**현재 코드**
- `use-chat.ts:17-64`: `parseAIResponse()` — `||` 구분자, 번호 리스트, 150자 이상 자동 분리
- `DebateView.tsx:524-535`: 토론 스트리밍 중 문장 끝 감지 + 2문장/말풍선 규칙 (별도 인라인 로직)

두 곳의 분할 규칙이 독립적으로 존재하여 일관성 없음.

**수정 방법**

새 유틸 파일 생성: `src/lib/bubble-splitter.ts`

```ts
/**
 * 말풍선 분할 공통 유틸
 */
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
    return cleaned.split('||').map(s => s.trim()).filter(s => s.length > 0);
  }
  // ... 기존 parseAIResponse 로직 이전
}

/** 스트리밍 중 문장 끝 감지 (DebateView.tsx용) */
export function isSentenceEnd(text: string): boolean {
  return BUBBLE_CONFIG.SENTENCE_END_REGEX.test(text.trimEnd()) && text.trim().length > BUBBLE_CONFIG.MIN_BUBBLE_LENGTH;
}
```

- `use-chat.ts`의 `parseAIResponse()`를 `splitIntoBubbles()` 호출로 교체
- `DebateView.tsx`의 인라인 문장 끝 감지를 `isSentenceEnd()` + `BUBBLE_CONFIG` 상수 사용으로 교체

**주의사항**
- 토론 모드(스트리밍)와 채팅 모드(완성 텍스트)는 분할 시점이 다르므로, 함수를 2개로 분리하되 상수/정규식은 공유.

---

### 이슈 7: 에러 시 잘못된 메시지 삭제

**현재 코드** (`use-chat.ts:321-327`)
```ts
onError: (err) => {
  setStreaming(false);
  useChatStore.setState((state) => ({
    messages: state.messages.slice(0, -1), // ← 무조건 마지막 메시지 삭제
  }));
```
동시 스트림 상황에서 마지막 메시지가 에러 발생 placeholder가 아닐 수 있음.

**수정 방법**

placeholder 메시지 생성 시 고유 ID 추적:

Before (assistant placeholder 추가 시점, `use-chat.ts` — `sendMessage` 내부):
```ts
// assistant placeholder 추가 (기존 코드 위치 확인 필요)
addMessage({ role: 'assistant', content: '' });
```

After:
```ts
const placeholderId = `placeholder-${Date.now()}`;
addMessage({ role: 'assistant', content: '', id: placeholderId });
```

onError에서:
Before:
```ts
useChatStore.setState((state) => ({
  messages: state.messages.slice(0, -1),
}));
```

After:
```ts
useChatStore.setState((state) => ({
  messages: state.messages.filter(m => m.id !== placeholderId),
}));
```

**주의사항**
- `Message` 타입에 `id?: string` 필드가 없으면 추가 필요 (`src/types/chat.ts`).
- `placeholderId`를 `onError` 클로저에서 접근 가능하도록 `sendMessage` 함수 스코프 내에서 선언.
- 기존 메시지에 `id`가 없어도 `filter`는 안전 (`undefined !== placeholderId` → 삭제 안 됨).

---

## 구현 순서 권장

1. **이슈 1 (데드락)** — 가장 치명적, 토론 완전 멈춤
2. **이슈 2 (30라운드 종료)** — 1줄 추가로 해결, 빠름
3. **이슈 4 (컨텍스트 폭증)** — 1줄 수정, API 비용 즉시 절감
4. **이슈 3 (스트리밍 렌더)** — UX 개선, 모바일 체감 큼
5. **이슈 5 (캐시 key)** — 서버 API 수정 동반
6. **이슈 7 (에러 삭제)** — 타입 수정 동반
7. **이슈 6 (분할 통일)** — 리팩토링, 기능 변경 없음

---

*작성: Zeon subagent | 2026-02-20*
