begin;
do $$
declare admin_id uuid; other_id uuid; result jsonb;
begin
 select user_id into admin_id from public.ak_admins limit 1;
 if admin_id is null then raise exception 'No existing admin available for test'; end if;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 result:=public.ak_admin_customer_accounts(0,200);
 if jsonb_typeof(result->'accounts')<>'array' or (result->>'registered')::integer<1 then raise exception 'Invalid report'; end if;
 perform public.ak_record_customer_surface('website');
 if not exists(select 1 from public.ak_customer_surfaces where user_id=admin_id and surface='website') then raise exception 'Own activity failed'; end if;
 select id into other_id from auth.users where id not in(select user_id from public.ak_admins) limit 1;
 perform set_config('request.jwt.claim.sub',coalesce(other_id,gen_random_uuid())::text,true);
 begin
  perform public.ak_admin_customer_accounts(0,200);
  raise exception 'Non-admin unexpectedly accessed report';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub','',true);
 begin
  perform public.ak_record_customer_surface('app');
  raise exception 'Anonymous activity unexpectedly accepted';
 exception when insufficient_privilege then null; end;
end $$;
select 'PASS: administrator report, own-source recording, non-admin denial, anonymous denial; test writes rolled back' as verification;
rollback;
