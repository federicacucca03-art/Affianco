-- BOOKINGS: colonne economiche + canale prenotazione
-- objective: 'LEADS' | 'BOOKINGS' (normalizza anche LEAD_GEN legacy)

alter table public.campaigns
  add column if not exists booking_service_value numeric;

alter table public.campaigns
  add column if not exists show_up_rate numeric default 75;

alter table public.campaigns
  add column if not exists booking_channel text;

comment on column public.campaigns.booking_service_value is
  'Valore medio prima visita/servizio (€) per obiettivo BOOKINGS';

comment on column public.campaigns.show_up_rate is
  'Tasso di presenza stimato % (default 75) per BOOKINGS';

comment on column public.campaigns.booking_channel is
  'WHATSAPP | LEAD_FORM | BOOKING_LINK';

-- Allinea objective legacy LEAD_GEN → LEADS
update public.campaigns
set objective = 'LEADS'
where upper(coalesce(objective, '')) in ('LEAD_GEN', 'LEADS', '');
