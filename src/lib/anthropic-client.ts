export interface StreamChatOptions {
  systemPrompt: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  idolId?: string; // RAG 검색용
  onChunk: (fullText: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
  onRetry?: (attempt: number, maxAttempts: number, delayMs: number) => void;
}

// Retry 대상 HTTP 상태 코드
const RETRYABLE_STATUS_CODES = [500, 503, 429];
const MAX_RETRY_ATTEMPTS = 3;
const BACKOFF_DELAYS = [1000, 2000, 4000]; // exponential backoff

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(status: number): boolean {
  return RETRYABLE_STATUS_CODES.includes(status);
}

const STREAM_TIMEOUT_MS = 45000; // 45초 타임아웃

export async function streamChat({
  systemPrompt,
  messages,
  idolId,
  onChunk,
  onComplete,
  onError,
  onRetry,
}: StreamChatOptions): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          system: systemPrompt,
          messages,
          model: 'moonshotai/kimi-k2.5', // 기존: 'claude-opus-4-6'
          max_tokens: 1024,
          idolId,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        const error = new Error(`Server error ${response.status}: ${errorBody}`);

        // Retry 가능한 에러인지 확인
        if (isRetryableError(response.status) && attempt < MAX_RETRY_ATTEMPTS) {
          const delay = BACKOFF_DELAYS[attempt] ?? 1000;
          onRetry?.(attempt + 1, MAX_RETRY_ATTEMPTS, delay);
          await sleep(delay);
          lastError = error;
          continue;
        }

        throw error;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split('\n');
        // Keep the last potentially incomplete line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);
            if (event.type === 'text') {
              fullText += event.text;
              onChunk(fullText);
            } else if (event.type === 'error') {
              throw new Error(event.error);
            } else if (event.type === 'done') {
              // Stream complete
            }
          } catch (parseErr) {
            // If it's a re-thrown error from above, propagate it
            if (parseErr instanceof Error && parseErr.message !== 'Unexpected end of JSON input') {
              throw parseErr;
            }
          }
        }
      }

      clearTimeout(timeoutId);
      onComplete(fullText);
      return; // 성공하면 함수 종료
    } catch (error) {
      clearTimeout(timeoutId);
      
      // Abort 에러는 타임아웃으로 처리
      if (error instanceof Error && error.name === 'AbortError') {
        lastError = new Error('요청 시간이 초과되었습니다. 다시 시도해주세요.');
      } else {
        lastError = error instanceof Error ? error : new Error(String(error));
      }

      // 네트워크 에러 등 다른 에러도 retry 시도 (마지막 시도가 아닐 때)
      if (attempt < MAX_RETRY_ATTEMPTS) {
        const delay = BACKOFF_DELAYS[attempt] ?? 1000;
        onRetry?.(attempt + 1, MAX_RETRY_ATTEMPTS, delay);
        await sleep(delay);
        continue;
      }
    }
  }

  // 모든 retry 실패 시
  onError(lastError || new Error('Unknown error after retries'));
}
