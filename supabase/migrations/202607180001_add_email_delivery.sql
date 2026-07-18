alter table public.quotes
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_delivery_id text,
  add column if not exists email_error text;

comment on column public.quotes.email_sent_at is 'Fecha en que Resend aceptó la notificación';
comment on column public.quotes.email_delivery_id is 'Identificador de entrega devuelto por Resend';
comment on column public.quotes.email_error is 'Último error de notificación, si ocurrió';

