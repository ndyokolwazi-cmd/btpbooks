-- A company selects a business pack; the core document engine remains shared.
alter table public.companies
  add column if not exists business_pack text not null default 'general_services',
  add column if not exists currency_code text not null default 'ZAR';

alter table public.companies
  drop constraint if exists companies_business_pack_check;

alter table public.companies
  add constraint companies_business_pack_check
  check (business_pack in ('general_services', 'property_rental'));

alter table public.companies
  drop constraint if exists companies_currency_code_check;

alter table public.companies
  add constraint companies_currency_code_check
  check (currency_code = 'ZAR');

comment on column public.companies.business_pack is
  'Controls business terminology, document defaults and workflow modules.';

comment on column public.companies.currency_code is
  'ISO 4217 currency code. MyInvox South Africa currently supports ZAR.';
