-- Run once on an existing database before deploying SMS support.
begin;
alter table public.eai_registrations add column if not exists sms_status text not null default 'not_sent';
alter table public.eai_registrations add column if not exists sms_attempted_at timestamptz;
alter table public.eai_registrations add column if not exists sms_sent_at timestamptz;
alter table public.eai_registrations add column if not exists sms_campaign_id text;
alter table public.eai_registrations add column if not exists sms_error text;
alter table public.eai_registrations add constraint eai_sms_status_check check(sms_status in ('not_sent','sending','submitted','failed','unknown'));
create table if not exists public.eai_sms_settings (
 id boolean primary key default true check(id),
 account_id text not null default '', sender text not null default '', message text not null default '',
 api_key_encrypted text, enabled boolean not null default false, updated_at timestamptz not null default now()
);
alter table public.eai_sms_settings enable row level security;
revoke all on public.eai_sms_settings from public;
commit;
