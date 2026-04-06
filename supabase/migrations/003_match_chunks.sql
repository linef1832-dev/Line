-- RPC สำหรับ RAG: ค้นหา chunk ที่ใกล้เคียงคำถาม
create or replace function public.match_chunks (
  query_embedding vector(768),
  match_count int default 5,
  min_similarity float default 0.5
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language sql
stable
parallel safe
as $$
  select
    k.id,
    k.content,
    k.metadata,
    (1 - (k.embedding <=> query_embedding)) as similarity
  from public.knowledge_chunks k
  where (1 - (k.embedding <=> query_embedding)) > min_similarity
  order by k.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

comment on function public.match_chunks is 'ค้นหา chunk ความรู้ที่ใกล้เคียงคำถาม (cosine similarity) สำหรับส่งต่อให้ LLM สรุปคำตอบ';
