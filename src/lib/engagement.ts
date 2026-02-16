/**
 * AI 응답의 몰입도(engagement) 점수 계산
 * 정치인이 대화에 얼마나 즐겁게 참여했는지 측정
 * 
 * 점수 기준:
 * - 이모지 사용: 최대 30점
 * - ㅋㅋ/하하 웃음: 최대 30점  
 * - 느낌표 사용: 최대 20점
 * - 긍정 키워드: 개당 10점
 * - 질문 (팬에게 관심): 15점
 * - 긴 응답 (50자+): 10점
 * 
 * 리액션 규칙:
 * - 50점 이상: 확정 리액션
 * - 30-49점: 50% 확률
 * - 30점 미만: 리액션 없음
 */

export function calculateEngagement(response: string): number {
  let score = 0;
  
  // 이모지 체크 (😊🥰😆 등 얼굴 이모지)
  const emojiCount = (response.match(/[\u{1F600}-\u{1F64F}]/gu) || []).length;
  score += Math.min(emojiCount * 10, 30);
  
  // ㅋㅋ/하하/ㅎㅎ 체크
  const laughCount = (response.match(/[ㅋㅎ]{2,}|하하|ㅎㅎ/g) || []).length;
  score += Math.min(laughCount * 15, 30);
  
  // 느낌표 체크
  const exclamationCount = (response.match(/!/g) || []).length;
  score += Math.min(exclamationCount * 5, 20);
  
  // 긍정 키워드
  const positiveKeywords = ['좋아', '대박', '진짜', '맞아', '나도', '그거', '알아', '재밌', '웃기'];
  positiveKeywords.forEach(kw => {
    if (response.includes(kw)) score += 10;
  });
  
  // 질문 (팬에게 관심 표현)
  if (response.includes('?')) score += 15;
  
  // 길이 보너스 (50자 이상이면 몰입도 높음)
  if (response.length > 50) score += 10;
  
  return Math.min(score, 100);
}

/**
 * engagement 점수에 따라 리액션 여부 결정
 */
export function shouldReact(engagementScore: number): boolean {
  if (engagementScore >= 50) {
    // 높은 몰입도 → 확정 리액션
    return true;
  } else if (engagementScore >= 30) {
    // 중간 몰입도 → 50% 확률
    return Math.random() < 0.5;
  } else {
    // 낮은 몰입도 → 리액션 없음
    return false;
  }
}
