import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type RelationType = 'fan' | 'oppa' | 'unnie' | 'hyung' | 'noona' | 'dongsaeng';

export interface UserProfile {
  name: string;
  birthday: string; // YYYY-MM-DD
}

export interface IdolRelation {
  relationType: RelationType;
  startDate: number; // timestamp when chat started
}

export type OnboardingStep = 'name' | 'birthday' | 'relation' | 'complete';

interface UserStore {
  profile: UserProfile | null;
  idolRelations: Record<string, IdolRelation>; // idolId -> relation
  onboardingStep: OnboardingStep; // 현재 onboarding 단계
  tempName: string; // 임시 저장 (birthday 입력 전까지)

  setProfile: (profile: UserProfile) => void;
  setOnboardingStep: (step: OnboardingStep) => void;
  setTempName: (name: string) => void;
  setIdolRelation: (idolId: string, relation: IdolRelation) => void;
  getIdolRelation: (idolId: string) => IdolRelation | null;
  getDayCount: (idolId: string) => number;
  getHonorific: (idolId: string, idolBirthYear?: number) => string;
  isOnboarded: () => boolean;
  isIdolRelationSet: (idolId: string) => boolean;
  reset: () => void;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      profile: null,
      idolRelations: {},
      onboardingStep: 'name' as OnboardingStep,
      tempName: '',

      setProfile: (profile) => set({ profile }),
      setOnboardingStep: (step) => set({ onboardingStep: step }),
      setTempName: (name) => set({ tempName: name }),

      setIdolRelation: (idolId, relation) =>
        set((state) => ({
          idolRelations: {
            ...state.idolRelations,
            [idolId]: relation,
          },
        })),

      getIdolRelation: (idolId) => get().idolRelations[idolId] ?? null,

      getDayCount: (idolId) => {
        const relation = get().idolRelations[idolId];
        if (!relation) return 0;
        const now = Date.now();
        const diff = now - relation.startDate;
        return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
      },

      getHonorific: (idolId) => {
        const relation = get().idolRelations[idolId];
        if (!relation) return '';
        
        const profile = get().profile;
        const fullName = profile?.name ?? '';
        
        // 성 빼고 이름만 추출 (홍성욱 → 성욱)
        let firstName = fullName;
        if (fullName.length >= 3) {
          // 복성 체크 (남궁, 선우, 독고, 황보, 제갈, 사공, 서문 등)
          const doubleSurnames = ['남궁', '선우', '독고', '황보', '제갈', '사공', '서문', '소봉'];
          const firstTwo = fullName.slice(0, 2);
          if (fullName.length >= 4 && doubleSurnames.includes(firstTwo)) {
            firstName = fullName.slice(2); // 복성 제거
          } else {
            firstName = fullName.slice(1); // 일반 성 제거
          }
        }
        // 2글자 이하는 그대로 (이름만 입력했을 수 있음)
        
        switch (relation.relationType) {
          case 'oppa':
            return `${firstName} 오빠`;
          case 'unnie':
            return `${firstName} 언니`;
          case 'hyung':
            return `${firstName} 형`;
          case 'noona':
            return `${firstName} 누나`;
          case 'dongsaeng': {
            // 받침 체크
            const lastChar = firstName.charAt(firstName.length - 1);
            const lastCharCode = lastChar.charCodeAt(0);
            const hasBatchim = lastCharCode >= 0xAC00 && lastCharCode <= 0xD7A3 
              && (lastCharCode - 0xAC00) % 28 !== 0;
            return hasBatchim ? `${firstName}아` : `${firstName}야`;
          }
          case 'fan':
          default:
            return firstName;
        }
      },

      isOnboarded: () => get().profile !== null,

      isIdolRelationSet: (idolId) => idolId in get().idolRelations,

      reset: () => set({ profile: null, idolRelations: {} }),
    }),
    {
      name: 'mimchat-user',
    }
  )
);
