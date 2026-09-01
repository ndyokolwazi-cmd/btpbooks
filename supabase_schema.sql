-- BTP Books Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Companies
create table companies (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  trading_as text,
  reg text,
  vat text,
  vat_registered boolean default false,
  address text,
  email text,
  phone text,
  website text,
  logo text,
  currency_symbol text default 'R',
  banking jsonb default '[]',
  next_nos jsonb default '{"invoice":1001,"quote":101,"delivery":501,"credit":201,"receipt":801}',
  created_at timestamptz default now()
);

-- Clients
create table clients (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  email text,
  phone text,
  address text,
  vat text,
  vat_registered boolean default false,
  notes text,
  created_at timestamptz default now()
);

-- Documents
create table documents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  company_id uuid references companies(id) on delete cascade not null,
  type text not null,
  number text not null,
  status text default 'Draft',
  date date not null,
  due date,
  client_id uuid references clients(id) on delete set null,
  client_name text not null,
  client_address text,
  client_vat text,
  po_number text,
  ref text,
  items jsonb default '[]',
  notes text,
  terms text,
  totals jsonb default '{"subtotal":0,"vat":0,"total":0}',
  linked_to uuid references documents(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Row Level Security
alter table companies enable row level security;
alter table clients enable row level security;
alter table documents enable row level security;

-- Policies - users can only see their own data
create policy "Users see own companies" on companies for all using (auth.uid() = user_id);
create policy "Users see own clients" on clients for all using (auth.uid() = user_id);
create policy "Users see own documents" on documents for all using (auth.uid() = user_id);

-- Updated at trigger
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger documents_updated_at before update on documents
for each row execute function update_updated_at();

-- NOTE: this file is not fully in sync with production — see CLAUDE.md.
-- The table below (added for recurring invoices) has NOT been applied to
-- production yet; run it manually via the Supabase SQL Editor.
create table recurring_invoices (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  company_id uuid references companies(id) on delete cascade not null,
  client_id uuid references clients(id) on delete set null,
  -- Snapshot of the source invoice's client/line-item/notes fields, plus
  -- due_days (gap between date and due on the source invoice) so each
  -- generated invoice gets a fresh date/due computed at generation time.
  template jsonb not null,
  frequency text not null default 'monthly', -- 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  next_run date not null,
  last_generated_at timestamptz,
  active boolean default true,
  created_at timestamptz default now()
);
alter table recurring_invoices enable row level security;
create policy "Users see own recurring_invoices" on recurring_invoices for all using (auth.uid() = user_id);
