-- ECOMMERCE: mercato spedizione + prodotto hero
alter table public.campaigns
  add column if not exists shipping_market text;

alter table public.campaigns
  add column if not exists hero_product text;

comment on column public.campaigns.shipping_market is
  'ITALY | EUROPE | GLOBAL';

comment on column public.campaigns.hero_product is
  'Prodotto Hero o collezione promossa (ECOMMERCE)';
