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
        className="w-full text-left px-4 py-2.5 rounded-2xl text-sm font-medium transition-all duration-200 hover:opacity-70"
        style={{
          background: '#f1f5f9',
          color: '#64748b',
          border: '1px solid #e2e8f0',
        }}
      >
        ✏️ 직접 입력하기
      </button>
    </div>
  );
}
