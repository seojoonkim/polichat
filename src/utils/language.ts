/**
 * 언어 코드에 따른 국기 이모지 매핑
 */
export const FLAG_MAP: Record<string, string> = {
  ko: '🇰🇷',
  ja: '🇯🇵',
  en: '🇺🇸',
  zh: '🇨🇳',
  hi: '🇮🇳',
};

export const DEFAULT_FLAG = '🇰🇷';

/**
 * 언어 코드를 국기 이모지로 변환
 */
export function getLanguageFlag(language?: string): string {
  if (!language) return DEFAULT_FLAG;
  return FLAG_MAP[language] ?? DEFAULT_FLAG;
}

/**
 * 언어 코드에 따른 국가 코드 매핑
 */
const COUNTRY_CODE_MAP: Record<string, string> = {
  ko: 'kr',
  ja: 'jp',
  en: 'us',
  zh: 'cn',
  hi: 'in',
  IN: 'in',
};

/**
 * 언어 코드에 따른 국가명 (접근성용)
 */
const COUNTRY_NAME_MAP: Record<string, string> = {
  ko: 'South Korea',
  ja: 'Japan',
  en: 'United States',
  zh: 'China',
  hi: 'India',
};

/**
 * 언어 코드를 국기 이미지 URL로 변환 (flagcdn.com 사용)
 */
export function getFlagImageUrl(language?: string): string {
  const code = COUNTRY_CODE_MAP[language || 'ko'] || 'kr';
  return `https://flagcdn.com/w40/${code}.png`;
}

/**
 * 언어 코드를 국가명으로 변환 (alt 텍스트용)
 */
export function getCountryName(language?: string): string {
  return COUNTRY_NAME_MAP[language || 'ko'] || 'South Korea';
}

/**
 * 상대적 시간 표시 다국어 처리
 */
type TimeKey = 'justNow' | 'minutesAgo' | 'hoursAgo' | 'yesterday' | 'daysAgo' | 'online' | 'typing';

const TIME_TRANSLATIONS: Record<string, Record<TimeKey, string | ((n: number) => string)>> = {
  ko: {
    justNow: '방금',
    minutesAgo: (n: number) => `${n}분 전`,
    hoursAgo: (n: number) => `${n}시간 전`,
    yesterday: '어제',
    daysAgo: (n: number) => `${n}일 전`,
    online: '온라인',
    typing: '입력중...',
  },
  ja: {
    justNow: 'たった今',
    minutesAgo: (n: number) => `${n}分前`,
    hoursAgo: (n: number) => `${n}時間前`,
    yesterday: '昨日',
    daysAgo: (n: number) => `${n}日前`,
    online: 'オンライン',
    typing: '入力中...',
  },
  en: {
    justNow: 'just now',
    minutesAgo: (n: number) => `${n}m ago`,
    hoursAgo: (n: number) => `${n}h ago`,
    yesterday: 'yesterday',
    daysAgo: (n: number) => `${n}d ago`,
    online: 'online',
    typing: 'typing...',
  },
};

/**
 * 상대적 시간 포맷 함수 (다국어 지원)
 */
export function formatRelativeTime(timestamp: number | null, language?: string): string {
  const t = (language && TIME_TRANSLATIONS[language]) || TIME_TRANSLATIONS['en']!;
  
  if (!timestamp) return t.online as string;
  
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (minutes < 1) return t.justNow as string;
  if (minutes < 60) return (t.minutesAgo as (n: number) => string)(minutes);
  if (hours < 24) return (t.hoursAgo as (n: number) => string)(hours);
  if (days === 1) return t.yesterday as string;
  if (days < 7) return (t.daysAgo as (n: number) => string)(days);
  
  // 일주일 이상이면 날짜 표시
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * 'typing...' 상태 다국어 처리
 */
export function getTypingText(language?: string): string {
  const t = (language && TIME_TRANSLATIONS[language]) || TIME_TRANSLATIONS['en']!;
  return t.typing as string;
}
