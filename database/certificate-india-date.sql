-- Use India's calendar date, including the hours before midnight UTC.
begin;
create or replace function public.ak_issue_certificate(p_request_id uuid,p_product_id text,p_buyer_name text,p_purchase_date date,p_edition text default '',p_order_id uuid default null,p_message text default 'Congratulations on your new collectible. Welcome to the Anime Kingdom family!')
returns public.ak_certificates language plpgsql security definer set search_path='' as $$
declare result public.ak_certificates; product jsonb;
begin
 if not public.ak_is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 select * into result from public.ak_certificates where request_id=p_request_id;
 if found then return result; end if;
 select data into product from public.ak_products where id=p_product_id;
 if not found then raise exception 'Choose an existing catalog product'; end if;
 if p_purchase_date is null or p_purchase_date>(now() at time zone 'Asia/Kolkata')::date then raise exception 'Purchase date must not be in the future'; end if;
 if p_order_id is not null and not exists(select 1 from public."AK orders" where id=p_order_id and form_type='checkout') then raise exception 'Order ID was not found'; end if;
 insert into public.ak_certificates(request_id,product_id,product_name,buyer_name,purchase_date,edition,order_id,message,issued_by)
 values(p_request_id,p_product_id,product->>'name',trim(p_buyer_name),p_purchase_date,trim(p_edition),p_order_id,trim(p_message),auth.uid())
 on conflict(request_id) do nothing returning * into result;
 if result.serial is null then select * into result from public.ak_certificates where request_id=p_request_id; end if;
 return result;
end;
$$;
commit;
select (now() at time zone 'Asia/Kolkata')::date as india_today;
