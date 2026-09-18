-- ============================================================
-- M10D — Meta configuration intelligence (read-only)
-- ============================================================
-- Idempotent. No DROP. Server-only writes (existing triggers).
-- Do NOT apply automatically from this slice.
-- Stores Graph config needed for UI / Ask Ally / planned-vs-actual.
-- No Meta writes. No ads_management.
-- ============================================================

-- -------------------- meta_campaigns --------------------
alter table public.meta_campaigns
  add column if not exists special_ad_categories jsonb null;

alter table public.meta_campaigns
  add column if not exists is_adset_budget_sharing_enabled boolean null;

comment on column public.meta_campaigns.special_ad_categories is
  'M10D — Meta special_ad_categories array as returned by Graph (ads_read).';
comment on column public.meta_campaigns.is_adset_budget_sharing_enabled is
  'M10D — Meta is_adset_budget_sharing_enabled (Ad Set Budget Sharing), not CBO.';

-- -------------------- meta_ad_sets --------------------
alter table public.meta_ad_sets
  add column if not exists billing_event text null;

alter table public.meta_ad_sets
  add column if not exists bid_strategy text null;

alter table public.meta_ad_sets
  add column if not exists bid_amount numeric null;

alter table public.meta_ad_sets
  add column if not exists start_time timestamptz null;

alter table public.meta_ad_sets
  add column if not exists end_time timestamptz null;

alter table public.meta_ad_sets
  add column if not exists destination_type text null;

alter table public.meta_ad_sets
  add column if not exists attribution_spec jsonb null;

alter table public.meta_ad_sets
  add column if not exists promoted_object jsonb null;

alter table public.meta_ad_sets
  add column if not exists targeting_summary jsonb null;

comment on column public.meta_ad_sets.targeting_summary is
  'M10D — sanitized Ally targeting summary (not raw Ads Manager dump).';
comment on column public.meta_ad_sets.attribution_spec is
  'M10D — Meta attribution_spec as returned (professional detail).';
comment on column public.meta_ad_sets.promoted_object is
  'M10D — Meta promoted_object subset (destination-related, no secrets).';
