-- ============================================================
-- P4.1 — Revoca RPC approval basate su campaign UUID
-- ============================================================
-- Applicare SOLO DOPO:
--   1) 20260827_p4_approval_token.sql
--   2) Deploy codice P4 su Vercel
--   3) Smoke token path OK
--
-- Dopo questo file, /approvazione/[campaign_id] NON è più capability.
-- ============================================================

drop function if exists public.get_campaign_for_public_approval(uuid);
drop function if exists public.approve_campaign_public(uuid);
drop function if exists public.request_campaign_revision_public(uuid, text);
