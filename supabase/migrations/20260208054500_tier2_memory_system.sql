-- Mim.chat 2-Tier Data Architecture + User Memory System
-- Migration: 20260208_tier2_memory_system.sql

-- ============================================
-- TIER 1: Core Identity (항상 로드, 캐시)
-- ============================================

CREATE TABLE IF NOT EXISTS idol_identity (
  id TEXT PRIMARY KEY,
  name_ko TEXT NOT NULL,
  name_en TEXT,
  birth_date DATE,
  group_name TEXT,
  personality_tags TEXT[],
  speech_style JSONB, -- 말투 규칙
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 업데이트 시 자동 타임스탬프
CREATE OR REPLACE FUNCTION update_idol_identity_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER idol_identity_updated
  BEFORE UPDATE ON idol_identity
  FOR EACH ROW
  EXECUTE FUNCTION update_idol_identity_timestamp();

-- ============================================
-- USER MEMORY SYSTEM
-- ============================================

-- user_memory: 유저별 아이돌별 기억
CREATE TABLE IF NOT EXISTS user_memory (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  idol_id TEXT NOT NULL,
  name TEXT, -- 유저가 알려준 이름
  birthday DATE, -- 유저 생일
  honorific TEXT, -- 호칭 (오빠, 언니, 형 등)
  facts JSONB DEFAULT '{}', -- 기타 사실들
  first_chat_at TIMESTAMPTZ DEFAULT NOW(),
  total_messages INT DEFAULT 0,
  affinity_score FLOAT DEFAULT 0.5, -- 0.0 ~ 1.0
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, idol_id)
);

-- conversation_memory: 대화에서 추출된 중요 기억
CREATE TABLE IF NOT EXISTS conversation_memory (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  idol_id TEXT NOT NULL,
  memory_type TEXT, -- 'preference', 'event', 'topic', 'emotion' 등
  content TEXT NOT NULL,
  embedding vector(1536),
  importance FLOAT DEFAULT 0.5, -- 0.0 ~ 1.0
  last_referenced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_user_memory_user_idol ON user_memory(user_id, idol_id);
CREATE INDEX IF NOT EXISTS idx_conversation_memory_user_idol ON conversation_memory(user_id, idol_id);
CREATE INDEX IF NOT EXISTS idx_conversation_memory_type ON conversation_memory(memory_type);

-- HNSW 벡터 인덱스 (유사도 검색용)
CREATE INDEX IF NOT EXISTS idx_conversation_memory_embedding 
  ON conversation_memory USING hnsw (embedding vector_cosine_ops);

-- 유저 메모리 업데이트 트리거
CREATE OR REPLACE FUNCTION update_user_memory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_memory_updated
  BEFORE UPDATE ON user_memory
  FOR EACH ROW
  EXECUTE FUNCTION update_user_memory_timestamp();

-- ============================================
-- RPC FUNCTIONS
-- ============================================

-- 유저 관련 대화 기억 검색
CREATE OR REPLACE FUNCTION match_conversation_memory(
  query_embedding vector(1536),
  filter_user_id TEXT,
  filter_idol_id TEXT,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id BIGINT,
  memory_type TEXT,
  content TEXT,
  importance FLOAT,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    conversation_memory.id,
    conversation_memory.memory_type,
    conversation_memory.content,
    conversation_memory.importance,
    1 - (conversation_memory.embedding <=> query_embedding) as similarity
  FROM conversation_memory
  WHERE 
    conversation_memory.user_id = filter_user_id
    AND conversation_memory.idol_id = filter_idol_id
    AND conversation_memory.embedding IS NOT NULL
    AND 1 - (conversation_memory.embedding <=> query_embedding) > match_threshold
  ORDER BY conversation_memory.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ============================================
-- RLS (Row Level Security)
-- ============================================

ALTER TABLE idol_identity ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_memory ENABLE ROW LEVEL SECURITY;

-- idol_identity: 공개 읽기
CREATE POLICY "Allow public read idol_identity" ON idol_identity
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert idol_identity" ON idol_identity
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated update idol_identity" ON idol_identity
  FOR UPDATE USING (true);

-- user_memory: 공개 읽기/쓰기 (API에서 user_id로 필터링)
CREATE POLICY "Allow public access user_memory" ON user_memory
  FOR ALL USING (true);

-- conversation_memory: 공개 읽기/쓰기
CREATE POLICY "Allow public access conversation_memory" ON conversation_memory
  FOR ALL USING (true);

-- ============================================
-- Verify
-- ============================================
SELECT 'Migration complete!' as status;
