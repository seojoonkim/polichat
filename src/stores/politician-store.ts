import { create } from 'zustand';
import type { PoliticianMeta, KnowledgeCategory } from '@/types/politician';
import { KNOWLEDGE_CATEGORIES } from '@/types/politician';
import * as db from '@/lib/db';
import { loadAllPoliticians, loadPoliticianKnowledge } from '@/lib/politician-loader';

interface PoliticianStore {
  politicians: PoliticianMeta[];
  loading: boolean;
  error: string | null;

  loadPoliticians: () => Promise<void>;
  addPolitician: (
    meta: Omit<PoliticianMeta, 'createdAt' | 'updatedAt' | 'isBuiltIn'>,
  ) => Promise<PoliticianMeta>;
  updatePoliticianMeta: (id: string, updates: Partial<PoliticianMeta>) => Promise<void>;
  deletePolitician: (id: string) => Promise<void>;
  resetBuiltInPolitician: (id: string) => Promise<void>;

  getKnowledge: (
    politicianId: string,
  ) => Promise<Record<KnowledgeCategory, string>>;
  saveKnowledgeFile: (
    politicianId: string,
    category: KnowledgeCategory,
    content: string,
  ) => Promise<void>;
  resetKnowledgeFile: (
    politicianId: string,
    category: KnowledgeCategory,
  ) => Promise<void>;
}

export const usePoliticianStore = create<PoliticianStore>((set, get) => ({
  politicians: [],
  loading: true,  // Start as true to prevent flash
  error: null,

  loadPoliticians: async () => {
    set({ loading: true, error: null });
    try {
      const politicians = await loadAllPoliticians();
      set({ politicians, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  addPolitician: async (metaInput) => {
    const now = Date.now();
    const meta: PoliticianMeta = {
      ...metaInput,
      isBuiltIn: false,
      createdAt: now,
      updatedAt: now,
    };
    await db.putPoliticianMeta(meta);

    // Create empty knowledge files
    for (const category of KNOWLEDGE_CATEGORIES) {
      await db.putKnowledgeFile({
        politicianId: meta.id,
        category,
        content: '',
        updatedAt: now,
      });
    }

    await get().loadPoliticians();
    return meta;
  },

  updatePoliticianMeta: async (id, updates) => {
    const existing =
      get().politicians.find((i) => i.id === id) ??
      (await db.getPoliticianMeta(id));
    if (!existing) return;

    const updated: PoliticianMeta = {
      ...existing,
      ...updates,
      id, // prevent id change
      updatedAt: Date.now(),
    };
    await db.putPoliticianMeta(updated);
    await get().loadPoliticians();
  },

  deletePolitician: async (id) => {
    await db.deletePoliticianMeta(id);
    await db.deleteAllKnowledgeForPolitician(id);
    await get().loadPoliticians();
  },

  resetBuiltInPolitician: async (id) => {
    // Remove IndexedDB overrides so static files are used
    await db.deletePoliticianMeta(id);
    await db.deleteAllKnowledgeForPolitician(id);
    await get().loadPoliticians();
  },

  getKnowledge: async (politicianId) => {
    // Find politician to get agencyId and group
    const politician = get().politicians.find((i) => i.id === politicianId);
    return loadPoliticianKnowledge(politicianId, politician?.agencyId);
  },

  saveKnowledgeFile: async (politicianId, category, content) => {
    await db.putKnowledgeFile({
      politicianId,
      category,
      content,
      updatedAt: Date.now(),
    });
  },

  resetKnowledgeFile: async (politicianId, category) => {
    const dbFile = await db.getKnowledgeFile(politicianId, category);
    if (dbFile) {
      const dbObj = await db.getDB();
      await dbObj.delete('idol-knowledge', [politicianId, category]);
    }
  },
}));
