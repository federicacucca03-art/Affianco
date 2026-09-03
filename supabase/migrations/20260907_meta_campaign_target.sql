-- ============================================================
-- M5B — meta_campaigns: primary_kpi + target_value
-- ============================================================
-- Additiva / non distruttiva. Nessun DROP.
-- Nessuna modifica a campaign_checks.
-- Nessun link nativo ↔ Meta (deferred).
-- Writes remain server-only (trigger enforced).
-- ============================================================

alter table public.meta_campaigns
  add column if not exists primary_kpi text null,
  add column if not exists target_value numeric null;

alter table public.meta_campaigns
  drop constraint if exists meta_campaigns_primary_kpi_chk;

alter table public.meta_campaigns
  add constraint meta_campaigns_primary_kpi_chk
  check (
    primary_kpi is null
    or primary_kpi in ('CPL', 'CPA', 'CPM', 'CPC', 'ROAS', 'NONE')
  );

alter table public.meta_campaigns
  drop constraint if exists meta_campaigns_target_value_chk;

alter table public.meta_campaigns
  add constraint meta_campaigns_target_value_chk
  check (
    target_value is null
    or target_value > 0
  );

-- NONE KPI must have null target_value
alter table public.meta_campaigns
  drop constraint if exists meta_campaigns_kpi_none_target_chk;

alter table public.meta_campaigns
  add constraint meta_campaigns_kpi_none_target_chk
  check (
    primary_kpi is distinct from 'NONE'
    or target_value is null
  );

-- Expose to authenticated (read only — writes remain server-only via existing trigger)
grant select (primary_kpi, target_value)
  on table public.meta_campaigns to authenticated;

comment on column public.meta_campaigns.primary_kpi is
  'KPI monitorato per Control Room. NULL = nessun target. NONE = target esplicitamente rimosso.';

comment on column public.meta_campaigns.target_value is
  'Valore target del KPI. NULL quando primary_kpi è NULL o NONE.';
