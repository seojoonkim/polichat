-- Mim.chat RAG Pipeline - Supabase Setup
-- 이 SQL을 Supabase 대시보드 SQL Editor에서 실행하세요

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create idol_knowledge table
CREATE TABLE IF NOT EXISTS idol_knowledge (
  id BIGSERIAL PRIMARY KEY,
  idol_id TEXT NOT NULL,
  category TEXT NOT NULL, -- 'sns', 'interview', 'lyrics', 'bubble', 'profile', 'relationship', 'general'
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_idol_knowledge_idol_id ON idol_knowledge(idol_id);
CREATE INDEX IF NOT EXISTS idx_idol_knowledge_category ON idol_knowledge(category);

-- 4. Create IVFFlat index for similarity search (requires some data first)
-- Note: Run this after inserting some data, or use HNSW for better performance
-- CREATE INDEX ON idol_knowledge USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 5. Create HNSW index (recommended, works without data)
CREATE INDEX IF NOT EXISTS idx_idol_knowledge_embedding ON idol_knowledge 
USING hnsw (embedding vector_cosine_ops);

-- 6. Create similarity search function
CREATE OR REPLACE FUNCTION match_idol_knowledge(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  filter_idol_id text DEFAULT NULL,
  filter_category text DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  idol_id text,
  category text,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    idol_knowledge.id,
    idol_knowledge.idol_id,
    idol_knowledge.category,
    idol_knowledge.content,
    idol_knowledge.metadata,
    1 - (idol_knowledge.embedding <=> query_embedding) as similarity
  FROM idol_knowledge
  WHERE 
    (filter_idol_id IS NULL OR idol_knowledge.idol_id = filter_idol_id)
    AND (filter_category IS NULL OR idol_knowledge.category = filter_category)
    AND idol_knowledge.embedding IS NOT NULL
    AND 1 - (idol_knowledge.embedding <=> query_embedding) > match_threshold
  ORDER BY idol_knowledge.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 7. Enable Row Level Security (optional but recommended)
ALTER TABLE idol_knowledge ENABLE ROW LEVEL SECURITY;

-- 8. Create policy for read access (adjust as needed)
CREATE POLICY "Allow public read access" ON idol_knowledge
  FOR SELECT USING (true);

-- 9. Create policy for insert (for data collection scripts)
CREATE POLICY "Allow authenticated insert" ON idol_knowledge
  FOR INSERT WITH CHECK (true);

-- Verify setup
SELECT 
  'Setup complete!' as status,
  (SELECT COUNT(*) FROM idol_knowledge) as total_records;
