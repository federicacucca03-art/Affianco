-- ============================================================
-- M3 — meta_campaigns (read-only Meta campaign import)
-- ============================================================
-- Idempotente / non distruttivo. Nessun DROP TABLE.
-- NON applicare in produzione da questo slice in automatico.
-- Non è public.campaigns: niente campi di pianificazione Affianco inventati.
-- Write path: service role. SELECT autenticato solo metadati sicuri.
-- ============================================================

create table if not exists public.meta_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  meta_connection_id uuid not null references public.meta_connections (id) on delete cascade,
  meta_ad_account_id text not null,
  meta_campaign_id text not null,
  name text not null,
  raw_objective text,
  affianco_objective_candidate text,
  objective_mapping_confidence text,
  status text,
  effective_status text,
  buying_type text,
  daily_budget numeric,
  lifetime_budget numeric,
  meta_created_at timestamptz,
  meta_start_at timestamptz,
  meta_stop_at timestamptz,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meta_campaigns_user_client_campaign_unique
    unique (user_id, client_id, meta_campaign_id),
  constraint meta_campaigns_mapping_confidence_chk
    check (
      objective_mapping_confidence is null
      or objective_mapping_confidence in ('CONFIDENT', 'AMBIGUOUS', 'UNKNOWN')
    )
);

create index if not exists meta_campaigns_user_client_idx
  on public.meta_campaigns (user_id, client_id);

create index if not exists meta_campaigns_client_id_idx
  on public.meta_campaigns (client_id);

create or replace function public.touch_meta_campaigns_updated_at()
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

drop trigger if exists trg_touch_meta_campaigns_updated_at on public.meta_campaigns;
create trigger trg_touch_meta_campaigns_updated_at
  before update on public.meta_campaigns
  for each row
  execute function public.touch_meta_campaigns_updated_at();

create or replace function public.enforce_meta_campaigns_server_writes()
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
begin
  jwt_role := coalesce(auth.role(), '');
  if jwt_role in ('authenticated', 'anon') then
    raise exception 'meta_campaigns writes are server-only';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    raise exception 'meta_campaigns.user_id is immutable';
  end if;
  if tg_op = 'UPDATE' and new.client_id is distinct from old.client_id then
    raise exception 'meta_campaigns.client_id is immutable';
  end if;
  if tg_op = 'UPDATE' and new.meta_campaign_id is distinct from old.meta_campaign_id then
    raise exception 'meta_campaigns.meta_campaign_id is immutable';
  end if;

  select c.user_id, c.client_id
    into conn_user, conn_client
  from public.meta_connections c
  where c.id = new.meta_connection_id;
  if conn_user is null then
    raise exception 'meta_campaigns.meta_connection_id not found';
  end if;
  if conn_user is distinct from new.user_id or conn_client is distinct from new.client_id then
    raise exception 'meta_campaigns connection scope mismatch';
  end if;

  select a.meta_ad_account_id, a.meta_connection_id
    into map_account, map_connection
  from public.client_ad_accounts a
  where a.user_id = new.user_id
    and a.client_id = new.client_id;
  if map_account is null then
    raise exception 'meta_campaigns mapping not found';
  end if;
  if map_account is distinct from new.meta_ad_account_id
     or map_connection is distinct from new.meta_connection_id then
    raise exception 'meta_campaigns mapping account mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_meta_campaigns_server_writes on public.meta_campaigns;
create trigger trg_enforce_meta_campaigns_server_writes
  before insert or update or delete on public.meta_campaigns
  for each row
  execute function public.enforce_meta_campaigns_server_writes();

alter table public.meta_campaigns enable row level security;

revoke all on table public.meta_campaigns from anon;
revoke all on table public.meta_campaigns from public;
revoke all on table public.meta_campaigns from authenticated;

grant select (
  id,
  user_id,
  client_id,
  meta_connection_id,
  meta_ad_account_id,
  meta_campaign_id,
  name,
  raw_objective,
  affianco_objective_candidate,
  objective_mapping_confidence,
  status,
  effective_status,
  buying_type,
  daily_budget,
  lifetime_budget,
  meta_created_at,
  meta_start_at,
  meta_stop_at,
  last_synced_at,
  created_at,
  updated_at
) on table public.meta_campaigns to authenticated;

drop policy if exists "meta_campaigns_select_own" on public.meta_campaigns;

create policy "meta_campaigns_select_own"
  on public.meta_campaigns
  for select
  to authenticated
  using (user_id = auth.uid());

comment on table public.meta_campaigns is
  'Campagne Meta importate in sola lettura per cliente Affianco. Non sostituisce public.campaigns.';
