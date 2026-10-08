begin;
alter table public.ak_certificates add column if not exists manufacturing_date date;
create or replace function public.ak_issue_certificate_v2(p_request_id uuid,p_product_id text,p_buyer_name text,p_purchase_date date,p_manufacturing_date date,p_edition text default '',p_order_id uuid default null,p_message text default '')
returns public.ak_certificates language plpgsql security definer set search_path='' as $$
declare result public.ak_certificates;
begin
 if public.ak_is_admin() is not true then raise exception 'Administrator access required' using errcode='42501'; end if;
 if p_manufacturing_date is not null and p_manufacturing_date>p_purchase_date then raise exception 'Manufacturing date must be on or before purchase date'; end if;
 select * into result from public.ak_certificates where request_id=p_request_id;
 if found then return result; end if;
 result:=public.ak_issue_certificate(p_request_id,p_product_id,p_buyer_name,p_purchase_date,p_edition,p_order_id,p_message);
 update public.ak_certificates set manufacturing_date=p_manufacturing_date where serial=result.serial returning * into result;
 return result;
end;
$$;
revoke all on function public.ak_issue_certificate_v2(uuid,text,text,date,date,text,uuid,text) from public,anon;
grant execute on function public.ak_issue_certificate_v2(uuid,text,text,date,date,text,uuid,text) to authenticated;
create or replace function public.ak_verify_certificate(p_token uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select case when status='revoked' then jsonb_build_object('serial',serial,'status','revoked')
 else jsonb_build_object('serial',serial,'status',status,'product_name',product_name,'edition',edition,'buyer_name',buyer_name,'manufacturing_date',manufacturing_date,'purchase_date',purchase_date,'message',message,'issued_at',issued_at,'seller','Anime Kingdom') end
 from public.ak_certificates where token=p_token;
$$;
commit;
