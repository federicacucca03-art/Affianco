-- ============================================================
-- P4 — Secure Approval Token (RPC token-based)
-- ============================================================
-- Idempotente / non distruttivo. Nessun DROP TABLE.
-- NON modifica RLS owner P3.
--
-- CUTOVER (obbligatorio):
--   1) Applicare QUESTO SQL (aggiunge token + nuove RPC; lascia vecchie RPC id)
--   2) Deploy codice P4 (link + page usano token; fallback UUID SOLO se RPC token assenti)
--   3) Smoke token path
--   4) Applicare 20260827_p4_revoke_uuid_approval_rpcs.sql
--   5) (opzionale) rimuovere fallback UUID dal codice in commit successivo
--
-- Token: 32 hex chars = 128 bit da gen_random_bytes(16).
-- UUID campagna NON è più capability dopo step 4.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- 1. Column + unique index ----------
alter table public.campaigns
  add column if not exists approval_token text;

-- Backfill solo per nuove: DEFAULT. Legacy restano NULL.
alter table public.campaigns
  alter column approval_token set default encode(gen_random_bytes(16), 'hex');

-- Unique tra token non-null (più legacy NULL ammessi)
create unique index if not exists campaigns_approval_token_uidx
  on public.campaigns (approval_token)
  where approval_token is not null;

-- ---------- 2. Token RPCs (public approval) ----------
-- Nessuna helper generate_approval_token() esposta:
-- DEFAULT e regenerate usano gen_random_bytes() inline (least privilege).
create or replace function public.get_campaign_for_public_approval_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  v_token text;
begin
  v_token := nullif(trim(both from coalesce(p_token, '')), '');
  if v_token is null then
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
  where c.approval_token = v_token;

  return result;
end;
$$;

create or replace function public.approve_campaign_public_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_id uuid;
  v_approved_at timestamptz;
  result jsonb;
begin
  v_token := nullif(trim(both from coalesce(p_token, '')), '');
  if v_token is null then
    raise exception 'approval token required';
  end if;

  v_approved_at := now();

  update public.campaigns c
  set
    status = 'APPROVED',
    approved_at = v_approved_at
  where c.approval_token = v_token
  returning c.id into v_id;

  if v_id is null then
    raise exception 'campaign not found';
  end if;

  insert into public.campaign_logs (campaign_id, event_type, title, description)
  values (
    v_id,
    'APPROVED',
    'Approvazione cliente',
    'Approvazione ricevuta dal cliente via link /approvazione/[token]'
  );

  result := jsonb_build_object(
    'id', v_id,
    'status', 'APPROVED',
    'approved_at', v_approved_at
  );
  return result;
end;
$$;

create or replace function public.request_campaign_revision_public_token(
  p_token text,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_notes text;
  v_id uuid;
  result jsonb;
begin
  v_token := nullif(trim(both from coalesce(p_token, '')), '');
  if v_token is null then
    raise exception 'approval token required';
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
  where c.approval_token = v_token
  returning c.id into v_id;

  if v_id is null then
    raise exception 'campaign not found';
  end if;

  result := jsonb_build_object(
    'id', v_id,
    'status', 'REVISION_REQUESTED',
    'revision_notes', v_notes
  );
  return result;
end;
$$;

-- ---------- 3. Owner-only token rotation ----------
create or replace function public.regenerate_campaign_approval_token(p_campaign_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_updated uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if p_campaign_id is null then
    raise exception 'campaign id required';
  end if;

  v_token := encode(extensions.gen_random_bytes(16), 'hex');

  update public.campaigns c
  set approval_token = v_token
  where c.id = p_campaign_id
    and c.user_id = auth.uid()
  returning c.id into v_updated;

  if v_updated is null then
    raise exception 'campaign not found or not owned';
  end if;

  return v_token;
end;
$$;

-- ---------- 4. Grants ----------
revoke all on function public.get_campaign_for_public_approval_token(text) from public;
revoke all on function public.approve_campaign_public_token(text) from public;
revoke all on function public.request_campaign_revision_public_token(text, text) from public;
revoke all on function public.regenerate_campaign_approval_token(uuid) from public;
revoke execute on function public.regenerate_campaign_approval_token(uuid) from anon;

grant execute on function public.get_campaign_for_public_approval_token(text)
  to anon, authenticated;
grant execute on function public.approve_campaign_public_token(text)
  to anon, authenticated;
grant execute on function public.request_campaign_revision_public_token(text, text)
  to anon, authenticated;
grant execute on function public.regenerate_campaign_approval_token(uuid)
  to authenticated;

-- Nota: le RPC P3 basate su p_id uuid restano attive fino a
-- supabase/migrations/20260827_p4_revoke_uuid_approval_rpcs.sql
