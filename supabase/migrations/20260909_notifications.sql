-- ============================================================
-- M7B.2 — Notification persistence + monitoring snapshots
-- ============================================================
-- Idempotente / non distruttivo. Nessun DROP TABLE.
-- NON applicare in produzione da questo slice in automatico.
--
-- Creation: service role only.
-- Authenticated: SELECT + UPDATE (read/dismiss fields only).
-- Anon: nessun accesso.
-- Nessun payload Meta grezzo. Nessun contenuto AI.
-- ============================================================

-- ---------- 1. notifications ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  source text not null
    check (source in ('NATIVE', 'META')),
  campaign_id uuid references public.campaigns (id) on delete set null,
  meta_campaign_id uuid references public.meta_campaigns (id) on delete set null,
  notification_type text not null
    check (
      notification_type in (
        'PERFORMANCE_DROPPED',
        'CRITICAL_STATE',
        'RECOVERED',
        'CONFIGURATION_REQUIRED',
        'DATA_STALE',
        'CLIENT_REVISION'
      )
    ),
  severity text not null
    check (severity in ('HIGH', 'MEDIUM', 'LOW')),
  reason_code text not null,
  title text not null,
  message text not null,
  dedupe_key text not null,
  recommended_href text,
  cta_label text,
  client_name text,
  campaign_name text,
  is_read boolean not null default false,
  is_dismissed boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  dismissed_at timestamptz,
  constraint notifications_identity_chk check (
    (
      source = 'NATIVE'
      and campaign_id is not null
      and meta_campaign_id is null
    )
    or (
      source = 'META'
      and meta_campaign_id is not null
      and campaign_id is null
    )
  ),
  constraint notifications_user_dedupe_unique unique (user_id, dedupe_key)
);

create index if not exists notifications_user_inbox_idx
  on public.notifications (user_id, is_dismissed, is_read, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where is_read = false and is_dismissed = false;

-- ---------- 2. notification_monitoring_state ----------
create table if not exists public.notification_monitoring_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  source text not null
    check (source in ('NATIVE', 'META')),
  campaign_id uuid references public.campaigns (id) on delete cascade,
  meta_campaign_id uuid references public.meta_campaigns (id) on delete cascade,
  attention_state text not null,
  urgency_level text not null,
  health text,
  trend text,
  freshness text,
  campaign_status text,
  health_availability text,
  configuration_kind text,
  results_count numeric,
  suppressed_by_link boolean not null default false,
  href text,
  updated_at timestamptz not null default now(),
  constraint notification_monitoring_state_identity_chk check (
    (
      source = 'NATIVE'
      and campaign_id is not null
      and meta_campaign_id is null
    )
    or (
      source = 'META'
      and meta_campaign_id is not null
      and campaign_id is null
    )
  )
);

create unique index if not exists notification_monitoring_state_native_uidx
  on public.notification_monitoring_state (user_id, campaign_id)
  where source = 'NATIVE';

create unique index if not exists notification_monitoring_state_meta_uidx
  on public.notification_monitoring_state (user_id, meta_campaign_id)
  where source = 'META';

create or replace function public.touch_notification_monitoring_state_updated_at()
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

drop trigger if exists trg_touch_notification_monitoring_state_updated_at
  on public.notification_monitoring_state;
create trigger trg_touch_notification_monitoring_state_updated_at
  before update on public.notification_monitoring_state
  for each row
  execute function public.touch_notification_monitoring_state_updated_at();

-- ---------- 3. Server-only creation for notifications ----------
create or replace function public.enforce_notifications_server_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text;
  owner_id uuid;
  row_client uuid;
begin
  jwt_role := coalesce(auth.role(), '');

  if tg_op = 'INSERT' then
    if jwt_role in ('authenticated', 'anon') then
      raise exception 'notifications inserts are server-only';
    end if;

    if new.client_id is not null then
      select c.user_id into owner_id
      from public.clients c
      where c.id = new.client_id;
      if owner_id is null then
        raise exception 'notifications.client_id not found';
      end if;
      if owner_id is distinct from new.user_id then
        raise exception 'notifications.client_id ownership mismatch';
      end if;
    end if;

    if new.source = 'NATIVE' then
      select c.user_id, c.client_id into owner_id, row_client
      from public.campaigns c
      where c.id = new.campaign_id;
      if owner_id is null or owner_id is distinct from new.user_id then
        raise exception 'notifications.campaign_id ownership mismatch';
      end if;
      if new.client_id is not null
         and row_client is not null
         and new.client_id is distinct from row_client then
        raise exception 'notifications.client_id must match campaigns.client_id';
      end if;
    end if;

    if new.source = 'META' then
      select m.user_id, m.client_id into owner_id, row_client
      from public.meta_campaigns m
      where m.id = new.meta_campaign_id;
      if owner_id is null or owner_id is distinct from new.user_id then
        raise exception 'notifications.meta_campaign_id ownership mismatch';
      end if;
      if new.client_id is not null
         and new.client_id is distinct from row_client then
        raise exception 'notifications.client_id must match meta_campaigns.client_id';
      end if;
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    if jwt_role in ('authenticated', 'anon') then
      if new.user_id is distinct from old.user_id
         or new.client_id is distinct from old.client_id
         or new.source is distinct from old.source
         or new.campaign_id is distinct from old.campaign_id
         or new.meta_campaign_id is distinct from old.meta_campaign_id
         or new.notification_type is distinct from old.notification_type
         or new.severity is distinct from old.severity
         or new.reason_code is distinct from old.reason_code
         or new.title is distinct from old.title
         or new.message is distinct from old.message
         or new.dedupe_key is distinct from old.dedupe_key
         or new.recommended_href is distinct from old.recommended_href
         or new.cta_label is distinct from old.cta_label
         or new.client_name is distinct from old.client_name
         or new.campaign_name is distinct from old.campaign_name
         or new.created_at is distinct from old.created_at then
        raise exception 'notifications update may only change read/dismiss fields';
      end if;
      if auth.uid() is null or auth.uid() is distinct from old.user_id then
        raise exception 'notifications update requires owner';
      end if;
    end if;

    if new.user_id is distinct from old.user_id then
      raise exception 'notifications.user_id is immutable';
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    if jwt_role in ('authenticated', 'anon') then
      raise exception 'notifications deletes are not allowed from clients';
    end if;
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_notifications_server_insert on public.notifications;
create trigger trg_enforce_notifications_server_insert
  before insert or update or delete on public.notifications
  for each row
  execute function public.enforce_notifications_server_insert();

-- ---------- 4. Monitoring state: server-only entirely ----------
create or replace function public.enforce_notification_monitoring_state_server_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text;
  owner_id uuid;
  row_client uuid;
begin
  jwt_role := coalesce(auth.role(), '');
  if jwt_role in ('authenticated', 'anon') then
    raise exception 'notification_monitoring_state writes are server-only';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    raise exception 'notification_monitoring_state.user_id is immutable';
  end if;

  if new.client_id is not null then
    select c.user_id into owner_id from public.clients c where c.id = new.client_id;
    if owner_id is null or owner_id is distinct from new.user_id then
      raise exception 'notification_monitoring_state.client_id ownership mismatch';
    end if;
  end if;

  if new.source = 'NATIVE' then
    select c.user_id, c.client_id into owner_id, row_client
    from public.campaigns c
    where c.id = new.campaign_id;
    if owner_id is null or owner_id is distinct from new.user_id then
      raise exception 'notification_monitoring_state.campaign_id ownership mismatch';
    end if;
    if new.client_id is not null
       and row_client is not null
       and new.client_id is distinct from row_client then
      raise exception 'notification_monitoring_state.client_id must match campaigns.client_id';
    end if;
  end if;

  if new.source = 'META' then
    select m.user_id, m.client_id into owner_id, row_client
    from public.meta_campaigns m
    where m.id = new.meta_campaign_id;
    if owner_id is null or owner_id is distinct from new.user_id then
      raise exception 'notification_monitoring_state.meta_campaign_id ownership mismatch';
    end if;
    if new.client_id is not null
       and new.client_id is distinct from row_client then
      raise exception 'notification_monitoring_state.client_id must match meta_campaigns.client_id';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_notification_monitoring_state_server_only
  on public.notification_monitoring_state;
create trigger trg_enforce_notification_monitoring_state_server_only
  before insert or update or delete on public.notification_monitoring_state
  for each row
  execute function public.enforce_notification_monitoring_state_server_only();

-- ---------- 5. RLS / grants ----------
alter table public.notifications enable row level security;
alter table public.notification_monitoring_state enable row level security;

revoke all on table public.notifications from anon;
revoke all on table public.notifications from public;
revoke all on table public.notification_monitoring_state from anon;
revoke all on table public.notification_monitoring_state from public;
revoke all on table public.notification_monitoring_state from authenticated;

grant select, update on table public.notifications to authenticated;
revoke insert, delete on table public.notifications from authenticated;
-- No grants for authenticated on notification_monitoring_state (select/write).

drop policy if exists "notifications_select_own" on public.notifications;
drop policy if exists "notifications_update_own" on public.notifications;

create policy "notifications_select_own"
  on public.notifications
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "notifications_update_own"
  on public.notifications
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

comment on table public.notifications is
  'M7B.2 in-app notification inbox. Created server-side only; users may read/dismiss.';
comment on table public.notification_monitoring_state is
  'Compact previous canonical monitoring snapshot for M7B.1 transition evaluation. Server-only.';
