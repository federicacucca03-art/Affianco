-- Diario di Bordo: audit trail eventi campagna.
-- Schema neutro (tabella + index + RLS on). Nessuna policy anon.
-- Per MVP locale: applicare anche supabase/dev/setup-dev-rls.sql
-- (DEV ONLY — NOT FOR PRODUCTION).
--
-- Su DB nuovi la tabella è già creata da 20260728_bootstrap_schema.sql;
-- questo file resta idempotente per history e progetti parziali.

create table if not exists public.campaign_logs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  event_type text not null
    check (
      event_type in (
        'CREATED',
        'APPROVED',
        'EXPORTED',
        'METRICS_UPDATED',
        'DIAGNOSIS_CHANGED',
        'NOTE_ADDED'
      )
    ),
  title text not null,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists campaign_logs_campaign_id_created_at_idx
  on public.campaign_logs (campaign_id, created_at desc);

alter table public.campaign_logs enable row level security;
