-- ============================================================
-- P4.0.1 — Fix regenerate_campaign_approval_token
-- ============================================================
-- Applicare DOPO 20260827_p4_approval_token.sql (già in prod).
-- NON applica revoke UUID.
--
-- Bug: SET search_path = public nasconde pgcrypto in schema
--      extensions → gen_random_bytes(integer) does not exist.
-- Fix: encode(extensions.gen_random_bytes(16), 'hex')
-- +    REVOKE EXECUTE FROM anon (hard deny privilegi).
-- ============================================================

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

revoke all on function public.regenerate_campaign_approval_token(uuid) from public;
revoke execute on function public.regenerate_campaign_approval_token(uuid) from anon;
grant execute on function public.regenerate_campaign_approval_token(uuid)
  to authenticated;
