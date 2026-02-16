import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured. RAG features will be disabled.');
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Types for idol_knowledge table
export interface PoliticianKnowledge {
  id?: number;
  idol_id: string;
  category: 'sns' | 'interview' | 'lyrics' | 'bubble' | 'profile' | 'relationship' | 'general';
  content: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
  created_at?: string;
}

export interface SimilaritySearchResult extends PoliticianKnowledge {
  similarity: number;
}
