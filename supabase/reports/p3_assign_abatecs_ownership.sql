-- ============================================================
-- P3 POST-MIGRATION — ownership Abatecs (PREPARATA, NON ESEGUIRE ora)
-- ============================================================
-- Eseguire SOLO DOPO aver applicato 20260826_p3_ownership_rls.sql
-- e SOLO dopo aver sostituito <MY_AUTH_USER_UUID> con il tuo auth.users.id.
--
-- Conservare:
--   Abatecs - Pellicole e Rivestimenti - Luglio 2026
-- Non assegnare (restano user_id NULL):
--   T2 Smoke REVISION API
--   T2 Smoke LEADS API Create
--   zzz - Richieste Contatto - Agosto 2026
-- ============================================================

-- 0) Trova il tuo user id (Authentication → Users, oppure):
-- select id, email, created_at from auth.users order by created_at desc;

-- 1) VERIFICA campagna + client (nessun UPDATE)
select
  c.id as campaign_id,
  c.name as campaign_name,
  c.user_id as campaign_user_id,
  c.client_id,
  cl.name as client_name,
  cl.user_id as client_user_id
from public.campaigns c
left join public.clients cl on cl.id = c.client_id
where c.name = 'Abatecs - Pellicole e Rivestimenti - Luglio 2026';

-- 2) Assegnazione (sostituisci placeholder, poi decommenta)
-- begin;
--
-- update public.campaigns
-- set user_id = '<MY_AUTH_USER_UUID>'::uuid
-- where name = 'Abatecs - Pellicole e Rivestimenti - Luglio 2026'
--   and user_id is null;
--
-- update public.clients cl
-- set user_id = '<MY_AUTH_USER_UUID>'::uuid
-- where cl.id = (
--   select c.client_id
--   from public.campaigns c
--   where c.name = 'Abatecs - Pellicole e Rivestimenti - Luglio 2026'
--   limit 1
-- )
--   and cl.user_id is null;
--
-- -- Verifica post-update
-- select
--   c.id as campaign_id,
--   c.name,
--   c.user_id as campaign_user_id,
--   cl.id as client_id,
--   cl.name as client_name,
--   cl.user_id as client_user_id
-- from public.campaigns c
-- left join public.clients cl on cl.id = c.client_id
-- where c.name = 'Abatecs - Pellicole e Rivestimenti - Luglio 2026';
--
-- commit;
