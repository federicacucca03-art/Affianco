-- ============================================================
-- P6 — Approve log idempotency (token RPC)
-- ============================================================
-- Se status è già APPROVED: non aggiornare approved_at, non inserire
-- un secondo log APPROVED.
-- APPROVED → REVISION_REQUESTED → APPROVED: nuovo log consentito.
-- ============================================================

create or replace function public.approve_campaign_public_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_id uuid;
  v_status text;
  v_approved_at timestamptz;
  result jsonb;
begin
  v_token := nullif(trim(both from coalesce(p_token, '')), '');
  if v_token is null then
    raise exception 'approval token required';
  end if;

  select c.id, c.status, c.approved_at
  into v_id, v_status, v_approved_at
  from public.campaigns c
  where c.approval_token = v_token;

  if v_id is null then
    raise exception 'campaign not found';
  end if;

  -- Idempotente: già APPROVED → nessun update, nessun log duplicato.
  if upper(coalesce(v_status, '')) = 'APPROVED' then
    result := jsonb_build_object(
      'id', v_id,
      'status', 'APPROVED',
      'approved_at', coalesce(v_approved_at, now())
    );
    return result;
  end if;

  v_approved_at := now();

  update public.campaigns c
  set
    status = 'APPROVED',
    approved_at = v_approved_at
  where c.id = v_id
    and c.approval_token = v_token;

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

revoke all on function public.approve_campaign_public_token(text) from public;
grant execute on function public.approve_campaign_public_token(text)
  to anon, authenticated;
