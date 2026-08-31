-- Fonte del tasso di conversione LEADS (REAL | ESTIMATED | UNKNOWN).
-- Non applicare automaticamente in production: migration da eseguire a mano.

alter table public.campaigns
  add column if not exists conversion_rate_source text;

alter table public.campaigns
  drop constraint if exists campaigns_conversion_rate_source_check;

alter table public.campaigns
  add constraint campaigns_conversion_rate_source_check
  check (
    conversion_rate_source is null
    or conversion_rate_source in ('REAL', 'ESTIMATED', 'UNKNOWN')
  );

comment on column public.campaigns.conversion_rate_source is
  'Provenienza del tasso di conversione LEADS: REAL, ESTIMATED o UNKNOWN.';
