begin;
do $$
declare user_name text:='test_'||encode(extensions.gen_random_bytes(6),'hex'); password text:=encode(extensions.gen_random_bytes(20),'hex'); login jsonb; report jsonb; token text; blocked boolean; n integer;
begin
 insert into public.ak_partners(username,password_hash,codes) values(user_name,extensions.crypt(password,extensions.gen_salt('bf',4)),array['RAGGOFAN50OFF']);
 login:=public.ak_partner_login(user_name,'wrong-test-password');if (login->>'ok')::boolean then raise exception 'Wrong password accepted';end if;
 login:=public.ak_partner_login(upper(user_name),password);if not (login->>'ok')::boolean then raise exception 'Correct username login rejected';end if;token:=login->>'token';
 report:=public.ak_partner_code_report(token);
 if jsonb_array_length(report->'codes')<>1 or report->'codes'->0->>'code'<>'RAGGOFAN50OFF' then raise exception 'Partner scope incorrect';end if;
 if report::text ~ 'password|token|@|customer_name|phone|email' then raise exception 'Private identifiers exposed';end if;
 select count(*) into n from public."AK orders" o where form_type='checkout' and upper(trim(form_data->>'couponCode'))='RAGGOFAN50OFF' and coalesce(status,'pending')<>'cancelled' and case when form_data->>'discount' ~ '^[0-9]+([.][0-9]+)?$' then (form_data->>'discount')::numeric>0 else false end and coalesce(form_data->>'discountSource','coupon')='coupon';
 if (report->'codes'->0->>'orders')::int<>n then raise exception 'Order count mismatch';end if;
 blocked:=false;begin perform public.ak_partner_code_report(repeat('0',64));exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Invalid token accepted';end if;
 perform public.ak_partner_logout(token);blocked:=false;begin perform public.ak_partner_code_report(token);exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Logged out token accepted';end if;
 for n in 1..5 loop perform public.ak_partner_login(user_name,'wrong-test-password');end loop;
 login:=public.ak_partner_login(user_name,password);if (login->>'ok')::boolean then raise exception 'Login lockout missing';end if;
 perform set_config('request.jwt.claim.sub','',true);blocked:=false;begin perform public.ak_admin_create_raggo_partner(password);exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Anonymous setup accepted';end if;
 if has_table_privilege('anon','public.ak_partners','SELECT') or has_table_privilege('authenticated','public.ak_partner_sessions','SELECT') then raise exception 'Credential tables readable';end if;
end $$;
rollback;
select 'PASS: username login; wrong-password denial; rate limit; own-code-only report; no customer identifiers; accurate order counts; logout invalidation; administrator-only setup. Test writes rolled back.' as result;
