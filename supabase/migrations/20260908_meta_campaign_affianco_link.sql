-- ============================================================
-- M5C — meta_campaigns.affianco_campaign_id (explicit native link)
-- ============================================================
-- Idempotente / non distruttivo. Nessun DROP TABLE.
-- NON applicare in produzione da questo slice in automatico.
-- Link opzionale, user-controlled. Nessun auto-match.
-- ON DELETE SET NULL: campagna Affianco cancellata → UNLINKED.
-- Write path: service role (trigger esistente). SELECT autenticato del FK.
-- ============================================================

alter table public.meta_campaigns
  add column if not exists affianco_campaign_id uuid null
    references public.campaigns (id)
    on delete set null;

create index if not exists meta_campaigns_affianco_campaign_id_idx
  on public.meta_campaigns (affianco_campaign_id)
  where affianco_campaign_id is not null;

-- Same user + same client. No uniqueness: more Meta rows may share one native.
create or replace function public.enforce_meta_campaigns_affianco_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  camp_user uuid;
  camp_client uuid;
begin
  if new.affianco_campaign_id is null then
    return new;
  end if;

  select c.user_id, c.client_id
    into camp_user, camp_client
  from public.campaigns c
  where c.id = new.affianco_campaign_id;

  if camp_user is null then
    raise exception 'meta_campaigns.affianco_campaign_id not found';
  end if;
  if camp_user is distinct from new.user_id then
    raise exception 'meta_campaigns affianco link user mismatch';
  end if;
  if camp_client is null or camp_client is distinct from new.client_id then
    raise exception 'meta_campaigns affianco link client mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_meta_campaigns_affianco_link on public.meta_campaigns;
create trigger trg_enforce_meta_campaigns_affianco_link
  before insert or update of affianco_campaign_id, user_id, client_id
  on public.meta_campaigns
  for each row
  execute function public.enforce_meta_campaigns_affianco_link();

grant select (affianco_campaign_id)
  on table public.meta_campaigns to authenticated;

comment on column public.meta_campaigns.affianco_campaign_id is
  'FK opzionale a public.campaigns. Impostata solo esplicitamente. ON DELETE SET NULL.';
