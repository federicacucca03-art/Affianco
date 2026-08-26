/**
 * P3 smoke checklist — eseguire DOPO cutover SQL production.
 * Non applicabile finché la migration non è sul DB.
 *
 * Prerequisiti:
 * - Deploy Vercel con codice RPC dual-path
 * - SQL 20260826_p3_ownership_rls.sql applicato
 *
 * USER A / USER B: due account Auth distinti.
 *
 * 1) A login → crea client + campagna → OK, user_id = A
 * 2) B home /campagne → non vede record A
 * 3) B select campaigns where id = A_id → empty / null
 * 4) B update campaigns A → 0 rows / error
 * 5) A legge/aggiorna i propri → OK
 * 6) A insert campaigns con user_id = B → reject (exception trigger)
 * 7) A update campaigns set user_id = B → reject (immutable)
 * 8) anon from('campaigns').select() → empty / denied
 * 9) anon rpc get_campaign_for_public_approval(A_id) → payload minimo OK
 * 10) anon rpc approve_campaign_public / request_campaign_revision_public → OK
 * 11) anon update diretto campaigns → denied
 * 12) A campaign_logs solo sulle proprie campagne → OK
 *
 * Legacy NULL: non visibili in home dopo RLS finché non assegnati a mano.
 */
export {};
