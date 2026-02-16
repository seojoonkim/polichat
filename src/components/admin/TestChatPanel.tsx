import { useState, useEffect, useRef, useCallback } from 'react';
import type { PoliticianMeta } from '@/types/politician';
import type { Message } from '@/types/chat';
import { useAdminStore } from '@/stores/admin-store';
import { useSystemPromptWithOverrides } from '@/hooks/use-system-prompt';
import { streamChat } from '@/lib/anthropic-client';

interface Props {
  politician: PoliticianMeta;
}

export default function TestChatPanel({ politician }: Props) {
  const setTestChatOpen = useAdminStore((s) => s.setTestChatOpen);
  const unsavedChanges = useAdminStore((s) => s.unsavedChanges);

  const overrides = unsavedChanges[politician.id];
  const { systemPrompt } = useSystemPromptWithOverrides(politician, overrides);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reset messages when politician changes
  useEffect(() => {
    setMessages([]);
  }, [politician.id]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming || !systemPrompt) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMsg, assistantMsg];
    setMessages(newMessages);
    setInput('');
    setIsStreaming(true);

    const conversationMessages = [...messages, userMsg]
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    await streamChat({
      systemPrompt,
      messages: conversationMessages,
      onChunk: (fullText) => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'assistant') {
            updated[updated.length - 1] = { ...last, content: fullText };
          }
          return updated;
        });
      },
      onComplete: () => {
        setIsStreaming(false);
      },
      onError: (err) => {
        setIsStreaming(false);
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'assistant') {
            updated[updated.length - 1] = {
              ...last,
              content: `[오류] ${err.message}`,
            };
          }
          return updated;
        });
      },
    });
  }, [input, isStreaming, systemPrompt, messages]);

  return (
    <div className="w-96 bg-white border-l border-gray-200 flex flex-col shrink-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-gray-800">
            테스트 채팅
          </div>
          <div className="text-xs text-gray-400">{politician.nameKo}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPrompt(!showPrompt)}
            className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-500 hover:bg-gray-200"
          >
            {showPrompt ? '프롬프트 닫기' : '프롬프트 보기'}
          </button>
          <button
            onClick={() => setMessages([])}
            className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-500 hover:bg-gray-200"
          >
            초기화
          </button>
          <button
            onClick={() => setTestChatOpen(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* System prompt view */}
      {showPrompt && (
        <div className="border-b border-gray-200 max-h-48 overflow-y-auto p-3 bg-gray-50">
          <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono leading-relaxed">
            {systemPrompt || '(Loading prompt...)'}
          </pre>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-xs mt-8">
            메시지를 보내서 테스트하세요
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-purple-600 text-white rounded-br-md'
                  : 'bg-gray-100 text-gray-800 rounded-bl-md'
              }`}
            >
              {msg.content || '...'}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="border-t border-gray-200 px-3 py-2 flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="테스트 메시지..."
          disabled={isStreaming}
          className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-xs outline-none focus:border-purple-300 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="px-3 py-2 rounded-lg bg-purple-600 text-white text-xs font-medium disabled:opacity-40"
        >
          전송
        </button>
      </form>
    </div>
  );
}
