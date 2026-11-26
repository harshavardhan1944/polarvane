-- Polarvane database setup, part 11: Talon chats remember which comments they answer from.
-- '' = all sources, 'reddit' = Reddit threads only, 'instagram' = Instagram posts only.
-- Chats made before this update count as all sources.
alter table public.talon_chats add column if not exists source text not null default '';
alter table public.talon_chats drop constraint if exists talon_chats_source_check;
alter table public.talon_chats
  add constraint talon_chats_source_check check (source in ('', 'reddit', 'instagram'));
create index if not exists talon_chats_source_idx on public.talon_chats (user_id, source, dashboard_id, updated_at desc);
