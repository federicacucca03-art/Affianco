-- Step 1 Wizard: offerta d'ingresso e target di riferimento.
alter table public.campaigns
  add column if not exists front_end_offer text,
  add column if not exists target_type text,
  add column if not exists target_age text;
