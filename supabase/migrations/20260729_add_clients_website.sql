-- Aggiunge il sito web del cliente alla tabella clients.
-- Esegui questo SQL nel SQL Editor di Supabase (Dashboard → SQL).

alter table public.clients
  add column if not exists website text;
