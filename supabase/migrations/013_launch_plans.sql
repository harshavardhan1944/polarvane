-- Polarvane database setup, part 13: saved launch plans (Launch planner).
create table if not exists public.launch_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  product text not null,
  market text not null,
  input jsonb not null,
  research jsonb not null,
  report jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists launch_plans_user_idx on public.launch_plans (user_id, created_at desc);

alter table public.launch_plans enable row level security;
drop policy if exists "Own launch plans" on public.launch_plans;
create policy "Own launch plans" on public.launch_plans
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
