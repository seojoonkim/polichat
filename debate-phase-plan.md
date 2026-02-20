# Polichat 토론 시스템 업그레이드 구현 계획

## 구현 순서 (의존성 기반)

```
Phase 1 (api/debate.js만 수정 — 프론트 변경 없음)
  1. 감정 에스컬레이션 → 2. 지문 삽입 → 3. 캐릭터 특화 공격 패턴
  → 4. 반전 카드 → 5. 3단 반박 구조

Phase 2 (프론트엔드 — 각각 독립적, 병렬 가능)
  6. 긴장도 게이지
  7. 관중 반응 이모지
  8. 사회자 AI 개입 (새 API 엔드포인트 필요)
  9. 맞장구 끼어들기
```

---

## Phase 1: 프롬프트 변경 (api/debate.js)

### 1. 감정 에스컬레이션 (Emotional Escalation)

**파일:** `api/debate.js`
**위치:** `getStylePrompt()` 함수 + handler의 턴 가이드 섹션

**새 데이터 구조:**

```javascript
// 모듈 최상위에 추가
const ESCALATION_CONFIG = {
  act1: { rounds: [1, 8], label: '1막 탐색', intensity: 'low' },
  act2: { rounds: [9, 18], label: '2막 격돌', intensity: 'mid' },
  act3: { rounds: [19, 30], label: '3막 결전', intensity: 'high' },
};

function getAct(historyLength) {
  // historyLength = 해당 speaker의 과거 발언 수 (0-indexed)
  // 양쪽 합산이므로 speaker 기준 턴 = historyLength (recentHistory.length)
  const totalRound = historyLength; // 전체 발언 수 기준
  if (totalRound <= 8) return ESCALATION_CONFIG.act1;
  if (totalRound <= 18) return ESCALATION_CONFIG.act2;
  return ESCALATION_CONFIG.act3;
}
```

**변경 1: `getStylePrompt()` — policy 스타일**

현재 (`policy` 분기 안):
```javascript
return `${baseContext}\n\n정책 토론 방식: 반드시 수치·통계...`;
```

변경 후:
```javascript
if (style === 'policy') {
  const act = getAct(historyLength);
  const escalation = {
    low: '차분하고 논리적으로. 상대를 탐색하며 핵심 입장을 정리하라.',
    mid: '더 공격적으로. 상대 논리의 허점을 직접 찌르고, 감정을 약간 섞어라. "그 논리라면~"',
    high: '결정타를 날려라. 가장 강력한 데이터로 상대를 압도하고, 확신에 찬 어조로 마무리하라.',
  };
  return `${baseContext}\n\n[${act.label}] ${escalation[act.intensity]}\n정책 토론 방식: 반드시 수치·통계·예산규모·법안명·기관 발표 등 데이터를 매 발언마다 1개 이상 직접 인용하세요...`;
}
```

**변경 2: `getStylePrompt()` — emotional 스타일**

현재 emotion pool에서 6개 선택하는 부분 뒤에 에스컬레이션 추가:
```javascript
const act = getAct(historyLength);
const emotionalEscalation = {
  low: `[1막 탐색] 감정은 아직 절제하라. 논리와 데이터 중심으로 탐색하되, 가끔 날카로운 한마디를 던져라. 60% 논리 + 40% 감정.`,
  mid: `[2막 격돌] 감정을 본격적으로 드러내라! 상대에게 직접 질문 던지고, 목소리 높이고, 허점 발견 즉시 끊어라. 40% 논리 + 60% 감정.`,
  high: `[3막 결전] 감정 폭발! 분노·경멸·풍자를 최대치로 끌어올려라. 상대를 완전히 압도하는 결정적 발언을 하라. 20% 논리 + 80% 감정. 마지막 승부수!`,
};

return `${baseContext}\n\n${emotionalEscalation[act.intensity]}\n\n감정 토론 방식: ...`;
```

**변경 3: `getStylePrompt()` — consensus 스타일**

consensus도 에스컬레이션 적용 (단, 합의 방향):
```javascript
const act = getAct(historyLength);
const consensusEscalation = {
  low: '', // 기존 phase 1-2 유지
  mid: '중반이다. 이견이 좁혀지지 않으면 더 직접적으로 조건부 제안을 던져라.',
  high: '마지막이다. 합의문을 도출하지 못하면 실패다. 최대한 양보하고 타협안을 완성하라.',
};
```

**변경 4: handler 내 턴 가이드 대체**

현재 코드:
```javascript
const turnNum = myPastMessages.length + 1;
if (turnNum <= 3) {
  systemPrompt += '\n\n📍 초반부: 핵심 주장 + 강력한 데이터로 선제 공격.';
} else if (turnNum <= 7) {
  systemPrompt += `\n\n📍 중반부: ${opponentName} 논리의 구체적 허점 파고들기. 새로운 증거 제시.`;
} else {
  systemPrompt += '\n\n📍 후반부: 아직 꺼내지 않은 숨겨둔 카드 사용. 감정적 호소 또는 결정타.';
}
```

변경 후:
```javascript
const act = getAct(recentHistory.length);
const actGuides = {
  low: `📍 [${act.label}] 핵심 주장 + 강력한 데이터로 선제 공격. 상대를 탐색하라.`,
  mid: `📍 [${act.label}] ${OPPONENTS[speaker]} 논리의 구체적 허점 파고들기. 감정 격화. 직접 충돌하라!`,
  high: `📍 [${act.label}] 감정 폭발! 아직 꺼내지 않은 숨겨둔 카드 사용. 결정타를 날려라!`,
};
systemPrompt += `\n\n${actGuides[act.intensity]}`;
```

---

### 2. 지문 삽입 (Stage Directions)

**파일:** `api/debate.js`
**위치:** handler 내, 에스컬레이션 가이드 바로 뒤

**새 데이터 구조:**

```javascript
// 모듈 최상위
const STAGE_DIRECTIONS = {
  // 공통 (모든 캐릭터)
  common: {
    low: [
      '(자료를 펼치며)', '(안경을 고쳐 쓰며)', '(마이크를 가까이 당기며)',
      '(상대를 바라보며)', '(자료를 넘기며)', '(고개를 끄덕이며)',
    ],
    mid: [
      '(목소리를 높이며)', '(손가락으로 탁자를 두드리며)', '(몸을 앞으로 기울이며)',
      '(실소하며)', '(고개를 저으며)', '(손으로 제지하며)',
      '(자료를 탁 내려놓으며)', '(상대를 가리키며)',
    ],
    high: [
      '(책상을 탁 치며)', '(자리에서 일어서며)', '(마이크를 잡고 몸을 앞으로 숙이며)',
      '(격앙된 목소리로)', '(자료를 던지듯 내밀며)', '(씁쓸하게 웃으며)',
      '(주먹을 불끈 쥐며)', '(고개를 돌리며 탄식하고)',
    ],
  },
  // 캐릭터별 고유 지문
  leejunseok: {
    low: ['(노트북을 열며)', '(데이터를 확인하며)'],
    mid: ['(냉소적으로 웃으며)', '(손가락으로 숫자를 세며)'],
    high: ['(자리에서 벌떡 일어나며)', '(안경을 벗어 탁자에 내려놓으며)'],
  },
  jeonhangil: {
    low: ['(역사책을 펼치며)', '(칠판을 가리키듯)'],
    mid: ['(주먹으로 가슴을 치며)', '(목소리에 울림을 담아)'],
    high: ['(눈시울을 붉히며)', '(두 손을 번쩍 들며)', '(격앙되어 자리에서 벌떡)'],
  },
  jungcr: {
    low: ['(천천히 사자성어를 읊으며)'],
    mid: ['(손바닥으로 탁자를 내리치며)', '(손가락을 하나씩 세며)'],
    high: ['(벌떡 일어나 상대를 가리키며)', '(주먹을 불끈 쥐고 목소리를 높이며)'],
  },
  jangdh: {
    low: ['(서류를 정리하며)', '(법전을 펼치며)'],
    mid: ['(안경 너머로 날카롭게 바라보며)', '(차갑게 미소 지으며)'],
    high: ['(서류를 탁 덮으며)', '(냉정하게 한 마디 한 마디 또박또박)'],
  },
  ohsehoon: {
    low: ['(자료를 넘기며)', '(당당하게 어깨를 펴며)'],
    mid: ['(손으로 지도를 가리키며)', '(목소리에 힘을 주며)'],
    high: ['(탁자를 두드리며)', '(일어서서 패널을 가리키며)'],
  },
  jungwono: {
    low: ['(주민 사진을 보여주며)', '(현장 자료를 꺼내며)'],
    mid: ['(주먹을 쥐며)', '(진지한 표정으로 몸을 기울이며)'],
    high: ['(격앙된 목소리로 탁자를 치며)', '(눈시울을 붉히며)'],
  },
  kimeoojun: {
    low: ['(천천히 커피를 내려놓으며)', '(안경을 만지작거리며)'],
    mid: ['(의미심장하게 웃으며)', '(손가락으로 허공을 가리키며)'],
    high: ['(자리에서 일어나며)', '(흥분하여 마이크를 잡으며)'],
  },
  jinjungkwon: {
    low: ['(비꼬듯 미소 지으며)', '(고개를 갸웃하며)'],
    mid: ['(콧웃음을 치며)', '(손으로 이마를 짚으며)'],
    high: ['(탄식하며)', '(독설을 내뱉듯 빠르게)'],
  },
};

function getStageDirection(speaker, intensity) {
  const common = STAGE_DIRECTIONS.common[intensity] || [];
  const personal = (STAGE_DIRECTIONS[speaker] || {})[intensity] || [];
  const pool = [...personal, ...common];
  return pool[Math.floor(Math.random() * pool.length)] || '';
}
```

**주입 위치:** handler 내, 최종 systemPrompt 조립 직전:
```javascript
// 에스컬레이션 가이드 뒤에 추가
const act = getAct(recentHistory.length);
const stageDir = getStageDirection(speaker, act.intensity);
if (stageDir) {
  systemPrompt += `\n\n🎭 연출 지문: 이번 발언을 시작할 때 "${stageDir}" 를 발언 맨 앞에 자연스럽게 삽입하라. 예: "${stageDir} 그 논리가 통한다고 생각하십니까?"`;
}
```

---

### 3. 캐릭터 특화 공격 패턴

**파일:** `api/debate.js`
**위치:** handler 내, PERSONAS 뒤에 새 상수 + 에스컬레이션 가이드 근처 주입

**새 데이터 구조:**

```javascript
const CHARACTER_ATTACK_PATTERNS = {
  leejunseok: {
    method: '귀류법(reductio ad absurdum) + 정확한 수치',
    instruction: `공격 방법: 상대 주장을 극단까지 밀고 가서 모순을 드러내라(귀류법).
예: "${OPPONENTS.leejunseok}의 논리대로라면, X도 성립해야 하는데, 실제로는 Y입니다. 수치로 보면 Z%죠."
반드시 정확한 수치(%, 조, 억, 건, 명)를 포함하라.`,
  },
  jeonhangil: {
    method: '도덕적 분노 폭발 + 애국심 호소',
    instruction: `공격 방법: 도덕적 분노를 폭발시키고, 대한민국·국민·역사를 호소하라.
예: "이것이 대한민국을 사랑하는 사람이 할 짓입니까! X만 국민이 지켜보고 있습니다!"
감정적 호소 + 애국심을 핵심 무기로 사용.`,
  },
  jungcr: {
    method: '사자성어 + 리스트 나열 (1번 2번 3번)',
    instruction: `공격 방법: 사자성어로 시작하고, 반드시 번호 매겨 리스트로 근거를 나열하라.
예: "명명백백(明明白白)합니다! 첫째, X. 둘째, Y. 셋째, Z. 이래도 부인하시겠습니까?"
사자성어 1개 + 번호 리스트 3개 필수.`,
  },
  jangdh: {
    method: '법률 조문 인용 + 냉철한 논리',
    instruction: `공격 방법: 법률·조문·판례를 직접 인용하고, 감정 없이 냉철하게 논리를 전개하라.
예: "헌법 제X조에 따르면... 이에 비추어 봤을 때, 이 정책은 명백한 위헌 소지가 있습니다."
법적 근거 + 차분하지만 단호한 톤.`,
  },
  ohsehoon: {
    method: '행정 실적 과시 + 비전 제시',
    instruction: `공격 방법: 본인 실적(수치)을 먼저 과시한 뒤, 미래 비전으로 마무리하라.
예: "제가 서울시장으로서 X를 달성했습니다. 354곳 정비구역, 16조 강북르네상스. 앞으로 Y를 하겠습니다."
과거 실적 수치 → 미래 비전 구조.`,
  },
  jungwono: {
    method: '현장 경험 + 구체적 주민 사례',
    instruction: `공격 방법: 성동구 현장 경험과 구체적 주민 사례를 들어 반박하라.
예: "성동구에서 직접 겪었습니다. 젠트리피케이션 방지책을 전국 최초로 도입한 결과, X동 주민 Y명이..."
현장 사례 + 실제 주민 이야기.`,
  },
  kimeoojun: {
    method: '맥락 강조 + 음모론적 통찰',
    instruction: `공격 방법: "맥락을 봐야 합니다"로 시작하고, 숨겨진 구조·의도를 드러내라.
예: "팩트만 보면 안 됩니다. 맥락을 봐야 해요. 왜 이 시점에 X가 나왔는지, 누가 이득을 보는지..."
맥락 → 숨겨진 의도 → 구조적 비판.`,
  },
  jinjungkwon: {
    method: '독설 비유 + 내로남불 프레임',
    instruction: `공격 방법: 날카로운 비유·은유로 상대를 조롱하고, 내로남불 프레임을 씌워라.
예: "웃기는 소리 하고 있네요. 이건 마치 X가 Y하는 격입니다. 본인들이 하면 로맨스, 남이 하면 불륜이죠."
비유 1개 + 내로남불 지적 필수.`,
  },
};
```

**주입 위치:** handler 내, 에스컬레이션 가이드 뒤:
```javascript
const attackPattern = CHARACTER_ATTACK_PATTERNS[speaker];
if (attackPattern) {
  systemPrompt += `\n\n🗡️ 캐릭터 공격 패턴 (${attackPattern.method}):\n${attackPattern.instruction}`;
}
```

---

### 4. 반전 카드 (Reversal Card)

**파일:** `api/debate.js`
**위치:** handler 내 — 에스컬레이션 가이드 근처, `act.intensity === 'high'`일 때만 주입

**새 데이터 구조:**

```javascript
const REVERSAL_CARDS = {
  leejunseok: [
    '전한길이 본명 전유관으로 국민의힘 입당 시도했다가 거부당한 사실 — 지지하는 당에서 두 번이나 거절당한 인물이 보수를 대변?',
    '건국펀드 100억 모금 선언 후 72시간 만에 자진 중단 — 본인이 불법 소지를 인정한 것',
    '전한길 TV조선 심의 부적격 판정(2026.2.13) — 보수 언론까지 음모론 인정',
    '전한길 "3권분립 폐지·발해 수복" 발언(서울신문 2026.2.12) — 보수 내부에서도 황당',
    '전한길 유튜브 53만 구독자 중 실제 투표로 연결된 정치 성과 0건 — 구독자 = 정치력 아님',
  ],
  jeonhangil: [
    '이준석 성 접대 의혹 — 공소권없음은 무죄가 아님, 공소시효 만료로 처벌 못한 것',
    '이준석 젓가락 발언(2025.5.27) 직후 지지율 15%→8.34% 폭락 — 국민이 본질을 꿰뚫어본 것',
    '이준석 SW마에스트로 병역 특혜 — 공정을 외치면서 본인은 병역에서 특혜',
    '개혁신당 대표직 허은아에게 이양(2024.5.19) — 자기가 만든 당에서도 밀려나는 리더십',
    '이준석 동덕여대+서부지법 양비론(2025.2.18) — 확실한 입장 없이 양쪽 비판은 비겁',
  ],
  jungcr: [
    '국민의힘 공약 이행률 35.3%, 72개 파기 — 뉴스톱 윤석열미터, 국민 기만의 역사',
    '병사월급 200만원 공약→실제 125만원, 적금 포함 꼼수 — 청년 기만',
    '장동혁 대표 본인 6채 보유(2026.2) — 다주택자 규제하면서 본인은 다주택',
    '윤석열 정부 부자감세로 5년 세수 -3.9조 — 감세해놓고 세수 펑크는 국민 탓?',
    '12.3 계엄 후 무기징역(2026.2.19) — 이 당이 민주주의를 말할 자격이 있나?',
  ],
  jangdh: [
    '이재명 기본소득 100만원 공약 집권하자마자 철회 — 대국민 사기',
    '탈원전 주장하다 180도 전환 — 정책 일관성 제로',
    '10.15 대책 3중 규제 후에도 서울 집값 하락 없음 — 규제만으로 집값 못 잡는 증거',
    'LH 부채 160조 이상인데 기본주택 100만호 — 재정 파탄 자초',
    '경제 노선 우클릭: "재벌개혁"에서 "AI 210조 투자"로 — 진보 정체성 상실',
  ],
  ohsehoon: [
    '정원오 무상급식 주민투표 투표율 미달(25.7%) — 민의 확인도 못 한 정책',
    '성동구 젠트리피케이션 방지 주장하지만 성수동 임대료는 5년간 300% 급등',
    '구청장 경험만으로 서울 전체를 감당할 수 있나? 규모의 차이를 인식 못하는 것',
    '정원오 예산 7,642억 — 서울시 51.5조의 1.5%. 서울 전체를 이 규모로 운영할 수 있나?',
    '보편복지 강조하지만 재원 마련 계획 구체적으로 제시한 적 없음',
  ],
  jungwono: [
    '오세훈 신통기획 196곳 중 3곳만 승인 — 승인율 1.5%, 실적 부풀리기',
    '오세훈 무상급식 반대 주민투표 강행(2011) — 투표율 미달로 개표도 못한 흑역사',
    '강북르네상스 16조 투자 발표했지만 10년 장기 — 현 임기 내 성과 보장 없음',
    '서울시 버스 준공영제 적자 5,000억→8,000억 전망 — 교통 재정 관리 실패',
    '태양광 보조금 중단, 에너지 협동조합 폐지 — 환경 정책 후퇴',
  ],
  kimeoojun: [
    '진중권 과거 노무현 지지→비판→문재인 지지→비판→이재명 비판 — 일관성 0, 기회주의',
    '진중권 비판의 수혜자가 보수·국민의힘 — 의도와 결과의 괴리, 사실상 보수 대변인',
    '진중권 대안 없는 독설 — 민주당 비판하면서 대안적 비전 제시 못 함',
    '"조국이 떨어지면 진보 포기" 발언 후 결국 본인이 진보를 포기 — 자기 예언 실현',
    '진중권이 극우 유튜버·보수 언론과 연대 — 진보 비판이 아니라 보수 프레임 전파',
  ],
  jinjungkwon: [
    '김어준 대통령 전용기 무단 탑승(2021) — 특권 의식 그 자체',
    'TBS 뉴스공장 편파방송으로 해고(2022.11) — 공영방송 사유화한 장본인',
    '나꼼수 BBK 논란 과장 — 법원 허위사실 인정, 10년 넘은 사실왜곡의 역사',
    '부정선거 의혹 동조 — 음모론 유통자, 반지성주의 주범',
    '"팩트보다 맥락" 논리 — 언론인이 팩트를 외면하겠다는 선언',
  ],
};
```

**주입 로직:** handler 내, 에스컬레이션 가이드 근처:
```javascript
// 반전 카드: 3막(round 20+)에서만 활성화
const act = getAct(recentHistory.length);
if (act.intensity === 'high' && recentHistory.length >= 20) {
  const cards = REVERSAL_CARDS[speaker];
  if (cards && cards.length > 0) {
    // 이미 사용한 카드 제외 (과거 발언에서 키워드 매칭)
    const allMyText = myPastMessages.map(m => m.text).join(' ');
    const unusedCards = cards.filter(card => {
      const keywords = card.split(/[—,]/).map(s => s.trim().slice(0, 10));
      return !keywords.some(kw => kw.length > 5 && allMyText.includes(kw));
    });
    if (unusedCards.length > 0) {
      const chosen = unusedCards[Math.floor(Math.random() * unusedCards.length)];
      systemPrompt += `\n\n💣 반전 카드 (숨겨둔 결정타 — 이번 발언에서 반드시 사용하라!):\n"${chosen}"\n이 논거를 이번 발언의 핵심으로 사용하라. 상대가 예상하지 못한 결정적 한방이다!`;
    }
  }
}
```

---

### 5. 3단 반박 구조 (3-Step Rebuttal)

**파일:** `api/debate.js`
**위치:** handler 내, 기존 `rebutClaim` 주입 부분 대체

**현재 코드:**
```javascript
const rebutClaim = mustRebutClaim || extractKeyClaim(opponentLastMessage);
if (rebutClaim) {
  systemPrompt += `\n\n🎯 필수 반박 (이걸 직접 공격하지 않으면 패배): "${rebutClaim}"`;
}
```

**변경 후:**
```javascript
const rebutClaim = mustRebutClaim || extractKeyClaim(opponentLastMessage);
if (rebutClaim) {
  systemPrompt += `\n\n🎯 필수 3단 반박 (이 구조를 반드시 따르라):
Step 1 — 직접 인용: "${rebutClaim}" ← 상대가 한 이 주장을 정확히 인용하며 시작하라. "~라고 하셨는데"
Step 2 — 팩트 반박: 구체적 수치·데이터·사례로 정면 반박하라. "실제로는 X입니다. Y 기관에 따르면..."
Step 3 — 프레임 재설정: 토론의 프레임 자체를 바꿔라. "이건 X의 문제가 아니라 Y의 문제입니다."
⚠️ 3단계를 모두 포함하되, 4문장 이내로 압축하라.`;
}
```

**2막(mid) 이상에서만 강제 (1막에서는 기존 방식 유지):**
```javascript
const rebutClaim = mustRebutClaim || extractKeyClaim(opponentLastMessage);
if (rebutClaim) {
  const act = getAct(recentHistory.length);
  if (act.intensity === 'low') {
    // 1막: 기존 단순 반박
    systemPrompt += `\n\n🎯 필수 반박: "${rebutClaim}" — 이 주장을 직접 반박하라.`;
  } else {
    // 2-3막: 3단 반박 구조 강제
    systemPrompt += `\n\n🎯 필수 3단 반박 (이 구조를 반드시 따르라):
Step 1 — 직접 인용: "${rebutClaim}" ← "~라고 하셨는데"
Step 2 — 팩트 반박: 수치·데이터로 정면 반박. "실제로는..."
Step 3 — 프레임 재설정: "이건 X가 아니라 Y 문제입니다"
⚠️ 3단계를 자연스럽게 4문장 이내로.`;
  }
}
```

---

## Phase 2: 프론트엔드 기능

### 6. 실시간 긴장도 게이지 (Tension Gauge)

**파일:** 새 파일 `src/components/debate/TensionGauge.tsx` + `DebateView.tsx` 수정

**새 파일: `src/components/debate/TensionGauge.tsx`**

```tsx
import { useMemo } from 'react';

interface TensionGaugeProps {
  messages: { speaker: string; text: string }[];
  round: number;
  maxRound: number;
}

// 긴장도 계산
const TENSION_KEYWORDS = {
  attack: ['거짓', '실패', '황당', '부끄럽', '웃기', '말이 됩니까', '사기', '기만', '위선', '배신', '음모', '폭탄'],
  emotional: ['분노', '충격', '경악', '한심', '부끄럽', '치욕', '눈물', '울분'],
  data_attack: ['반박', '팩트', '근거', '수치', '통계', '실제로는'],
};

function calcTension(messages: { text: string }[], round: number, maxRound: number): number {
  // 기본 긴장도: 라운드 진행에 따라 자연 상승 (0~40)
  const roundTension = Math.min(40, (round / maxRound) * 40);

  // 최근 6개 메시지 기준 키워드 카운트
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

  // 교차 공격 빈도 (연속 다른 화자 = 충돌 중)
  let crossAttacks = 0;
  for (let i = 1; i < recent.length; i++) {
    if (recent[i].speaker !== recent[i - 1].speaker) crossAttacks++;
  }
  const crossScore = Math.min(20, crossAttacks * 4);

  return Math.min(100, Math.round(roundTension + keywordScore + crossScore));
}

export default function TensionGauge({ messages, round, maxRound }: TensionGaugeProps) {
  const tension = useMemo(() => calcTension(messages, round, maxRound), [messages, round, maxRound]);

  const color = tension < 33 ? '#FCD34D' : tension < 66 ? '#F97316' : '#EF4444';
  const flames = tension < 33 ? '🔥' : tension < 66 ? '🔥🔥' : '🔥🔥🔥';

  return (
    <div style={{ width: '100%', padding: '8px 16px', marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          {flames} 긴장도
        </span>
        <span style={{ fontSize: 12, color: '#888' }}>{tension}%</span>
      </div>
      <div style={{
        width: '100%', height: 8, borderRadius: 4,
        background: '#333', overflow: 'hidden',
      }}>
        <div style={{
          width: `${tension}%`, height: '100%', borderRadius: 4,
          background: `linear-gradient(90deg, #FCD34D, ${color})`,
          transition: 'width 0.5s ease, background 0.5s ease',
          boxShadow: tension > 66 ? `0 0 8px ${color}` : 'none',
        }} />
      </div>
    </div>
  );
}

// 외부에서 tension 값 사용 가능하도록 export
export { calcTension };
```

**DebateView.tsx 수정:**

```tsx
// import 추가
import TensionGauge from './TensionGauge';

// phase === 'running' 렌더 영역, 타이머 바로 아래에:
{phase === 'running' && (
  <TensionGauge messages={messages} round={_round} maxRound={30} />
)}
```

---

### 7. 관중 반응 이모지 (Audience Reactions)

**새 파일: `src/components/debate/AudienceReaction.tsx`**

```tsx
import { useEffect, useState } from 'react';

interface AudienceReactionProps {
  messageText: string;
  tension: number;
  show: boolean; // 메시지 완료 시 true
}

const REACTION_RULES = [
  { keywords: ['거짓', '사기', '위선', '배신', '폭탄', '공격', '비판'], emoji: '💥' },
  { keywords: ['조', '억', '만명', '퍼센트', '%', '통계', '데이터'], emoji: '😲' },
  { keywords: ['웃기', '실소', '명불허전', '창의적', '훌륭하십니다'], emoji: '🤣' },
  { keywords: ['국민', '민주주의', '역사', '대한민국', '수호', '핵심'], emoji: '👏' },
];

function detectReactions(text: string, tension: number): string[] {
  const reactions: string[] = [];
  for (const rule of REACTION_RULES) {
    if (rule.keywords.some(kw => text.includes(kw))) {
      reactions.push(rule.emoji);
    }
  }
  // 긴장도 기반 보너스
  const count = tension > 66 ? 5 : tension > 33 ? 3 : 2;
  // 부족하면 기본 이모지 추가
  while (reactions.length < count) {
    reactions.push(['👏', '💥', '😲'][Math.floor(Math.random() * 3)]);
  }
  return reactions.slice(0, count);
}

export default function AudienceReaction({ messageText, tension, show }: AudienceReactionProps) {
  const [emojis, setEmojis] = useState<string[]>([]);

  useEffect(() => {
    if (!show) return;
    const detected = detectReactions(messageText, tension);
    setEmojis(detected);
    // 2.5초 후 자동 삭제
    const timer = setTimeout(() => setEmojis([]), 2500);
    return () => clearTimeout(timer);
  }, [show, messageText, tension]);

  if (emojis.length === 0) return null;

  return (
    <div style={{ position: 'relative', height: 0 }}>
      {emojis.map((emoji, i) => (
        <span
          key={`${emoji}-${i}`}
          style={{
            position: 'absolute',
            left: `${20 + i * 15}%`,
            bottom: 0,
            fontSize: 24,
            animation: `floatUp 2s ease-out forwards`,
            animationDelay: `${i * 0.15}s`,
            opacity: 0,
          }}
        >
          {emoji}
        </span>
      ))}
      <style>{`
        @keyframes floatUp {
          0% { transform: translateY(0); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translateY(-80px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
```

**DebateView.tsx 수정:** 각 완성된 메시지 버블 바로 아래에 렌더:
```tsx
import AudienceReaction from './AudienceReaction';
import { calcTension } from './TensionGauge';

// 메시지 렌더링 루프 내 (각 msg 버블 뒤):
<AudienceReaction
  messageText={msg.text}
  tension={calcTension(messages.slice(0, idx + 1), _round, 30)}
  show={idx === messages.length - 1} // 가장 최근 메시지만
/>
```

---

### 8. 사회자 AI 개입 (Moderator AI)

**새 API 파일: `api/debate-moderator.js`**

```javascript
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { messages, currentTopic, debateType } = req.body;
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
  const isOpenAI = apiKey.startsWith('sk-proj-') || (apiKey.startsWith('sk-') && !apiKey.startsWith('sk-or-'));
  const apiBase = isOpenAI ? 'https://api.openai.com/v1' : 'https://openrouter.ai/api/v1';

  const recentTexts = messages.slice(-6).map(m => m.text).join('\n');

  const systemPrompt = `당신은 한국 TV 토론 사회자입니다. 중립적이고 공정하며, 토론의 흐름을 관리합니다.
현재 주제: "${currentTopic}"
최근 토론 내용을 분석하고, 사회자로서 한 마디 개입하세요.

역할:
- 같은 주제 반복 시: "잠깐, 주제를 정리하겠습니다. 지금까지의 핵심 쟁점은..."
- 논점 이탈 시: "본론으로 돌아가시죠. 원래 논의하던..."  
- 감정 과열 시: "양측 모두 진정하시고, 국민이 듣고 싶은 건..."
- 새로운 질문: "여기서 한 가지 여쭤보겠습니다. X에 대해..."

규칙: 2문장 이내. 존댓말. 중립. 구체적.`;

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey.trim()}`,
  };
  if (!isOpenAI) {
    headers['HTTP-Referer'] = 'https://polichat.kr';
    headers['X-Title'] = 'PoliChat Moderator';
  }

  const response = await fetch(`${apiBase}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: isOpenAI ? 'gpt-4o-mini' : 'openai/gpt-4o-mini',
      max_tokens: 150,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `최근 토론:\n${recentTexts}\n\n사회자로서 개입하세요.` },
      ],
    }),
  });

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '잠깐, 논점을 정리하겠습니다.';
  res.json({ text });
}
```

**DebateView.tsx 수정:**

```tsx
// 상수 추가
const MODERATOR_INTERVAL = 6; // 6라운드마다

// runLiveDebate 내, 라운드 루프 안 (라운드 완료 후):
// 사회자 개입 체크
if ((i + 1) % MODERATOR_INTERVAL === 0 && !abortRef.current) {
  try {
    const modRes = await fetch('/api/debate-moderator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: allMessages.slice(-6),
        currentTopic: selectedTopic === 'free' ? freeTopicRef.current : initialTopic,
        debateType,
      }),
    });
    const modData = await modRes.json();
    if (modData.text) {
      const modMsg: DebateMessage = {
        speaker: '__moderator__',
        text: `🎙️ ${modData.text}`,
        timestamp: Date.now(),
      };
      allMessages.push(modMsg);
      setMessages(prev => [...prev, modMsg]);
      scrollToBottom();
      await sleep(2000);
    }
  } catch (e) {
    console.error('[moderator] Error:', e);
  }
}
```

**사회자 메시지 UI (메시지 렌더 영역):**
```tsx
// 메시지 렌더링에서 speaker === '__moderator__' 분기:
{msg.speaker === '__moderator__' && (
  <div style={{
    background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: '12px 16px',
    margin: '8px 24px',
    textAlign: 'center',
    fontSize: 14,
    color: '#e2e8f0',
    fontStyle: 'italic',
  }}>
    {msg.text}
  </div>
)}
```

**주제 반복 감지 (선택적 강화):**
```tsx
// runLiveDebate 내, 사회자 개입 조건 확장:
const shouldModerate = (i + 1) % MODERATOR_INTERVAL === 0 || (() => {
  // 같은 테마 3회 반복 감지
  const recent6 = allMessages.slice(-6).map(m => m.text).join(' ');
  const themeCount: Record<string, number> = {};
  const themes = ['부동산', '경제', '연금', '검찰', '부정선거', '탄핵'];
  for (const t of themes) {
    const count = (recent6.match(new RegExp(t, 'g')) || []).length;
    if (count >= 3) return true;
  }
  return false;
})();
```

---

### 9. 맞장구 끼어들기 (Interjection/Heckling)

**새 파일: `src/components/debate/Interjection.tsx`**

```tsx
import { useEffect, useState } from 'react';

interface InterjectionProps {
  streamingText: string;
  opponentSpeaker: string;
  isStreaming: boolean;
}

const INTERJECTIONS: Record<string, string[]> = {
  ohsehoon: ['그건 사실이 아닙니다!', '잠깐만요!', '근거를 대세요!', '착각하고 계시네요.'],
  jungwono: ['아닙니다!', '현장을 모르시는 거예요!', '주민들한테 물어보세요!', '그게 다가 아닙니다!'],
  jungcr: ['천만에요!', '거짓입니다!', '명명백백한 거짓말!', '국민이 다 보고 있습니다!'],
  jangdh: ['법적 근거가 없습니다.', '사실 왜곡입니다.', '수치를 확인하십시오.', '그건 다른 문제입니다.'],
  leejunseok: ['그건 논리적으로 안 맞죠.', '출처가 어디입니까?', '팩트체크 하시죠.', '웃기시네요.'],
  jeonhangil: ['거짓말!', '그건 왜곡입니다!', '국민이 판단합니다!', '역사가 증명할 겁니다!'],
  kimeoojun: ['맥락을 빼셨네요.', '그게 다가 아닌데...', '잠깐만요.', '핵심을 비켜가시는데요.'],
  jinjungkwon: ['웃기는 소리.', '논리가 왜 그러세요?', '내로남불이죠.', '비약이 심하시네요.'],
};

const TRIGGER_KEYWORDS = ['거짓', '실패', '사기', '위선', '배신', '무능', '파탄', '폭탄', '기만', '망신', '황당', '부끄럽', '음모'];

export default function Interjection({ streamingText, opponentSpeaker, isStreaming }: InterjectionProps) {
  const [interjection, setInterjection] = useState<string | null>(null);
  const [shownCount, setShownCount] = useState(0);

  useEffect(() => {
    if (!isStreaming || !streamingText || shownCount >= 2) return; // 최대 2회

    // 트리거 키워드 감지
    const triggered = TRIGGER_KEYWORDS.some(kw => streamingText.includes(kw));
    if (!triggered) return;

    // 이미 보여준 적 있으면 건너뛰기 (같은 스트리밍 세션)
    const pool = INTERJECTIONS[opponentSpeaker] || ['잠깐만요!'];
    const chosen = pool[Math.floor(Math.random() * pool.length)];

    setInterjection(chosen);
    setShownCount(prev => prev + 1);

    const timer = setTimeout(() => setInterjection(null), 2000);
    return () => clearTimeout(timer);
  }, [streamingText.length > 50 ? streamingText.slice(-50) : streamingText]); // 50자 단위 체크

  // 스트리밍 세션 리셋
  useEffect(() => {
    if (!isStreaming) {
      setShownCount(0);
    }
  }, [isStreaming]);

  if (!interjection) return null;

  return (
    <div style={{
      position: 'absolute',
      top: -30,
      right: 0,
      background: 'rgba(255,255,255,0.95)',
      color: '#333',
      padding: '4px 10px',
      borderRadius: 12,
      fontSize: 12,
      fontWeight: 600,
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      animation: 'fadeInOut 2s ease-in-out',
      zIndex: 10,
    }}>
      {interjection}
      <style>{`
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translateY(10px); }
          15% { opacity: 1; transform: translateY(0); }
          85% { opacity: 1; }
          100% { opacity: 0; transform: translateY(-5px); }
        }
      `}</style>
    </div>
  );
}
```

**DebateView.tsx 수정:**
현재 스트리밍 중인 화자의 반대편 프로필 영역에 렌더:
```tsx
import Interjection from './Interjection';

// 스트리밍 중 말풍선 렌더 영역에서, 상대방 쪽:
// currentSpeaker가 speakerA면 → speakerB 쪽에 Interjection
{currentSpeaker && (
  <div style={{ position: 'relative' }}>
    <Interjection
      streamingText={currentText}
      opponentSpeaker={
        currentSpeaker === config.speakerA ? config.speakerB : config.speakerA
      }
      isStreaming={!!currentSpeaker}
    />
  </div>
)}
```

---

## API 변경 요약

| 변경 | 파일 | 타입 |
|------|------|------|
| `getAct()` 함수 추가 | api/debate.js | 새 함수 |
| `ESCALATION_CONFIG` 상수 | api/debate.js | 새 상수 |
| `STAGE_DIRECTIONS` 상수 | api/debate.js | 새 상수 |
| `CHARACTER_ATTACK_PATTERNS` 상수 | api/debate.js | 새 상수 |
| `REVERSAL_CARDS` 상수 | api/debate.js | 새 상수 |
| `getStageDirection()` 함수 | api/debate.js | 새 함수 |
| 에스컬레이션 가이드 교체 | api/debate.js handler | 수정 |
| 반박 구조 강화 | api/debate.js handler | 수정 |
| `/api/debate-moderator` 엔드포인트 | api/debate-moderator.js | 새 파일 |

## 프론트엔드 변경 요약

| 변경 | 파일 | 타입 |
|------|------|------|
| TensionGauge 컴포넌트 | src/components/debate/TensionGauge.tsx | 새 파일 |
| AudienceReaction 컴포넌트 | src/components/debate/AudienceReaction.tsx | 새 파일 |
| Interjection 컴포넌트 | src/components/debate/Interjection.tsx | 새 파일 |
| DebateView에 import + 렌더 | src/components/debate/DebateView.tsx | 수정 |
| `__moderator__` 메시지 타입 처리 | src/components/debate/DebateView.tsx | 수정 |

## 잠재적 이슈 및 해결

### 1. 프롬프트 토큰 증가
- **문제:** Phase 1 변경으로 systemPrompt가 더 길어짐 (에스컬레이션 + 지문 + 공격패턴 + 반전카드 + 3단반박)
- **해결:** max_tokens=300 유지. systemPrompt 총 길이 모니터링. 에스컬레이션/지문/공격패턴은 짧은 텍스트라 ~200토큰 추가 수준. 반전카드는 3막에서만 활성화.

### 2. 사회자 API 레이턴시
- **문제:** 6라운드마다 추가 API 호출 → 대기 시간 발생
- **해결:** 사회자 호출은 non-streaming(일반 completion). max_tokens=150으로 짧게. 실패 시 조용히 스킵. UX상 "사회자가 정리 중..." 로딩 표시 가능.

### 3. Interjection 트리거 빈도
- **문제:** 키워드가 매우 자주 등장 → 끼어들기 과도
- **해결:** `shownCount >= 2` 제한 (스트리밍 세션당 최대 2회). 다음 화자 턴에서 리셋.

### 4. 긴장도 게이지 정확도
- **문제:** 키워드 기반이라 맥락 무시 가능
- **해결:** 키워드 가중치 튜닝 + 라운드 자연 상승(40%)이 베이스라인. 완벽한 정확도보다 "느낌"이 중요. 추후 LLM 기반 sentiment 분석 가능.

### 5. 캐시 호환성
- **문제:** 기존 캐시된 토론에는 사회자 메시지, 에스컬레이션이 없음
- **해결:** 캐시 키에 PROMPT_VERSION 이미 포함되어 있으므로, 버전 올리면 자동 무효화. `src/constants/debate-config.ts`의 PROMPT_VERSION 업데이트.

### 6. `__moderator__` 타입 호환
- **문제:** 기존 DebateMessage 타입에 moderator 처리 없음
- **해결:** speaker 필드가 string이므로 `__moderator__`도 수용. 판정 로직에서 moderator 메시지 제외 필요 (judging 시 filter).
