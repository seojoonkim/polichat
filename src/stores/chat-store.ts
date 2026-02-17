import { create } from 'zustand';
import type { Message } from '@/types/chat';
import { getChatHistory, saveChatHistory } from '@/lib/db';

interface ChatStore {
  messages: Message[];
  currentPoliticianId: string | null;
  isStreaming: boolean;
  error: string | null;
  historyLoaded: boolean;
  lastMessageTime: number | null; // 마지막 메시지 시간
  suggestedQuestions: string[]; // 추천 질문 버튼

  setCurrentPolitician: (politicianId: string | null) => void;
  loadHistory: (politicianId: string) => Promise<void>;
  addMessage: (role: 'user' | 'assistant', content: string) => void;
  updateLastAssistantMessage: (content: string) => void;
  setStreaming: (streaming: boolean) => void;
  setError: (error: string | null) => void;
  clearMessages: () => void;
  persistMessages: () => void;
  markUserMessagesAsRead: () => void; // 읽음 처리
  addReactionToLastUserMessage: (reaction: string) => void; // 리액션 추가
  setSuggestedQuestions: (questions: string[]) => void; // 추천 질문 설정
  clearSuggestedQuestions: () => void; // 추천 질문 초기화
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  currentPoliticianId: null,
  isStreaming: false,
  error: null,
  historyLoaded: false,
  lastMessageTime: null,
  suggestedQuestions: [],

  setCurrentPolitician: (politicianId) => {
    // Save current conversation before switching
    const { currentPoliticianId, messages } = get();
    if (currentPoliticianId && messages.length > 0) {
      saveChatHistory(currentPoliticianId, messages).catch(() => {});
    }
    set({
      currentPoliticianId: politicianId,
      messages: [],
      error: null,
      historyLoaded: false,
      isStreaming: false, // 새 채팅 시작 시 로딩 상태 초기화
      lastMessageTime: null,
    });
    // Load history for the new politician
    if (politicianId) {
      get().loadHistory(politicianId);
    }
  },

  loadHistory: async (politicianId) => {
    try {
      const messages = await getChatHistory(politicianId);
      // Only set if we're still on the same politician
      if (get().currentPoliticianId === politicianId) {
        // 마지막 메시지 시간 계산
        const lastTime = messages.length > 0 
          ? Math.max(...messages.map(m => m.timestamp))
          : null;
        set({ messages, historyLoaded: true, lastMessageTime: lastTime });
      }
    } catch {
      set({ historyLoaded: true });
    }
  },

  addMessage: (role, content) =>
    set((state) => {
      const now = Date.now();
      const newMessages = [
        ...state.messages,
        {
          id: crypto.randomUUID(),
          role,
          content,
          timestamp: now,
        },
      ];
      return { messages: newMessages, lastMessageTime: now };
    }),

  updateLastAssistantMessage: (content) =>
    set((state) => {
      const msgs = [...state.messages];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i]!.role === 'assistant') {
          msgs[i] = { ...msgs[i]!, content };
          break;
        }
      }
      return { messages: msgs };
    }),

  setStreaming: (streaming) => set({ isStreaming: streaming }),
  setError: (error) => set({ error }),

  clearMessages: () => {
    const { currentPoliticianId } = get();
    set({ messages: [], error: null });
    if (currentPoliticianId) {
      saveChatHistory(currentPoliticianId, []).catch(() => {});
    }
  },

  persistMessages: () => {
    const { currentPoliticianId, messages } = get();
    if (currentPoliticianId && messages.length > 0) {
      saveChatHistory(currentPoliticianId, messages).catch(() => {});
    }
  },

  // 모든 user 메시지를 읽음 처리
  markUserMessagesAsRead: () =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.role === 'user' ? { ...msg, isRead: true } : msg
      ),
    })),

  // 마지막 user 메시지에 리액션 추가 (20% 확률로 호출됨)
  addReactionToLastUserMessage: (reaction: string) =>
    set((state) => {
      const msgs = [...state.messages];
      // 마지막 user 메시지 찾기
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i]!.role === 'user' && !msgs[i]!.reaction) {
          msgs[i] = { ...msgs[i]!, reaction };
          break;
        }
      }
      return { messages: msgs };
    }),

  // 추천 질문 설정/초기화
  setSuggestedQuestions: (questions) => set({ suggestedQuestions: questions }),
  clearSuggestedQuestions: () => set({ suggestedQuestions: [] }),
}));
