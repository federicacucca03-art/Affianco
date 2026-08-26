/**
 * Mapping errori Supabase Auth → copy UX.
 * Non espone codici/stack; non logga secret.
 */

export type ContestoAuthErrore = "login" | "signup" | "logout" | "generico";

function testoErrore(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "";
}

export function messaggioErroreAuth(
  error: unknown,
  contesto: ContestoAuthErrore = "generico",
): string {
  const msg = testoErrore(error).toLowerCase();

  if (
    error instanceof TypeError ||
    /failed to fetch|networkerror|fetch failed|network/i.test(msg)
  ) {
    return "Non riesco a collegarmi. Controlla la connessione e riprova.";
  }

  if (
    /invalid login credentials|invalid_credentials|wrong password|email.*password/i.test(
      msg,
    )
  ) {
    return "Email o password non corretti.";
  }

  if (
    /email not confirmed|not confirmed|confirm your email|email_not_confirmed/i.test(
      msg,
    )
  ) {
    return "Conferma l’account dalla email che ti abbiamo inviato, poi riprova ad accedere.";
  }

  if (
    /user already registered|already been registered|email.*already|already exists/i.test(
      msg,
    )
  ) {
    return "Esiste già un account con questa email. Prova ad accedere.";
  }

  if (/password.*short|at least|too short|weak password/i.test(msg)) {
    return "La password è troppo corta. Usa almeno 6 caratteri.";
  }

  if (/invalid.*email|unable to validate email/i.test(msg)) {
    return "Inserisci un’email valida.";
  }

  if (/rate limit|too many requests|over_request_rate/i.test(msg)) {
    return "Troppi tentativi. Attendi un momento e riprova.";
  }

  if (contesto === "signup") {
    return "Non riesco a creare l’account. Riprova tra poco.";
  }
  if (contesto === "login") {
    return "Accesso non riuscito. Riprova.";
  }
  if (contesto === "logout") {
    return "Uscita non riuscita. Riprova.";
  }
  return "Operazione non riuscita. Riprova.";
}

export function logErroreAuthDev(operazione: string, error: unknown): void {
  if (process.env.NODE_ENV === "production") return;
  console.error("[Affianco][Auth]", {
    operazione,
    messaggio: testoErrore(error).slice(0, 200),
  });
}
