-- ============================================================
-- M0.3A — campaign_checks: clicks + impressions (P0 counts)
-- ============================================================
-- Additiva / non distruttiva. Nessun DROP.
-- Nullable: null = dato non disponibile; 0 = zero reale.
-- Nessun DEFAULT 0. Nessun NOT NULL. Nessun CHECK su range.
-- RLS / trigger / indici esistenti invariati.
-- ============================================================

alter table public.campaign_checks
  add column if not exists clicks integer;

alter table public.campaign_checks
  add column if not exists impressions integer;

comment on column public.campaign_checks.clicks is
  'Click nel periodo del check. NULL = non disponibile; 0 = zero reale.';

comment on column public.campaign_checks.impressions is
  'Impression nel periodo del check. NULL = non disponibile; 0 = zero reale.';
