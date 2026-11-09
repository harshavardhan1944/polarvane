-- Polarvane database setup, part 7: your own names for posts.
alter table public.analyses add column if not exists title text
  check (title is null or char_length(title) between 1 and 120);
