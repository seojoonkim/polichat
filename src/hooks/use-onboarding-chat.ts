import { useCallback, useRef, useEffect } from 'react';
import { useUserStore, type RelationType, type OnboardingStep } from '@/stores/user-store';
import type { IdolMeta } from '@/types/idol';

export type { OnboardingStep };

// 성 빼고 이름만 추출 (홍성욱 → 성욱)
function getFirstName(fullName: string): string {
  if (fullName.length >= 3) {
    // 복성 체크 (남궁, 선우, 독고, 황보, 제갈, 사공, 서문 등)
    const doubleSurnames = ['남궁', '선우', '독고', '황보', '제갈', '사공', '서문', '소봉'];
    const firstTwo = fullName.slice(0, 2);
    if (fullName.length >= 4 && doubleSurnames.includes(firstTwo)) {
      return fullName.slice(2); // 복성 제거
    } else {
      return fullName.slice(1); // 일반 성 제거
    }
  }
  // 2글자 이하는 그대로 (이름만 입력했을 수 있음)
  return fullName;
}

// Extract name from natural language response
function extractName(text: string): string {
  const cleaned = text.trim();
  
  // Common Korean name patterns to extract actual name
  const patterns = [
    /^(?:저는?|나는?|내\s*이름은?)\s*(.+?)(?:이야|야|이에요|에요|입니다|이요|요|임|인데|이거든|거든)?$/,
    /^(.+?)(?:이야|야|이에요|에요|입니다|이요|요)$/,
    /^(?:저|나)\s+(.+?)$/,
  ];
  
  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match && match[1]) {
      // Remove any remaining particles/suffixes
      let name = match[1].trim();
      // Remove trailing particles like 라고, 라고요, etc.
      name = name.replace(/(?:라고|이라고|라고요|이라고요).*$/, '').trim();
      // Remove punctuation
      name = name.replace(/[~!@#$%^&*(),.?":{}|<>]/g, '').trim();
      if (name.length >= 1 && name.length <= 10) {
        return name;
      }
    }
  }
  
  // Fallback: just clean the input and assume it's the name
  const fallback = cleaned.replace(/[~!@#$%^&*(),.?":{}|<>]/g, '').trim();
  if (fallback.length >= 1 && fallback.length <= 10) {
    return fallback;
  }
  
  return '';
}

// Parse relation from user response
function parseRelation(text: string): RelationType | null {
  const lower = text.toLowerCase();
  if (lower.includes('오빠') || lower.includes('1')) return 'oppa';
  if (lower.includes('언니') || lower.includes('2')) return 'unnie';
  if (lower.includes('형') || lower.includes('3')) return 'hyung';
  if (lower.includes('누나') || lower.includes('4')) return 'noona';
  if (lower.includes('동생') || lower.includes('5')) return 'dongsaeng';
  if (lower.includes('팬') || lower.includes('6')) return 'fan';
  return null;
}

// Parse birthday from user response (currently unused, exported for future use)
export function parseBirthday(text: string): string {
  // Try to extract date patterns
  // Format: YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD, YYYYMMDD
  const patterns = [
    /(\d{4})[-./](\d{1,2})[-./](\d{1,2})/,
    /(\d{4})(\d{2})(\d{2})/,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[2] && match[3]) {
      const [, year, month, day] = match;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }
  
  // Korean format: 84년 11월 16일, 2000년 1월 15일
  const koreanPattern = /(\d{2,4})년\s*(\d{1,2})월\s*(\d{1,2})일/;
  const koreanMatch = text.match(koreanPattern);
  if (koreanMatch && koreanMatch[1] && koreanMatch[2] && koreanMatch[3]) {
    let year = koreanMatch[1];
    // 2자리 연도 → 4자리 (84 → 1984, 00 → 2000)
    if (year.length === 2) {
      const yearNum = parseInt(year, 10);
      year = yearNum >= 50 ? `19${year}` : `20${year}`;
    }
    const month = koreanMatch[2].padStart(2, '0');
    const day = koreanMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // Check for skip keywords
  if (text.includes('비밀') || text.includes('안알려') || text.includes('패스') || text.includes('스킵')) {
    return '';
  }
  
  return '';
}

export function useOnboardingChat(idol: IdolMeta) {
  const profile = useUserStore((s) => s.profile);
  const isIdolRelationSet = useUserStore((s) => s.isIdolRelationSet(idol.id));
  const setProfile = useUserStore((s) => s.setProfile);
  const setIdolRelation = useUserStore((s) => s.setIdolRelation);
  
  // Zustand store for step (동기적 업데이트)
  const step = useUserStore((s) => s.onboardingStep);
  const setStep = useUserStore((s) => s.setOnboardingStep);
  // tempName은 processResponse 내에서 getState()로 직접 읽음 (stale closure 방지)
  const setTempName = useUserStore((s) => s.setTempName);

  // 초기 step 설정 (한 번만)
  // 온보딩은 이름 → 호칭만. 생일은 친밀도 쌓인 후 자연스럽게 물어보도록 변경
  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      if (!profile?.name) {
        setStep('name');
      } else if (!isIdolRelationSet) {
        setStep('relation');
      } else {
        setStep('complete');
      }
    }
  }, [profile, isIdolRelationSet, setStep]);

  const isOnboarding = step !== 'complete';

  // Get the initial message idol should say
  const getInitialMessage = useCallback((): string => {
    switch (step) {
      case 'name':
        return `어 안녕~! 💕||처음 보는 얼굴이네? 이름이 뭐야?`;
      case 'relation':
        return `${profile?.name}! 반가워~ 🥰||근데 나한테 어떻게 불러줄까?||1.오빠 2.언니 3.형 4.누나 5.동생 6.팬`;
      default:
        return '';
    }
  }, [step, profile?.name]);

  // Process user response and advance to next step
  const processResponse = useCallback((userMessage: string): { 
    nextStep: OnboardingStep; 
    idolResponse: string;
    shouldSendToAI: boolean;
  } => {
    // ✅ 항상 최신 값을 store에서 직접 읽기 (stale closure 방지)
    const currentStep = useUserStore.getState().onboardingStep;
    const currentTempName = useUserStore.getState().tempName;
    const currentProfile = useUserStore.getState().profile;
    
    console.log('[Onboarding] Current step:', currentStep, 'Message:', userMessage);

    if (currentStep === 'name') {
      // Extract actual name from response
      const name = extractName(userMessage);
      if (name && name.length >= 1 && name.length <= 10) {
        setTempName(name);
        // 이름 받은 후 바로 호칭으로 (생일은 나중에 자연스럽게)
        setStep('relation');
        
        // Save profile with empty birthday (will be filled later naturally)
        setProfile({ name, birthday: '' });
        
        // 성 빼고 이름만 사용 (홍성욱 → 성욱)
        const firstName = getFirstName(name);
        
        // Check if name has 받침
        const lastChar = firstName.charAt(firstName.length - 1);
        const lastCharCode = lastChar.charCodeAt(0);
        const hasBatchim = lastCharCode >= 0xAC00 && lastCharCode <= 0xD7A3 
          && (lastCharCode - 0xAC00) % 28 !== 0;
        const callName = hasBatchim ? `${firstName}아` : `${firstName}야`;
        
        return {
          nextStep: 'relation',
          idolResponse: `${callName}~ 이름 너무 예쁘다! 😊||근데 나한테 뭐라고 불러줄 거야?||1.오빠 2.언니 3.형 4.누나 5.동생 6.팬`,
          shouldSendToAI: false,
        };
      }
      return {
        nextStep: 'name',
        idolResponse: `앗 이름이 잘 안들렸어 ㅠㅠ||다시 알려줄래?`,
        shouldSendToAI: false,
      };
    }

    // birthday step은 더 이상 온보딩에서 사용하지 않음
    // 생일은 친밀도가 쌓인 후 AI가 자연스럽게 물어봄

    if (currentStep === 'relation') {
      const relation = parseRelation(userMessage);
      if (relation) {
        setIdolRelation(idol.id, {
          relationType: relation,
          startDate: Date.now(),
        });
        setStep('complete');
        
        // 성 빼고 이름만 사용 - currentProfile 사용 (이미 저장됨)
        const firstName = getFirstName(currentProfile?.name || currentTempName || '');
        
        // Build call name based on relation
        let callName = firstName;
        const lastChar = firstName.charAt(firstName.length - 1);
        const lastCharCode = lastChar.charCodeAt(0);
        const hasBatchim = lastCharCode >= 0xAC00 && lastCharCode <= 0xD7A3 
          && (lastCharCode - 0xAC00) % 28 !== 0;
        
        switch (relation) {
          case 'oppa': callName = `${firstName} 오빠`; break;
          case 'unnie': callName = `${firstName} 언니`; break;
          case 'hyung': callName = `${firstName} 형`; break;
          case 'noona': callName = `${firstName} 누나`; break;
          default: callName = hasBatchim ? `${firstName}아` : `${firstName}야`;
        }
        
        // 더 자연스러운 온보딩 완료 메시지 (생일 안 물어봄)
        return {
          nextStep: 'complete',
          idolResponse: `좋아 ${callName}~! 💕||앞으로 밈챗에서 자주 얘기하자!||오늘 하루 어땠어?`,
          shouldSendToAI: false,
        };
      }
      return {
        nextStep: 'relation',
        idolResponse: `음... 뭐라고? 😅||1~6 중에 하나 골라줘!||1.오빠 2.언니 3.형 4.누나 5.동생 6.팬`,
        shouldSendToAI: false,
      };
    }

    // If complete, send to AI
    return {
      nextStep: 'complete',
      idolResponse: '',
      shouldSendToAI: true,
    };
  }, [idol.id, setProfile, setIdolRelation, setStep, setTempName]);

  return {
    isOnboarding,
    currentStep: step,
    getInitialMessage,
    processResponse,
  };
}
