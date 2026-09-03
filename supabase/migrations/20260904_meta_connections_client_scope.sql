-- ============================================================
-- M2C.1 — meta_connections scoped by user + client
-- ============================================================
-- Idempotente / non distruttivo. Nessun DROP TABLE.
-- NON applicare in produzione da questo slice in automatico.
--
-- Legacy M2B.2: la riga esistente resta con client_id NULL.
-- UNIQUE(user_id) viene rimosso. Nuove righe usano UNIQUE(user_id, client_id).
-- Al massimo una riga unassigned (client_id NULL) per utente.
-- ============================================================

alter table public.meta_connections
  add column if not exists client_id uuid references public.clients (id) on delete cascade;

alter table public.meta_connections
  drop constraint if exists meta_connections_user_unique;

alter table public.meta_connections
  drop constraint if exists meta_connections_user_client_unique;

alter table public.meta_connections
  add constraint meta_connections_user_client_unique unique (user_id, client_id);

create unique index if not exists meta_connections_user_legacy_unassigned_uidx
  on public.meta_connections (user_id)
  where client_id is null;

create index if not exists meta_connections_client_id_idx
  on public.meta_connections (client_id);

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
  if tg_op = 'UPDATE' and new.client_id is distinct from old.client_id then
    raise exception 'meta_connections.client_id is immutable';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_client_ad_accounts_connection_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  conn_user uuid;
  conn_client uuid;
begin
  select c.user_id, c.client_id
    into conn_user, conn_client
  from public.meta_connections c
  where c.id = new.meta_connection_id;

  if conn_user is null then
    raise exception 'client_ad_accounts.meta_connection_id not found';
  end if;
  if conn_user is distinct from new.user_id then
    raise exception 'client_ad_accounts connection user mismatch';
  end if;
  if conn_client is null or conn_client is distinct from new.client_id then
    raise exception 'client_ad_accounts connection client mismatch';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_client_ad_accounts_connection_scope on public.client_ad_accounts;
create trigger trg_enforce_client_ad_accounts_connection_scope
  before insert or update on public.client_ad_accounts
  for each row
  execute function public.enforce_client_ad_accounts_connection_scope();

revoke all on table public.meta_connections from authenticated;
grant select (
  id,
  user_id,
  client_id,
  meta_user_id,
  token_expires_at,
  scopes,
  status,
  token_type,
  created_at,
  updated_at
) on table public.meta_connections to authenticated;

comment on column public.meta_connections.client_id is
  'Cliente Affianco. NULL solo per connessione legacy M2B.2 non assegnata.';
comment on table public.meta_connections is
  'Una connessione Meta per coppia utente+cliente. Token solo cifrato; write via service role. client_id NULL = legacy unassigned.';
