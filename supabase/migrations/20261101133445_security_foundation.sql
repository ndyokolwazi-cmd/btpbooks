-- MyInvox security foundation.
-- This migration is intended for an isolated Supabase branch first.

-- RLS policies: scope them to signed-in users, cache auth.uid() per statement,
-- and prevent ownership from being reassigned during writes.
drop policy if exists "Users see own companies" on public.companies;
create policy "Users manage own companies"
on public.companies for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users see own clients" on public.clients;
create policy "Users manage own clients"
on public.clients for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users see own documents" on public.documents;
create policy "Users manage own documents"
on public.documents for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users see own recurring_invoices" on public.recurring_invoices;
create policy "Users manage own recurring invoices"
on public.recurring_invoices for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "own company counters" on public.document_counters;
create policy "Users manage own company counters"
on public.document_counters for all to authenticated
using (
  exists (
    select 1 from public.companies c
    where c.id = document_counters.company_id
      and c.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.companies c
    where c.id = document_counters.company_id
      and c.user_id = (select auth.uid())
  )
);

-- Remove the permissive policy that currently exposes every subscription row.
drop policy if exists "Service role full access" on public.subscriptions;
drop policy if exists "Users can view own subscription" on public.subscriptions;
create policy "Users view own subscription"
on public.subscriptions for select to authenticated
using ((select auth.uid()) = user_id);

-- Atomic document numbering, limited to a company owned by the caller.
create or replace function public.next_document_number(p_company uuid, p_type text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if p_type not in ('invoice', 'quote', 'delivery', 'credit', 'receipt') then
    raise exception 'Unsupported document type';
  end if;

  if not exists (
    select 1 from public.companies
    where id = p_company and user_id = (select auth.uid())
  ) then
    raise exception 'Company not found';
  end if;

  insert into public.document_counters (company_id, type, last_number)
  values (p_company, p_type, 1)
  on conflict (company_id, type)
  do update set last_number = public.document_counters.last_number + 1
  returning last_number into v_next;

  return v_next;
end;
$$;

revoke execute on function public.next_document_number(uuid, text) from public, anon, authenticated;
grant execute on function public.next_document_number(uuid, text) to authenticated;

-- Auth trigger: trigger execution does not require browser roles to call this
-- privileged function directly.
create or replace function public.handle_new_user_subscription()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.subscriptions (user_id, email, status, trial_ends_at)
  values (new.id, new.email, 'trial', now() + interval '14 days')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user_subscription() from public, anon, authenticated;

create or replace function public.update_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.update_updated_at() from public, anon, authenticated;

-- Admin operations are exposed through two narrow RPCs. The browser can no
-- longer query or mutate the subscriptions table for other users directly.
create or replace function public.admin_list_subscriptions()
returns setof public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
     or coalesce((select auth.jwt() ->> 'email'), '') <> 'lwazi@betheproject.co.za' then
    raise exception 'Not authorized';
  end if;

  return query
  select * from public.subscriptions order by created_at desc;
end;
$$;

revoke execute on function public.admin_list_subscriptions() from public, anon, authenticated;
grant execute on function public.admin_list_subscriptions() to authenticated;

create or replace function public.admin_update_subscription(
  p_id uuid,
  p_status text,
  p_trial_ends_at timestamptz,
  p_subscription_ends_at timestamptz,
  p_notes text
)
returns public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subscription public.subscriptions;
begin
  if (select auth.uid()) is null
     or coalesce((select auth.jwt() ->> 'email'), '') <> 'lwazi@betheproject.co.za' then
    raise exception 'Not authorized';
  end if;

  if p_status not in ('trial', 'active', 'expired', 'cancelled') then
    raise exception 'Unsupported subscription status';
  end if;

  update public.subscriptions
  set status = p_status,
      trial_ends_at = p_trial_ends_at,
      subscription_ends_at = p_subscription_ends_at,
      notes = coalesce(p_notes, ''),
      updated_at = now()
  where id = p_id
  returning * into v_subscription;

  if not found then
    raise exception 'Subscription not found';
  end if;

  return v_subscription;
end;
$$;

revoke execute on function public.admin_update_subscription(uuid, text, timestamptz, timestamptz, text) from public, anon, authenticated;
grant execute on function public.admin_update_subscription(uuid, text, timestamptz, timestamptz, text) to authenticated;

-- Foreign-key indexes identified by Supabase's performance advisor.
create index if not exists companies_user_id_idx on public.companies (user_id);
create index if not exists clients_user_id_idx on public.clients (user_id);
create index if not exists documents_user_id_idx on public.documents (user_id);
create index if not exists documents_company_id_idx on public.documents (company_id);
create index if not exists documents_client_id_idx on public.documents (client_id);
create index if not exists documents_linked_to_idx on public.documents (linked_to);
create index if not exists subscriptions_user_id_idx on public.subscriptions (user_id);
create index if not exists recurring_invoices_user_id_idx on public.recurring_invoices (user_id);
create index if not exists recurring_invoices_company_id_idx on public.recurring_invoices (company_id);
create index if not exists recurring_invoices_client_id_idx on public.recurring_invoices (client_id);
