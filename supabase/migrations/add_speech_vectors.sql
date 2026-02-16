-- politician_speeches: 정치인 발언/회의록 벡터 저장
create table if not exists politician_speeches (
  id uuid default gen_random_uuid() primary key,
  politician_id text not null,
  source text not null, -- 'assembly', 'news', 'sns'
  content text not null,
  embedding vector(1536),
  metadata jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_politician_speeches_politician on politician_speeches(politician_id);
create index if not exists idx_politician_speeches_source on politician_speeches(source);

-- ivfflat index for cosine similarity (requires rows to exist first for training)
-- Run after inserting initial data:
-- create index on politician_speeches using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- RPC function for similarity search
create or replace function match_politician_speeches(
  query_embedding vector(1536),
  filter_politician_id text default null,
  filter_source text default null,
  match_threshold float default 0.7,
  match_count int default 5
)
returns table (
  id uuid,
  politician_id text,
  source text,
  content text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    ps.id,
    ps.politician_id,
    ps.source,
    ps.content,
    ps.metadata,
    1 - (ps.embedding <=> query_embedding) as similarity
  from politician_speeches ps
  where
    (filter_politician_id is null or ps.politician_id = filter_politician_id)
    and (filter_source is null or ps.source = filter_source)
    and 1 - (ps.embedding <=> query_embedding) > match_threshold
  order by ps.embedding <=> query_embedding
  limit match_count;
$$;
