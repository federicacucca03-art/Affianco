-- ============================================================
-- DEV ONLY — NOT FOR PRODUCTION
-- ============================================================
-- Policy anon/authenticated aperte per MVP locale Affianco.
-- Chiunque abbia la publishable key può SELECT/INSERT/UPDATE.
--
-- NON eseguire su ambienti di produzione.
-- Conflitto con P3: supabase/migrations/20260826_p3_ownership_rls.sql
-- (ownership + RLS owner-only + approval RPC).
-- Auth + RLS restrittive + token approval = P3/P4.
-- ============================================================

grant select, insert, update on public.clients to anon, authenticated;
grant select, insert, update on public.campaigns to anon, authenticated;
grant select, insert on public.campaign_logs to anon, authenticated;

alter table public.clients enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_logs enable row level security;

drop policy if exists "clients_dev_all_anon" on public.clients;
create policy "clients_dev_all_anon"
  on public.clients for all to anon, authenticated
  using (true) with check (true);

drop policy if exists "campaigns_dev_all_anon" on public.campaigns;
create policy "campaigns_dev_all_anon"
  on public.campaigns for all to anon, authenticated
  using (true) with check (true);

drop policy if exists "campaign_logs_select_anon" on public.campaign_logs;
create policy "campaign_logs_select_anon"
  on public.campaign_logs for select to anon, authenticated
  using (true);

drop policy if exists "campaign_logs_insert_anon" on public.campaign_logs;
create policy "campaign_logs_insert_anon"
  on public.campaign_logs for insert to anon, authenticated
  with check (true);
