/**
 * AI 답변 기반 추천 질문 3개 생성
 */
export async function generateSuggestedQuestions(
  lastUserMessage: string,
  lastAssistantMessage: string,
  politicianName: string,
  knowledge?: string,
): Promise<string[]> {
  const prompt = `정치인 "${politicianName}"과의 대화 맥락:

사용자 질문: ${lastUserMessage}
${politicianName}의 답변: ${lastAssistantMessage.slice(0, 500)}

${knowledge ? `관련 정보:\n${knowledge.slice(0, 300)}` : ''}

위 대화에서 사용자가 자연스럽게 이어서 할 만한 질문 3개를 추천해줘.
- 반드시 바로 위 대화 내용에서 이어지는 질문이어야 함 (맥락 무관한 질문 금지)
- 각 질문은 20자 이내로 짧게
- JSON 배열로만 응답: ["질문1", "질문2", "질문3"]`;

  try {
    const response = await fetch('/api/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.questions || [];
  } catch {
    return [];
  }
}
