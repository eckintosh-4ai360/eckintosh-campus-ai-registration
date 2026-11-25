-- Shared login attempt limit, including across serverless instances.
create table if not exists public.eai_admin_login_guard (
 id boolean primary key default true check (id),
 window_start timestamptz not null default now(),
 attempts integer not null default 0
);
alter table public.eai_admin_login_guard enable row level security;
revoke all on public.eai_admin_login_guard from public;

create table if not exists public.eai_admin_sessions (
 session_hash text primary key,
 expires_at timestamptz not null
);
alter table public.eai_admin_sessions enable row level security;
revoke all on public.eai_admin_sessions from public;
