-- AI 토론 배틀 캐시 테이블
-- 오세훈 vs 정원오 토론 결과를 저장하여 재사용

CREATE TABLE debate_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  topic TEXT NOT NULL,
  style TEXT NOT NULL DEFAULT 'free',
  version INTEGER DEFAULT 1,
  messages JSONB NOT NULL,  -- [{speaker, text, timestamp}]
  judgment JSONB,           -- {winner, reason, scores: {ohsehoon: N, jungwono: N}}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스: 주제+방식 조합으로 빠른 조회
CREATE INDEX idx_debate_cache_topic_style
  ON debate_cache(topic, style, version DESC);
