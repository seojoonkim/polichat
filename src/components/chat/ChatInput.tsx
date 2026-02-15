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
  const formRef = useRef<HTMLFormElement>(null);

  // Handle iOS Safari viewport changes (keyboard)
  // 키보드가 올라오면 입력창만 키보드 위로 이동 (헤더/메시지는 그대로)
  useEffect(() => {
    const handleViewportChange = () => {
      if (!formRef.current || !window.visualViewport) return;
      
      // visualViewport.height가 window.innerHeight보다 작으면 키보드가 올라온 것
      const keyboardHeight = window.innerHeight - window.visualViewport.height;
      const isMobile = window.innerWidth <= 768;
      
      if (keyboardHeight > 100) {
        // 키보드가 올라왔을 때: 입력창을 키보드 바로 위로 이동
        formRef.current.style.bottom = `${keyboardHeight}px`;
        formRef.current.style.paddingBottom = '0.75rem';
      } else {
        // 키보드가 없을 때: 기본 위치
        formRef.current.style.bottom = '0';
        formRef.current.style.paddingBottom = isMobile 
          ? 'max(60px, env(safe-area-inset-bottom, 60px))'
          : 'max(1rem, env(safe-area-inset-bottom))';
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      window.visualViewport.addEventListener('scroll', handleViewportChange);
      handleViewportChange();
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
        window.visualViewport.removeEventListener('scroll', handleViewportChange);
      }
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText('');
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Skip if IME is composing (Japanese/Chinese/Korean input)
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  // Auto-focus when enabled (after AI response completes)
  useEffect(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [disabled]);

  const hasText = text.trim().length > 0;

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="fixed left-1/2 -translate-x-1/2 w-full bg-white/95 backdrop-blur-md border-t border-gray-100 px-4 pt-3 flex items-end gap-2.5"
      style={{ 
        maxWidth: '600px', 
        bottom: 0,
        paddingBottom: 'max(60px, env(safe-area-inset-bottom, 60px))'
      }}
    >
      <textarea
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={getPlaceholder(language)}
        rows={1}
        className="flex-1 px-4 py-2.5 rounded-2xl bg-gray-50 border border-gray-200 text-[15px] outline-none
          focus:border-purple-300 focus:ring-2 focus:ring-purple-50 transition-all duration-200
          resize-none leading-relaxed scrollbar-hide"
        style={{ minHeight: '42px', maxHeight: '120px' }}
        autoFocus
      />
      <button
        type="submit"
        disabled={!hasText}
        className="w-10 h-10 rounded-full flex items-center justify-center text-white
          disabled:opacity-30 transition-all duration-200 hover:shadow-lg active:scale-90 shrink-0 mb-0.5"
        style={{
          backgroundColor: hasText ? themeColor : '#d1d5db',
          boxShadow: hasText ? `0 4px 12px -2px ${themeColor}40` : 'none',
          transform: hasText ? 'scale(1)' : 'scale(0.95)',
        }}
      >
        <svg
          className="w-5 h-5 transition-transform duration-200"
          style={{ transform: hasText ? 'rotate(-45deg)' : 'rotate(-45deg)' }}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
        </svg>
      </button>
    </form>
  );
}
