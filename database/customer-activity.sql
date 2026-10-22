-- Customer account report: existing administrator role only. No credentials are returned.
begin;
create table if not exists public.ak_customer_surfaces (
 user_id uuid not null references auth.users(id) on delete cascade,
 surface text not null check(surface in ('website','app')),
 first_seen_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(),
 primary key(user_id,surface)
);
alter table public.ak_customer_surfaces enable row level security;
revoke all on public.ak_customer_surfaces from public,anon,authenticated;
create or replace function public.ak_record_customer_surface(p_surface text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in first.' using errcode='42501'; end if;
 if p_surface not in ('website','app') or p_surface is null then raise exception 'Invalid surface.' using errcode='22023'; end if;
 insert into public.ak_customer_surfaces(user_id,surface) values(auth.uid(),p_surface)
 on conflict(user_id,surface) do update set last_seen_at=now()
 where public.ak_customer_surfaces.last_seen_at < now()-interval '2 minutes';
end $$;
revoke all on function public.ak_record_customer_surface(text) from public,anon;
grant execute on function public.ak_record_customer_surface(text) to authenticated;
create or replace function public.ak_admin_customer_accounts(p_offset integer default 0,p_limit integer default 200)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not coalesce(public.ak_is_admin(),false) then raise exception 'Administrator access required.' using errcode='42501'; end if;
 if p_offset<0 or p_limit not between 1 and 200 then raise exception 'Invalid page.' using errcode='22023'; end if;
 select jsonb_build_object(
  'registered',(select count(*) from auth.users),
  'signedIn',(select count(*) from auth.users where last_sign_in_at is not null),
  'website',(select count(*) from public.ak_customer_surfaces where surface='website'),
  'app',(select count(*) from public.ak_customer_surfaces where surface='app'),
  'accounts',coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb)
 ) into result from (
 select u.id,u.email,coalesce(p.full_name,u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name','') as full_name,
 p.customer_id,p.phone,p.favorite_character,u.created_at,u.last_sign_in_at,
 u.email_confirmed_at is not null as email_verified,
 coalesce(u.raw_app_meta_data->>'provider','email') as provider,
 (select s.last_seen_at from public.ak_customer_surfaces s where s.user_id=u.id and s.surface='website') as website_last_seen,
 (select s.last_seen_at from public.ak_customer_surfaces s where s.user_id=u.id and s.surface='app') as app_last_seen
 from auth.users u left join public.ak_customer_profiles p on p.id=u.id
 order by u.created_at desc,u.id limit p_limit offset p_offset
 ) q;
 return result;
end $$;
revoke all on function public.ak_admin_customer_accounts(integer,integer) from public,anon;
grant execute on function public.ak_admin_customer_accounts(integer,integer) to authenticated;
notify pgrst,'reload schema';
commit;
