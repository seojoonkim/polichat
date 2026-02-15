import type { IdolMeta, KnowledgeCategory } from '@/types/idol';
import { KNOWLEDGE_CATEGORIES } from '@/types/idol';
import { BUILT_IN_IDOL_IDS } from '@/constants/idol-defaults';
import * as db from './db';

async function fetchStaticMeta(idolId: string): Promise<IdolMeta | null> {
  try {
    const res = await fetch(`/idols/${idolId}/meta.json`);
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
    const res = await fetch(`/idols/${idolId}/${category}.md`);
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
  groupName?: string,
): Promise<Record<KnowledgeCategory, string>> {
  const result = {} as Record<KnowledgeCategory, string>;
  const dbFiles = await db.getAllKnowledgeForIdol(idolId);
  const dbMap = new Map(dbFiles.map((f) => [f.category, f.content]));

  for (const category of KNOWLEDGE_CATEGORIES) {
    // Special handling for agency-info
    if (category === 'agency-info') {
      if (agencyId) {
        result[category] = await loadAgencyInfo(agencyId);
      } else {
        result[category] = '';
      }
      continue;
    }

    // Special handling for group-info
    if (category === 'group-info') {
      if (groupName) {
        const groupSlug = getGroupSlug(groupName);
        result[category] = await loadGroupInfoMd(groupSlug);
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

// Load single group info.md file
async function loadGroupInfoMd(groupSlug: string): Promise<string> {
  try {
    const res = await fetch(`/groups/${groupSlug}/info.md`);
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  }
}

// --- Group info loading ---

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

/** Map group display name to folder slug */
const GROUP_SLUG_MAP: Record<string, string> = {
  IVE: 'ive',
  SEVENTEEN: 'seventeen',
  tripleS: 'triples',
  ARTMS: 'artms',
  '트리플에스': 'triples',
  '세븐틴': 'seventeen',
  '아이브': 'ive',
  '아르테미스': 'artms',
  '솔로': 'solo',
  Solo: 'solo',
};

export function getGroupSlug(groupName: string): string {
  return (
    GROUP_SLUG_MAP[groupName] ??
    groupName.toLowerCase().replace(/\s+/g, '-')
  );
}

// --- Agency info loading ---

export async function loadAgencyInfo(agencyId: string): Promise<string> {
  try {
    const res = await fetch(`/agencies/${agencyId}/info.md`);
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
      // Merge: static values are authoritative for built-in fields
      allIdols.push({
        ...staticMeta,
        // Keep user's chat history association but use static profile
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

  // Sort by Korean name, but keep hodong at the end
  return allIdols.sort((a, b) => {
    if (a.id === 'hodong') return 1;
    if (b.id === 'hodong') return -1;
    return a.nameKo.localeCompare(b.nameKo, 'ko');
  });
}
