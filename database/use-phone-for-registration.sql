-- Preserve existing registrations while removing the email requirement.
begin;
alter table public.eai_registrations alter column email drop not null;
create or replace function public.eai_register(p_event_id uuid,p_name text,p_email text,p_phone text,p_institution text,p_programme text,p_level text,p_experience text) returns jsonb language plpgsql set search_path='' as $$
declare ev public.eai_events%rowtype; ref text;
begin
 select * into ev from public.eai_events where id=p_event_id for update;
 if not found or ev.status<>'open' then return jsonb_build_object('error','Registration is no longer open.'); end if;
 if exists(select 1 from public.eai_registrations where event_id=ev.id and regexp_replace(phone,'[^0-9]','','g')=regexp_replace(p_phone,'[^0-9]','','g')) then return jsonb_build_object('error','This phone number is already registered. Check your status or contact support.'); end if;
 insert into public.eai_registrations(event_id,full_name,email,phone,institution,programme,study_level,ai_experience,expected_fee_pesewas,consent_version)
 values(ev.id,p_name,p_email,p_phone,p_institution,p_programme,p_level,nullif(p_experience,''),ev.fee_pesewas,'2026-11-25-v1') returning reference into ref;
 return jsonb_build_object('reference',ref,'status','pending','instructions',ev.payment_instructions);
end;
$$;
drop function public.eai_status(text,text);
create function public.eai_status(p_reference text,p_phone text) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('status',status) from public.eai_registrations where reference=p_reference and regexp_replace(phone,'[^0-9]','','g')=regexp_replace(p_phone,'[^0-9]','','g') limit 1;
$$;
revoke execute on function public.eai_status(text,text) from public;
commit;
