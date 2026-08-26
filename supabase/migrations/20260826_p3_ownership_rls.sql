-- ============================================================
-- P3 — Ownership + RLS produzione + approval RPC
-- ============================================================
-- Idempotente / non distruttivo. Nessun DROP TABLE.
--
-- CUTOVER (obbligatorio):
--   1) Deploy codice app (RPC dual-path) su Vercel
--   2) Solo dopo deploy OK → eseguire QUESTO SQL in Dashboard
--   3) Smoke immediato
--
-- NON rieseguire supabase/dev/setup-dev-rls.sql in produzione.
--
-- SICUREZZA RESIDUA (P1 fino a P4):
--   UUID campagna = capability approval pubblica (temporaneo).
--   P4 sostituirà con approval token.
-- ============================================================

-- ---------- 1. Ownership columns (nullable = legacy) ----------
alter table public.clients
  add column if not exists user_id uuid references auth.users (id) on delete restrict;

alter table public.campaigns
  add column if not exists user_id uuid references auth.users (id) on delete restrict;

create index if not exists clients_user_id_idx
  on public.clients (user_id);

create index if not exists clients_user_id_lower_name_idx
  on public.clients (user_id, lower(name));

create index if not exists campaigns_user_id_idx
  on public.campaigns (user_id);

create index if not exists campaigns_user_id_created_at_idx
  on public.campaigns (user_id, created_at desc);

-- ---------- 2. Anti-spoofing / immutability triggers ----------
create or replace function public.enforce_clients_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null then
      raise exception 'clients insert requires authenticated user';
    end if;
    if new.user_id is null then
      new.user_id := auth.uid();
    elsif new.user_id is distinct from auth.uid() then
      raise exception 'clients.user_id must equal auth.uid()';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id then
      raise exception 'clients.user_id is immutable';
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_clients_user_id on public.clients;
create trigger trg_enforce_clients_user_id
  before insert or update on public.clients
  for each row
  execute function public.enforce_clients_user_id();

create or replace function public.enforce_campaigns_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null then
      raise exception 'campaigns insert requires authenticated user';
    end if;
    if new.user_id is null then
      new.user_id := auth.uid();
    elsif new.user_id is distinct from auth.uid() then
      raise exception 'campaigns.user_id must equal auth.uid()';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id then
      raise exception 'campaigns.user_id is immutable';
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_campaigns_user_id on public.campaigns;
create trigger trg_enforce_campaigns_user_id
  before insert or update on public.campaigns
  for each row
  execute function public.enforce_campaigns_user_id();

-- ---------- 3. Drop DEV policies ----------
drop policy if exists "clients_dev_all_anon" on public.clients;
drop policy if exists "campaigns_dev_all_anon" on public.campaigns;
drop policy if exists "campaign_logs_select_anon" on public.campaign_logs;
drop policy if exists "campaign_logs_insert_anon" on public.campaign_logs;

-- Drop P3 policies if re-run
drop policy if exists "clients_select_own" on public.clients;
drop policy if exists "clients_insert_own" on public.clients;
drop policy if exists "clients_update_own" on public.clients;
drop policy if exists "campaigns_select_own" on public.campaigns;
drop policy if exists "campaigns_insert_own" on public.campaigns;
drop policy if exists "campaigns_update_own" on public.campaigns;
drop policy if exists "campaign_logs_select_own" on public.campaign_logs;
drop policy if exists "campaign_logs_insert_own" on public.campaign_logs;

alter table public.clients enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_logs enable row level security;

-- ---------- 4. Grants: no anon table access ----------
revoke all on table public.clients from anon;
revoke all on table public.campaigns from anon;
revoke all on table public.campaign_logs from anon;

grant select, insert, update on table public.clients to authenticated;
grant select, insert, update on table public.campaigns to authenticated;
grant select, insert on table public.campaign_logs to authenticated;

-- ---------- 5. RLS clients (owner-only) ----------
create policy "clients_select_own"
  on public.clients
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "clients_insert_own"
  on public.clients
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "clients_update_own"
  on public.clients
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------- 6. RLS campaigns (owner-only) ----------
create policy "campaigns_select_own"
  on public.campaigns
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "campaigns_insert_own"
  on public.campaigns
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "campaigns_update_own"
  on public.campaigns
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------- 7. RLS campaign_logs (via campaigns ownership) ----------
create policy "campaign_logs_select_own"
  on public.campaign_logs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.campaigns c
      where c.id = campaign_id
        and c.user_id = auth.uid()
    )
  );

create policy "campaign_logs_insert_own"
  on public.campaign_logs
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.campaigns c
      where c.id = campaign_id
        and c.user_id = auth.uid()
    )
  );

-- ---------- 8. Approval RPCs (SECURITY DEFINER, search_path fixed) ----------
-- UUID campagna = capability temporanea fino a P4 approval token.

create or replace function public.get_campaign_for_public_approval(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if p_id is null then
    return null;
  end if;

  select jsonb_build_object(
    'id', c.id,
    'status', c.status,
    'daily_budget', c.daily_budget,
    'objective', c.objective,
    'max_sustainable_cpa', c.max_sustainable_cpa,
    'target_margin', c.target_margin,
    'average_order_value', c.average_order_value,
    'average_receipt', c.average_receipt,
    'store_margin', c.store_margin,
    'recovery_value', c.recovery_value,
    'recovery_margin', c.recovery_margin,
    'recovery_discount', c.recovery_discount,
    'launch_budget', c.launch_budget,
    'estimated_cpm', c.estimated_cpm,
    'awareness_radius_km', c.awareness_radius_km,
    'raggio_km', c.raggio_km,
    'booking_service_value', c.booking_service_value,
    'show_up_rate', c.show_up_rate,
    'booking_channel', c.booking_channel,
    'variante_a', c.variante_a,
    'variante_b', c.variante_b,
    'variante_c', c.variante_c,
    'titolo_annuncio', c.titolo_annuncio,
    'approved_at', c.approved_at,
    'revision_notes', c.revision_notes,
    'clients', case
      when cl.id is null then null
      else jsonb_build_object(
        'id', cl.id,
        'name', cl.name,
        'elevator_pitch', cl.elevator_pitch,
        'average_ticket_value', cl.average_ticket_value,
        'closing_rate', cl.closing_rate,
        'website', cl.website
      )
    end
  )
  into result
  from public.campaigns c
  left join public.clients cl on cl.id = c.client_id
  where c.id = p_id;

  return result;
end;
$$;

create or replace function public.approve_campaign_public(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  v_approved_at timestamptz;
  v_id uuid;
begin
  if p_id is null then
    raise exception 'campaign id required';
  end if;

  v_approved_at := now();

  update public.campaigns c
  set
    status = 'APPROVED',
    approved_at = v_approved_at
  where c.id = p_id
  returning c.id into v_id;

  if v_id is null then
    raise exception 'campaign not found';
  end if;

  insert into public.campaign_logs (campaign_id, event_type, title, description)
  values (
    p_id,
    'APPROVED',
    'Approvazione cliente',
    'Approvazione ricevuta dal cliente via link /approvazione/[id]'
  );

  result := jsonb_build_object(
    'id', p_id,
    'status', 'APPROVED',
    'approved_at', v_approved_at
  );
  return result;
end;
$$;

create or replace function public.request_campaign_revision_public(
  p_id uuid,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notes text;
  v_id uuid;
  result jsonb;
begin
  if p_id is null then
    raise exception 'campaign id required';
  end if;

  v_notes := trim(both from coalesce(p_notes, ''));
  if v_notes = '' then
    raise exception 'revision notes required';
  end if;
  if v_notes = 'Nessuna nota aggiuntiva fornita.' then
    raise exception 'revision notes required';
  end if;

  update public.campaigns c
  set
    status = 'REVISION_REQUESTED',
    revision_notes = v_notes
  where c.id = p_id
  returning c.id into v_id;

  if v_id is null then
    raise exception 'campaign not found';
  end if;

  result := jsonb_build_object(
    'id', p_id,
    'status', 'REVISION_REQUESTED',
    'revision_notes', v_notes
  );
  return result;
end;
$$;

revoke all on function public.get_campaign_for_public_approval(uuid) from public;
revoke all on function public.approve_campaign_public(uuid) from public;
revoke all on function public.request_campaign_revision_public(uuid, text) from public;

grant execute on function public.get_campaign_for_public_approval(uuid)
  to anon, authenticated;
grant execute on function public.approve_campaign_public(uuid)
  to anon, authenticated;
grant execute on function public.request_campaign_revision_public(uuid, text)
  to anon, authenticated;

-- ---------- 9. Legacy count (solo report — non assegnare) ----------
-- Eseguire separatamente prima del cutover:
--
-- select 'clients' as tabella,
--        count(*) filter (where user_id is null) as user_id_null,
--        count(*) as totale
-- from public.clients
-- union all
-- select 'campaigns',
--        count(*) filter (where user_id is null),
--        count(*)
-- from public.campaigns;
--
-- Assegnazione manuale (esempio, NON eseguire alla cieca):
-- update public.campaigns set user_id = '<auth-user-uuid>' where id = '<campaign-uuid>';
-- update public.clients set user_id = '<auth-user-uuid>' where id = '<client-uuid>';
