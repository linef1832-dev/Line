-- รันใน Supabase SQL Editor หลังเปิด extension vector
-- เวกเตอร์ต้องตรงกับ Gemini text-embedding-004 (ค่าเริ่มต้น 768 มิติ)

create extension if not exists vector;

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(768) not null,
  created_at timestamptz not null default now()
);

create index if not exists knowledge_chunks_embedding_idx
  on public.knowledge_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create table if not exists public.pending_line_replies (
  id uuid primary key default gen_random_uuid(),
  line_user_id text not null,
  question_text text not null,
  draft_text text not null,
  context_snippets jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'sent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pending_line_replies_status_idx
  on public.pending_line_replies (status, created_at desc);

create or replace function public.match_knowledge_chunks (
  query_embedding vector(768),
  match_count int default 8,
  min_similarity float default 0.22
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language sql
stable
as $$
  select
    k.id,
    k.content,
    k.metadata,
    (1 - (k.embedding <=> query_embedding))::float as similarity
  from public.knowledge_chunks k
  where (1 - (k.embedding <=> query_embedding)) >= min_similarity
  order by k.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;
