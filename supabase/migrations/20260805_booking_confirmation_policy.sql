-- BOOKINGS: politica di conferma / caparra
alter table public.campaigns
  add column if not exists booking_confirmation_policy text;

comment on column public.campaigns.booking_confirmation_policy is
  'FREE_SMS_WHATSAPP | DEPOSIT_ONLINE | PAY_ON_SITE';

comment on column public.campaigns.booking_channel is
  'WHATSAPP | BOOKING_LINK | PHONE_CALL | INSTAGRAM_DM | LEAD_FORM (legacy)';
