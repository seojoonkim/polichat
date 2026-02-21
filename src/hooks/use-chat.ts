import { useCallback, useRef } from 'react';
import { useChatStore } from '@/stores/chat-store';
import { streamChat } from '@/lib/anthropic-client';
import { getRelevantContext } from '@/lib/keyword-rag';
import { calculateEngagement, shouldReact } from '@/lib/engagement';
import { generateSuggestedQuestions } from '@/lib/suggest-questions';
import { splitIntoBubbles } from '@/lib/bubble-splitter';
import type { KnowledgeCategory } from '@/types/politician';
import type { Message } from '@/types/chat';

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

      // 딜레이 후 텍스트 바로 추가 (빈 content 단계 없이)
      const typingDelay = 400 + Math.random() * 350;
      setTimeout(() => {
        const { messages: currentMessages } = useChatStore.getState();
        useChatStore.setState({
          messages: [...currentMessages, {
            id: crypto.randomUUID(),
            role: 'assistant' as const,
            content: text,
            timestamp: Date.now(),
          }],
          isStreaming: true,  // 잠깐 true → isNew=true → 타이핑 애니메이션 트리거
        });
        // 80ms 후 false 전환 → MessageBubble이 isNew: true→false 감지하고 타이핑 시작
        setTimeout(() => {
          useChatStore.setState({ isStreaming: false });
          setTimeout(() => persistMessages(), 50);
        }, 80);
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

      // Add empty assistant message as placeholder (with tracked ID for safe error cleanup)
      const placeholderId = `placeholder-${crypto.randomUUID()}`;
      useChatStore.setState((state) => ({
        messages: [...state.messages, {
          id: placeholderId,
          role: 'assistant' as const,
          content: '',
          timestamp: Date.now(),
        }],
      }));
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
            const bubbles = splitIntoBubbles(lastMsg.content);

            if (bubbles.length > 1) {
              // 여러 말풍선으로 분리
              // 1) 첫 번째 버블로 즉시 교체 (isStreaming: false → 바로 표시)
              const firstBubble = bubbles[0];
              useChatStore.setState(state => ({
                messages: state.messages.map(m =>
                  m.id === lastMsg.id ? { ...m, content: firstBubble } : m
                ) as Message[],
                isStreaming: false, // 즉시 표시
              }));

              // 2) 나머지 버블을 순차적으로 추가
              //    각 버블 추가 전 200ms 먼저 타이핑 인디케이터를 켜서 순차감 부여
              bubbles.slice(1).forEach((bubble, index) => {
                const baseDelay = (index + 1) * 1800;
                // 버블 추가 600ms 전에 타이핑 인디케이터 ON (첫 버블 충분히 보인 후)
                setTimeout(() => {
                  useChatStore.setState({ isStreaming: true });
                }, baseDelay - 600);

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
                    // 추천 질문 생성 — 3회 이상 교환 후에만 (인사 단계 제외)
                    const { messages: suggMsgs } = useChatStore.getState();
                    const userMsgCount = suggMsgs.filter(m => m.role === 'user').length;
                    const lastUserMsg = [...suggMsgs].reverse().find(m => m.role === 'user');
                    const lastAiMsg = [...suggMsgs].reverse().find(m => m.role === 'assistant');
                    if (userMsgCount >= 3 && lastUserMsg && lastAiMsg && lastAiMsg.content.trim()) {
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
                }, baseDelay); // 각 말풍선 1500ms 간격 (자연스러운 타이밍)
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
              // 추천 질문 생성 — 3회 이상 교환 후에만 (인사 단계 제외)
              const { messages: suggMsgs } = useChatStore.getState();
              const userMsgCount = suggMsgs.filter(m => m.role === 'user').length;
              const lastUserMsg = [...suggMsgs].reverse().find(m => m.role === 'user');
              const lastAiMsg = [...suggMsgs].reverse().find(m => m.role === 'assistant');
              if (userMsgCount >= 3 && lastUserMsg && lastAiMsg && lastAiMsg.content.trim()) {
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
          const latest = useChatStore.getState();
          const placeholderIndex = latest.messages.findIndex((m) => m.id === placeholderId);

          // placeholder가 이미 일부 응답을 받은 상태면 메시지 유지(삭제 아님)
          if (placeholderIndex === -1) {
            // should not happen, but safety
          } else if (!latest.messages[placeholderIndex]?.content?.trim()) {
            useChatStore.setState((state) => ({
              messages: state.messages.filter((m) => m.id !== placeholderId),
            }));
          }

          // Still persist the user message
          setTimeout(() => persistMessages(), 50);

          if (err.message.includes('401')) {
            setError('API 키가 유효하지 않습니다. 서버 설정을 확인해주세요.');
          } else if (err.message.includes('429')) {
            setError('요청이 한동안 과부하 상태입니다. 잠시 후 다시 시도해주세요.');
          } else {
            setError(`오류가 발생했습니다: ${err.message}`);
          }

          // 응답이 있는 부분이 있으면 그대로 노출 상태로 두고 종료
          if (latest.messages[placeholderIndex]?.content?.trim()) {
            return;
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
