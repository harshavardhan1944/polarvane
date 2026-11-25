-- Polarvane database setup, part 8: AI visibility checks.
-- Stores what an AI assistant answered to a customer question, and whether the brand appeared.
-- Each user can only see and change their own checks (Row Level Security).

create table if not exists public.ai_visibility_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  run_id uuid not null,
  brand text not null,
  question text not null,
  model text not null,
  web_search boolean not null default false,
  answer text not null,
  mentioned boolean not null default false,
  rank integer,
  sentiment text check (sentiment in ('positive', 'neutral', 'negative', 'not_mentioned')),
  description text,
  competitors text[] not null default '{}',
  sources jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index if not exists ai_visibility_user_idx on public.ai_visibility_checks (user_id, created_at desc);
create index if not exists ai_visibility_run_idx on public.ai_visibility_checks (run_id);

alter table public.ai_visibility_checks enable row level security;

drop policy if exists "Own visibility checks" on public.ai_visibility_checks;
create policy "Own visibility checks" on public.ai_visibility_checks
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
