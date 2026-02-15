import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ApiKeyState {
  apiKey: string;
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
}

export const useApiKeyStore = create<ApiKeyState>()(
  persist(
    (set) => ({
      apiKey: '',
      setApiKey: (key) => set({ apiKey: key }),
      clearApiKey: () => set({ apiKey: '' }),
    }),
    { name: 'mimchat-api-key' },
  ),
);
