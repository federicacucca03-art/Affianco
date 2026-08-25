-- AWARENESS / LAUNCH: budget lancio, raggio, CPM stimato
alter table public.campaigns
  add column if not exists launch_budget numeric;

alter table public.campaigns
  add column if not exists awareness_radius_km numeric;

alter table public.campaigns
  add column if not exists estimated_cpm numeric default 7;

comment on column public.campaigns.launch_budget is
  'Budget totale di lancio (€) per obiettivo AWARENESS / LAUNCH';

comment on column public.campaigns.awareness_radius_km is
  'Raggio geografico dal punto vendita (km) per AWARENESS';

comment on column public.campaigns.estimated_cpm is
  'CPM stimato area locale (€ per 1.000 visualizzazioni) per AWARENESS';
