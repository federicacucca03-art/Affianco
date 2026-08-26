-- P3 report — conteggio legacy senza ownership.
-- Solo SELECT. Non assegna user_id.
--
-- Eseguire in Supabase SQL Editor PRIMA del cutover RLS.

select 'clients' as tabella,
       count(*) filter (where user_id is null) as user_id_null,
       count(*) as totale
from public.clients
union all
select 'campaigns',
       count(*) filter (where user_id is null),
       count(*)
from public.campaigns;

-- Elenco id legacy (opzionale, per assegnazione manuale):
-- select id, name, created_at from public.clients where user_id is null order by created_at;
-- select id, name, client_id, created_at from public.campaigns where user_id is null order by created_at;
