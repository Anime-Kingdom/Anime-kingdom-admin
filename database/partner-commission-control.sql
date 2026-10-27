create or replace function public.ak_admin_set_partner_commission(p_username text,p_rate numeric) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or public.ak_is_admin() is not true then raise exception 'Administrator access required';end if;
 if p_rate is null or p_rate<0 or p_rate>1 or p_rate<>round(p_rate,4) then raise exception 'Use a commission between 0 and 100 percent (up to two decimals)';end if;
 perform 1 from public.ak_partners where username=lower(trim(p_username)) for update;
 if not found then raise exception 'Creator account not found';end if;
 update public.ak_partners set commission_rate=p_rate,updated_at=now() where username=lower(trim(p_username));
 return true;
end $$;
revoke all on function public.ak_admin_set_partner_commission(text,numeric) from public,anon;
grant execute on function public.ak_admin_set_partner_commission(text,numeric) to authenticated;
