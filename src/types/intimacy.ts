// 친밀도 칭호 매핑 (팬-아이돌 관계 발전 순서)
export const INTIMACY_TITLES: Record<number, string> = {
  0: '처음 만난 사이',    // 1-10: 시작
  1: '아는 사이',         // 11-20: 인지
  2: '친해진 사이',       // 21-30: 친밀감 시작
  3: '특별한 친구',       // 31-40: 특별함
  4: '베프',              // 41-50: 최고의 친구
  5: '소울메이트',        // 51-60: 영혼의 동반자
  6: '단 하나뿐인',       // 61-70: 유일무이
  7: '운명의 상대',       // 71-80: 운명
  8: '전설의 팬',         // 81-90: 전설급
  9: '영원한 인연 ✨',    // 91-99: 최고 등급
};

// 칭호별 아이콘 매핑
export const INTIMACY_ICONS: Record<number, string> = {
  0: '/icons/intimacy/lv0-wave.svg',
  1: '/icons/intimacy/lv1-people.svg',
  2: '/icons/intimacy/lv2-heart.svg',
  3: '/icons/intimacy/lv3-star.svg',
  4: '/icons/intimacy/lv4-hearts.svg',
  5: '/icons/intimacy/lv5-sparkle.svg',
  6: '/icons/intimacy/lv6-crown.svg',
  7: '/icons/intimacy/lv7-diamond.svg',
  8: '/icons/intimacy/lv8-trophy.svg',
  9: '/icons/intimacy/lv9-infinity.svg',
};

// 칭호 가져오기 함수
export function getIntimacyTitle(level: number): string {
  const tier = Math.floor(level / 10);
  return INTIMACY_TITLES[tier] ?? INTIMACY_TITLES[0]!;
}

// 아이돌별 친밀도 데이터
export interface IdolIntimacy {
  level: number; // 1~99
  exp: number; // 0~99 (100 도달 시 레벨업)
  totalExp: number; // 누적 EXP
  
  // 통계
  stats: {
    chatDays: number; // 대화 일수
    totalMessages: number; // 총 메시지 수
    reactionsReceived: number; // 받은 리액션 수
    consecutiveDays: number; // 연속 대화 일수
    lastChatDate: string | null; // YYYY-MM-DD
  };
}

// EXP 변동 이벤트
export interface ExpEvent {
  type: 'message' | 'daily_bonus' | 'reaction' | 'combo' | 'decay' | 'leave' | 'response_bonus';
  amount: number;
  timestamp: number;
}
