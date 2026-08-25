/**
 * Mapping errori Supabase/network → copy UX.
 * Non logga secret; non cambia la semantica DB.
 */

export type CategoriaErroreSupabase =
  | "rete"
  | "config"
  | "api"
  | "non_trovato";

function supabaseEnvPresenti(): boolean {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  return Boolean(url && key);
}

/** true se URL e anon key sono presenti (non valida raggiungibilità). */
export function isSupabaseConfigurato(): boolean {
  return supabaseEnvPresenti();
}

function testoErrore(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === "string") return error;
  return "";
}

export function classificaErroreSupabase(
  error: unknown,
): CategoriaErroreSupabase {
  if (!supabaseEnvPresenti()) return "config";

  const msg = testoErrore(error);
  const lower = msg.toLowerCase();

  if (
    error instanceof TypeError ||
    /failed to fetch|networkerror|network request failed|load failed|fetch failed|enotfound|econnrefused|econnreset|etimedout|err_name_not_resolved|err_internet_disconnected|offline/i.test(
      lower,
    )
  ) {
    return "rete";
  }

  if (
    /not configured|invalid supabase|missing.*supabase|supabase.*url|supabase.*key/i.test(
      lower,
    )
  ) {
    return "config";
  }

  if (
    /not found|0 rows|pgrst116|no rows|does not exist|record assente/i.test(
      lower,
    )
  ) {
    return "non_trovato";
  }

  return "api";
}

type ContestoErroreSupabase =
  | "salva"
  | "copia_link"
  | "carica_approvazione"
  | "azione_approvazione"
  | "lista"
  | "generico";

const COPY: Record<
  CategoriaErroreSupabase,
  Partial<Record<ContestoErroreSupabase, string>> & { default: string }
> = {
  rete: {
    default:
      "Non riesco a collegarmi al database. Controlla la connessione e riprova.",
    carica_approvazione:
      "Non riesco a caricare la proposta in questo momento. Controlla la connessione e riprova.",
    azione_approvazione:
      "Non riesco a salvare la risposta in questo momento. Controlla la connessione e riprova.",
    lista: "Non riesco a collegarmi al database. Riprova tra qualche secondo.",
  },
  config: {
    default:
      "Supabase non è configurato correttamente in questo ambiente.",
  },
  api: {
    default: "Operazione non riuscita. Riprova tra poco.",
    salva: "Salvataggio non riuscito. Riprova tra poco.",
    copia_link: "Impossibile preparare il link. Riprova tra poco.",
    azione_approvazione: "Operazione non riuscita. Riprova tra poco.",
  },
  non_trovato: {
    default: "Proposta non trovata.",
    carica_approvazione: "Proposta non trovata.",
  },
};

/**
 * Messaggio user-facing. Non espone hostname né secret.
 */
export function messaggioErroreSupabase(
  error: unknown,
  contesto: ContestoErroreSupabase = "generico",
): string {
  const categoria = classificaErroreSupabase(error);
  const perContesto = COPY[categoria];
  return perContesto[contesto] ?? perContesto.default;
}

/** Log tecnico solo in development (senza secret/payload). */
export function logErroreSupabaseDev(
  operazione: string,
  error: unknown,
): void {
  if (process.env.NODE_ENV === "production") return;
  const categoria = classificaErroreSupabase(error);
  const messaggio = testoErrore(error);
  console.error("[Affianco][Supabase]", {
    operazione,
    categoria,
    messaggio: messaggio.slice(0, 200),
  });
}
