\set ON_ERROR_STOP on
create role authenticated nologin;
create role anon nologin;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table public.companies(id uuid primary key,user_id uuid not null);
insert into auth.users values ('11111111-1111-1111-1111-111111111111'),('22222222-2222-2222-2222-222222222222');
insert into public.companies values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111'),('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','22222222-2222-2222-2222-222222222222');
grant usage on schema public,auth to authenticated;
grant select on public.companies to authenticated;
alter table public.companies enable row level security;
create policy owner_company on public.companies for select to authenticated using (user_id=auth.uid());
\i migrations/20261120_text_snippets.sql
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
insert into public.text_snippets(company_id,user_id,shortcut,body) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','rent','Rent for {month}');
reset role;
insert into public.text_snippets(company_id,user_id,shortcut,body) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','22222222-2222-2222-2222-222222222222','rent','Private business two');
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
do $$
begin
 if (select count(*) from public.text_snippets) <> 1 then raise exception 'Cross-company data leak'; end if;
 if exists(select 1 from public.text_snippets where company_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') then raise exception 'Other company visible'; end if;
end $$;
\echo RLS_OWNER_READ_PASS

-- A user must not insert, modify or delete another company's shortcuts.
do $$
begin
 begin
  insert into public.text_snippets(company_id,user_id,shortcut,body)
  values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','11111111-1111-1111-1111-111111111111','attack','not allowed');
  raise exception 'Cross-company INSERT unexpectedly succeeded';
 exception when insufficient_privilege then null;
 end;
 if (select count(*) from public.text_snippets where company_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') <> 0 then
   raise exception 'Cross-company rows visible';
 end if;
end $$;
update public.text_snippets set body='tampered' where company_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
delete from public.text_snippets where company_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
reset role;
do $$
begin
 if (select body from public.text_snippets where company_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') <> 'Private business two' then
  raise exception 'Cross-company update/delete occurred';
 end if;
end $$;
\echo RLS_CROSS_COMPANY_WRITE_PASS
