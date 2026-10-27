create or replace function public.ak_partner_order_items(p_order_id text) returns jsonb
language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('name',left(coalesce(item->>'name',item->>'id','Product'),200),'quantity',item->>'qty')), '[]'::jsonb)
 from public."AK orders" o cross join lateral jsonb_array_elements(case when jsonb_typeof(o.form_data->'items')='array' then o.form_data->'items' else '[]'::jsonb end) item
 where o.id::text=p_order_id and o.form_type='checkout';
$$;
revoke all on function public.ak_partner_order_items(text) from public,anon,authenticated;
create or replace function public.ak_partner_wallet(p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare user_name text;
begin
 user_name:=public.ak_wallet_partner(p_token);
 return jsonb_build_object('totals',public.ak_wallet_totals(user_name),
 'rate',(select commission_rate from public.ak_partners where username=user_name),
 'orders',coalesce((select jsonb_agg(to_jsonb(x) order by order_date desc) from (select order_id,code,order_date,order_status,product_net,commission,credited,public.ak_partner_order_items(order_id) as products from public.ak_partner_earnings where username=user_name order by order_date desc limit 100) x),'[]'::jsonb),
 'withdrawals',coalesce((select jsonb_agg(to_jsonb(x) order by created_at desc) from (select id,amount,status,created_at,resolved_at,payment_reference,admin_note from public.ak_partner_withdrawals where username=user_name order by created_at desc limit 100) x),'[]'::jsonb));
end $$;
revoke all on function public.ak_partner_wallet(text) from public;
grant execute on function public.ak_partner_wallet(text) to anon,authenticated;

