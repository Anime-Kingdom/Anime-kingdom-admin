-- Run once in Supabase SQL Editor. Does not delete any existing certificate.
begin;
create or replace function public.ak_delete_certificate(p_serial bigint)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if public.ak_is_admin() is not true then
  raise exception 'Administrator access required' using errcode='42501';
 end if;
 delete from public.ak_certificates where serial=p_serial;
 return found;
end;
$$;
revoke all on function public.ak_delete_certificate(bigint) from public,anon;
grant execute on function public.ak_delete_certificate(bigint) to authenticated;
commit;
