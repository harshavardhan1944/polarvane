-- Polarvane database setup, part 8: "Find sources".
-- A scan asks every connected source how much a brand's customers engage there,
-- ranks the sources, and (after the user picks some) analyzes what people say.
-- Author names are never stored (same privacy rule as comments).

create table if not exists public.source_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  brand text not null check (char_length(brand) between 1 and 80),
  market text not null default '' check (char_length(market) <= 60),
  status text not null default 'scanning'
    check (status in ('scanning', 'ranked', 'analyzing', 'analyzed', 'failed')),
  error_message text,
  selected_sources text[] not null default '{}',
  analysis jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists source_scans_user_idx on public.source_scans (user_id, created_at desc);
create index if not exists source_scans_brand_idx on public.source_scans (user_id, lower(brand), created_at desc);

drop trigger if exists source_scans_set_updated_at on public.source_scans;
create trigger source_scans_set_updated_at
  before update on public.source_scans
  for each row execute function public.set_updated_at();

-- One row per source per scan: how busy it is for this brand.
create table if not exists public.scan_sources (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.source_scans (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  type text not null,
  status text not null check (status in ('ok', 'empty', 'needs_key', 'error')),
  engagement_count bigint not null default 0,
  unit text not null default '',
  avg_rating real,
  where_list text[] not null default '{}',
  note text not null default '',
  rank_index integer not null default 0,
  unique (scan_id, name)
);
create index if not exists scan_sources_scan_idx on public.scan_sources (scan_id);

-- The real reviews/posts/comments pulled from each source.
create table if not exists public.scan_mentions (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.source_scans (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source text not null,
  text text not null,
  url text,
  posted_at text,
  rating real,
  sentiment text check (sentiment in ('positive', 'neutral', 'negative')),
  theme text
);
create index if not exists scan_mentions_scan_idx on public.scan_mentions (scan_id, source);

-- Row Level Security: each user only ever sees and changes their own rows.
alter table public.source_scans enable row level security;
alter table public.scan_sources enable row level security;
alter table public.scan_mentions enable row level security;

drop policy if exists "Own source scans" on public.source_scans;
create policy "Own source scans" on public.source_scans
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Own scan sources" on public.scan_sources;
create policy "Own scan sources" on public.scan_sources
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.source_scans s where s.id = scan_id and s.user_id = (select auth.uid()))
  );

drop policy if exists "Own scan mentions" on public.scan_mentions;
create policy "Own scan mentions" on public.scan_mentions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.source_scans s where s.id = scan_id and s.user_id = (select auth.uid()))
  );
