-- IN_STORE / DRIVE_TO_STORE: scontrino medio cassa + margine negozio
alter table public.campaigns
  add column if not exists average_receipt numeric;

alter table public.campaigns
  add column if not exists store_margin numeric;

comment on column public.campaigns.average_receipt is
  'Scontrino medio in cassa (€) per obiettivo IN_STORE / DRIVE_TO_STORE';

comment on column public.campaigns.store_margin is
  'Margine lordo medio prodotti fisici % per obiettivo IN_STORE';
