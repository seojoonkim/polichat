import { useCallback, useRef } from 'react';
import { useChatStore } from '@/stores/chat-store';
import { streamChat } from '@/lib/anthropic-client';
import { getRelevantContext } from '@/lib/keyword-rag';
import { calculateEngagement, shouldReact } from '@/lib/engagement';
import { generateSuggestedQuestions } from '@/lib/suggest-questions';
import type { KnowledgeCategory } from '@/types/politician';
import type { Message } from '@/types/chat';

/**
 * AI 응답을 파싱해서 말풍선 배열로 변환
 * 1. ** 마크다운 제거
 * 2. || 구분자로 분리 (시스템 프롬프트에서 지시)
 * 3. 번호 리스트 (1. 2. 3. ...) → 각 번호별 말풍선으로 분리
 * 4. 긴 응답 → 문장 단위로 2~3문장씩 자동 분리
 */
function parseAIResponse(text: string): string[] {
  // ** 마크다운 제거
  const cleaned = text.replace(/\*\*(.*?)\*\*/g, '$1');

  // || 구분자로 분리 (최우선)
  if (cleaned.includes('||')) {
    return cleaned.split('||').map(s => s.trim()).filter(s => s.length > 0);
  }

  // 번호 리스트 패턴 감지: "1. " "2. " 등이 2개 이상 있을 때
  const allNumbers = cleaned.match(/\d+\.\s/g);

  if (allNumbers && allNumbers.length >= 2) {
    // 번호 앞에서 분리 (lookahead)
    const parts = cleaned.split(/(?=\d+\.\s)/).map(s => s.trim()).filter(s => s);

    const bubbles: string[] = [];
    for (const part of parts) {
      if (part) bubbles.push(part);
    }
    return bubbles;
  }

  // 긴 응답 자동 분리 (150자 이상이면 문장 단위로 2~3문장씩)
  if (cleaned.length > 150) {
    // 한국어 문장 끝 패턴 (습니다. 해요. 있어요. 거예요. 등) + 영문 .!?
    const sentences = cleaned.split(/(?<=[다요죠네요\.!?])\s+/).filter(s => s.trim());
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
      const validBubbles = bubbles.filter(b => b.trim().length > 0);
      if (validBubbles.length > 1) return validBubbles;
    }
  }

  // 리스트 없으면 그냥 ** 제거한 텍스트 반환
  return [cleaned];
}

export function useChat(systemPrompt: string, knowledge?: Record<KnowledgeCategory, string> | null) {
  const messages = useChatStore((s) => s.messages);
  const currentPoliticianId = useChatStore((s) => s.currentPoliticianId);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const error = useChatStore((s) => s.error);
  const historyLoaded = useChatStore((s) => s.historyLoaded);
  const addMessage = useChatStore((s) => s.addMessage);
  const updateLastAssistantMessage = useChatStore(
    (s) => s.updateLastAssistantMessage,
  );
  const setStreaming = useChatStore((s) => s.setStreaming);
  const setError = useChatStore((s) => s.setError);
  const persistMessages = useChatStore((s) => s.persistMessages);
  const markUserMessagesAsRead = useChatStore((s) => s.markUserMessagesAsRead);
  const addReactionToLastUserMessage = useChatStore((s) => s.addReactionToLastUserMessage);
  
  // 메시지 큐잉 (AI 응답 중 입력한 메시지 저장)
  const pendingMessageRef = useRef<string | null>(null);

  // Add assistant message with simulated typing (for greeting/onboarding flow)
  // Shows typing indicator first, then reveals text after delay
  const addAssistantMessage = useCallback(
    (text: string, options?: { skipTyping?: boolean }) => {
      if (options?.skipTyping) {
        // 즉시 표시 (히스토리 로드 등)
        const { messages: currentMessages } = useChatStore.getState();
        const newMessage = {
          id: crypto.randomUUID(),
          role: 'assistant' as const,
          content: text,
          timestamp: Date.now() - 15000,
        };
        useChatStore.setState({ messages: [...currentMessages, newMessage] });
        setTimeout(() => persistMessages(), 50);
        return;
      }

      // 1) 빈 메시지 추가 + 스트리밍 상태 ON (로딩 인디케이터 표시)
      const msgId = crypto.randomUUID();
      const { messages: currentMessages } = useChatStore.getState();
      useChatStore.setState({
        messages: [...currentMessages, {
          id: msgId,
          role: 'assistant' as const,
          content: '',
          timestamp: Date.now(),
        }],
        isStreaming: true,
      });

      // 2) 0.8~1.5초 후 텍스트 채우고 스트리밍 OFF
      const typingDelay = 400 + Math.random() * 350;
      setTimeout(() => {
        const { messages: latestMessages } = useChatStore.getState();
        const updated = latestMessages.map(m =>
          m.id === msgId ? { ...m, content: text } : m
        );
        useChatStore.setState({ messages: updated, isStreaming: false });
        setTimeout(() => persistMessages(), 50);
      }, typingDelay);
    },
    [persistMessages],
  );

  // Add user message directly (for onboarding flow, bypasses isStreaming check)
  const addUserMessage = useCallback(
    (text: string) => {
      addMessage('user', text.trim());
      setTimeout(() => persistMessages(), 50);
    },
    [addMessage, persistMessages],
  );

  const sendMessage = useCallback(
    async (text: string, skipAI = false) => {
      if (!text.trim()) return;
      
      // AI 응답 중이면 큐에 저장하고 리턴
      if (isStreaming) {
        pendingMessageRef.current = text;
        return;
      }

      setError(null);
      // 새 질문 시작 시 추천 질문 즉시 초기화
      useChatStore.getState().clearSuggestedQuestions();
      addMessage('user', text.trim());

      // If skipAI, just add user message and return
      if (skipAI) {
        setTimeout(() => persistMessages(), 50);
        return;
      }

      // Need systemPrompt for AI call
      if (!systemPrompt) return;

      // Add empty assistant message as placeholder
      addMessage('assistant', '');
      setStreaming(true);

      // 0.5~1.2초 랜덤 딜레이 (읽는 척 - 타이핑 인디케이터가 보이는 상태)
      const readingDelay = 250 + Math.random() * 350;
      await new Promise(resolve => setTimeout(resolve, readingDelay));

      const conversationMessages = [
        // system 메시지는 AI 컨텍스트에서 제외 (레벨업 알림 등은 순수 UI용)
        ...messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user' as const, content: text.trim() },
      ];

      // 🔍 키워드 RAG: 사용자 메시지에서 키워드 감지하고 관련 정보 추가
      let enhancedSystemPrompt = systemPrompt;
      if (knowledge) {
        const relevantContext = getRelevantContext(text, knowledge as Record<string, string>);
        if (relevantContext) {
          enhancedSystemPrompt = systemPrompt + relevantContext;
          console.log('[RAG] 관련 컨텍스트 추가됨:', relevantContext.slice(0, 200) + '...');
        }
      }

      // 🕐 실시간 시간 정보 inject (시스템 프롬프트 로드 시점과 현재 시간 차이 보정)
      const now = new Date();
      const hour = now.getHours();
      let timeOfDay = '밤';
      if (hour >= 6 && hour < 12) timeOfDay = '아침';
      else if (hour >= 12 && hour < 18) timeOfDay = '낮';
      else if (hour >= 18 && hour < 23) timeOfDay = '저녁';
      
      const timeContext = `\n\n[⏰ 현재 시간 - 반드시 참고해서 시간에 맞는 인사/대화를 하세요!]
- 현재 시각: ${hour}시 ${now.getMinutes()}분
- 시간대: ${timeOfDay}
- 날짜: ${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일
- 예시: 아침이면 "좋은 아침입니다", 밤이면 "밤늦게 찾아주셨네요"`;
      
      enhancedSystemPrompt = enhancedSystemPrompt + timeContext;

      await streamChat({
        systemPrompt: enhancedSystemPrompt,
        messages: conversationMessages,
        politicianId: currentPoliticianId || undefined, // RAG 검색용
        onChunk: (fullText) => {
          updateLastAssistantMessage(fullText);
        },
        onComplete: () => {
          // 1. 스트리밍 완료 후 마지막 assistant 메시지 가져오기
          const { messages: latestMsgs } = useChatStore.getState();
          const lastMsg = latestMsgs.filter(m => m.role === 'assistant').pop();

          if (lastMsg) {
            const bubbles = parseAIResponse(lastMsg.content);

            if (bubbles.length > 1) {
              // 여러 말풍선으로 분리
              // 1) 마지막 assistant 메시지를 첫 번째 버블로 교체
              const firstBubble = bubbles[0];
              useChatStore.setState(state => ({
                messages: state.messages.map(m =>
                  m.id === lastMsg.id ? { ...m, content: firstBubble } : m
                ) as Message[],
                isStreaming: true, // 계속 스트리밍 상태로
              }));

              // 2) 나머지 버블을 순차적으로 추가 (타이핑 딜레이 포함)
              bubbles.slice(1).forEach((bubble, index) => {
                setTimeout(() => {
                  const isLast = index === bubbles.length - 2;
                  const newMsg = {
                    id: crypto.randomUUID(),
                    role: 'assistant' as const,
                    content: bubble,
                    timestamp: Date.now(),
                  };
                  useChatStore.setState(state => ({
                    messages: [...state.messages, newMsg],
                    isStreaming: !isLast,
                  }));
                  if (isLast) {
                    markUserMessagesAsRead();
                    // engagement 처리
                    const { messages: finalMsgs } = useChatStore.getState();
                    const lastAssistantMsg = finalMsgs.filter(m => m.role === 'assistant').pop();
                    if (lastAssistantMsg) {
                      const engagement = calculateEngagement(lastAssistantMsg.content);
                      if (shouldReact(engagement)) {
                        addReactionToLastUserMessage('❤️');
                      }
                    }
                    setTimeout(() => persistMessages(), 50);
                    // 추천 질문 생성
                    const { messages: suggMsgs } = useChatStore.getState();
                    const lastUserMsg = [...suggMsgs].reverse().find(m => m.role === 'user');
                    const lastAiMsg = [...suggMsgs].reverse().find(m => m.role === 'assistant');
                    if (lastUserMsg && lastAiMsg && lastAiMsg.content.trim()) {
                      generateSuggestedQuestions(
                        lastUserMsg.content,
                        lastAiMsg.content,
                        currentPoliticianId || '정치인',
                      ).then(questions => {
                        if (questions.length > 0) {
                          useChatStore.getState().setSuggestedQuestions(questions);
                        }
                      });
                    }
                    // 큐에 대기중인 메시지가 있으면 자동 전송
                    if (pendingMessageRef.current) {
                      const pendingText = pendingMessageRef.current;
                      pendingMessageRef.current = null;
                      setTimeout(() => { sendMessage(pendingText); }, 100);
                    }
                  }
                }, (index + 1) * 600); // 각 말풍선 600ms 간격
              });
            } else {
              // 단일 말풍선: ** 제거만 적용
              if (bubbles[0] !== lastMsg.content) {
                useChatStore.setState(state => ({
                  messages: state.messages.map(m =>
                    m.id === lastMsg.id ? { ...m, content: bubbles[0] } : m
                  ) as Message[],
                }));
              }
              setStreaming(false);
              markUserMessagesAsRead();
              const engagement = calculateEngagement(lastMsg.content);
              if (shouldReact(engagement)) {
                addReactionToLastUserMessage('❤️');
              }
              setTimeout(() => persistMessages(), 50);
              // 추천 질문 생성
              const { messages: suggMsgs } = useChatStore.getState();
              const lastUserMsg = [...suggMsgs].reverse().find(m => m.role === 'user');
              const lastAiMsg = [...suggMsgs].reverse().find(m => m.role === 'assistant');
              if (lastUserMsg && lastAiMsg && lastAiMsg.content.trim()) {
                generateSuggestedQuestions(
                  lastUserMsg.content,
                  lastAiMsg.content,
                  currentPoliticianId || '정치인',
                ).then(questions => {
                  if (questions.length > 0) {
                    useChatStore.getState().setSuggestedQuestions(questions);
                  }
                });
              }
              if (pendingMessageRef.current) {
                const pendingText = pendingMessageRef.current;
                pendingMessageRef.current = null;
                setTimeout(() => { sendMessage(pendingText); }, 100);
              }
            }
          } else {
            setStreaming(false);
            markUserMessagesAsRead();
            setTimeout(() => persistMessages(), 50);
          }
        },
        onError: (err) => {
          setStreaming(false);
          // Remove the empty assistant placeholder
          useChatStore.setState((state) => ({
            messages: state.messages.slice(0, -1),
          }));
          // Still persist the user message
          setTimeout(() => persistMessages(), 50);
          if (err.message.includes('401')) {
            setError('API 키가 유효하지 않습니다. 서버 설정을 확인해주세요.');
          } else {
            setError(`오류가 발생했습니다: ${err.message}`);
          }
        },
      });
    },
    [
      systemPrompt,
      knowledge,
      messages,
      currentPoliticianId,
      isStreaming,
      addMessage,
      updateLastAssistantMessage,
      setStreaming,
      setError,
      persistMessages,
      markUserMessagesAsRead,
      addReactionToLastUserMessage,
    ],
  );

  return { messages, isStreaming, error, sendMessage, addAssistantMessage, addUserMessage, historyLoaded };
}
