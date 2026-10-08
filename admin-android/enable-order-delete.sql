-- Enable permanent deletion of checkout orders by verified administrators only.
begin;
grant delete on public."AK orders" to authenticated;
drop policy if exists ak_admin_orders_delete on public."AK orders";
create policy ak_admin_orders_delete on public."AK orders"
for delete to authenticated
using (form_type='checkout' and (select public.ak_is_admin()));
commit;