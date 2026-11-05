-- Polarvane database setup, part 3: post details (caption, likes, views, date).
alter table public.analyses add column if not exists caption text;
alter table public.analyses add column if not exists post_owner text;
alter table public.analyses add column if not exists likes_count integer;
alter table public.analyses add column if not exists views_count integer;
alter table public.analyses add column if not exists post_published_at timestamptz;
alter table public.analyses add column if not exists details_status text;
