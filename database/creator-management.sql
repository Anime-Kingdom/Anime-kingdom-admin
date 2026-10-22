begin;
alter table public.ak_partners add column if not exists display_name text;
alter table public.ak_partners add column if not exists updated_at timestamptz not null default now();
update public.ak_partners set display_name=initcap(username) where display_name is null;
alter table public.ak_partners alter column display_name set not null;
create or replace function public.ak_admin_validate_partner(p_username text,p_name text,p_codes text[])
returns text[] language plpgsql security definer set search_path='' as $$
declare cleaned text[];
begin
 if auth.uid() is null or not public.ak_is_admin() then raise exception using errcode='42501',message='Administrator access required';end if;
 if p_username is null or lower(trim(p_username)) !~ '^[a-z0-9][a-z0-9_-]{2,39}$' then raise exception using errcode='22023',message='Use a username of 3–40 letters, numbers, hyphens or underscores';end if;
 if p_name is null or char_length(trim(p_name)) not between 2 and 100 then raise exception using errcode='22023',message='Enter a creator name of 2–100 characters';end if;
 if p_codes is null or cardinality(p_codes) not between 1 and 20 then raise exception using errcode='22023',message='Assign between 1 and 20 existing coupon codes';end if;
 select array_agg(upper(trim(code)) order by upper(trim(code))) into cleaned from unnest(p_codes) code;
 if exists(select 1 from unnest(cleaned) code where code is null or code !~ '^[A-Z0-9_-]{3,40}$') or (select count(distinct code) from unnest(cleaned) code)<>cardinality(cleaned) then raise exception using errcode='22023',message='Enter valid, distinct coupon codes';end if;
 if exists(select 1 from unnest(cleaned) as requested(code) where not exists(select 1 from public.ak_coupons c where upper(trim(c.code))=requested.code)) then raise exception using errcode='22023',message='A coupon code does not exist. Create it in Coupons first';end if;
 perform pg_advisory_xact_lock(hashtext('ak-partner-code-assignments'));
 if exists(select 1 from public.ak_partners p where p.username<>lower(trim(p_username)) and p.codes && cleaned) then raise exception using errcode='22023',message='A code is already assigned to another creator';end if;
 return cleaned;
end $$;
revoke all on function public.ak_admin_validate_partner(text,text,text[]) from public,anon,authenticated;
create or replace function public.ak_admin_list_partners()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.ak_is_admin() then raise exception using errcode='42501',message='Administrator access required';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('username',username,'display_name',display_name,'codes',codes,'enabled',enabled,'created_at',created_at,'updated_at',updated_at) order by created_at,username) from public.ak_partners),'[]'::jsonb);
end $$;
create or replace function public.ak_admin_create_partner(p_username text,p_display_name text,p_codes text[],p_password text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cleaned text[];
begin
 cleaned:=public.ak_admin_validate_partner(p_username,p_display_name,p_codes);
 if p_password is null or octet_length(p_password) not between 8 and 72 then raise exception using errcode='22023',message='Use a password between 8 and 72 bytes';end if;
 insert into public.ak_partners(username,display_name,password_hash,codes) values(lower(trim(p_username)),trim(p_display_name),extensions.crypt(p_password,extensions.gen_salt('bf',12)),cleaned);
 return jsonb_build_object('saved',true,'username',lower(trim(p_username)));
 exception when unique_violation then raise exception using errcode='22023',message='This username already exists';
end $$;
create or replace function public.ak_admin_update_partner(p_username text,p_display_name text,p_codes text[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare cleaned text[];
begin
 cleaned:=public.ak_admin_validate_partner(p_username,p_display_name,p_codes);
 update public.ak_partners set display_name=trim(p_display_name),codes=cleaned,updated_at=now() where username=lower(trim(p_username));
 if not found then raise exception using errcode='22023',message='Creator account not found';end if;
 delete from public.ak_partner_sessions where username=lower(trim(p_username));
 return jsonb_build_object('saved',true);
end $$;
create or replace function public.ak_admin_set_partner_enabled(p_username text,p_enabled boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.ak_is_admin() then raise exception using errcode='42501',message='Administrator access required';end if;
 if p_enabled is null then raise exception using errcode='22023',message='Select an access status';end if;
 update public.ak_partners set enabled=p_enabled,failed_attempts=0,locked_until=null,updated_at=now() where username=lower(trim(p_username));
 if not found then raise exception using errcode='22023',message='Creator account not found';end if;
 delete from public.ak_partner_sessions where username=lower(trim(p_username));
 return jsonb_build_object('saved',true,'enabled',p_enabled);
end $$;
create or replace function public.ak_admin_reset_partner_password(p_username text,p_password text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.ak_is_admin() then raise exception using errcode='42501',message='Administrator access required';end if;
 if p_password is null or octet_length(p_password) not between 8 and 72 then raise exception using errcode='22023',message='Use a password between 8 and 72 bytes';end if;
 update public.ak_partners set password_hash=extensions.crypt(p_password,extensions.gen_salt('bf',12)),failed_attempts=0,locked_until=null,updated_at=now() where username=lower(trim(p_username));
 if not found then raise exception using errcode='22023',message='Creator account not found';end if;
 delete from public.ak_partner_sessions where username=lower(trim(p_username));
 return jsonb_build_object('saved',true);
end $$;
revoke all on function public.ak_admin_list_partners() from public,anon;
revoke all on function public.ak_admin_create_partner(text,text,text[],text) from public,anon;
revoke all on function public.ak_admin_update_partner(text,text,text[]) from public,anon;
revoke all on function public.ak_admin_set_partner_enabled(text,boolean) from public,anon;
revoke all on function public.ak_admin_reset_partner_password(text,text) from public,anon;
grant execute on function public.ak_admin_list_partners() to authenticated;
grant execute on function public.ak_admin_create_partner(text,text,text[],text) to authenticated;
grant execute on function public.ak_admin_update_partner(text,text,text[]) to authenticated;
grant execute on function public.ak_admin_set_partner_enabled(text,boolean) to authenticated;
grant execute on function public.ak_admin_reset_partner_password(text,text) to authenticated;
-- Keep the old setup endpoint compatible; no password or access changes for existing creators.
create or replace function public.ak_admin_create_raggo_partner(p_password text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 return public.ak_admin_create_partner('raggo','Raggo',array['RAGGOFAN100OFF','RAGGOFAN50OFF'],p_password);
end $$;
commit;
select 'Creator management installed. Existing credentials, code assignments and access status preserved.' as result;
