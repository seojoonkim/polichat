export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  reaction?: string; // ❤️ 등 아이돌이 남긴 리액션
  isRead?: boolean; // 읽음 표시 (user 메시지용)
  expGained?: number; // 이 메시지로 얻은 EXP (버블 끝에 표시)
}
