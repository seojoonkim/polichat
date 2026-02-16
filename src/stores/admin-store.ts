import { create } from 'zustand';
import type { KnowledgeCategory } from '@/types/politician';

interface AdminStore {
  selectedPoliticianId: string | null;
  activeKnowledgeTab: KnowledgeCategory;
  isTestChatOpen: boolean;
  unsavedChanges: Record<string, Record<string, string>>;

  setSelectedPolitician: (id: string | null) => void;
  setActiveKnowledgeTab: (tab: KnowledgeCategory) => void;
  toggleTestChat: () => void;
  setTestChatOpen: (open: boolean) => void;
  setUnsavedContent: (
    politicianId: string,
    category: KnowledgeCategory,
    content: string,
  ) => void;
  clearUnsavedChanges: (politicianId: string) => void;
  getUnsavedContent: (
    politicianId: string,
    category: KnowledgeCategory,
  ) => string | undefined;
}

export const useAdminStore = create<AdminStore>((set, get) => ({
  selectedPoliticianId: null,
  activeKnowledgeTab: 'personality',
  isTestChatOpen: false,
  unsavedChanges: {},

  setSelectedPolitician: (id) => set({ selectedPoliticianId: id }),
  setActiveKnowledgeTab: (tab) => set({ activeKnowledgeTab: tab }),
  toggleTestChat: () => set((s) => ({ isTestChatOpen: !s.isTestChatOpen })),
  setTestChatOpen: (open) => set({ isTestChatOpen: open }),

  setUnsavedContent: (politicianId, category, content) =>
    set((state) => ({
      unsavedChanges: {
        ...state.unsavedChanges,
        [politicianId]: {
          ...state.unsavedChanges[politicianId],
          [category]: content,
        },
      },
    })),

  clearUnsavedChanges: (politicianId) =>
    set((state) => {
      const { [politicianId]: _, ...rest } = state.unsavedChanges;
      return { unsavedChanges: rest };
    }),

  getUnsavedContent: (politicianId, category) => {
    return get().unsavedChanges[politicianId]?.[category];
  },
}));
