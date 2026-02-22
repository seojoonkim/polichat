# Polichat 디버깅 리포트 — 2026-02-22

> 작성: Zeon 서브에이전트 | 테스트 시간: 09:45~10:45 KST

---

## 발견된 버그

| 심각도 | 위치 | 설명 | 상태 |
|--------|------|------|------|
| 🟠 High | `src/App.tsx` | `/chat` 직접 접근 시 빈 화면 + React Router 경고 | ✅ **수정완료** |
| 🟠 High | `src/pages/DebatePage.tsx` | 유효하지 않은 `?type=` 파라미터로 접근 시 빈 화면 | ✅ **수정완료** |
| 🟡 Medium | `src/components/debate/DebateView.tsx` | 버블 분리 시 가끔 3번째 버블 앞에 ". " 선행 문자 등장 | ⚠️ 미수정 (간헐적 스트리밍 아티팩트) |
| 🟢 Low | `api/debate.js` | 이슈 토론 시 인용 구문 "(UN Charter," 이 독립 버블로 나오는 경우 있음 | ⚠️ 미수정 (드문 케이스) |

---

## 수정된 사항

### 1. `/chat` 라우트 리다이렉트 (App.tsx)
**문제:** `polichat.kr/chat` 직접 접근 시 빈 화면 + 콘솔 경고 `No routes matched location "/chat"`  
**원인:** React Router 라우트 정의에 `/chat` 경로가 없었음 (`/`와 `/chat/:politicianId`만 존재)  
**수정:** `<Route path="/chat" element={<Navigate to="/" replace />} />` 추가

```diff
// src/App.tsx
+ import { Routes, Route, Navigate } from 'react-router';

  <Route path="/" element={<ChatPage />} />
+ <Route path="/chat" element={<Navigate to="/" replace />} />
  <Route path="/chat/:politicianId" element={<ChatPage />} />
```

### 2. 유효하지 않은 Debate Type 폴백 (DebatePage.tsx)
**문제:** `polichat.kr/debate?type=invalid` 접근 시 빈 화면 (DEBATE_CONFIGS 조회 실패)  
**원인:** 유효성 검사 없이 URL 파라미터를 그대로 DebateType으로 사용  
**수정:** `VALID_TYPES` 배열 정의 후, 유효하지 않은 타입은 `'seoul'`로 fallback

```diff
// src/pages/DebatePage.tsx
+ const VALID_TYPES: DebateType[] = ['seoul', 'national', 'leejeon', 'kimjin', 'hanhong'];

- const debateType = (searchParams.get('type') as DebateType) || 'seoul';
+ const rawType = searchParams.get('type') || 'seoul';
+ const debateType: DebateType = (VALID_TYPES.includes(rawType as DebateType) ? rawType : 'seoul') as DebateType;
```

---

## 정상 작동 확인된 기능

| 기능 | 결과 | 비고 |
|------|------|------|
| 홈페이지 로딩 | ✅ 정상 | 빠른 로딩, 모든 카드 렌더링 |
| AI 5분 토론 탭 | ✅ 정상 | 5개 배틀 카드 + 이미지 로딩 |
| 정책 토론 모드 | ✅ 정상 | 8+ 라운드, 주제 자동 전환, 사회자 개입 |
| 감정 토론 모드 | ✅ 정상 | 시작 확인 |
| 합의 도출 모드 | ℹ️ UI 확인 | 버튼 클릭 가능, 내부 미테스트 |
| 1:1 채팅 (이재명) | ✅ 정상 | 페르소나 유지, 3회+ 대화 성공 |
| 추천 질문 기능 | ✅ 정상 | 3회+ 교환 후 3개 추천질문 표시 |
| 오늘의 이슈 탭 | ✅ 정상 | 3개 이슈, 토론 페어 선택 가능 |
| 이슈 토론 (이준석 vs 전한길) | ✅ 정상 | 뉴스 수집→팩트 분석→논거 구성 로더 → 토론 시작 |
| OpenRouter API | ✅ 작동 | Vercel에 키 설정됨, AI 응답 생성 정상 |
| 모바일 뷰 (390px) | ✅ 정상 | 카드, 이미지, 버튼 모두 적절히 렌더링 |
| 토론 종료 화면 | ✅ 정상 | 하이라이트 섹션 표시 |
| 타이머 | ✅ 정상 | 카운트다운 작동 |
| 라운드 카운터 | ✅ 정상 | 탐색→겨룸→최고조 단계 전환 |
| 토론 주제 자동 전환 | ✅ 정상 | 100초마다 자동 전환 |
| 사회자 발언 | ✅ 정상 | 논점 정리 + 주제 전환 멘트 |

---

## 남은 이슈 (형 확인 필요)

### 🟡 버블 선행 문자 버그 (간헐적)
- **현상:** 3번째 버블 시작 시 가끔 ". 보편적인..." 처럼 선행 마침표가 등장
- **재현율:** 낮음 (수십 라운드 중 1-2회 관찰)
- **원인 추정:** 스트리밍 청크 분리 타이밍 + pendingFlush 로직 엣지케이스
- **파일:** `src/components/debate/DebateView.tsx` > `appendTextChunk` 함수
- **권고:** `currentBubble.length === 0` 체크 외 추가 방어로직 검토

### ℹ️ 말풍선 다중 분리 설계 (디자인 결정 필요)
- **현상:** 각 정치인 발언이 최대 3개 버블로 분리 출력
- **평가:** 버블 분리는 `bubble-splitter.ts`의 의도적 설계 (MAX_BUBBLES: 3)
- **의문:** 이게 의도된 UX인지 확인 필요 (원래 "말풍선 중복 버그"로 보고됐던 내용)

### ℹ️ 이재명 배틀 카드 미존재
- 이재명은 "AI 5분 토론" 탭에 없고 "AI 1:1 대화"에만 있음 (현재 대통령 설정)
- 태스크에서 "이재명 vs 정청래", "이재명 vs 장동혁" 조합 요청했으나 현재 없음
- 배틀 카드에 이재명 추가 여부는 형의 결정 필요

---

## 커밋 정보

```bash
commit bc16eaf
fix: /chat 라우트 리다이렉트 및 잘못된 debate type 폴백 처리
- /chat 직접 접근 시 빈 화면 → / 로 리다이렉트
- 유효하지 않은 debate type URL 접근 시 blank 화면 → 'seoul' 타입으로 폴백
```

---

## 스크린샷 (주요 장면)

| 장면 | 경로 |
|------|------|
| 홈페이지 AI 5분 토론 탭 | 정상 로딩 확인 |
| 이재명 1:1 채팅 + 추천질문 표시 | 추천질문 3개 생성 완료 |
| 이슈 토론 로더 (85% 진행) | 뉴스수집→팩트분석→논거구성 |
| 정청래 vs 장동혁 감정토론 시작 | 정상 시작 확인 |
| 모바일 뷰 (390px) | 반응형 레이아웃 정상 |

---

*테스트 환경: Chrome (OpenClaw), polichat.kr Production (Vercel)*
