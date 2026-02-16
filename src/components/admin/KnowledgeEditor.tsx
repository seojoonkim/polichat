import { useEffect, useState, useCallback } from 'react';
import type { PoliticianMeta, KnowledgeCategory } from '@/types/politician';
import { KNOWLEDGE_CATEGORIES, KNOWLEDGE_LABELS } from '@/types/politician';
import { usePoliticianStore } from '@/stores/politician-store';
import { useAdminStore } from '@/stores/admin-store';
import MarkdownFileTab from './MarkdownFileTab';

interface Props {
  politician: PoliticianMeta;
}

export default function KnowledgeEditor({ politician }: Props) {
  const activeTab = useAdminStore((s) => s.activeKnowledgeTab);
  const setActiveTab = useAdminStore((s) => s.setActiveKnowledgeTab);
  const getKnowledge = usePoliticianStore((s) => s.getKnowledge);
  const saveKnowledgeFile = usePoliticianStore((s) => s.saveKnowledgeFile);
  const setUnsavedContent = useAdminStore((s) => s.setUnsavedContent);
  const clearUnsavedChanges = useAdminStore((s) => s.clearUnsavedChanges);

  const [knowledge, setKnowledge] = useState<
    Record<KnowledgeCategory, string>
  >({} as Record<KnowledgeCategory, string>);
  const [loading, setLoading] = useState(true);
  const [savedTab, setSavedTab] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getKnowledge(politician.id).then((data) => {
      if (!cancelled) {
        setKnowledge(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [politician.id, getKnowledge]);

  const handleContentChange = useCallback(
    (category: KnowledgeCategory, content: string) => {
      setKnowledge((prev) => ({ ...prev, [category]: content }));
      setUnsavedContent(politician.id, category, content);
    },
    [politician.id, setUnsavedContent],
  );

  const uploadToServer = async (category: KnowledgeCategory, content: string) => {
    try {
      const response = await fetch('/api/upload-knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ politicianId: politician.id, category, content }),
      });
      if (!response.ok) throw new Error('Upload failed');
      return true;
    } catch (error) {
      console.error('Server upload error:', error);
      return false;
    }
  };

  const handleSave = useCallback(
    async (category: KnowledgeCategory) => {
      const content = knowledge[category] ?? '';
      // Save to IndexedDB
      await saveKnowledgeFile(politician.id, category, content);
      // Upload to server (background, don't block)
      uploadToServer(category, content);
      setSavedTab(category);
      setTimeout(() => setSavedTab(null), 2000);
    },
    [politician.id, knowledge, saveKnowledgeFile],
  );

  const handleSaveAll = async () => {
    for (const category of KNOWLEDGE_CATEGORIES) {
      const content = knowledge[category] ?? '';
      await saveKnowledgeFile(politician.id, category, content);
      // Upload to server in parallel
      uploadToServer(category, content);
    }
    clearUnsavedChanges(politician.id);
    setSavedTab('all');
    setTimeout(() => setSavedTab(null), 2000);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 text-gray-400 text-sm">
        Loading knowledge data...
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <h2 className="text-base font-bold text-gray-800">지식 데이터베이스</h2>
        <div className="flex items-center gap-2">
          {savedTab === 'all' && (
            <span className="text-xs text-green-600 animate-fade-in">
              전체 저장 완료!
            </span>
          )}
          <button
            onClick={handleSaveAll}
            className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 transition-colors"
          >
            전체 저장
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 px-5 gap-1 overflow-x-auto">
        {KNOWLEDGE_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveTab(cat)}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === cat
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {KNOWLEDGE_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Editor */}
      <div className="p-5">
        <MarkdownFileTab
          key={`${politician.id}-${activeTab}`}
          category={activeTab}
          content={knowledge[activeTab] ?? ''}
          onChange={(content) => handleContentChange(activeTab, content)}
          onSave={() => handleSave(activeTab)}
          saved={savedTab === activeTab}
        />
      </div>
    </div>
  );
}
