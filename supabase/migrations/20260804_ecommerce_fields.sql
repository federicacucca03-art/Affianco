-- ECOMMERCE: AOV + margine prodotto
alter table public.campaigns
  add column if not exists average_order_value numeric;

alter table public.campaigns
  add column if not exists product_margin numeric;

comment on column public.campaigns.average_order_value is
  'Scontrino medio carrello AOV (€) per obiettivo ECOMMERCE';

comment on column public.campaigns.product_margin is
  'Margine lordo prodotto % per obiettivo ECOMMERCE';
