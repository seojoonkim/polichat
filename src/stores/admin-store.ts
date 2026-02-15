import { create } from 'zustand';
import type { KnowledgeCategory } from '@/types/idol';

interface AdminStore {
  selectedIdolId: string | null;
  activeKnowledgeTab: KnowledgeCategory;
  isTestChatOpen: boolean;
  unsavedChanges: Record<string, Record<string, string>>;

  setSelectedIdol: (id: string | null) => void;
  setActiveKnowledgeTab: (tab: KnowledgeCategory) => void;
  toggleTestChat: () => void;
  setTestChatOpen: (open: boolean) => void;
  setUnsavedContent: (
    idolId: string,
    category: KnowledgeCategory,
    content: string,
  ) => void;
  clearUnsavedChanges: (idolId: string) => void;
  getUnsavedContent: (
    idolId: string,
    category: KnowledgeCategory,
  ) => string | undefined;
}

export const useAdminStore = create<AdminStore>((set, get) => ({
  selectedIdolId: null,
  activeKnowledgeTab: 'personality',
  isTestChatOpen: false,
  unsavedChanges: {},

  setSelectedIdol: (id) => set({ selectedIdolId: id }),
  setActiveKnowledgeTab: (tab) => set({ activeKnowledgeTab: tab }),
  toggleTestChat: () => set((s) => ({ isTestChatOpen: !s.isTestChatOpen })),
  setTestChatOpen: (open) => set({ isTestChatOpen: open }),

  setUnsavedContent: (idolId, category, content) =>
    set((state) => ({
      unsavedChanges: {
        ...state.unsavedChanges,
        [idolId]: {
          ...state.unsavedChanges[idolId],
          [category]: content,
        },
      },
    })),

  clearUnsavedChanges: (idolId) =>
    set((state) => {
      const { [idolId]: _, ...rest } = state.unsavedChanges;
      return { unsavedChanges: rest };
    }),

  getUnsavedContent: (idolId, category) => {
    return get().unsavedChanges[idolId]?.[category];
  },
}));
