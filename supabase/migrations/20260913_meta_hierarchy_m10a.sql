-- ============================================================
-- M10A — Meta hierarchy read-only: ad sets + ads + daily insights
-- ============================================================
-- Idempotent. No DROP TABLE. Server-only writes. SELECT for owner.
-- Do NOT apply automatically from this slice.
-- No Meta writes. No ads_management.
-- ============================================================

-- -------------------- meta_ad_sets --------------------
create table if not exists public.meta_ad_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  meta_connection_id uuid not null references public.meta_connections (id) on delete cascade,
  meta_ad_account_id text not null,
  meta_campaign_id text not null,
  meta_ad_set_id text not null,
  name text not null,
  status text null,
  effective_status text null,
  daily_budget numeric null,
  lifetime_budget numeric null,
  optimization_goal text null,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meta_ad_sets_unique
    unique (user_id, client_id, meta_ad_set_id),
  constraint meta_ad_sets_campaign_fk
    foreign key (user_id, client_id, meta_campaign_id)
    references public.meta_campaigns (user_id, client_id, meta_campaign_id)
    on delete cascade
);

create index if not exists meta_ad_sets_user_client_idx
  on public.meta_ad_sets (user_id, client_id);
create index if not exists meta_ad_sets_campaign_idx
  on public.meta_ad_sets (user_id, client_id, meta_campaign_id);

-- -------------------- meta_ads --------------------
create table if not exists public.meta_ads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  meta_connection_id uuid not null references public.meta_connections (id) on delete cascade,
  meta_ad_account_id text not null,
  meta_campaign_id text not null,
  meta_ad_set_id text not null,
  meta_ad_id text not null,
  name text not null,
  status text null,
  effective_status text null,
  creative_id text null,
  creative_body text null,
  creative_title text null,
  creative_description text null,
  creative_cta text null,
  creative_thumbnail_url text null,
  creative_link_url text null,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meta_ads_unique
    unique (user_id, client_id, meta_ad_id),
  constraint meta_ads_campaign_fk
    foreign key (user_id, client_id, meta_campaign_id)
    references public.meta_campaigns (user_id, client_id, meta_campaign_id)
    on delete cascade
);

create index if not exists meta_ads_user_client_idx
  on public.meta_ads (user_id, client_id);
create index if not exists meta_ads_adset_idx
  on public.meta_ads (user_id, client_id, meta_ad_set_id);
create index if not exists meta_ads_campaign_idx
  on public.meta_ads (user_id, client_id, meta_campaign_id);

-- -------------------- insights daily (ad set) --------------------
create table if not exists public.meta_ad_set_insights_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  meta_connection_id uuid not null references public.meta_connections (id) on delete cascade,
  meta_ad_account_id text not null,
  meta_campaign_id text not null,
  meta_ad_set_id text not null,
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
  constraint meta_ad_set_insights_daily_unique
    unique (user_id, client_id, meta_ad_set_id, date_start),
  constraint meta_ad_set_insights_daily_dates_chk
    check (date_stop >= date_start),
  constraint meta_ad_set_insights_daily_confidence_chk
    check (
      result_mapping_confidence is null
      or result_mapping_confidence in ('CONFIDENT', 'AMBIGUOUS', 'UNKNOWN')
    )
);

create index if not exists meta_ad_set_insights_daily_adset_idx
  on public.meta_ad_set_insights_daily (user_id, client_id, meta_ad_set_id);

-- -------------------- insights daily (ad) --------------------
create table if not exists public.meta_ad_insights_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  meta_connection_id uuid not null references public.meta_connections (id) on delete cascade,
  meta_ad_account_id text not null,
  meta_campaign_id text not null,
  meta_ad_set_id text not null,
  meta_ad_id text not null,
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
  constraint meta_ad_insights_daily_unique
    unique (user_id, client_id, meta_ad_id, date_start),
  constraint meta_ad_insights_daily_dates_chk
    check (date_stop >= date_start),
  constraint meta_ad_insights_daily_confidence_chk
    check (
      result_mapping_confidence is null
      or result_mapping_confidence in ('CONFIDENT', 'AMBIGUOUS', 'UNKNOWN')
    )
);

create index if not exists meta_ad_insights_daily_ad_idx
  on public.meta_ad_insights_daily (user_id, client_id, meta_ad_id);

-- -------------------- touch + server-write guards --------------------
create or replace function public.touch_meta_hierarchy_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.enforce_meta_hierarchy_server_writes()
returns trigger language plpgsql security definer set search_path = public as $$
declare jwt_role text;
begin
  jwt_role := coalesce(auth.role(), '');
  if jwt_role in ('authenticated', 'anon') then
    raise exception 'meta hierarchy writes are server-only';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'meta_ad_sets',
    'meta_ads',
    'meta_ad_set_insights_daily',
    'meta_ad_insights_daily'
  ]
  loop
    execute format('drop trigger if exists trg_touch_%s on public.%I', t, t);
    execute format(
      'create trigger trg_touch_%s before update on public.%I for each row execute function public.touch_meta_hierarchy_updated_at()',
      t, t
    );
    execute format('drop trigger if exists trg_enforce_%s on public.%I', t, t);
    execute format(
      'create trigger trg_enforce_%s before insert or update or delete on public.%I for each row execute function public.enforce_meta_hierarchy_server_writes()',
      t, t
    );
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I_select_own on public.%I', t, t);
    execute format(
      'create policy %I_select_own on public.%I for select to authenticated using (user_id = auth.uid())',
      t, t
    );
    execute format('revoke all on table public.%I from anon', t);
    execute format('revoke all on table public.%I from public', t);
    execute format('revoke all on table public.%I from authenticated', t);
    execute format('grant select on table public.%I to authenticated', t);
  end loop;
end $$;
