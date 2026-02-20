# Debate 성능 코드 리뷰 (by GPT-5.3-Codex-Spark)

## 1) 발견된 문제점

### AI 응답 품질 (프롬프트 엔지니어링 갭, 컨텍스트 관리, 반복 방지)

| 우선순위 | 파일:라인 | 문제 |
|---|---|---|
| **High** | `prompt-template.ts:4-8` / `prompt-assembler.ts:151-155` | 시스템 프롬프트에 `현재는 2026년 2월` 같은 하드코딩 시간 컨텍스트 → 오래 운영 시 사실성 저하 |
| **High** | `use-chat.ts:194-199` | AI 응답 시간 컨텍스트가 prompt-template 정적 컨텍스트와 중복/충돌 가능 |
| **High** | `DebateView.tsx:510` | 라운드마다 `recentHistory: [...allMessages]` 전체 전달 → 컨텍스트 폭증, 반복/할루시네이션 유도 |
| **Mid** | `prompt-assembler.ts:86-103`, `DebateView.tsx:496-499` | 주제 전환 시 맥락 초기화는 있으나 "반복 억제"/"이전 주장 재인용 규칙" 약함 |
| **Mid** | `prompt-template.ts:38-40`, `use-chat.ts:21-64`, `DebateView.tsx:504-508` | `||` 강제 규칙과 파서/클라이언트 분할 규칙이 다르게 동작 → 말풍선 분할 일관성 저하 |

### 토론 흐름 로직 (턴 관리, 주제 전환, 라운드 제한)

| 우선순위 | 파일:라인 | 문제 |
|---|---|---|
| **High** | `DebateView.tsx:350-362`, `431-435` | `abortRef`가 true가 되면 `streamRound`가 `cleanup()`만 하고 Promise를 resolve/reject하지 않음 → 스트림 영구 대기 (데드락) |
| **High** | `DebateView.tsx:471-477`, `608-610`, `664-675` | 30라운드 루프 정상 완료 시 `phase`가 `finished`로 이동하지 않음 |
| **Mid** | `DebateView.tsx:270-275`, `612-616` | 캐시 key가 `topic/style/debateType`만 사용 → 프롬프트/설정 변경 반영 느슨함 (구버전 캐시 재사용) |
| **Low** | `DebateView.tsx:129-137`, `561-563` | 반박 주장 추출 로직이 정규식 기반 단순 추출 (`extractKeyClaimClient`) → 언어/표현 변주 반영 약함 |

### UX/성능 (스트리밍, 말풍선 분할, 타이밍)

| 우선순위 | 파일:라인 | 문제 |
|---|---|---|
| **High** | `DebateView.tsx:513-521`, `195-200`, `182-186` | 문자 단위 `setCurrentText` + 매 타이핑마다 스크롤 호출 → 렌더/레이아웃 비용 큼 |
| **High** | `DebateView.tsx:276`, `513-521` | 발화 분할/표시 타이밍이 고정(600ms, 55ms) → 기기 성능 편차 반영 불가 |
| **Mid** | `use-chat.ts:206`, `17-64` | `onChunk`마다 상태 갱신 + 분할 파서 규칙 분산 → 말풍선 길이·타이밍 지터 발생 |
| **Mid** | `DebateView.tsx:321`, `557-559` | 캐시 재생/라이브 재생 모두 즉시 스크롤+타이핑 지연 → 긴 세션에서 체감 지연 증가 |

### 코드 품질 (race condition, state 버그)

| 우선순위 | 파일:라인 | 문제 |
|---|---|---|
| **High** | `use-chat.ts:140-143`, `270-274` | `pendingMessageRef` 단일 슬롯 큐 → 빠른 연속 입력 시 중간 메시지 유실 |
| **High** | `use-chat.ts:321-327` | 에러 시 `slice(0, -1)`로 마지막 메시지 삭제 → 동시 스트림 상황에서 잘못된 메시지 삭제 가능 |
| **Mid** | `DebateView.tsx:115-121`, `1486-1489` | 판정 스키마가 `ohsehoon/jungwono` 하드코딩 → 다른 debateType와 타입/표시 불일치 위험 |
| **Mid** | `DebateView.tsx:156`, `689-690` | `_round` 등 일부 상태 활용도 낮아 유지보수 비용 증가 |

---

## 2) 개선 제안

### 🔴 High 우선순위

**1. 데드락 수정** (`DebateView.tsx:350-362, 431-435`)
- `abortRef` 경로에서도 `streamRound` Promise 반드시 resolve/reject
- `AbortController.abort()`로 fetch 정리
- `runLiveDebate`에서 종료 플래그 분리

**2. 30라운드 정상 종료 처리** (`DebateView.tsx:471-610`)
- 라운드 루프 정상 완료 시 `setPhase('finished')` 추가
- `let finishedByLimit = false` 플래그로 중복 종료 방지

**3. 스트리밍 렌더 최적화** (`DebateView.tsx:513-521`, `182-200`)
- 문자 단위 → 8~12자 단위 배치 렌더링
- `requestAnimationFrame` 기반 스크롤 쓰로틀 적용

**4. pendingMessageRef 큐 개선** (`use-chat.ts:140-143`)
- 단일 슬롯 → FIFO 배열 큐로 전환

### 🟡 Mid 우선순위

**5. 컨텍스트 폭증 방지** (`DebateView.tsx:510`)
- 최근 6~10회 발언 + 요약 블록만 `recentHistory`로 전달
- 주제 전환 시 별도 요약 캐시 사용

**6. 캐시 key 강화** (`DebateView.tsx:270-275`)
- `promptVersion`, `styleVersion`, `knowledgeHash` 추가
- TTL 만료 시 자동 무효화

**7. 말풍선 분할 규칙 통일**
- `prompt-template` + 파싱기 + 스트리밍 분할 → 단일 소스 통합

**8. 에러 삭제 정확도** (`use-chat.ts:321-327`)
- placeholder id 추적으로 정확한 대상 삭제
- onError 시 큐/타이핑 상태 원자적 초기화

### 🟢 Low 우선순위

**9. 하드코딩 시간 컨텍스트 제거**
- 실행 시점/타임존 기반 동적 컨텍스트로 전환

**10. judgment 타입 동적화** (`DebateView.tsx:115-121`)
- debateType별 speaker id 동적 구조로 전환

---

## 3) 예상 임팩트

| 항목 | 예상 효과 |
|------|---------|
| 토론 종료 안정성 | 중단/타이머 만료 시 즉시 복귀, 멈춤 현상 감소 |
| 스트리밍 UX | 모바일 렌더 부드러움 개선, 타이핑 지연 감소 |
| AI 응답 품질 | 반복 억제·맥락 요약으로 토론 밀도·논리 일관성 향상 |
| 운영 신뢰성 | 캐시 버전관리·큐 정합성으로 상태 역전/데이터 손실 감소 |
| 유지보수성 | 토론 타입별 규칙 정리로 향후 변경 비용 감소 |

---
*리뷰어: GPT-5.3-Codex-Spark | 2026-02-20*
