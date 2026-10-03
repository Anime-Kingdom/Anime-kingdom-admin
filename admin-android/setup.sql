-- Run in the Anime Kingdom Supabase SQL editor after creating and verifying
-- vgamerking45@gmail.com in Authentication. No password belongs in this file.
begin;
create table if not exists public.ak_admins(user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.ak_admins enable row level security;
revoke all on public.ak_admins from anon, authenticated;
insert into public.ak_admins(user_id)
select id from auth.users where id='9acce796-9131-498c-93ab-038692a66f4e'::uuid and lower(email)='vgamerking45@gmail.com' and email_confirmed_at is not null
on conflict do nothing;
create or replace function public.ak_is_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.ak_admins where user_id=(select auth.uid()));
$$;
revoke all on function public.ak_is_admin() from public;
grant execute on function public.ak_is_admin() to authenticated;

create table if not exists public.ak_products(
 id text primary key check(id ~ '^[-a-zA-Z0-9_]+$'),
 data jsonb not null,
 constraint ak_product_valid check (
  jsonb_typeof(data)='object' and data ?& array['id','name','price','stock','anime','category','imageUrl','imageUrls'] and data->>'id'=id and
  length(data->>'name') between 1 and 200 and
  jsonb_typeof(data->'price')='number' and (data->>'price')::numeric>0 and
  jsonb_typeof(data->'stock')='number' and (data->>'stock')::numeric>=0 and
  (data->>'stock')::numeric=trunc((data->>'stock')::numeric) and
  octet_length(data::text)<50000
 )
);
alter table public.ak_products enable row level security;
grant select on public.ak_products to anon,authenticated;
grant insert,update on public.ak_products to authenticated;
drop policy if exists ak_products_read on public.ak_products;
create policy ak_products_read on public.ak_products for select to anon,authenticated using(true);
drop policy if exists ak_products_add on public.ak_products;
create policy ak_products_add on public.ak_products for insert to authenticated with check((select public.ak_is_admin()));
drop policy if exists ak_products_edit on public.ak_products;
create policy ak_products_edit on public.ak_products for update to authenticated using((select public.ak_is_admin())) with check((select public.ak_is_admin()));

alter table public."AK orders" enable row level security;
grant select on public."AK orders" to authenticated;
grant update(status) on public."AK orders" to authenticated;
drop policy if exists ak_admin_orders_read on public."AK orders";
create policy ak_admin_orders_read on public."AK orders" for select to authenticated using((select public.ak_is_admin()));
drop policy if exists ak_admin_orders_status on public."AK orders";
create policy ak_admin_orders_status on public."AK orders" for update to authenticated using((select public.ak_is_admin())) with check((select public.ak_is_admin()) and status in ('pending','confirmed','packed','shipped','delivered','cancelled'));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('ak-product-images','ak-product-images',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
drop policy if exists ak_admin_photo_add on storage.objects;
create policy ak_admin_photo_add on storage.objects for insert to authenticated with check(bucket_id='ak-product-images' and (select public.ak_is_admin()));
create table if not exists public.ak_coupons(
 code text primary key check(code ~ '^[A-Z0-9_-]{3,40}$'),
 minimum numeric not null default 0 check(minimum>=0),
 percent numeric check(percent>0 and percent<=100),
 amount numeric check(amount>0),
 enabled boolean not null default true,
 check((percent is not null and amount is null) or (percent is null and amount is not null))
);
alter table public.ak_coupons enable row level security;
grant select on public.ak_coupons to anon,authenticated;
grant insert,update on public.ak_coupons to authenticated;
drop policy if exists ak_coupons_read on public.ak_coupons;
create policy ak_coupons_read on public.ak_coupons for select to anon,authenticated using(true);
drop policy if exists ak_coupons_add on public.ak_coupons;
create policy ak_coupons_add on public.ak_coupons for insert to authenticated with check((select public.ak_is_admin()));
drop policy if exists ak_coupons_edit on public.ak_coupons;
create policy ak_coupons_edit on public.ak_coupons for update to authenticated using((select public.ak_is_admin())) with check((select public.ak_is_admin()));
insert into public.ak_coupons(code,minimum,percent,amount) values('BICA20OFF',0,20,null),('RAGGOFAN50OFF',799,null,50),('RAGGOFAN100OFF',1499,null,100) on conflict do nothing;
commit;
-- This must be 1 before signing in to the app:
select count(*) as authorized_admins from public.ak_admins;
