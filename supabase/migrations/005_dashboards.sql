-- Polarvane database setup, part 5: named dashboards.
create table if not exists public.dashboards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);
create index if not exists dashboards_user_idx on public.dashboards (user_id, created_at);

alter table public.dashboards enable row level security;
drop policy if exists "Own dashboards" on public.dashboards;
create policy "Own dashboards" on public.dashboards
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table public.analyses add column if not exists dashboard_id uuid
  references public.dashboards (id) on delete set null;
create index if not exists analyses_dashboard_idx on public.analyses (dashboard_id);
