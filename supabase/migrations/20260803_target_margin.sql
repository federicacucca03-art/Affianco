-- Margine di profitto target per il calcolo CPL sostenibile.
alter table public.campaigns
  add column if not exists target_margin numeric;
