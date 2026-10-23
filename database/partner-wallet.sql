-- Private commission accounting. No payment is executed by these functions.
begin;
alter table public.ak_partners add column if not exists commission_rate numeric not null default 0 check(commission_rate between 0 and 1);
update public.ak_partners set commission_rate=0.10 where username='raggo';
create table if not exists public.ak_partner_earnings(
 order_id text primary key, username text not null references public.ak_partners(username),
 code text not null, order_date timestamptz not null, order_status text not null,
 product_net numeric, rate numeric not null, commission numeric not null default 0,
 credited boolean not null default false, approved_by uuid, updated_at timestamptz not null default now()
);
create table if not exists public.ak_partner_withdrawals(
 id uuid primary key default gen_random_uuid(), username text not null references public.ak_partners(username),
 amount numeric not null check(amount>=1000 and amount=round(amount,2)),
 status text not null default 'requested' check(status in ('requested','paid','rejected')),
 qr_image text not null, payee_name text not null, created_at timestamptz not null default now(),
 resolved_at timestamptz, resolved_by uuid, payment_reference text, admin_note text,
 request_key uuid not null, unique(username,request_key)
);
create unique index if not exists ak_partner_one_open_withdrawal on public.ak_partner_withdrawals(username) where status='requested';
alter table public.ak_partner_earnings enable row level security;
alter table public.ak_partner_withdrawals enable row level security;
revoke all on public.ak_partner_earnings,public.ak_partner_withdrawals from public,anon,authenticated;

create or replace function public.ak_partner_net_products(p_data jsonb) returns numeric
language plpgsql immutable set search_path='' as $$
declare subtotal numeric; discount numeric;
begin
 if p_data->>'subtotal' !~ '^[0-9]{1,10}([.][0-9]{1,2})?$' or p_data->>'discount' !~ '^[0-9]{1,10}([.][0-9]{1,2})?$' or p_data->>'subtotal' is null or p_data->>'discount' is null then return null;end if;
 subtotal:=(p_data->>'subtotal')::numeric;discount:=(p_data->>'discount')::numeric;
 if discount<=0 or discount>subtotal then return null;end if;
 return round(subtotal-discount,2);
end $$;
revoke all on function public.ak_partner_net_products(jsonb) from public,anon,authenticated;

create or replace function public.ak_capture_partner_earning() returns trigger
language plpgsql security definer set search_path='' as $$
declare partner public.ak_partners; existing public.ak_partner_earnings; net numeric; code_value text; is_admin boolean;
begin
 if TG_OP='DELETE' then
  select * into existing from public.ak_partner_earnings where order_id=old.id::text;
  if found then
   perform 1 from public.ak_partners where username=existing.username for update;
   update public.ak_partner_earnings set credited=false,order_status='deleted',updated_at=now() where order_id=old.id::text;
  end if;return old;
 end if;
 select * into existing from public.ak_partner_earnings where order_id=new.id::text;
 code_value:=upper(trim(new.form_data->>'couponCode'));
 if existing.order_id is null then
  if new.form_type<>'checkout' or coalesce(new.form_data->>'discountSource','coupon')<>'coupon' then return new;end if;
  select * into partner from public.ak_partners where code_value=any(codes) and commission_rate>0 order by created_at limit 1 for update;
  if not found then return new;end if;
  net:=public.ak_partner_net_products(new.form_data);
  insert into public.ak_partner_earnings(order_id,username,code,order_date,order_status,product_net,rate,commission)
  values(new.id::text,partner.username,code_value,new.created_at,coalesce(new.status,'pending'),net,partner.commission_rate,coalesce(round(net*partner.commission_rate,2),0));
  select * into existing from public.ak_partner_earnings where order_id=new.id::text;
 else
  perform 1 from public.ak_partners where username=existing.username for update;
 end if;
 is_admin:=auth.uid() is not null and public.ak_is_admin();
 -- Only an administrator's status update can unlock earnings, never checkout insertion.
 if TG_OP='UPDATE' and is_admin then
  net:=public.ak_partner_net_products(new.form_data);
  update public.ak_partner_earnings set product_net=net,commission=coalesce(round(net*rate,2),0),
   order_status=coalesce(new.status,'pending'),
   credited=new.status='delivered' and net is not null and code_value=code and coalesce(new.form_data->>'discountSource','coupon')='coupon',
   approved_by=case when new.status='delivered' then auth.uid() else approved_by end,updated_at=now()
  where order_id=new.id::text;
 else
  update public.ak_partner_earnings set order_status=coalesce(new.status,'pending'),updated_at=now() where order_id=new.id::text;
 end if;
 return new;
end $$;
revoke all on function public.ak_capture_partner_earning() from public,anon,authenticated;
drop trigger if exists ak_partner_earning_sync on public."AK orders";
create trigger ak_partner_earning_sync after insert or update of status,form_data or delete on public."AK orders" for each row execute function public.ak_capture_partner_earning();
-- Existing orders remain uncredited until explicitly marked Delivered by an administrator.
insert into public.ak_partner_earnings(order_id,username,code,order_date,order_status,product_net,rate,commission)
select o.id::text,p.username,upper(trim(o.form_data->>'couponCode')),o.created_at,coalesce(o.status,'pending'),public.ak_partner_net_products(o.form_data),p.commission_rate,coalesce(round(public.ak_partner_net_products(o.form_data)*p.commission_rate,2),0)
from public."AK orders" o join public.ak_partners p on upper(trim(o.form_data->>'couponCode'))=any(p.codes) and p.commission_rate>0
where o.form_type='checkout' and coalesce(o.form_data->>'discountSource','coupon')='coupon' on conflict(order_id) do nothing;

create or replace function public.ak_wallet_partner(p_token text) returns text
language plpgsql security definer set search_path='' as $$
declare user_name text;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception using errcode='42501',message='Partner sign-in required';end if;
 select p.username into user_name from public.ak_partner_sessions s join public.ak_partners p using(username)
 where s.token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and s.expires_at>now() and p.enabled;
 if user_name is null then raise exception using errcode='42501',message='Partner session expired';end if;
 return user_name;
end $$;
revoke all on function public.ak_wallet_partner(text) from public,anon,authenticated;

create or replace function public.ak_wallet_totals(p_username text) returns jsonb
language sql stable security definer set search_path='' as $$
 with e as(select coalesce(sum(commission) filter(where credited),0) earned,coalesce(sum(commission) filter(where not credited and order_status in ('pending','confirmed','packed','shipped')),0) pending from public.ak_partner_earnings where username=p_username),
 w as(select coalesce(sum(amount) filter(where status='paid'),0) paid,coalesce(sum(amount) filter(where status='requested'),0) reserved from public.ak_partner_withdrawals where username=p_username)
 select jsonb_build_object('earned',earned,'pending',pending,'paid',paid,'reserved',reserved,'available',earned-paid-reserved,'minimum',1000) from e,w;
$$;
revoke all on function public.ak_wallet_totals(text) from public,anon,authenticated;

create or replace function public.ak_partner_wallet(p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare user_name text;
begin
 user_name:=public.ak_wallet_partner(p_token);
 return jsonb_build_object('totals',public.ak_wallet_totals(user_name),
 'rate',(select commission_rate from public.ak_partners where username=user_name),
 'orders',coalesce((select jsonb_agg(to_jsonb(x) order by order_date desc) from (select order_id,code,order_date,order_status,product_net,commission,credited from public.ak_partner_earnings where username=user_name order by order_date desc limit 100) x),'[]'::jsonb),
 'withdrawals',coalesce((select jsonb_agg(to_jsonb(x) order by created_at desc) from (select id,amount,status,created_at,resolved_at,payment_reference,admin_note from public.ak_partner_withdrawals where username=user_name order by created_at desc limit 100) x),'[]'::jsonb));
end $$;
revoke all on function public.ak_partner_wallet(text) from public;
grant execute on function public.ak_partner_wallet(text) to anon,authenticated;

create or replace function public.ak_partner_request_withdrawal(p_token text,p_amount numeric,p_qr text,p_payee text,p_request_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare user_name text; totals jsonb; old_request public.ak_partner_withdrawals; request_id uuid;
begin
 user_name:=public.ak_wallet_partner(p_token);
 perform 1 from public.ak_partners where username=user_name for update;
 select * into old_request from public.ak_partner_withdrawals where username=user_name and request_key=p_request_key;
 if found then return jsonb_build_object('id',old_request.id,'status',old_request.status);end if;
 if p_request_key is null or p_amount is null or p_amount<1000 or p_amount<>round(p_amount,2) or p_amount>10000000 then raise exception 'Minimum withdrawal is INR 1,000';end if;
 if p_qr is null or octet_length(p_qr)>1000000 or p_qr !~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$' then raise exception 'Upload a PNG, JPEG or WebP payment QR under 700 KB';end if;
 if p_payee is null or char_length(trim(p_payee)) not between 2 and 100 then raise exception 'Enter the account holder name';end if;
 if exists(select 1 from public.ak_partner_withdrawals where username=user_name and status='requested') then raise exception 'A withdrawal request is already pending';end if;
 totals:=public.ak_wallet_totals(user_name);
 if p_amount>(totals->>'available')::numeric then raise exception 'Insufficient delivered-order balance';end if;
 insert into public.ak_partner_withdrawals(username,amount,qr_image,payee_name,request_key) values(user_name,p_amount,p_qr,trim(p_payee),p_request_key) returning id into request_id;
 return jsonb_build_object('id',request_id,'status','requested');
end $$;
revoke all on function public.ak_partner_request_withdrawal(text,numeric,text,text,uuid) from public;
grant execute on function public.ak_partner_request_withdrawal(text,numeric,text,text,uuid) to anon,authenticated;

create or replace function public.ak_admin_partner_wallets() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.ak_is_admin() then raise exception using errcode='42501',message='Administrator access required';end if;
 return jsonb_build_object('partners',coalesce((select jsonb_agg(jsonb_build_object('username',username,'display_name',display_name,'totals',public.ak_wallet_totals(username),'rate',commission_rate) order by username) from public.ak_partners),'[]'::jsonb),
 'orders',coalesce((select jsonb_agg(to_jsonb(x) order by order_date desc) from (select * from public.ak_partner_earnings order by order_date desc limit 500) x),'[]'::jsonb),
 'withdrawals',coalesce((select jsonb_agg(to_jsonb(x) order by created_at desc) from (select id,username,amount,status,payee_name,created_at,resolved_at,payment_reference,admin_note from public.ak_partner_withdrawals order by created_at desc limit 500) x),'[]'::jsonb));
end $$;
create or replace function public.ak_admin_withdrawal_qr(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.ak_is_admin() then raise exception using errcode='42501',message='Administrator access required';end if;
 return (select jsonb_build_object('qr_image',qr_image,'payee_name',payee_name,'amount',amount,'status',status) from public.ak_partner_withdrawals where id=p_id);
end $$;
create or replace function public.ak_admin_resolve_withdrawal(p_id uuid,p_status text,p_reference text,p_note text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare entry public.ak_partner_withdrawals; totals jsonb;
begin
 if auth.uid() is null or not public.ak_is_admin() then raise exception using errcode='42501',message='Administrator access required';end if;
 select * into entry from public.ak_partner_withdrawals where id=p_id;
 if not found then raise exception 'Withdrawal not found';end if;
 perform 1 from public.ak_partners where username=entry.username for update;
 select * into entry from public.ak_partner_withdrawals where id=p_id for update;
 if entry.status<>'requested' then raise exception 'This request has already been resolved';end if;
 if p_status is null or p_status not in ('paid','rejected') then raise exception 'Choose paid or rejected';end if;
 if p_status='paid' then
  if p_reference is null or char_length(trim(p_reference)) not between 3 and 100 then raise exception 'Record the bank or UPI transaction reference after paying';end if;
  totals:=public.ak_wallet_totals(entry.username);
  if (totals->>'earned')::numeric-(totals->>'paid')::numeric<entry.amount then raise exception 'Delivered balance has changed. Review the orders before payment';end if;
 else
  if p_note is null or char_length(trim(p_note)) not between 3 and 500 then raise exception 'Enter a reason for rejecting the request';end if;
 end if;
 if char_length(coalesce(p_note,''))>500 then raise exception 'Note is too long';end if;
 update public.ak_partner_withdrawals set status=p_status,payment_reference=case when p_status='paid' then trim(p_reference) else null end,admin_note=nullif(trim(p_note),''),resolved_at=now(),resolved_by=auth.uid() where id=p_id;
 return jsonb_build_object('id',p_id,'status',p_status);
end $$;
revoke all on function public.ak_admin_partner_wallets(),public.ak_admin_withdrawal_qr(uuid),public.ak_admin_resolve_withdrawal(uuid,text,text,text) from public,anon;
grant execute on function public.ak_admin_partner_wallets(),public.ak_admin_withdrawal_qr(uuid),public.ak_admin_resolve_withdrawal(uuid,text,text,text) to authenticated;
commit;
select 'Partner wallet installed. No payments sent and no historical orders credited automatically.' as result;
