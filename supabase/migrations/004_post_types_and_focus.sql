-- Polarvane database setup, part 4: post types and comment focus.
alter table public.analyses add column if not exists post_kind text
  check (post_kind in ('collaboration', 'brand', 'other'));
alter table public.comments add column if not exists focus text
  check (focus in ('product', 'creator', 'both', 'other'));
