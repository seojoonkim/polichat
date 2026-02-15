import { create } from 'zustand';
import type { Message } from '@/types/chat';
import { getChatHistory, saveChatHistory } from '@/lib/db';

interface ChatStore {
  messages: Message[];
  currentIdolId: string | null;
  isStreaming: boolean;
  error: string | null;
  historyLoaded: boolean;
  lastMessageTime: number | null; // 마지막 메시지 시간

  setCurrentIdol: (idolId: string | null) => void;
  loadHistory: (idolId: string) => Promise<void>;
  addMessage: (role: 'user' | 'assistant', content: string) => void;
  updateLastAssistantMessage: (content: string) => void;
  setStreaming: (streaming: boolean) => void;
  setError: (error: string | null) => void;
  clearMessages: () => void;
  persistMessages: () => void;
  markUserMessagesAsRead: () => void; // 읽음 처리
  addReactionToLastUserMessage: (reaction: string) => void; // 리액션 추가
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  currentIdolId: null,
  isStreaming: false,
  error: null,
  historyLoaded: false,
  lastMessageTime: null,

  setCurrentIdol: (idolId) => {
    // Save current conversation before switching
    const { currentIdolId, messages } = get();
    if (currentIdolId && messages.length > 0) {
      saveChatHistory(currentIdolId, messages).catch(() => {});
    }
    set({
      currentIdolId: idolId,
      messages: [],
      error: null,
      historyLoaded: false,
      isStreaming: false, // 새 채팅 시작 시 로딩 상태 초기화
      lastMessageTime: null,
    });
    // Load history for the new idol
    if (idolId) {
      get().loadHistory(idolId);
    }
  },

  loadHistory: async (idolId) => {
    try {
      const messages = await getChatHistory(idolId);
      // Only set if we're still on the same idol
      if (get().currentIdolId === idolId) {
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
    const { currentIdolId } = get();
    set({ messages: [], error: null });
    if (currentIdolId) {
      saveChatHistory(currentIdolId, []).catch(() => {});
    }
  },

  persistMessages: () => {
    const { currentIdolId, messages } = get();
    if (currentIdolId && messages.length > 0) {
      saveChatHistory(currentIdolId, messages).catch(() => {});
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
}));
