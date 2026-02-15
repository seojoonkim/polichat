import { create } from 'zustand';
import type { IdolMeta, KnowledgeCategory } from '@/types/idol';
import { KNOWLEDGE_CATEGORIES } from '@/types/idol';
import * as db from '@/lib/db';
import { loadAllIdols, loadIdolKnowledge } from '@/lib/idol-loader';

interface IdolStore {
  idols: IdolMeta[];
  loading: boolean;
  error: string | null;

  loadIdols: () => Promise<void>;
  addIdol: (
    meta: Omit<IdolMeta, 'createdAt' | 'updatedAt' | 'isBuiltIn'>,
  ) => Promise<IdolMeta>;
  updateIdolMeta: (id: string, updates: Partial<IdolMeta>) => Promise<void>;
  deleteIdol: (id: string) => Promise<void>;
  resetBuiltInIdol: (id: string) => Promise<void>;

  getKnowledge: (
    idolId: string,
  ) => Promise<Record<KnowledgeCategory, string>>;
  saveKnowledgeFile: (
    idolId: string,
    category: KnowledgeCategory,
    content: string,
  ) => Promise<void>;
  resetKnowledgeFile: (
    idolId: string,
    category: KnowledgeCategory,
  ) => Promise<void>;
}

export const useIdolStore = create<IdolStore>((set, get) => ({
  idols: [],
  loading: true,  // Start as true to prevent flash
  error: null,

  loadIdols: async () => {
    set({ loading: true, error: null });
    try {
      const idols = await loadAllIdols();
      set({ idols, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  addIdol: async (metaInput) => {
    const now = Date.now();
    const meta: IdolMeta = {
      ...metaInput,
      isBuiltIn: false,
      createdAt: now,
      updatedAt: now,
    };
    await db.putIdolMeta(meta);

    // Create empty knowledge files
    for (const category of KNOWLEDGE_CATEGORIES) {
      await db.putKnowledgeFile({
        idolId: meta.id,
        category,
        content: '',
        updatedAt: now,
      });
    }

    await get().loadIdols();
    return meta;
  },

  updateIdolMeta: async (id, updates) => {
    const existing =
      get().idols.find((i) => i.id === id) ??
      (await db.getIdolMeta(id));
    if (!existing) return;

    const updated: IdolMeta = {
      ...existing,
      ...updates,
      id, // prevent id change
      updatedAt: Date.now(),
    };
    await db.putIdolMeta(updated);
    await get().loadIdols();
  },

  deleteIdol: async (id) => {
    await db.deleteIdolMeta(id);
    await db.deleteAllKnowledgeForIdol(id);
    await get().loadIdols();
  },

  resetBuiltInIdol: async (id) => {
    // Remove IndexedDB overrides so static files are used
    await db.deleteIdolMeta(id);
    await db.deleteAllKnowledgeForIdol(id);
    await get().loadIdols();
  },

  getKnowledge: async (idolId) => {
    // Find idol to get agencyId and group
    const idol = get().idols.find((i) => i.id === idolId);
    return loadIdolKnowledge(idolId, idol?.agencyId, idol?.group);
  },

  saveKnowledgeFile: async (idolId, category, content) => {
    await db.putKnowledgeFile({
      idolId,
      category,
      content,
      updatedAt: Date.now(),
    });
  },

  resetKnowledgeFile: async (idolId, category) => {
    const dbFile = await db.getKnowledgeFile(idolId, category);
    if (dbFile) {
      const dbObj = await db.getDB();
      await dbObj.delete('idol-knowledge', [idolId, category]);
    }
  },
}));
