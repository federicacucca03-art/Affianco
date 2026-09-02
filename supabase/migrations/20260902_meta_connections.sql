-- ============================================================
-- M2B.1 — meta_connections (OAuth token storage foundation)
-- ============================================================
-- Idempotente / non distruttivo. Nessun DROP TABLE.
-- NON applicare in produzione da questo slice in automatico.
-- Write path: solo service role (API server). Il client non inserisce token.
-- Il ciphertext non è il token in chiaro; la chiave vive in env, non in DB.
-- ============================================================

create table if not exists public.meta_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  meta_user_id text,
  access_token_encrypted text not null,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  status text not null default 'ACTIVE',
  token_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meta_connections_status_chk
    check (
      status in ('ACTIVE', 'EXPIRED', 'REVOKED', 'REAUTH_REQUIRED')
    ),
  constraint meta_connections_user_unique unique (user_id)
);

create index if not exists meta_connections_status_idx
  on public.meta_connections (status);

create or replace function public.touch_meta_connections_updated_at()
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

drop trigger if exists trg_touch_meta_connections_updated_at on public.meta_connections;
create trigger trg_touch_meta_connections_updated_at
  before update on public.meta_connections
  for each row
  execute function public.touch_meta_connections_updated_at();

-- Blocca INSERT/UPDATE/DELETE dal JWT utente (authenticated/anon).
-- Il service role (API) non usa quei ruoli: i write restano server-only.
create or replace function public.enforce_meta_connections_server_writes()
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
    raise exception 'meta_connections writes are server-only';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    raise exception 'meta_connections.user_id is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_meta_connections_server_writes on public.meta_connections;
create trigger trg_enforce_meta_connections_server_writes
  before insert or update or delete on public.meta_connections
  for each row
  execute function public.enforce_meta_connections_server_writes();

alter table public.meta_connections enable row level security;

revoke all on table public.meta_connections from anon;
revoke all on table public.meta_connections from public;
revoke all on table public.meta_connections from authenticated;

-- PostgreSQL: un GRANT SELECT a livello tabella include tutte le colonne.
-- REVOKE SELECT (colonna) NON toglie il privilegio se era stato concesso
-- a livello tabella. Servono GRANT espliciti sulle sole colonne sicure.
grant select (
  id,
  user_id,
  meta_user_id,
  token_expires_at,
  scopes,
  status,
  token_type,
  created_at,
  updated_at
) on table public.meta_connections to authenticated;

drop policy if exists "meta_connections_select_own" on public.meta_connections;

create policy "meta_connections_select_own"
  on public.meta_connections
  for select
  to authenticated
  using (user_id = auth.uid());

comment on table public.meta_connections is
  'Una connessione Meta per utente Affianco. Token solo cifrato; write via service role.';
