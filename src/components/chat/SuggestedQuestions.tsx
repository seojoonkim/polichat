import { useChatStore } from '@/stores/chat-store';

interface Props {
  onSelect: (question: string) => void;
  onDirectInput: () => void;
  themeColor: string;
}

export default function SuggestedQuestions({ onSelect, onDirectInput, themeColor }: Props) {
  const questions = useChatStore((s) => s.suggestedQuestions);

  if (questions.length === 0) return null;

  return (
    <div className="px-4 pb-3 flex flex-col gap-2">
      {questions.map((q, i) => (
        <button
          key={i}
          onClick={() => onSelect(q)}
          className="w-full text-left px-4 py-2.5 rounded-2xl text-sm font-medium transition-all duration-200 hover:opacity-80 active:scale-95"
          style={{
            background: `${themeColor}12`,
            color: themeColor,
            border: `1px solid ${themeColor}30`,
          }}
        >
          {q}
        </button>
      ))}
      <button
        onClick={onDirectInput}
        className="w-full text-left px-4 py-2.5 rounded-2xl text-sm font-medium transition-all duration-200 hover:opacity-70 flex items-center gap-2"
        style={{
          background: '#f1f5f9',
          color: '#64748b',
          border: '1px solid #e2e8f0',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        직접 입력하기
      </button>
    </div>
  );
}
