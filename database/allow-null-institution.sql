-- Preserve existing records while allowing registrations without an institution.
alter table public.eai_registrations alter column institution drop not null;
