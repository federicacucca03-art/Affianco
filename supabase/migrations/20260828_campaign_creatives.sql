-- Creatività campagna persistite per portale approval pubblico.
-- Bucket PRIVATO: lettura solo owner autenticato o signed URL server-side.

alter table public.campaigns
  add column if not exists creativita jsonb not null default '[]'::jsonb;

insert into storage.buckets (id, name, public)
values ('campaign-creatives', 'campaign-creatives', false)
on conflict (id) do update set public = false;

-- Owner può leggere solo i propri oggetti.
drop policy if exists "campaign_creatives_owner_select" on storage.objects;
create policy "campaign_creatives_owner_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'campaign-creatives'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "campaign_creatives_auth_insert" on storage.objects;
create policy "campaign_creatives_auth_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'campaign-creatives'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "campaign_creatives_auth_update" on storage.objects;
create policy "campaign_creatives_auth_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'campaign-creatives'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "campaign_creatives_auth_delete" on storage.objects;
create policy "campaign_creatives_auth_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'campaign-creatives'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Rimuove policy public read legacy se presente da bozza precedente.
drop policy if exists "campaign_creatives_public_read" on storage.objects;

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
    'creativita', coalesce(c.creativita, '[]'::jsonb),
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
