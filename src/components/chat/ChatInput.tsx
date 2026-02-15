import { useState, useRef, useEffect } from 'react';

interface Props {
  onSend: (text: string) => void;
  disabled: boolean;
  themeColor: string;
  language?: string;
}

function getPlaceholder(language?: string): string {
  switch (language) {
    case 'ja':
      return 'メッセージを入力...';
    case 'en':
      return 'Type a message...';
    case 'ko':
    default:
      return '메시지를 입력하세요...';
  }
}

export default function ChatInput({ onSend, disabled, themeColor, language }: Props) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // iOS Safari: visualViewport 기반으로 처리하므로 scrollTo 불필요
  // 깜빡임 방지를 위해 아무것도 안 함
  const handleFocus = () => {
    // visualViewport가 height를 조절하므로 별도 처리 불필요
  };

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  useEffect(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [disabled]);

  const hasText = text.trim().length > 0;

  return (
    <form
      onSubmit={handleSubmit}
      className="shrink-0 bg-white border-t border-gray-100 px-4 pt-3 pb-safe flex items-end gap-2.5"
      style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
    >
      <textarea
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        placeholder={getPlaceholder(language)}
        rows={1}
        className="flex-1 px-4 py-2.5 rounded-2xl bg-gray-50 border border-gray-200 text-[15px] outline-none
          focus:border-purple-300 focus:ring-2 focus:ring-purple-50 transition-all duration-200
          resize-none leading-relaxed scrollbar-hide"
        style={{ minHeight: '42px', maxHeight: '120px' }}
      />
      <button
        type="submit"
        disabled={!hasText}
        className="w-10 h-10 rounded-full flex items-center justify-center text-white
          disabled:opacity-30 transition-all duration-200 hover:shadow-lg active:scale-90 shrink-0 mb-0.5"
        style={{
          backgroundColor: hasText ? themeColor : '#d1d5db',
          boxShadow: hasText ? `0 4px 12px -2px ${themeColor}40` : 'none',
        }}
      >
        <svg className="w-5 h-5" style={{ transform: 'rotate(-45deg)' }} fill="currentColor" viewBox="0 0 24 24">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
        </svg>
      </button>
    </form>
  );
}
