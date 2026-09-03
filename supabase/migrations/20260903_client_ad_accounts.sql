-- ============================================================
-- M2C — client_ad_accounts (Meta ad account ↔ Affianco client)
-- ============================================================
-- Idempotente / non distruttivo. Nessun DROP TABLE.
-- NON applicare in produzione da questo slice in automatico.
-- MVP: un account Meta per cliente Affianco (UNIQUE user_id, client_id).
-- Write path: service role. SELECT autenticato solo metadati mapping.
-- ============================================================

create table if not exists public.client_ad_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  meta_connection_id uuid not null references public.meta_connections (id) on delete cascade,
  meta_ad_account_id text not null,
  meta_ad_account_name text,
  meta_account_id text,
  currency text,
  timezone_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_ad_accounts_user_client_unique unique (user_id, client_id)
);

create index if not exists client_ad_accounts_user_id_idx
  on public.client_ad_accounts (user_id);

create index if not exists client_ad_accounts_client_id_idx
  on public.client_ad_accounts (client_id);

create or replace function public.touch_client_ad_accounts_updated_at()
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

drop trigger if exists trg_touch_client_ad_accounts_updated_at on public.client_ad_accounts;
create trigger trg_touch_client_ad_accounts_updated_at
  before update on public.client_ad_accounts
  for each row
  execute function public.touch_client_ad_accounts_updated_at();

create or replace function public.enforce_client_ad_accounts_server_writes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text;
begin
  jwt_role := coalesce(auth.role(), '');
  if jwt_role in ('authenticated', 'anon') then
    raise exception 'client_ad_accounts writes are server-only';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    raise exception 'client_ad_accounts.user_id is immutable';
  end if;
  if tg_op = 'UPDATE' and new.client_id is distinct from old.client_id then
    raise exception 'client_ad_accounts.client_id is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_client_ad_accounts_server_writes on public.client_ad_accounts;
create trigger trg_enforce_client_ad_accounts_server_writes
  before insert or update or delete on public.client_ad_accounts
  for each row
  execute function public.enforce_client_ad_accounts_server_writes();

alter table public.client_ad_accounts enable row level security;

revoke all on table public.client_ad_accounts from anon;
revoke all on table public.client_ad_accounts from public;
revoke all on table public.client_ad_accounts from authenticated;

grant select (
  id,
  user_id,
  client_id,
  meta_connection_id,
  meta_ad_account_id,
  meta_ad_account_name,
  meta_account_id,
  currency,
  timezone_name,
  created_at,
  updated_at
) on table public.client_ad_accounts to authenticated;

drop policy if exists "client_ad_accounts_select_own" on public.client_ad_accounts;

create policy "client_ad_accounts_select_own"
  on public.client_ad_accounts
  for select
  to authenticated
  using (user_id = auth.uid());

comment on table public.client_ad_accounts is
  'Un account pubblicitario Meta per cliente Affianco. Write via service role.';
