-- ============================================================
-- Results V3 — campaign_checks (weekly control room)
-- ============================================================
-- Idempotente / non distruttivo. Nessun DROP TABLE.
-- NON applicare in produzione da questo slice: solo file in repo.
-- ============================================================

create table if not exists public.campaign_checks (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  days_active integer,
  spend numeric,
  results_count numeric,
  primary_cost numeric,
  ctr numeric,
  cpm numeric,
  cpc numeric,
  frequency numeric,
  roas numeric,
  health_status text not null,
  signal text,
  actions jsonb,
  note text,
  objective text,
  threshold numeric,
  threshold_mode text,
  source text not null,
  constraint campaign_checks_health_status_chk
    check (health_status in ('GREEN', 'YELLOW', 'RED', 'INSUFFICIENT')),
  constraint campaign_checks_source_chk
    check (source in ('MANUAL', 'SCREENSHOT', 'CSV')),
  constraint campaign_checks_threshold_mode_chk
    check (
      threshold_mode is null
      or threshold_mode in ('BREAK_EVEN', 'EFFICIENCY', 'OTHER')
    )
);

create index if not exists campaign_checks_campaign_id_idx
  on public.campaign_checks (campaign_id);

create index if not exists campaign_checks_user_id_idx
  on public.campaign_checks (user_id);

create index if not exists campaign_checks_created_at_idx
  on public.campaign_checks (created_at desc);

create index if not exists campaign_checks_campaign_created_idx
  on public.campaign_checks (campaign_id, created_at desc);

-- ---------- Anti-spoof / immutability ----------
create or replace function public.enforce_campaign_checks_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null then
      raise exception 'campaign_checks insert requires authenticated user';
    end if;
    if new.user_id is null then
      new.user_id := auth.uid();
    elsif new.user_id is distinct from auth.uid() then
      raise exception 'campaign_checks.user_id must equal auth.uid()';
    end if;
    if not exists (
      select 1
      from public.campaigns c
      where c.id = new.campaign_id
        and c.user_id = auth.uid()
    ) then
      raise exception 'campaign_checks.campaign_id must belong to auth.uid()';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id then
      raise exception 'campaign_checks.user_id is immutable';
    end if;
    if new.campaign_id is distinct from old.campaign_id then
      raise exception 'campaign_checks.campaign_id is immutable';
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_campaign_checks_user_id on public.campaign_checks;
create trigger trg_enforce_campaign_checks_user_id
  before insert or update on public.campaign_checks
  for each row
  execute function public.enforce_campaign_checks_user_id();

alter table public.campaign_checks enable row level security;

revoke all on table public.campaign_checks from anon;
revoke all on table public.campaign_checks from public;

grant select, insert, update, delete on table public.campaign_checks
  to authenticated;

drop policy if exists "campaign_checks_select_own" on public.campaign_checks;
drop policy if exists "campaign_checks_insert_own" on public.campaign_checks;
drop policy if exists "campaign_checks_update_own" on public.campaign_checks;
drop policy if exists "campaign_checks_delete_own" on public.campaign_checks;

create policy "campaign_checks_select_own"
  on public.campaign_checks
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.campaigns c
      where c.id = campaign_id
        and c.user_id = auth.uid()
    )
  );

create policy "campaign_checks_insert_own"
  on public.campaign_checks
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.campaigns c
      where c.id = campaign_id
        and c.user_id = auth.uid()
    )
  );

create policy "campaign_checks_update_own"
  on public.campaign_checks
  for update
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.campaigns c
      where c.id = campaign_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.campaigns c
      where c.id = campaign_id
        and c.user_id = auth.uid()
    )
  );

create policy "campaign_checks_delete_own"
  on public.campaign_checks
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.campaigns c
      where c.id = campaign_id
        and c.user_id = auth.uid()
    )
  );
