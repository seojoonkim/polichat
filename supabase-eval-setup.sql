-- eval_logs 테이블: 일본어 품질 평가 결과 저장
-- 생성일: 2025-02-12

CREATE TABLE IF NOT EXISTS eval_logs (
  id BIGSERIAL PRIMARY KEY,
  idol_id TEXT NOT NULL,
  user_id TEXT,
  response_text TEXT NOT NULL,
  eval_result JSONB NOT NULL, -- 전체 eval JSON 저장
  total_score INTEGER,
  grade TEXT, -- A/B/C/D/F
  flagged BOOLEAN DEFAULT FALSE, -- C등급 이하면 true
  model_used TEXT, -- 응답 생성에 사용된 모델
  stop_reason TEXT, -- end_turn, max_tokens 등
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스: 자주 조회하는 컬럼
CREATE INDEX idx_eval_logs_flagged ON eval_logs(flagged);
CREATE INDEX idx_eval_logs_idol_id ON eval_logs(idol_id);
CREATE INDEX idx_eval_logs_grade ON eval_logs(grade);
CREATE INDEX idx_eval_logs_created_at ON eval_logs(created_at DESC);

-- 복합 인덱스: flagged 응답 조회 최적화
CREATE INDEX idx_eval_logs_flagged_created ON eval_logs(flagged, created_at DESC) WHERE flagged = TRUE;

-- 코멘트
COMMENT ON TABLE eval_logs IS '일본어 응답 품질 평가 로그';
COMMENT ON COLUMN eval_logs.eval_result IS 'LLM judge의 전체 평가 결과 JSON';
COMMENT ON COLUMN eval_logs.flagged IS 'C등급(13-17점) 이하면 true - 수동 검토 필요';
COMMENT ON COLUMN eval_logs.stop_reason IS 'Claude API stop_reason: end_turn(정상), max_tokens(잘림)';
