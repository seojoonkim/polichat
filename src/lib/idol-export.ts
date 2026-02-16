import type { IdolBundle, IdolMeta } from '@/types/idol';
import { KNOWLEDGE_CATEGORIES } from '@/types/idol';
import { loadIdolKnowledge } from './idol-loader';
import * as db from './db';

const BUNDLE_VERSION = 1;

export async function exportIdol(idolId: string, meta: IdolMeta): Promise<IdolBundle> {
  const knowledge = await loadIdolKnowledge(idolId);
  return { meta, knowledge, version: BUNDLE_VERSION };
}

export async function exportAllIdols(idols: IdolMeta[]): Promise<IdolBundle[]> {
  const bundles: IdolBundle[] = [];
  for (const idol of idols) {
    bundles.push(await exportIdol(idol.id, idol));
  }
  return bundles;
}

export async function importIdol(
  bundle: IdolBundle,
  overwrite = false,
): Promise<{ success: boolean; message: string }> {
  const existing = await db.getIdolMeta(bundle.meta.id);
  if (existing && !overwrite) {
    return {
      success: false,
      message: `정치인 "${bundle.meta.nameKo}" (${bundle.meta.id})이(가) 이미 존재합니다.`,
    };
  }

  const now = Date.now();
  const meta: IdolMeta = {
    ...bundle.meta,
    isBuiltIn: false,
    updatedAt: now,
    createdAt: existing?.createdAt ?? now,
  };

  await db.putIdolMeta(meta);

  for (const category of KNOWLEDGE_CATEGORIES) {
    const content = bundle.knowledge[category];
    if (content !== undefined) {
      await db.putKnowledgeFile({
        idolId: meta.id,
        category,
        content,
        updatedAt: now,
      });
    }
  }

  return { success: true, message: `"${meta.nameKo}" 가져오기 완료` };
}

export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function validateBundle(data: unknown): data is IdolBundle {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  if (!obj.meta || typeof obj.meta !== 'object') return false;
  if (!obj.knowledge || typeof obj.knowledge !== 'object') return false;
  const meta = obj.meta as Record<string, unknown>;
  return typeof meta.id === 'string' && typeof meta.nameKo === 'string';
}
