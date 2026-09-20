-- ============================================================
-- M11A.1 — meta_write_operations (dry-run / future write audit)
-- ============================================================
-- Idempotente / non distruttivo. Nessun DROP TABLE.
-- NON applicare in produzione da questo slice in automatico.
--
-- Creation/update: service role only (server writes).
-- Authenticated: SELECT own rows only.
-- Anon: nessun accesso.
-- Nessun token Meta. Nessun secret. Nessun payload grezzo pericoloso.
-- ============================================================

create table if not exists public.meta_write_operations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  ally_campaign_id uuid not null references public.campaigns (id) on delete cascade,

  operation_type text not null
    check (operation_type in ('CAMPAIGN_ADSET_PAUSED')),

  payload_fingerprint text not null,
  idempotency_key text not null,

  state text not null
    check (
      state in (
        'PREVIEWED',
        'CONFIRMED',
        'IN_PROGRESS',
        'PARTIALLY_CREATED',
        'COMPLETED',
        'FAILED'
      )
    ),

  safe_payload_summary jsonb not null default '{}'::jsonb,

  meta_campaign_id text null,
  meta_adset_id text null,
  meta_creative_id text null,
  meta_ad_id text null,

  error_category text null,
  error_safe_message text null,

  confirmed_at timestamptz null,
  started_at timestamptz null,
  completed_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint meta_write_operations_idempotency_unique
    unique (user_id, ally_campaign_id, operation_type, idempotency_key)
);

create index if not exists meta_write_operations_user_idx
  on public.meta_write_operations (user_id, created_at desc);

create index if not exists meta_write_operations_campaign_idx
  on public.meta_write_operations (ally_campaign_id, created_at desc);

create index if not exists meta_write_operations_fingerprint_idx
  on public.meta_write_operations (user_id, ally_campaign_id, payload_fingerprint);

create or replace function public.touch_meta_write_operations_updated_at()
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

drop trigger if exists trg_touch_meta_write_operations_updated_at
  on public.meta_write_operations;
create trigger trg_touch_meta_write_operations_updated_at
  before update on public.meta_write_operations
  for each row
  execute function public.touch_meta_write_operations_updated_at();

-- Ownership: user_id + client + campaign must align (anti-spoof).
create or replace function public.enforce_meta_write_operations_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  camp_user uuid;
  camp_client uuid;
begin
  select c.user_id, c.client_id
    into camp_user, camp_client
  from public.campaigns c
  where c.id = new.ally_campaign_id;

  if camp_user is null then
    raise exception 'meta_write_operations ally_campaign_id not found';
  end if;
  if camp_user is distinct from new.user_id then
    raise exception 'meta_write_operations user mismatch';
  end if;
  if camp_client is null or camp_client is distinct from new.client_id then
    raise exception 'meta_write_operations client mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_meta_write_operations_ownership
  on public.meta_write_operations;
create trigger trg_enforce_meta_write_operations_ownership
  before insert or update of user_id, client_id, ally_campaign_id
  on public.meta_write_operations
  for each row
  execute function public.enforce_meta_write_operations_ownership();

-- Browser cannot insert/update/delete — service role only.
create or replace function public.enforce_meta_write_operations_server_writes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'meta_write_operations writes are server-only';
  end if;
  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id then
      raise exception 'meta_write_operations.user_id is immutable';
    end if;
    if new.client_id is distinct from old.client_id then
      raise exception 'meta_write_operations.client_id is immutable';
    end if;
    if new.ally_campaign_id is distinct from old.ally_campaign_id then
      raise exception 'meta_write_operations.ally_campaign_id is immutable';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_enforce_meta_write_operations_server_writes
  on public.meta_write_operations;
create trigger trg_enforce_meta_write_operations_server_writes
  before insert or update or delete on public.meta_write_operations
  for each row
  execute function public.enforce_meta_write_operations_server_writes();

alter table public.meta_write_operations enable row level security;

revoke all on table public.meta_write_operations from anon;
revoke all on table public.meta_write_operations from public;
revoke all on table public.meta_write_operations from authenticated;

grant select (
  id,
  user_id,
  client_id,
  ally_campaign_id,
  operation_type,
  payload_fingerprint,
  idempotency_key,
  state,
  safe_payload_summary,
  meta_campaign_id,
  meta_adset_id,
  meta_creative_id,
  meta_ad_id,
  error_category,
  error_safe_message,
  confirmed_at,
  started_at,
  completed_at,
  created_at,
  updated_at
) on table public.meta_write_operations to authenticated;

drop policy if exists "meta_write_operations_select_own" on public.meta_write_operations;
create policy "meta_write_operations_select_own"
  on public.meta_write_operations
  for select
  to authenticated
  using (user_id = auth.uid());

comment on table public.meta_write_operations is
  'M11A — Meta write operation audit / idempotency. No tokens. Creates are future; M11A.1 dry-run preview logs only.';
