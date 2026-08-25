-- Completa clients + campaigns per Asset & Strategia.
-- Esegui nel SQL Editor di Supabase (Dashboard → SQL).

alter table public.clients
  add column if not exists website text;

alter table public.campaigns
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
  add column if not exists titolo_annuncio text;
