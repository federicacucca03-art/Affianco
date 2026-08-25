-- Affianco — schema base (clients, campaigns, campaign_logs).
-- Idempotente / non distruttivo. Nessun DROP. Nessuna policy anon aperta.
-- Le policy DEV stanno in supabase/dev/setup-dev-rls.sql
--
-- Timestamp 20260728: gira PRIMA degli ALTER 20260729+ così un clone nuovo
-- non dipende da tabelle create a mano.

create extension if not exists "pgcrypto";

-- ---------- clients ----------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  elevator_pitch text,
  average_ticket_value numeric,
  closing_rate numeric,
  website text
);

alter table public.clients
  add column if not exists elevator_pitch text,
  add column if not exists average_ticket_value numeric,
  add column if not exists closing_rate numeric,
  add column if not exists website text;

-- ---------- campaigns ----------
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id uuid references public.clients (id) on delete set null,
  name text not null,
  objective text,
  status text not null default 'DRAFT',
  daily_budget numeric,
  max_sustainable_cpa numeric,
  -- COPY
  variante_a text,
  variante_b text,
  variante_c text,
  page_id text,
  form_id text,
  titolo_annuncio text,
  front_end_offer text,
  -- TARGETING
  settore text,
  citta text,
  raggio_km numeric,
  eta_min integer,
  eta_max integer,
  target_type text,
  target_age text,
  -- ECONOMIA / OBJECTIVE-SPECIFIC
  target_margin numeric,
  booking_service_value numeric,
  show_up_rate numeric,
  booking_channel text,
  booking_confirmation_policy text,
  average_order_value numeric,
  product_margin numeric,
  average_receipt numeric,
  store_margin numeric,
  recovery_value numeric,
  recovery_margin numeric,
  recovery_discount numeric,
  launch_budget numeric,
  awareness_radius_km numeric,
  estimated_cpm numeric,
  shipping_market text,
  hero_product text,
  -- APPROVAL
  approved_at timestamptz,
  revision_notes text
);

alter table public.campaigns
  add column if not exists client_id uuid,
  add column if not exists objective text,
  add column if not exists status text,
  add column if not exists daily_budget numeric,
  add column if not exists max_sustainable_cpa numeric,
  add column if not exists variante_a text,
  add column if not exists variante_b text,
  add column if not exists variante_c text,
  add column if not exists page_id text,
  add column if not exists form_id text,
  add column if not exists settore text,
  add column if not exists citta text,
  add column if not exists raggio_km numeric,
  add column if not exists eta_min integer,
  add column if not exists eta_max integer,
  add column if not exists titolo_annuncio text,
  add column if not exists target_margin numeric,
  add column if not exists booking_service_value numeric,
  add column if not exists show_up_rate numeric,
  add column if not exists booking_channel text,
  add column if not exists booking_confirmation_policy text,
  add column if not exists average_order_value numeric,
  add column if not exists product_margin numeric,
  add column if not exists average_receipt numeric,
  add column if not exists store_margin numeric,
  add column if not exists recovery_value numeric,
  add column if not exists recovery_margin numeric,
  add column if not exists recovery_discount numeric,
  add column if not exists launch_budget numeric,
  add column if not exists awareness_radius_km numeric,
  add column if not exists estimated_cpm numeric,
  add column if not exists approved_at timestamptz,
  add column if not exists revision_notes text,
  add column if not exists front_end_offer text,
  add column if not exists target_type text,
  add column if not exists target_age text,
  add column if not exists shipping_market text,
  add column if not exists hero_product text;

do $$
begin
  alter table public.campaigns alter column status set default 'DRAFT';
exception when others then null;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'campaigns_client_id_fkey'
  ) then
    alter table public.campaigns
      add constraint campaigns_client_id_fkey
      foreign key (client_id) references public.clients (id)
      on delete set null;
  end if;
exception when others then null;
end $$;

-- ---------- campaign_logs ----------
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

-- RLS abilitato senza policy = accesso negato finché non si applica
-- supabase/dev/setup-dev-rls.sql (DEV) oppure policy produzione dedicate.
alter table public.clients enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_logs enable row level security;
