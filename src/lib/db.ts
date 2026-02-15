import { openDB, type IDBPDatabase, type DBSchema } from 'idb';
import type { IdolMeta, IdolKnowledgeFile } from '@/types/idol';
import type { Message } from '@/types/chat';

interface ChatHistoryEntry {
  idolId: string;
  messages: Message[];
  updatedAt: number;
}

interface MimChatDB extends DBSchema {
  'idol-meta': {
    key: string;
    value: IdolMeta;
    indexes: { 'by-group': string };
  };
  'idol-knowledge': {
    key: [string, string];
    value: IdolKnowledgeFile;
    indexes: { 'by-idol': string };
  };
  'chat-history': {
    key: string;
    value: ChatHistoryEntry;
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

// Idol Meta CRUD
export async function getAllIdolMeta(): Promise<IdolMeta[]> {
  const db = await getDB();
  return db.getAll('idol-meta');
}

export async function getIdolMeta(id: string): Promise<IdolMeta | undefined> {
  const db = await getDB();
  return db.get('idol-meta', id);
}

export async function putIdolMeta(meta: IdolMeta): Promise<void> {
  const db = await getDB();
  await db.put('idol-meta', meta);
}

export async function deleteIdolMeta(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('idol-meta', id);
}

// Knowledge CRUD
export async function getKnowledgeFile(
  idolId: string,
  category: string,
): Promise<IdolKnowledgeFile | undefined> {
  const db = await getDB();
  return db.get('idol-knowledge', [idolId, category]);
}

export async function getAllKnowledgeForIdol(
  idolId: string,
): Promise<IdolKnowledgeFile[]> {
  const db = await getDB();
  return db.getAllFromIndex('idol-knowledge', 'by-idol', idolId);
}

export async function putKnowledgeFile(
  file: IdolKnowledgeFile,
): Promise<void> {
  const db = await getDB();
  await db.put('idol-knowledge', file);
}

export async function deleteAllKnowledgeForIdol(
  idolId: string,
): Promise<void> {
  const db = await getDB();
  const files = await db.getAllFromIndex('idol-knowledge', 'by-idol', idolId);
  const tx = db.transaction('idol-knowledge', 'readwrite');
  for (const file of files) {
    await tx.store.delete([file.idolId, file.category]);
  }
  await tx.done;
}

// Chat History CRUD
export async function getChatHistory(idolId: string): Promise<Message[]> {
  try {
    // 5초 타임아웃 - IndexedDB가 stuck되면 빈 배열 반환
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('DB timeout')), 5000)
    );
    const db = await Promise.race([getDB(), timeoutPromise]);
    const entry = await db.get('chat-history', idolId);
    return entry?.messages ?? [];
  } catch {
    console.warn('getChatHistory failed, returning empty');
    return [];
  }
}

export async function saveChatHistory(
  idolId: string,
  messages: Message[],
): Promise<void> {
  const db = await getDB();
  await db.put('chat-history', {
    idolId,
    messages,
    updatedAt: Date.now(),
  });
}

export async function deleteChatHistory(idolId: string): Promise<void> {
  const db = await getDB();
  await db.delete('chat-history', idolId);
}
