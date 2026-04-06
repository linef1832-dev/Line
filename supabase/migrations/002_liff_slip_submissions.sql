-- ตารางเก็บข้อมูลสลิปที่ส่งจากหน้าเว็บ LIFF
create table if not exists public.liff_slip_submissions (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  slip_image_url text not null,
  line_user_id text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists liff_slip_submissions_created_idx
  on public.liff_slip_submissions (created_at desc);

comment on table public.liff_slip_submissions is 'เก็บข้อมูลสลิปที่ส่งมาจากหน้าเว็บ LIFF';
