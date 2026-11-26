-- Polarvane database setup, part 10: Reddit threads.
-- Lets an analysis be a Reddit thread as well as an Instagram post or Reel.
-- Reddit usernames are never stored (author_username stays empty).

alter table public.analyses drop constraint if exists analyses_post_type_check;
alter table public.analyses
  add constraint analyses_post_type_check check (post_type in ('post', 'reel', 'reddit'));
