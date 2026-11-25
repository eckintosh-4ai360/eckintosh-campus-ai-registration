-- Existing references stay valid; new registrations use AIUG plus four digits.
begin;
alter table public.eai_registrations alter column reference set default ('AIUG'||lpad(((('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint % 10000)::text),4,'0'));
create or replace function public.eai_register(p_event_id uuid,p_name text,p_email text,p_phone text,p_institution text,p_programme text,p_level text,p_experience text) returns jsonb language plpgsql set search_path='' as $$
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
commit;
