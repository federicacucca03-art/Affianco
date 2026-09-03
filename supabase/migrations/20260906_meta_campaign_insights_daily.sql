-- ============================================================
-- M4.1 — meta_campaign_insights_daily + period reach/frequency
-- ============================================================
-- Idempotente / non distruttivo. Nessun DROP TABLE.
-- NON applicare in produzione da questo slice in automatico.
-- Non scrive campaign_checks. Non è public.campaigns.
-- Write path: service role. SELECT autenticato solo metadati Insights.
-- ============================================================

alter table public.meta_campaigns
  add column if not exists insights_period_since date,
  add column if not exists insights_period_until date,
  add column if not exists insights_period_reach bigint,
  add column if not exists insights_period_frequency numeric,
  add column if not exists insights_lookback_truncated boolean not null default false,
  add column if not exists insights_date_fallback text,
  add column if not exists insights_empty boolean not null default false,
  add column if not exists insights_last_synced_at timestamptz;

alter table public.meta_campaigns
  drop constraint if exists meta_campaigns_insights_fallback_chk;

alter table public.meta_campaigns
  add constraint meta_campaigns_insights_fallback_chk
  check (
    insights_date_fallback is null
    or insights_date_fallback in ('campaign_dates', 'created_at', 'lookback')
  );

grant select (
  insights_period_since,
  insights_period_until,
  insights_period_reach,
  insights_period_frequency,
  insights_lookback_truncated,
  insights_date_fallback,
  insights_empty,
  insights_last_synced_at
) on table public.meta_campaigns to authenticated;

create table if not exists public.meta_campaign_insights_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  meta_connection_id uuid not null references public.meta_connections (id) on delete cascade,
  meta_ad_account_id text not null,
  meta_campaign_id text not null,
  date_start date not null,
  date_stop date not null,
  spend numeric null,
  impressions bigint null,
  reach bigint null,
  clicks bigint null,
  link_clicks bigint null,
  meta_ctr numeric null,
  meta_cpc numeric null,
  meta_cpm numeric null,
  frequency numeric null,
  actions jsonb null,
  action_values jsonb null,
  primary_result_type text null,
  primary_results numeric null,
  primary_result_value numeric null,
  result_mapping_confidence text null,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meta_campaign_insights_daily_unique
    unique (user_id, client_id, meta_campaign_id, date_start),
  constraint meta_campaign_insights_daily_dates_chk
    check (date_stop >= date_start),
  constraint meta_campaign_insights_daily_confidence_chk
    check (
      result_mapping_confidence is null
      or result_mapping_confidence in ('CONFIDENT', 'AMBIGUOUS', 'UNKNOWN')
    ),
  constraint meta_campaign_insights_daily_campaign_fk
    foreign key (user_id, client_id, meta_campaign_id)
    references public.meta_campaigns (user_id, client_id, meta_campaign_id)
    on delete cascade
);

create index if not exists meta_campaign_insights_daily_user_client_idx
  on public.meta_campaign_insights_daily (user_id, client_id);

create index if not exists meta_campaign_insights_daily_campaign_idx
  on public.meta_campaign_insights_daily (user_id, client_id, meta_campaign_id);

create or replace function public.touch_meta_campaign_insights_daily_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_meta_campaign_insights_daily_updated_at
  on public.meta_campaign_insights_daily;
create trigger trg_touch_meta_campaign_insights_daily_updated_at
  before update on public.meta_campaign_insights_daily
  for each row
  execute function public.touch_meta_campaign_insights_daily_updated_at();

create or replace function public.enforce_meta_campaign_insights_daily_server_writes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text;
  conn_user uuid;
  conn_client uuid;
  map_account text;
  map_connection uuid;
  camp_connection uuid;
  camp_account text;
begin
  jwt_role := coalesce(auth.role(), '');
  if jwt_role in ('authenticated', 'anon') then
    raise exception 'meta_campaign_insights_daily writes are server-only';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    raise exception 'meta_campaign_insights_daily.user_id is immutable';
  end if;
  if tg_op = 'UPDATE' and new.client_id is distinct from old.client_id then
    raise exception 'meta_campaign_insights_daily.client_id is immutable';
  end if;
  if tg_op = 'UPDATE' and new.meta_campaign_id is distinct from old.meta_campaign_id then
    raise exception 'meta_campaign_insights_daily.meta_campaign_id is immutable';
  end if;
  if tg_op = 'UPDATE' and new.date_start is distinct from old.date_start then
    raise exception 'meta_campaign_insights_daily.date_start is immutable';
  end if;

  select c.user_id, c.client_id
    into conn_user, conn_client
  from public.meta_connections c
  where c.id = new.meta_connection_id;
  if conn_user is null then
    raise exception 'meta_campaign_insights_daily.meta_connection_id not found';
  end if;
  if conn_user is distinct from new.user_id or conn_client is distinct from new.client_id then
    raise exception 'meta_campaign_insights_daily connection scope mismatch';
  end if;

  select a.meta_ad_account_id, a.meta_connection_id
    into map_account, map_connection
  from public.client_ad_accounts a
  where a.user_id = new.user_id
    and a.client_id = new.client_id;
  if map_account is null then
    raise exception 'meta_campaign_insights_daily mapping not found';
  end if;
  if map_account is distinct from new.meta_ad_account_id
     or map_connection is distinct from new.meta_connection_id then
    raise exception 'meta_campaign_insights_daily mapping account mismatch';
  end if;

  select m.meta_connection_id, m.meta_ad_account_id
    into camp_connection, camp_account
  from public.meta_campaigns m
  where m.user_id = new.user_id
    and m.client_id = new.client_id
    and m.meta_campaign_id = new.meta_campaign_id;
  if camp_connection is null then
    raise exception 'meta_campaign_insights_daily campaign not found';
  end if;
  if camp_connection is distinct from new.meta_connection_id
     or camp_account is distinct from new.meta_ad_account_id then
    raise exception 'meta_campaign_insights_daily campaign mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_meta_campaign_insights_daily_server_writes
  on public.meta_campaign_insights_daily;
create trigger trg_enforce_meta_campaign_insights_daily_server_writes
  before insert or update or delete on public.meta_campaign_insights_daily
  for each row
  execute function public.enforce_meta_campaign_insights_daily_server_writes();

alter table public.meta_campaign_insights_daily enable row level security;

revoke all on table public.meta_campaign_insights_daily from anon;
revoke all on table public.meta_campaign_insights_daily from public;
revoke all on table public.meta_campaign_insights_daily from authenticated;

grant select (
  id,
  user_id,
  client_id,
  meta_connection_id,
  meta_ad_account_id,
  meta_campaign_id,
  date_start,
  date_stop,
  spend,
  impressions,
  reach,
  clicks,
  link_clicks,
  meta_ctr,
  meta_cpc,
  meta_cpm,
  frequency,
  actions,
  action_values,
  primary_result_type,
  primary_results,
  primary_result_value,
  result_mapping_confidence,
  last_synced_at,
  created_at,
  updated_at
) on table public.meta_campaign_insights_daily to authenticated;

drop policy if exists "meta_campaign_insights_daily_select_own"
  on public.meta_campaign_insights_daily;

create policy "meta_campaign_insights_daily_select_own"
  on public.meta_campaign_insights_daily
  for select
  to authenticated
  using (user_id = auth.uid());

comment on table public.meta_campaign_insights_daily is
  'Insight giornalieri Meta (sola lettura Graph). Non sostituisce campaign_checks.';
