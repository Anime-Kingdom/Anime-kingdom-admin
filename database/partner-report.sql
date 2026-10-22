-- Username-only partner access. No auth.users account, email or customer rows are exposed.
begin;
create table if not exists public.ak_partners (
 username text primary key check(username=lower(username) and username ~ '^[a-z0-9_-]{3,40}$'),
 password_hash text not null,
 codes text[] not null,
 failed_attempts integer not null default 0,
 locked_until timestamptz,
 enabled boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.ak_partner_sessions (
 token_hash text primary key,
 username text not null references public.ak_partners(username) on delete cascade,
 expires_at timestamptz not null
);
alter table public.ak_partners enable row level security;
alter table public.ak_partner_sessions enable row level security;
revoke all on public.ak_partners,public.ak_partner_sessions from public,anon,authenticated;
create or replace function public.ak_admin_create_raggo_partner(p_password text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.ak_is_admin() then raise exception using errcode='42501',message='Administrator access required'; end if;
 if p_password is null or octet_length(p_password) not between 8 and 72 then raise exception 'Use a password between 8 and 72 bytes'; end if;
 if exists(select 1 from public.ak_partners where username='raggo') then raise exception 'Raggo partner access is already configured'; end if;
 insert into public.ak_partners(username,password_hash,codes)
 values('raggo',extensions.crypt(p_password,extensions.gen_salt('bf',12)),array['RAGGOFAN100OFF','RAGGOFAN50OFF']);
 return jsonb_build_object('created',true,'username','Raggo');
end $$;
revoke all on function public.ak_admin_create_raggo_partner(text) from public,anon;
grant execute on function public.ak_admin_create_raggo_partner(text) to authenticated;
create or replace function public.ak_partner_login(p_username text,p_password text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare partner public.ak_partners; token text;
begin
 if p_username is null or char_length(p_username)>40 or p_password is null or octet_length(p_password)>72 then return jsonb_build_object('ok',false); end if;
 select * into partner from public.ak_partners where username=lower(trim(p_username)) for update;
 if not found or not partner.enabled then return jsonb_build_object('ok',false); end if;
 if partner.locked_until>now() then return jsonb_build_object('ok',false); end if;
 if partner.password_hash<>extensions.crypt(p_password,partner.password_hash) then
  update public.ak_partners set failed_attempts=case when failed_attempts>=4 then 0 else failed_attempts+1 end,
  locked_until=case when failed_attempts>=4 then now()+interval '15 minutes' else null end where username=partner.username;
  return jsonb_build_object('ok',false);
 end if;
 update public.ak_partners set failed_attempts=0,locked_until=null where username=partner.username;
 delete from public.ak_partner_sessions where expires_at<now();
 token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into public.ak_partner_sessions(token_hash,username,expires_at)
 values(encode(extensions.digest(token,'sha256'),'hex'),partner.username,now()+interval '1 hour');
 return jsonb_build_object('ok',true,'token',token,'expires_at',now()+interval '1 hour');
end $$;
revoke all on function public.ak_partner_login(text,text) from public;
grant execute on function public.ak_partner_login(text,text) to anon,authenticated;
create or replace function public.ak_partner_code_report(p_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare allowed_codes text[]; result jsonb;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception using errcode='42501',message='Partner sign-in required'; end if;
 select p.codes into allowed_codes from public.ak_partner_sessions s join public.ak_partners p using(username)
 where s.token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and s.expires_at>now() and p.enabled;
 if allowed_codes is null then raise exception using errcode='42501',message='Partner session expired'; end if;
 with assigned as(select unnest(allowed_codes) as code),
 orders as(
 select upper(trim(o.form_data->>'couponCode')) as code,o.created_at,coalesce(o.status,'pending') as status,
 coalesce(nullif(lower(trim(o.email)),''),nullif(regexp_replace(coalesce(o.phone,''),'[^0-9]','','g'),''),o.id::text) as buyer
 from public."AK orders" o where o.form_type='checkout'
 and upper(trim(o.form_data->>'couponCode'))=any(allowed_codes)
 and case when o.form_data->>'discount' ~ '^[0-9]+([.][0-9]+)?$' then (o.form_data->>'discount')::numeric>0 else false end
 and coalesce(o.form_data->>'discountSource','coupon')='coupon'
 ),summary as(
 select a.code,count(o.code) filter(where o.status<>'cancelled') as orders,
 count(distinct o.buyer) filter(where o.status<>'cancelled') as customers,
 count(o.code) filter(where o.status in ('confirmed','packed','shipped','delivered')) as confirmed,
 count(o.code) filter(where o.status='cancelled') as cancelled
 from assigned a left join orders o using(code) group by a.code
 ),daily as(
 select (o.created_at at time zone 'Asia/Kolkata')::date as date,o.code,count(*) as orders
 from orders o where o.status<>'cancelled' and o.created_at>=(date_trunc('day',now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata')-interval '29 days'
 group by 1,2 order by 1 desc,2
 )
 select jsonb_build_object('codes',coalesce((select jsonb_agg(to_jsonb(s) order by code) from summary s),'[]'::jsonb),
 'daily',coalesce((select jsonb_agg(to_jsonb(d) order by date desc,code) from daily d),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.ak_partner_code_report(text) from public;
grant execute on function public.ak_partner_code_report(text) to anon,authenticated;
create or replace function public.ak_partner_logout(p_token text)
returns void language sql security definer set search_path='' as $$
 delete from public.ak_partner_sessions where token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
$$;
revoke all on function public.ak_partner_logout(text) from public;
grant execute on function public.ak_partner_logout(text) to anon,authenticated;
commit;
select 'Partner reporting installed; access remains disabled until the administrator creates Raggo login.' as result;
