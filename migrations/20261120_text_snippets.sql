-- Apply only after reviewing production schema and testing in staging.
create table if not exists public.text_snippets (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 shortcut text not null check (shortcut ~ '^[a-z0-9_-]{2,32}$'),
 title text not null default '',
 body text not null check (length(trim(body)) > 0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (company_id,shortcut)
);
create index if not exists text_snippets_company_idx on public.text_snippets(company_id);
alter table public.text_snippets enable row level security;
create policy "Owners manage their company snippets" on public.text_snippets
 for all to authenticated
 using (user_id = (select auth.uid()) and exists (
   select 1 from public.companies c where c.id = company_id and c.user_id = (select auth.uid())
 ))
 with check (user_id = (select auth.uid()) and exists (
   select 1 from public.companies c where c.id = company_id and c.user_id = (select auth.uid())
 ));
