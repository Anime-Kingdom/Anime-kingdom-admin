begin;
alter table public.ak_certificates add column if not exists order_number text check (length(order_number)<=64);
create or replace function public.ak_issue_certificate_v3(p_request_id uuid,p_product_id text,p_buyer_name text,p_purchase_date date,p_manufacturing_date date default null,p_edition text default '',p_order_number text default null,p_message text default '')
returns public.ak_certificates language plpgsql security definer set search_path='' as $$
declare result public.ak_certificates;
begin
 if public.ak_is_admin() is not true then raise exception 'Administrator access required' using errcode='42501'; end if;
 if length(trim(p_order_number))>64 then raise exception 'Order number must be 64 characters or fewer'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select * into result from public.ak_certificates where request_id=p_request_id;
 if found then return result; end if;
 result:=public.ak_issue_certificate_v2(p_request_id,p_product_id,p_buyer_name,p_purchase_date,p_manufacturing_date,p_edition,null,p_message);
 update public.ak_certificates set order_number=nullif(trim(p_order_number),'') where serial=result.serial returning * into result;
 return result;
end;
$$;
revoke all on function public.ak_issue_certificate_v3(uuid,text,text,date,date,text,text,text) from public,anon;
grant execute on function public.ak_issue_certificate_v3(uuid,text,text,date,date,text,text,text) to authenticated;
create or replace function public.ak_verify_certificate(p_token uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select case when status='revoked' then jsonb_build_object('serial',serial,'status','revoked')
 else jsonb_build_object('serial',serial,'status',status,'product_name',product_name,'edition',edition,'buyer_name',buyer_name,'manufacturing_date',manufacturing_date,'purchase_date',purchase_date,'order_number',order_number,'message',message,'issued_at',issued_at,'seller','Anime Kingdom') end
 from public.ak_certificates where token=p_token;
$$;
commit;
select 'Certificate order numbers ready' as result;
