-- Diario di bordo: evento UPDATED per "Modifica configurazione".
-- Non applicare automaticamente in production: migration da eseguire a mano.
-- Nessuna colonna nuova.

alter table public.campaign_logs
  drop constraint if exists campaign_logs_event_type_check;

alter table public.campaign_logs
  add constraint campaign_logs_event_type_check
  check (
    event_type in (
      'CREATED',
      'APPROVED',
      'EXPORTED',
      'METRICS_UPDATED',
      'DIAGNOSIS_CHANGED',
      'NOTE_ADDED',
      'UPDATED'
    )
  );
