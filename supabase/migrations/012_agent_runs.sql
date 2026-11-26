-- Polarvane database setup, part 12: saved agent plans ("Ask Polarvane" → Full plan).
create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dashboard_id uuid references public.dashboards (id) on delete set null,
  goal text not null,
  brand text,
  state jsonb not null,
  report jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists agent_runs_user_idx on public.agent_runs (user_id, created_at desc);

alter table public.agent_runs enable row level security;
drop policy if exists "Own agent runs" on public.agent_runs;
create policy "Own agent runs" on public.agent_runs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
