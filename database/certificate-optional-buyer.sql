begin;
alter table public.ak_certificates drop constraint if exists ak_certificates_buyer_name_check;
alter table public.ak_certificates add constraint ak_certificates_buyer_name_check check(length(buyer_name)<=120);
commit;
select 'Optional buyer name ready' as result;
