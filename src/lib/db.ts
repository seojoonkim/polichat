import { openDB, type IDBPDatabase, type DBSchema } from 'idb';
import type { PoliticianMeta, PoliticianKnowledgeFile } from '@/types/politician';
import type { Message } from '@/types/chat';

// NOTE: IndexedDB store names kept as 'idol-*' for backward compatibility.
// The keyPath property 'idolId' is also kept as-is in IndexedDB to avoid
// complex migration. We map between 'idolId' (DB) and 'politicianId' (code) at the CRUD layer.
interface MimChatDB extends DBSchema {
  'idol-meta': {
    key: string;
    value: PoliticianMeta;
    indexes: { 'by-group': string };
  };
  'idol-knowledge': {
    key: [string, string];
    // Stored with idolId in DB, mapped to politicianId in code
    value: { idolId: string; category: string; content: string; updatedAt: number };
    indexes: { 'by-idol': string };
  };
  'chat-history': {
    key: string;
    value: { idolId: string; messages: Message[]; updatedAt: number };
  };
}

const DB_NAME = 'mimchat-db';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<MimChatDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<MimChatDB>> {
  if (!dbPromise) {
    dbPromise = openDB<MimChatDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const metaStore = db.createObjectStore('idol-meta', { keyPath: 'id' });
          metaStore.createIndex('by-group', 'group');

          const knowledgeStore = db.createObjectStore('idol-knowledge', {
            keyPath: ['idolId', 'category'],
          });
          knowledgeStore.createIndex('by-idol', 'idolId');
        }
        if (oldVersion < 2) {
          db.createObjectStore('chat-history', { keyPath: 'idolId' });
        }
      },
    });
  }
  return dbPromise;
}

// Politician Meta CRUD
export async function getAllPoliticianMeta(): Promise<PoliticianMeta[]> {
  const db = await getDB();
  return db.getAll('idol-meta');
}

export async function getPoliticianMeta(id: string): Promise<PoliticianMeta | undefined> {
  const db = await getDB();
  return db.get('idol-meta', id);
}

export async function putPoliticianMeta(meta: PoliticianMeta): Promise<void> {
  const db = await getDB();
  await db.put('idol-meta', meta);
}

export async function deletePoliticianMeta(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('idol-meta', id);
}

// Knowledge CRUD - maps idolId (DB) <-> politicianId (code)
export async function getKnowledgeFile(
  politicianId: string,
  category: string,
): Promise<PoliticianKnowledgeFile | undefined> {
  const db = await getDB();
  const raw = await db.get('idol-knowledge', [politicianId, category]);
  if (!raw) return undefined;
  return { politicianId: raw.idolId, category: raw.category as PoliticianKnowledgeFile['category'], content: raw.content, updatedAt: raw.updatedAt };
}

export async function getAllKnowledgeForPolitician(
  politicianId: string,
): Promise<PoliticianKnowledgeFile[]> {
  const db = await getDB();
  const raws = await db.getAllFromIndex('idol-knowledge', 'by-idol', politicianId);
  return raws.map((raw) => ({
    politicianId: raw.idolId,
    category: raw.category as PoliticianKnowledgeFile['category'],
    content: raw.content,
    updatedAt: raw.updatedAt,
  }));
}

export async function putKnowledgeFile(
  file: PoliticianKnowledgeFile,
): Promise<void> {
  const db = await getDB();
  await db.put('idol-knowledge', {
    idolId: file.politicianId,
    category: file.category,
    content: file.content,
    updatedAt: file.updatedAt,
  });
}

export async function deleteAllKnowledgeForPolitician(
  politicianId: string,
): Promise<void> {
  const db = await getDB();
  const files = await db.getAllFromIndex('idol-knowledge', 'by-idol', politicianId);
  const tx = db.transaction('idol-knowledge', 'readwrite');
  for (const file of files) {
    await tx.store.delete([file.idolId, file.category]);
  }
  await tx.done;
}

// Chat History CRUD - maps idolId (DB) <-> politicianId (code)
export async function getChatHistory(politicianId: string): Promise<Message[]> {
  try {
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('DB timeout')), 5000)
    );
    const db = await Promise.race([getDB(), timeoutPromise]);
    const entry = await db.get('chat-history', politicianId);
    return entry?.messages ?? [];
  } catch {
    console.warn('getChatHistory failed, returning empty');
    return [];
  }
}

export async function saveChatHistory(
  politicianId: string,
  messages: Message[],
): Promise<void> {
  const db = await getDB();
  await db.put('chat-history', {
    idolId: politicianId,
    messages,
    updatedAt: Date.now(),
  });
}

export async function deleteChatHistory(politicianId: string): Promise<void> {
  const db = await getDB();
  await db.delete('chat-history', politicianId);
}
