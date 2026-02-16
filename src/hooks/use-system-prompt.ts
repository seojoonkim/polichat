import { useEffect, useState } from 'react';
import type { PoliticianMeta, KnowledgeCategory } from '@/types/politician';
import { loadPoliticianKnowledge, loadGroupInfo, getGroupSlug, loadFewShots } from '@/lib/politician-loader';
import { assembleSystemPrompt, type UserInfo } from '@/lib/prompt-assembler';
import { useUserStore } from '@/stores/user-store';

export function useSystemPrompt(politician: PoliticianMeta | null) {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [knowledge, setKnowledge] = useState<Record<KnowledgeCategory, string> | null>(null);
  const [loading, setLoading] = useState(false);
  
  const profile = useUserStore((s) => s.profile);
  // Watch the actual relation object, not the getter function (for proper reactivity)
  const politicianRelations = useUserStore((s) => s.politicianRelations);
  const relation = politician ? politicianRelations[politician.id] : null;

  useEffect(() => {
    if (!politician) {
      setSystemPrompt('');
      setKnowledge(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    // Build user info
    const userInfo: UserInfo | undefined = profile && relation ? {
      name: profile.name,
      birthday: profile.birthday || '(비공개)',
      relationType: relation.relationType,
    } : undefined;
    
    console.log('[SystemPrompt] Building with userInfo:', userInfo);

    Promise.all([
      loadPoliticianKnowledge(politician.id),
      loadGroupInfo(getGroupSlug(politician.group)),
      loadFewShots(politician.id),
    ]).then(([loadedKnowledge, groupInfo, fewShots]) => {
      if (!cancelled) {
        setKnowledge(loadedKnowledge);
        setSystemPrompt(assembleSystemPrompt(politician, loadedKnowledge, groupInfo, userInfo, fewShots));
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [politician?.id, politician?.updatedAt, profile, relation]);

  return { systemPrompt, knowledge, loading };
}

/** Build system prompt with optional unsaved overrides (for admin test chat) */
export function useSystemPromptWithOverrides(
  politician: PoliticianMeta | null,
  overrides?: Record<string, string>,
) {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!politician) {
      setSystemPrompt('');
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all([
      loadPoliticianKnowledge(politician.id),
      loadGroupInfo(getGroupSlug(politician.group)),
      loadFewShots(politician.id),
    ]).then(([knowledge, groupInfo, fewShots]) => {
      if (!cancelled) {
        const merged = { ...knowledge } as Record<KnowledgeCategory, string>;
        if (overrides) {
          for (const [key, value] of Object.entries(overrides)) {
            merged[key as KnowledgeCategory] = value;
          }
        }
        setSystemPrompt(assembleSystemPrompt(politician, merged, groupInfo, undefined, fewShots));
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [politician?.id, politician?.updatedAt, overrides]);

  return { systemPrompt, loading };
}
