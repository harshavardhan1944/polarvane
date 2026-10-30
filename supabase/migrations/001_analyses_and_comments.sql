-- Polarvane database setup, part 1.
-- Creates the tables for analyses (one per Instagram post) and comments,
-- and locks every row to the user who owns it (Row Level Security).

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  post_url text not null,
  shortcode text not null,
  post_type text not null check (post_type in ('post', 'reel')),
  status text not null default 'queued'
    check (status in ('queued', 'collecting', 'analyzing', 'completed', 'failed')),
  error_message text,
  comment_limit integer not null default 200 check (comment_limit between 1 and 5000),
  comments_reported integer,
  comments_collected integer not null default 0,
  comments_analyzed integer not null default 0,
  apify_run_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, shortcode)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  external_id text not null,
  text text not null,
  author_username text,
  posted_at timestamptz,
  like_count integer,
  reply_count integer,
  sentiment text check (sentiment in ('positive', 'neutral', 'negative')),
  sentiment_confidence real,
  topics text[] not null default '{}',
  analysis_error text,
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (analysis_id, external_id)
);

create index if not exists analyses_user_created_idx on public.analyses (user_id, created_at desc);
create index if not exists comments_analysis_idx on public.comments (analysis_id);
create index if not exists comments_user_idx on public.comments (user_id);

-- Keep updated_at current automatically.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists analyses_set_updated_at on public.analyses;
create trigger analyses_set_updated_at
  before update on public.analyses
  for each row execute function public.set_updated_at();

-- Row Level Security: each user can only ever see and change their own rows.
alter table public.analyses enable row level security;
alter table public.comments enable row level security;

drop policy if exists "Own analyses: read" on public.analyses;
drop policy if exists "Own analyses: create" on public.analyses;
drop policy if exists "Own analyses: update" on public.analyses;
drop policy if exists "Own analyses: delete" on public.analyses;
create policy "Own analyses: read" on public.analyses
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Own analyses: create" on public.analyses
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Own analyses: update" on public.analyses
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Own analyses: delete" on public.analyses
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Own comments: read" on public.comments;
drop policy if exists "Own comments: create" on public.comments;
drop policy if exists "Own comments: update" on public.comments;
drop policy if exists "Own comments: delete" on public.comments;
create policy "Own comments: read" on public.comments
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Own comments: create" on public.comments
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.analyses a where a.id = analysis_id and a.user_id = (select auth.uid()))
  );
create policy "Own comments: update" on public.comments
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Own comments: delete" on public.comments
  for delete to authenticated using (user_id = (select auth.uid()));
