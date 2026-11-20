-- Allow administrative role changes (SQL Editor / service_role) while keeping
-- the browser from promoting itself. Safe to apply after the earlier migrations.

create or replace function public.protect_profile_role()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.role is distinct from old.role
     and not public.is_accountant()
     and current_user not in ('postgres', 'supabase_auth_admin', 'service_role')
     and current_setting('request.jwt.claim.role', true) is distinct from 'service_role'
  then
    raise exception 'Only an accountant can change account roles';
  end if;
  return new;
end;
$$;
