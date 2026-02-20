import React from 'react';

// 국기 이모지 → Twemoji 이미지로 교체
// 웹 브라우저(특히 Linux/Windows)에서 flag emoji가 "KR" 텍스트로 렌더링되는 문제 해결
const FLAG_EMOJI_MAP: Record<string, string> = {
  '🇰🇷': 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f1f0-1f1f7.svg',
  '🇺🇸': 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f1f8-1f1f8.svg',
  '🇯🇵': 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f1ef-1f1f5.svg',
  '🇨🇳': 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f1e8-1f1f3.svg',
};

const FLAG_REGEX = /🇰🇷|🇺🇸|🇯🇵|🇨🇳/g;

interface TaglineRendererProps {
  text: string;
  className?: string;
}

export function TaglineRenderer({ text, className }: TaglineRendererProps) {
  if (!text) return null;

  const parts = text.split(FLAG_REGEX);
  const flags = text.match(FLAG_REGEX) ?? [];

  return (
    <span className={className}>
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {part}
          {flags[i] && (
            <img
              src={FLAG_EMOJI_MAP[flags[i]!] ?? ''}
              alt={flags[i]}
              className="inline-block w-4 h-4 align-middle mx-0.5"
              style={{ display: 'inline', verticalAlign: 'middle' }}
            />
          )}
        </React.Fragment>
      ))}
    </span>
  );
}
