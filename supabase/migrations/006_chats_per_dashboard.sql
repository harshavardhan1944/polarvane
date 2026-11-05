-- Polarvane database setup, part 6: Talon chats belong to a dashboard.
alter table public.talon_chats add column if not exists dashboard_id uuid
  references public.dashboards (id) on delete set null;
create index if not exists talon_chats_dashboard_idx on public.talon_chats (user_id, dashboard_id, updated_at desc);
