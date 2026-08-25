-- Client Review Portal: timestamp approvazione e note di revisione.
alter table public.campaigns
  add column if not exists approved_at timestamptz,
  add column if not exists revision_notes text;
