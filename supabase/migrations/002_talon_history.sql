-- Polarvane database setup, part 2: saved Talon chat history.
-- Each user can only see and change their own chats (Row Level Security).

create table if not exists public.talon_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  post_id uuid references public.analyses (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.talon_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.talon_chats (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'talon', 'error')),
  text text not null,
  evidence jsonb not null default '[]',
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists talon_chats_user_idx on public.talon_chats (user_id, updated_at desc);
create index if not exists talon_messages_chat_idx on public.talon_messages (chat_id, created_at);

alter table public.talon_chats enable row level security;
alter table public.talon_messages enable row level security;

drop policy if exists "Own chats" on public.talon_chats;
create policy "Own chats" on public.talon_chats
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Own chat messages" on public.talon_messages;
create policy "Own chat messages" on public.talon_messages
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.talon_chats c where c.id = chat_id and c.user_id = (select auth.uid()))
  );
