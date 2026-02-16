import { useState } from 'react';
import Markdown from 'react-markdown';
import type { KnowledgeCategory } from '@/types/politician';
import { KNOWLEDGE_LABELS } from '@/types/politician';

interface Props {
  category: KnowledgeCategory;
  content: string;
  onChange: (content: string) => void;
  onSave: () => void;
  saved: boolean;
}

export default function MarkdownFileTab({
  category,
  content,
  onChange,
  onSave,
  saved,
}: Props) {
  const [showPreview, setShowPreview] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      onSave();
    }
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            {KNOWLEDGE_LABELS[category]}
          </span>
          <span className="text-xs text-gray-400">
            ({content.length}자)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              showPreview
                ? 'bg-purple-100 text-purple-700'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {showPreview ? '편집' : '미리보기'}
          </button>
          <button
            onClick={onSave}
            className="px-3 py-1 rounded-md bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 transition-colors"
          >
            저장
          </button>
          {saved && (
            <span className="text-xs text-green-600 animate-fade-in">
              저장됨!
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      {showPreview ? (
        <div className="border border-gray-200 rounded-lg p-4 min-h-[300px] prose prose-sm max-w-none">
          {content ? (
            <Markdown>{content}</Markdown>
          ) : (
            <p className="text-gray-400 italic">내용이 없습니다.</p>
          )}
        </div>
      ) : (
        <textarea
          value={content}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`${KNOWLEDGE_LABELS[category]}에 대한 내용을 마크다운으로 작성하세요...`}
          className="w-full h-[300px] px-4 py-3 rounded-lg border border-gray-200 text-sm font-mono outline-none focus:border-purple-300 focus:ring-1 focus:ring-purple-100 resize-y leading-relaxed"
          spellCheck={false}
        />
      )}

      <p className="text-xs text-gray-400 mt-2">
        Ctrl+S로 저장할 수 있습니다. 마크다운 문법을 사용할 수 있습니다.
      </p>
    </div>
  );
}
