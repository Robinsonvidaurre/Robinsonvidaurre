create extension if not exists pgcrypto;

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'nuevo'
    check (status in ('nuevo', 'contactado', 'cotizado', 'cerrado', 'descartado')),
  contact_name text not null check (char_length(contact_name) between 2 and 120),
  business_name text not null check (char_length(business_name) between 2 and 160),
  phone text not null check (char_length(phone) between 6 and 40),
  email text not null check (char_length(email) between 5 and 254),
  city text not null check (char_length(city) between 2 and 120),
  district text,
  category text not null,
  products text not null check (char_length(products) between 3 and 3000),
  delivery_date date,
  frequency text,
  comments text,
  consent boolean not null default true,
  consent_at timestamptz not null default now(),
  source text not null default 'web'
);

comment on table public.quotes is 'Solicitudes de cotización recibidas desde la web de INZUMOS';
comment on column public.quotes.status is 'Estado comercial administrado desde Supabase';

alter table public.quotes enable row level security;

revoke all on table public.quotes from anon, authenticated;
grant all on table public.quotes to service_role;

create index if not exists quotes_created_at_idx on public.quotes (created_at desc);
create index if not exists quotes_status_idx on public.quotes (status);

