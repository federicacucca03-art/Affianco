-- RETARGETING: valore carrello/contatto, margine, sconto incentivo
alter table public.campaigns
  add column if not exists recovery_value numeric;

alter table public.campaigns
  add column if not exists recovery_margin numeric;

alter table public.campaigns
  add column if not exists recovery_discount numeric default 0;

comment on column public.campaigns.recovery_value is
  'Valore medio contatto/carrello da recuperare (€) per obiettivo RETARGETING';

comment on column public.campaigns.recovery_margin is
  'Margine lordo % per obiettivo RETARGETING';

comment on column public.campaigns.recovery_discount is
  'Incentivo/sconto offerto % per chi chiude oggi (RETARGETING, opzionale)';
