import type { IdolMeta, KnowledgeCategory } from '@/types/idol';
import { KNOWLEDGE_CATEGORIES } from '@/types/idol';
import { BUILT_IN_IDOL_IDS } from '@/constants/idol-defaults';
import * as db from './db';

async function fetchStaticMeta(idolId: string): Promise<IdolMeta | null> {
  try {
    const res = await fetch(`/politicians/${idolId}/meta.json`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchStaticKnowledge(
  idolId: string,
  category: KnowledgeCategory,
): Promise<string | null> {
  try {
    const res = await fetch(`/politicians/${idolId}/${category}.md`);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function loadIdolMeta(idolId: string): Promise<IdolMeta | null> {
  // IndexedDB first
  const dbMeta = await db.getIdolMeta(idolId);
  if (dbMeta) return dbMeta;

  // Static file fallback for built-in idols
  return fetchStaticMeta(idolId);
}

export async function loadIdolKnowledge(
  idolId: string,
  agencyId?: string,
): Promise<Record<KnowledgeCategory, string>> {
  const result = {} as Record<KnowledgeCategory, string>;
  const dbFiles = await db.getAllKnowledgeForIdol(idolId);
  const dbMap = new Map(dbFiles.map((f) => [f.category, f.content]));

  for (const category of KNOWLEDGE_CATEGORIES) {
    // Special handling for party-info
    if (category === 'party-info') {
      if (agencyId) {
        result[category] = await loadPartyInfo(agencyId);
      } else {
        result[category] = '';
      }
      continue;
    }

    // Check IndexedDB override first
    const dbContent = dbMap.get(category);
    if (dbContent !== undefined) {
      result[category] = dbContent;
      continue;
    }

    // Fall back to static file
    const staticContent = await fetchStaticKnowledge(idolId, category);
    result[category] = staticContent ?? '';
  }

  return result;
}

// --- Party info loading ---

export async function loadPartyInfo(partyId: string): Promise<string> {
  try {
    const res = await fetch(`/parties/${partyId}/info.md`);
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  }
}

export async function loadAllIdols(): Promise<IdolMeta[]> {
  const dbIdols = await db.getAllIdolMeta();
  const dbIdolMap = new Map(dbIdols.map((i) => [i.id, i]));

  const allIdols: IdolMeta[] = [];

  // Load built-in idols - always use static meta, merge with DB overrides
  for (const id of BUILT_IN_IDOL_IDS) {
    const staticMeta = await fetchStaticMeta(id);
    const dbMeta = dbIdolMap.get(id);
    if (staticMeta) {
      allIdols.push({
        ...staticMeta,
      });
      dbIdolMap.delete(id);
    } else if (dbMeta) {
      allIdols.push(dbMeta);
      dbIdolMap.delete(id);
    }
  }

  // Add user-created idols (not built-in)
  for (const idol of dbIdolMap.values()) {
    allIdols.push(idol);
  }

  // Sort by Korean name
  return allIdols.sort((a, b) => {
    return a.nameKo.localeCompare(b.nameKo, 'ko');
  });
}
