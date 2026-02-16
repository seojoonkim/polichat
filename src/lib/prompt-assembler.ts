import { SYSTEM_PROMPT_TEMPLATE } from '@/constants/prompt-template';
import type { PoliticianMeta, KnowledgeCategory } from '@/types/politician';
import { KNOWLEDGE_CATEGORIES } from '@/types/politician';
import type { RelationType } from '@/stores/user-store';

export interface UserInfo {
  name: string;
  birthday: string;
  relationType: RelationType;
}

// Helper to determine how politician calls the user
function getUserCallName(userName: string, relationType: RelationType): string {
  // Check if name ends with 받침 (final consonant)
  const lastChar = userName.charAt(userName.length - 1);
  const lastCharCode = lastChar.charCodeAt(0);
  // Korean syllable range: 0xAC00 ~ 0xD7A3
  // 받침 check: (charCode - 0xAC00) % 28 !== 0
  const hasBatchim = lastCharCode >= 0xAC00 && lastCharCode <= 0xD7A3 
    && (lastCharCode - 0xAC00) % 28 !== 0;
  
  switch (relationType) {
    case 'oppa':
      return `${userName} 오빠`;
    case 'unnie':
      return `${userName} 언니`;
    case 'hyung':
      return `${userName} 형`;
    case 'noona':
      return `${userName} 누나`;
    case 'dongsaeng':
      return hasBatchim ? `${userName}아` : `${userName}야`;
    case 'fan':
    default:
      return hasBatchim ? `${userName}아` : `${userName}야`;
  }
}

// Helper to get honorific description
function getHonorificDesc(relationType: RelationType): string {
  switch (relationType) {
    case 'oppa': return '오빠';
    case 'unnie': return '언니';
    case 'hyung': return '형';
    case 'noona': return '누나';
    case 'dongsaeng': return '동생';
    case 'fan':
    default: return '팬';
  }
}

// 현재 시간대 판단
function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return '아침';
  if (hour >= 12 && hour < 18) return '낮';
  if (hour >= 18 && hour < 23) return '저녁';
  return '밤';
}

// 요일 한글
function getKoreanWeekday(): string {
  const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  return days[new Date().getDay()]!;
}

// 날짜 포맷
function getCurrentDate(): string {
  const now = new Date();
  return `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`;
}

export function assembleSystemPrompt(
  meta: PoliticianMeta,
  knowledge: Record<KnowledgeCategory, string>,
  groupInfo?: string,
  userInfo?: UserInfo,
): string {
  let prompt = SYSTEM_PROMPT_TEMPLATE;

  // Handle language-specific instruction
  const isJapanese = meta.language === 'ja';
  const isEnglish = meta.language === 'en' || meta.language === 'hi'; // Hindi also uses English
  
  if (isJapanese) {
    // Replace the conditional block with actual content
    prompt = prompt.replace(
      /\{\{#if languageJa\}\}([\s\S]*?)\{\{\/if\}\}/g,
      '$1'
    );
  } else {
    // Remove the conditional block entirely for non-Japanese
    prompt = prompt.replace(
      /\{\{#if languageJa\}\}[\s\S]*?\{\{\/if\}\}/g,
      ''
    );
  }
  
  if (isEnglish) {
    // Replace the conditional block with actual content
    prompt = prompt.replace(
      /\{\{#if languageEn\}\}([\s\S]*?)\{\{\/if\}\}/g,
      '$1'
    );
  } else {
    // Remove the conditional block entirely for non-English
    prompt = prompt.replace(
      /\{\{#if languageEn\}\}[\s\S]*?\{\{\/if\}\}/g,
      ''
    );
  }

  prompt = prompt.replaceAll('{{nameKo}}', meta.nameKo);
  prompt = prompt.replaceAll('{{nameEn}}', meta.nameEn);
  prompt = prompt.replaceAll('{{group}}', meta.group);
  
  // 현재 시간 정보
  prompt = prompt.replaceAll('{{currentDate}}', getCurrentDate());
  prompt = prompt.replaceAll('{{currentWeekday}}', getKoreanWeekday());
  prompt = prompt.replaceAll('{{currentTimeOfDay}}', getTimeOfDay());

  // User info
  if (userInfo) {
    prompt = prompt.replaceAll('{{userName}}', userInfo.name);
    prompt = prompt.replaceAll('{{userBirthday}}', userInfo.birthday);
    prompt = prompt.replaceAll('{{userHonorific}}', getHonorificDesc(userInfo.relationType));
    prompt = prompt.replaceAll('{{userCallName}}', getUserCallName(userInfo.name, userInfo.relationType));
  } else {
    // Fallback for Polichat - 정치인이 시민에게 공손하게
    prompt = prompt.replaceAll('{{userName}}', '(아직 모름)');
    prompt = prompt.replaceAll('{{userBirthday}}', '(비공개)');
    prompt = prompt.replaceAll('{{userHonorific}}', '시민');
    prompt = prompt.replaceAll('{{userCallName}}', '(이름을 먼저 여쭤보세요)');
  }

  for (const category of KNOWLEDGE_CATEGORIES) {
    const placeholder = `{{${category}}}`;
    const content = knowledge[category] || '(정보 없음)';
    prompt = prompt.replaceAll(placeholder, content);
  }

  prompt = prompt.replaceAll('{{group-info}}', groupInfo || '(그룹 정보 없음)');

  return prompt.trim();
}
