import { useCallback, useRef } from 'react';
import { useChatStore } from '@/stores/chat-store';
import { streamChat } from '@/lib/anthropic-client';
import { getRelevantContext } from '@/lib/keyword-rag';
import { calculateEngagement, shouldReact } from '@/lib/engagement';
import type { KnowledgeCategory } from '@/types/idol';

export function useChat(systemPrompt: string, knowledge?: Record<KnowledgeCategory, string> | null) {
  const messages = useChatStore((s) => s.messages);
  const currentIdolId = useChatStore((s) => s.currentIdolId);
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

  // Add assistant message directly (for greeting/onboarding flow)
  // Use old timestamp to skip typing animation
  const addAssistantMessage = useCallback(
    (text: string) => {
      const { messages: currentMessages } = useChatStore.getState();
      const newMessage = {
        id: crypto.randomUUID(),
        role: 'assistant' as const,
        content: text,
        timestamp: Date.now() - 15000, // 15초 전으로 설정해서 애니메이션 스킵
      };
      useChatStore.setState({ 
        messages: [...currentMessages, newMessage] 
      });
      setTimeout(() => persistMessages(), 50);
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
      const readingDelay = 500 + Math.random() * 700;
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

      await streamChat({
        systemPrompt: enhancedSystemPrompt,
        messages: conversationMessages,
        idolId: currentIdolId || undefined, // RAG 검색용
        onChunk: (fullText) => {
          updateLastAssistantMessage(fullText);
        },
        onComplete: () => {
          setStreaming(false);
          // 읽음 표시 처리
          markUserMessagesAsRead();
          
          // AI 몰입도 기반 리액션: 응답의 감정/참여도를 분석해서 결정
          const { messages: latestMsgs } = useChatStore.getState();
          const lastAssistantMsg = latestMsgs.filter(m => m.role === 'assistant').pop();
          if (lastAssistantMsg) {
            const engagement = calculateEngagement(lastAssistantMsg.content);
            if (shouldReact(engagement)) {
              addReactionToLastUserMessage('❤️');
            }
          }
          // Save conversation to IndexedDB after each response
          // Use setTimeout to ensure state is updated first
          setTimeout(() => persistMessages(), 50);
          
          // 큐에 대기중인 메시지가 있으면 자동 전송
          if (pendingMessageRef.current) {
            const pendingText = pendingMessageRef.current;
            pendingMessageRef.current = null;
            // 잠시 딜레이 후 전송 (자연스러운 흐름을 위해)
            setTimeout(() => {
              sendMessage(pendingText);
            }, 100);
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
      currentIdolId,
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
