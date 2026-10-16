begin;
alter table public.ak_certificates add column if not exists registration_number text unique check(registration_number ~ '^[A-Z0-9][A-Z0-9-]{0,39}$');
create or replace function public.ak_set_certificate_registration(p_serial bigint,p_registration text) returns void language plpgsql security definer set search_path='' as $$
declare label text:=upper(trim(p_registration));
begin
 if public.ak_is_admin() is not true then raise exception 'Administrator access required' using errcode='42501'; end if;
 if label is null or label !~ '^[A-Z0-9][A-Z0-9-]{0,39}$' then raise exception 'Use 1–40 letters, numbers or hyphens'; end if;
 perform pg_advisory_xact_lock(824104);
 if label ~ '^AK-[0-9]+$' and label <> 'AK-'||p_serial then raise exception 'AK-number labels are reserved for their original registration. Use a custom prefix such as AKC-104.'; end if;
 if exists(select 1 from public.ak_certificates where serial<>p_serial and coalesce(registration_number,'AK-'||serial)=label) then raise exception 'Registration number already exists'; end if;
 update public.ak_certificates set registration_number=label where serial=p_serial;
 if not found then raise exception 'Certificate not found'; end if;
end; $$;
revoke all on function public.ak_set_certificate_registration(bigint,text) from public,anon;
grant execute on function public.ak_set_certificate_registration(bigint,text) to authenticated;
commit;
select 'Registration editing ready' as result;
