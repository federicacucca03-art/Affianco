/**
 * Mapping errori Supabase/network → copy UX.
 * Non logga secret; non cambia la semantica DB.
 */

export type CategoriaErroreSupabase =
  | "NETWORK"
  | "CONFIG"
  | "NOT_FOUND"
  | "DATABASE"
  | "UNKNOWN";

export type ContestoErroreSupabase =
  | "salva"
  | "copia_link"
  | "carica_approvazione"
  | "azione_approvazione"
  | "lista"
  | "carica_dettaglio"
  | "generico";

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
  if (error && typeof error === "object") {
    const o = error as { message?: unknown; code?: unknown; details?: unknown };
    const parts = [o.message, o.code, o.details]
      .filter((x) => typeof x === "string" && x.trim())
      .map((x) => String(x));
    if (parts.length) return parts.join(" ");
  }
  return "";
}

function codiceErrore(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const c = (error as { code?: unknown }).code;
    if (typeof c === "string") return c;
  }
  return "";
}

/**
 * Classifica un errore throwato (rete/config/API).
 * Non usare per “zero record”: quello è NOT_FOUND solo se lo passi
 * esplicitamente o se il messaggio/codice PostgREST lo indica.
 */
export function classificaErroreSupabase(
  error: unknown,
): CategoriaErroreSupabase {
  if (!supabaseEnvPresenti()) return "CONFIG";

  const msg = testoErrore(error);
  const lower = msg.toLowerCase();
  const code = codiceErrore(error).toUpperCase();

  if (
    error instanceof TypeError ||
    /failed to fetch|networkerror|network request failed|load failed|fetch failed|enotfound|econnrefused|econnreset|etimedout|err_name_not_resolved|err_internet_disconnected|offline|network unreachable|connecting to/i.test(
      lower,
    )
  ) {
    return "NETWORK";
  }

  if (
    /not configured|invalid supabase|missing.*supabase|supabase.*url|supabase.*key|supabase non è configurato/i.test(
      lower,
    )
  ) {
    return "CONFIG";
  }

  // PostgREST: zero rows da .single() — distinto da query fallita / colonna mancante.
  if (
    code === "PGRST116" ||
    /pgrst116|0 rows|no rows|results contain 0 rows|record assente/i.test(
      lower,
    )
  ) {
    return "NOT_FOUND";
  }

  if (
    code.startsWith("PGRST") ||
    code.startsWith("23") ||
    code.startsWith("42") ||
    /postgrest|postgres|permission denied|rls|jwt|duplicate key|foreign key|violates|could not find the .* column|schema cache/i.test(
      lower,
    )
  ) {
    return "DATABASE";
  }

  return "UNKNOWN";
}

const COPY: Record<
  CategoriaErroreSupabase,
  Partial<Record<ContestoErroreSupabase, string>> & { default: string }
> = {
  NETWORK: {
    default:
      "Non riesco a collegarmi al database. Controlla la connessione e riprova.",
    carica_approvazione:
      "Non riesco a caricare la proposta in questo momento.",
    carica_dettaglio:
      "Non riesco a caricare la campagna in questo momento.",
    azione_approvazione:
      "Non riesco a salvare la risposta in questo momento. Controlla la connessione e riprova.",
    salva: "Non riesco a salvare la campagna in questo momento. Riprova.",
    copia_link: "Non riesco a salvare la campagna in questo momento. Riprova.",
    lista: "Non riesco a collegarmi al database. Riprova tra qualche secondo.",
  },
  CONFIG: {
    default:
      "Supabase non è configurato correttamente in questo ambiente.",
  },
  NOT_FOUND: {
    default: "Proposta non trovata.",
    carica_approvazione: "Proposta non trovata.",
    carica_dettaglio: "Campagna non trovata.",
  },
  DATABASE: {
    default: "Operazione non riuscita. Riprova tra poco.",
    salva: "Salvataggio non riuscito. Riprova tra poco.",
    copia_link: "Non riesco a salvare la campagna in questo momento. Riprova.",
    carica_approvazione:
      "Non riesco a caricare la proposta in questo momento.",
    carica_dettaglio:
      "Non riesco a caricare la campagna in questo momento.",
    azione_approvazione: "Operazione non riuscita. Riprova tra poco.",
    lista: "Non riesco a caricare le campagne. Riprova tra poco.",
  },
  UNKNOWN: {
    default: "Operazione non riuscita. Riprova tra poco.",
    salva: "Non riesco a salvare la campagna in questo momento. Riprova.",
    copia_link: "Non riesco a salvare la campagna in questo momento. Riprova.",
    carica_approvazione:
      "Non riesco a caricare la proposta in questo momento.",
    carica_dettaglio:
      "Non riesco a caricare la campagna in questo momento.",
    azione_approvazione: "Operazione non riuscita. Riprova tra poco.",
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
