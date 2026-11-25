-- Run once against a Neon database. No fictional event or fee is inserted.
begin;
create table public.eai_events (
 id uuid primary key default gen_random_uuid(), host text not null, venue text not null, date_label text not null,
 fee_pesewas integer not null check(fee_pesewas>0),
 status text not null default 'draft' check(status in ('draft','open','closed')),
 payment_instructions text not null default 'Contact Eckintosh Technologies for approved payment instructions. Do not pay until the organiser confirms the payment channel.',
 created_at timestamptz not null default now()
);
create unique index eai_one_open_event on public.eai_events ((status)) where status='open';
create table public.eai_registrations (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.eai_events(id),
 reference text not null unique default ('AIUG'||lpad(((('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint % 10000)::text),4,'0')),
 full_name text not null, email text, phone text not null, institution text, programme text not null, study_level text not null, ai_experience text,
 expected_fee_pesewas integer not null check(expected_fee_pesewas>0),
 status text not null default 'pending' check(status in ('pending','paid','cancelled','refunded')),
 payment_reference text unique, payment_verified_at timestamptz, consent_version text not null, consent_at timestamptz not null default now(), created_at timestamptz not null default now(),
 check(status not in ('paid','refunded') or (payment_reference is not null and payment_verified_at is not null)),
 unique(event_id,email)
);
alter table public.eai_events enable row level security;
alter table public.eai_registrations enable row level security;
revoke all on public.eai_events,public.eai_registrations from public;
create table public.eai_admin_login_guard (
 id boolean primary key default true check (id),
 window_start timestamptz not null default now(),
 attempts integer not null default 0
);
alter table public.eai_admin_login_guard enable row level security;
revoke all on public.eai_admin_login_guard from public;
create table public.eai_admin_sessions (
 session_hash text primary key,
 expires_at timestamptz not null
);
alter table public.eai_admin_sessions enable row level security;
revoke all on public.eai_admin_sessions from public;
create function public.eai_public_event() returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',e.id,'host',e.host,'venue',e.venue,'date_label',e.date_label,'fee_pesewas',e.fee_pesewas,'open',e.status='open','status',e.status)
 from public.eai_events e where e.status='open' limit 1;
$$;
create function public.eai_register(p_event_id uuid,p_name text,p_email text,p_phone text,p_institution text,p_programme text,p_level text,p_experience text) returns jsonb language plpgsql set search_path='' as $$
declare ev public.eai_events%rowtype; ref text; start_number integer; attempt integer; constraint_name text;
begin
 select * into ev from public.eai_events where id=p_event_id for update;
 if not found or ev.status<>'open' then return jsonb_build_object('error','Registration is no longer open.'); end if;
 if exists(select 1 from public.eai_registrations where event_id=ev.id and regexp_replace(phone,'[^0-9]','','g')=regexp_replace(p_phone,'[^0-9]','','g')) then return jsonb_build_object('error','This phone number is already registered. Check your status or contact support.'); end if;
 start_number := (('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint % 10000)::integer;
 for attempt in 0..9999 loop
  ref := 'AIUG'||lpad(((start_number+attempt)%10000)::text,4,'0');
  begin
   insert into public.eai_registrations(event_id,reference,full_name,email,phone,institution,programme,study_level,ai_experience,expected_fee_pesewas,consent_version)
   values(ev.id,ref,p_name,p_email,p_phone,p_institution,p_programme,p_level,nullif(p_experience,''),ev.fee_pesewas,'2026-11-25-v1');
   return jsonb_build_object('reference',ref,'status','pending','instructions',ev.payment_instructions);
  exception when unique_violation then
   get stacked diagnostics constraint_name = constraint_name;
   if constraint_name <> 'eai_registrations_reference_key' then raise; end if;
  end;
 end loop;
 return jsonb_build_object('error','No registration references are available. Please contact support.');
end;
$$;
create function public.eai_status(p_reference text,p_phone text) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('status',status) from public.eai_registrations where reference=p_reference and regexp_replace(phone,'[^0-9]','','g')=regexp_replace(p_phone,'[^0-9]','','g') limit 1;
$$;
revoke execute on function public.eai_public_event() from public;
revoke execute on function public.eai_register(uuid,text,text,text,text,text,text,text) from public;
revoke execute on function public.eai_status(text,text) from public;
commit;
