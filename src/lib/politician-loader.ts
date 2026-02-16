import type { PoliticianMeta, KnowledgeCategory } from '@/types/politician';
import { KNOWLEDGE_CATEGORIES } from '@/types/politician';
import { BUILT_IN_POLITICIAN_IDS } from '@/constants/politician-defaults';
import * as db from './db';

async function fetchStaticMeta(politicianId: string): Promise<PoliticianMeta | null> {
  try {
    const res = await fetch(`/politicians/${politicianId}/meta.json`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchStaticKnowledge(
  politicianId: string,
  category: KnowledgeCategory,
): Promise<string | null> {
  try {
    const res = await fetch(`/politicians/${politicianId}/${category}.md`);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function loadPoliticianMeta(politicianId: string): Promise<PoliticianMeta | null> {
  // IndexedDB first
  const dbMeta = await db.getPoliticianMeta(politicianId);
  if (dbMeta) return dbMeta;

  // Static file fallback for built-in politicians
  return fetchStaticMeta(politicianId);
}

export async function loadFewShots(politicianId: string): Promise<string> {
  try {
    const res = await fetch(`/politicians/${politicianId}/few-shots.md`);
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  }
}

export async function loadPoliticianKnowledge(
  politicianId: string,
  agencyId?: string,
): Promise<Record<KnowledgeCategory, string>> {
  const result = {} as Record<KnowledgeCategory, string>;
  const dbFiles = await db.getAllKnowledgeForPolitician(politicianId);
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
    const staticContent = await fetchStaticKnowledge(politicianId, category);
    result[category] = staticContent ?? '';
  }

  return result;
}

// --- Group info loading (for backward compatibility) ---

const GROUP_FILES = ['overview', 'members', 'discography'] as const;

export async function loadGroupInfo(groupSlug: string): Promise<string> {
  const parts: string[] = [];
  for (const file of GROUP_FILES) {
    try {
      const res = await fetch(`/groups/${groupSlug}/${file}.md`);
      if (res.ok) {
        const text = await res.text();
        if (text.trim()) parts.push(text.trim());
      }
    } catch {
      // skip
    }
  }
  return parts.join('\n\n---\n\n');
}

const GROUP_SLUG_MAP: Record<string, string> = {
  '국민의힘': 'ppp',
  '더불어민주당': 'democratic',
};

export function getGroupSlug(groupName: string): string {
  return (
    GROUP_SLUG_MAP[groupName] ??
    groupName.toLowerCase().replace(/\s+/g, '-')
  );
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

export async function loadAllPoliticians(): Promise<PoliticianMeta[]> {
  const dbPoliticians = await db.getAllPoliticianMeta();
  const dbPoliticianMap = new Map(dbPoliticians.map((i) => [i.id, i]));

  const allPoliticians: PoliticianMeta[] = [];

  // Load built-in politicians - always use static meta, merge with DB overrides
  for (const id of BUILT_IN_POLITICIAN_IDS) {
    const staticMeta = await fetchStaticMeta(id);
    const dbMeta = dbPoliticianMap.get(id);
    if (staticMeta) {
      allPoliticians.push({
        ...staticMeta,
      });
      dbPoliticianMap.delete(id);
    } else if (dbMeta) {
      allPoliticians.push(dbMeta);
      dbPoliticianMap.delete(id);
    }
  }

  // Add user-created politicians (not built-in)
  for (const politician of dbPoliticianMap.values()) {
    allPoliticians.push(politician);
  }

  // Built-in politicians keep BUILT_IN_POLITICIAN_IDS order (first),
  // user-created politicians sorted by Korean name (after)
  const builtInIds = BUILT_IN_POLITICIAN_IDS as readonly string[];
  return allPoliticians.sort((a, b) => {
    const aBuiltIn = builtInIds.indexOf(a.id);
    const bBuiltIn = builtInIds.indexOf(b.id);
    // Both built-in: preserve defined order
    if (aBuiltIn !== -1 && bBuiltIn !== -1) return aBuiltIn - bBuiltIn;
    // Built-in comes first
    if (aBuiltIn !== -1) return -1;
    if (bBuiltIn !== -1) return 1;
    // Both user-created: sort by name
    return a.nameKo.localeCompare(b.nameKo, 'ko');
  });
}
