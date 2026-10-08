-- Anime Kingdom item certificates. Run once in Supabase SQL Editor.
-- Requires the existing public.ak_is_admin() administrator check.
begin;
create table if not exists public.ak_certificates (
 serial bigint generated always as identity (start with 101) primary key,
 token uuid not null unique default gen_random_uuid(),
 request_id uuid not null unique,
 product_id text not null,
 product_name text not null check(length(product_name) between 1 and 200),
 edition text not null default '' check(length(edition)<=160),
 buyer_name text not null check(length(buyer_name) between 1 and 120),
 purchase_date date not null,
 order_id uuid,
 message text not null default 'Congratulations on your new collectible. Welcome to the Anime Kingdom family!' check(length(message)<=500),
 status text not null default 'active' check(status in ('active','revoked')),
 issued_at timestamptz not null default now(),
 issued_by uuid not null references auth.users(id),
 revoked_at timestamptz
);
alter table public.ak_certificates enable row level security;
revoke all on public.ak_certificates from public,anon,authenticated;
grant select on public.ak_certificates to authenticated;
drop policy if exists ak_certificates_admin_read on public.ak_certificates;
create policy ak_certificates_admin_read on public.ak_certificates for select to authenticated using ((select public.ak_is_admin()));

create or replace function public.ak_issue_certificate(p_request_id uuid,p_product_id text,p_buyer_name text,p_purchase_date date,p_edition text default '',p_order_id uuid default null,p_message text default 'Congratulations on your new collectible. Welcome to the Anime Kingdom family!')
returns public.ak_certificates language plpgsql security definer set search_path='' as $$
declare result public.ak_certificates; product jsonb;
begin
 if not public.ak_is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 select * into result from public.ak_certificates where request_id=p_request_id;
 if found then return result; end if;
 select data into product from public.ak_products where id=p_product_id;
 if not found then raise exception 'Choose an existing catalog product'; end if;
 if p_purchase_date is null or p_purchase_date>current_date then raise exception 'Purchase date must not be in the future'; end if;
 if p_order_id is not null and not exists(select 1 from public."AK orders" where id=p_order_id and form_type='checkout') then raise exception 'Order ID was not found'; end if;
 insert into public.ak_certificates(request_id,product_id,product_name,buyer_name,purchase_date,edition,order_id,message,issued_by)
 values(p_request_id,p_product_id,product->>'name',trim(p_buyer_name),p_purchase_date,trim(p_edition),p_order_id,trim(p_message),auth.uid())
 on conflict(request_id) do nothing returning * into result;
 if result.serial is null then select * into result from public.ak_certificates where request_id=p_request_id; end if;
 return result;
end;
$$;
create or replace function public.ak_revoke_certificate(p_serial bigint)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.ak_is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 update public.ak_certificates set status='revoked',revoked_at=coalesce(revoked_at,now()) where serial=p_serial;
 if not found then raise exception 'Certificate not found'; end if;
end;
$$;
create or replace function public.ak_verify_certificate(p_token uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select case when status='revoked' then jsonb_build_object('serial',serial,'status','revoked')
 else jsonb_build_object('serial',serial,'status',status,'product_name',product_name,'edition',edition,'buyer_name',buyer_name,'purchase_date',purchase_date,'message',message,'issued_at',issued_at,'seller','Anime Kingdom') end
 from public.ak_certificates where token=p_token;
$$;
revoke all on function public.ak_issue_certificate(uuid,text,text,date,text,uuid,text) from public,anon;
grant execute on function public.ak_issue_certificate(uuid,text,text,date,text,uuid,text) to authenticated;
revoke all on function public.ak_revoke_certificate(bigint) from public,anon;
grant execute on function public.ak_revoke_certificate(bigint) to authenticated;
revoke all on function public.ak_verify_certificate(uuid) from public;
grant execute on function public.ak_verify_certificate(uuid) to anon,authenticated;
commit;
select 'Certificates ready' as result;