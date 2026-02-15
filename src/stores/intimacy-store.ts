import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { IdolIntimacy, ExpEvent } from '@/types/intimacy';
import { getIntimacyTitle } from '@/types/intimacy';

// 오늘 날짜 (YYYY-MM-DD)
function getToday(): string {
  return new Date().toISOString().split('T')[0]!;
}

// 두 날짜 사이의 일수 차이
function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diff = Math.abs(d2.getTime() - d1.getTime());
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

interface IntimacyStore {
  // 아이돌별 친밀도 데이터
  intimacies: Record<string, IdolIntimacy>;
  
  // EXP 토스트 표시용 (최근 이벤트)
  lastExpEvent: ExpEvent | null;
  
  // 레벨업/다운 시스템 메시지용
  levelChangeEvent: {
    idolId: string;
    oldLevel: number;
    newLevel: number;
    title: string;
  } | null;
  
  // 초기화
  getOrCreateIntimacy: (idolId: string) => IdolIntimacy;
  
  // EXP 변동
  addExp: (idolId: string, amount: number, type: ExpEvent['type']) => void;
  
  // 메시지 전송 시 호출 (EXP 획득 + 통계 업데이트)
  onMessageSent: (idolId: string) => void;
  
  // 리액션 받았을 때 호출
  onReactionReceived: (idolId: string) => void;
  
  // 채팅 나갈 때 호출 (갑자기 나감 페널티)
  onChatLeft: (idolId: string, wasAbrupt: boolean) => void;
  
  // AI 응답 품질에 따른 보너스 EXP
  onGoodResponse: (idolId: string, bonusExp: number) => void;
  
  // 앱 시작 시 호출 (비활성 페널티 체크)
  checkInactivityPenalty: (idolId: string) => void;
  
  // 레벨업 이벤트 클리어
  clearLevelChangeEvent: () => void;
  
  // 토스트 클리어
  clearLastExpEvent: () => void;
}

const DEFAULT_INTIMACY: IdolIntimacy = {
  level: 1,
  exp: 0,
  totalExp: 0,
  stats: {
    chatDays: 0,
    totalMessages: 0,
    reactionsReceived: 0,
    consecutiveDays: 0,
    lastChatDate: null,
  },
};

export const useIntimacyStore = create<IntimacyStore>()(
  persist(
    (set, get) => ({
      intimacies: {},
      lastExpEvent: null,
      levelChangeEvent: null,

      getOrCreateIntimacy: (idolId) => {
        const existing = get().intimacies[idolId];
        if (existing) return existing;
        
        const newIntimacy = { ...DEFAULT_INTIMACY };
        set((state) => ({
          intimacies: { ...state.intimacies, [idolId]: newIntimacy },
        }));
        return newIntimacy;
      },

      addExp: (idolId, amount, type) => {
        set((state) => {
          const current = state.intimacies[idolId] ?? { ...DEFAULT_INTIMACY };
          
          let newExp = current.exp + amount;
          let newLevel = current.level;
          let newTotalExp = current.totalExp + amount;
          
          // EXP가 음수가 되지 않도록
          if (newTotalExp < 0) newTotalExp = 0;
          
          // 레벨업 처리
          while (newExp >= 100 && newLevel < 99) {
            newExp -= 100;
            newLevel++;
          }
          
          // 레벨다운 처리
          while (newExp < 0 && newLevel > 1) {
            newLevel--;
            newExp += 100;
          }
          
          // 최소/최대 범위 보정
          if (newLevel <= 1 && newExp < 0) newExp = 0;
          if (newLevel >= 99) {
            newLevel = 99;
            if (newExp > 99) newExp = 99;
          }
          
          const updated: IdolIntimacy = {
            ...current,
            level: newLevel,
            exp: newExp,
            totalExp: newTotalExp,
          };
          
          // 레벨 변동 이벤트
          let levelChangeEvent = state.levelChangeEvent;
          if (newLevel !== current.level) {
            levelChangeEvent = {
              idolId,
              oldLevel: current.level,
              newLevel,
              title: getIntimacyTitle(newLevel),
            };
          }
          
          return {
            intimacies: { ...state.intimacies, [idolId]: updated },
            lastExpEvent: { type, amount, timestamp: Date.now() },
            levelChangeEvent,
          };
        });
      },

      onMessageSent: (idolId) => {
        const today = getToday();
        
        set((state) => {
          const current = state.intimacies[idolId] ?? { ...DEFAULT_INTIMACY };
          const stats = { ...current.stats };
          
          // 메시지 수 증가
          stats.totalMessages++;
          
          // 기본 메시지 EXP (응답 보너스는 onGoodResponse에서 별도 처리)
          let expGain = 1; // 기본 +1 EXP
          let expType: ExpEvent['type'] = 'message';
          
          if (stats.lastChatDate !== today) {
            // 오늘 첫 대화
            expGain += 5; // 일일 보너스
            expType = 'daily_bonus';
            stats.chatDays++;
            
            // 연속 대화 체크
            if (stats.lastChatDate) {
              const daysDiff = daysBetween(stats.lastChatDate, today);
              if (daysDiff === 1) {
                // 연속 대화
                stats.consecutiveDays++;
                // 콤보 보너스 (5일마다 +3)
                if (stats.consecutiveDays % 5 === 0) {
                  expGain += 3;
                  expType = 'combo';
                }
              } else {
                // 연속 끊김
                stats.consecutiveDays = 1;
              }
            } else {
              stats.consecutiveDays = 1;
            }
            
            stats.lastChatDate = today;
          }
          
          // EXP 적용
          let newExp = current.exp + expGain;
          let newLevel = current.level;
          let newTotalExp = current.totalExp + expGain;
          
          // 레벨업 처리
          while (newExp >= 100 && newLevel < 99) {
            newExp -= 100;
            newLevel++;
          }
          
          if (newLevel >= 99 && newExp > 99) newExp = 99;
          
          const updated: IdolIntimacy = {
            ...current,
            level: newLevel,
            exp: newExp,
            totalExp: newTotalExp,
            stats,
          };
          
          // 레벨 변동 이벤트
          let levelChangeEvent = state.levelChangeEvent;
          if (newLevel !== current.level) {
            levelChangeEvent = {
              idolId,
              oldLevel: current.level,
              newLevel,
              title: getIntimacyTitle(newLevel),
            };
          }
          
          return {
            intimacies: { ...state.intimacies, [idolId]: updated },
            lastExpEvent: { type: expType, amount: expGain, timestamp: Date.now() },
            levelChangeEvent,
          };
        });
      },

      onReactionReceived: (idolId) => {
        set((state) => {
          const current = state.intimacies[idolId] ?? { ...DEFAULT_INTIMACY };
          const stats = { ...current.stats };
          stats.reactionsReceived++;
          
          return {
            intimacies: {
              ...state.intimacies,
              [idolId]: { ...current, stats },
            },
          };
        });
        
        // +2 EXP
        get().addExp(idolId, 1, 'reaction');
      },

      onChatLeft: (idolId, wasAbrupt) => {
        if (wasAbrupt) {
          get().addExp(idolId, -1, 'leave');
        }
      },

      onGoodResponse: (idolId, bonusExp) => {
        if (bonusExp <= 0) return;
        get().addExp(idolId, bonusExp, 'response_bonus');
      },

      checkInactivityPenalty: (idolId) => {
        const current = get().intimacies[idolId];
        if (!current?.stats.lastChatDate) return;
        
        const today = getToday();
        const daysSinceLastChat = daysBetween(current.stats.lastChatDate, today);
        
        // 3일 이상 대화 안 함: 하루당 -2 EXP
        if (daysSinceLastChat >= 3) {
          const penalty = (daysSinceLastChat - 2) * -2;
          get().addExp(idolId, penalty, 'decay');
        }
      },

      clearLevelChangeEvent: () => set({ levelChangeEvent: null }),
      clearLastExpEvent: () => set({ lastExpEvent: null }),
    }),
    {
      name: 'mimchat-intimacy',
    }
  )
);
