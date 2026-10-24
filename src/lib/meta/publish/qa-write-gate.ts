/**
 * M14.2 — Secondary controlled QA write safety gate.
 * META_WRITES_LIVE=1 is NOT sufficient alone.
 *
 * Live Graph mutations for full publish require ALL of:
 * - META_WRITES_LIVE=1
 * - Ally QA Supabase project (never production ref)
 * - Vercel env is not production
 * - explicit approved Meta test ad account id
 * - explicit approved Ally QA campaign id
 * - explicit confirmation token match (when provided by caller)
 *
 * Pure helpers are free of server-only for unit tests.
 */

/** Ally QA Supabase project ref — never production. */
export const ALLY_QA_SUPABASE_PROJECT_REF = "unwxygpyrnbgulidsszk";

/** Known production Supabase ref — hard reject if ever selected. */
export const ALLY_PRODUCTION_SUPABASE_PROJECT_REF = "zbkdptopumdfgwsmkhzj";

function envTrim(
  name: string,
  env: Record<string, string | undefined> = process.env,
): string {
  return (env[name] ?? "").trim();
}

export function supabaseProjectRefFromUrl(url: string): string | null {
  try {
    const host = new URL(url.trim()).hostname;
    const m = host.match(/^([a-z0-9]+)\.supabase\.co$/i);
    return m?.[1]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

export function maskMetaAdAccountId(id: string | null | undefined): string {
  const s = (id ?? "").replace(/^act_/, "").trim();
  if (!s) return "(none)";
  if (s.length <= 6) return `act_***`;
  return `act_${s.slice(0, 3)}…${s.slice(-3)}`;
}

export type QaWriteGateCheck = {
  ok: boolean;
  code:
    | "OK"
    | "LIVE_OFF"
    | "NOT_ALLY_QA_SUPABASE"
    | "PRODUCTION_SUPABASE"
    | "VERCEL_PRODUCTION"
    | "MISSING_APPROVED_AD_ACCOUNT"
    | "AD_ACCOUNT_MISMATCH"
    | "MISSING_APPROVED_CAMPAIGN"
    | "CAMPAIGN_MISMATCH"
    | "CONFIRM_TOKEN_MISMATCH"
    | "MISSING_CONFIRM_TOKEN";
  messageIt: string;
};

export type QaWriteGateInput = {
  allyCampaignId: string;
  metaAdAccountId: string | null;
  /** Explicit human confirmation token from client — must match env. */
  confirmationToken?: string | null;
  env?: Record<string, string | undefined>;
};

/**
 * Evaluate secondary QA write constraints (does not perform Graph I/O).
 */
export function evaluateControlledQaWriteGate(
  input: QaWriteGateInput,
): QaWriteGateCheck {
  const env = input.env ?? process.env;

  if (envTrim("META_WRITES_LIVE", env) !== "1") {
    return {
      ok: false,
      code: "LIVE_OFF",
      messageIt: "META_WRITES_LIVE non attivo: nessuna mutazione Meta.",
    };
  }

  // ADV.2.4.0.3 — Preview/QA require secondary legacy gate (explicit "1").
  if (envTrim("VERCEL_ENV", env).toLowerCase() !== "production") {
    if (envTrim("META_QA_LEGACY_WRITE_LIVE", env) !== "1") {
      return {
        ok: false,
        code: "LIVE_OFF",
        messageIt:
          "Gate secondario QA legacy assente: nessuna mutazione Meta in Preview.",
      };
    }
  }

  const supabaseUrl = envTrim("NEXT_PUBLIC_SUPABASE_URL", env);
  const ref = supabaseProjectRefFromUrl(supabaseUrl);
  if (ref === ALLY_PRODUCTION_SUPABASE_PROJECT_REF) {
    return {
      ok: false,
      code: "PRODUCTION_SUPABASE",
      messageIt: "Rifiuto: Supabase Production rilevato. Write QA bloccata.",
    };
  }
  if (ref !== ALLY_QA_SUPABASE_PROJECT_REF) {
    return {
      ok: false,
      code: "NOT_ALLY_QA_SUPABASE",
      messageIt: "Write controllata solo su Ally QA Supabase.",
    };
  }

  const vercelEnv = envTrim("VERCEL_ENV", env).toLowerCase();
  if (vercelEnv === "production") {
    return {
      ok: false,
      code: "VERCEL_PRODUCTION",
      messageIt: "Write controllata non consentita su Vercel Production.",
    };
  }

  const approvedAccount = envTrim("META_QA_APPROVED_AD_ACCOUNT_ID", env);
  if (!approvedAccount) {
    return {
      ok: false,
      code: "MISSING_APPROVED_AD_ACCOUNT",
      messageIt:
        "Manca META_QA_APPROVED_AD_ACCOUNT_ID (account Meta test esplicito).",
    };
  }

  const incoming = (input.metaAdAccountId ?? "").replace(/^act_/, "").trim();
  const expected = approvedAccount.replace(/^act_/, "").trim();
  if (!incoming || incoming !== expected) {
    return {
      ok: false,
      code: "AD_ACCOUNT_MISMATCH",
      messageIt:
        "Account Meta non approvato per write QA. Nessuna mutazione eseguita.",
    };
  }

  const approvedCampaign = envTrim("META_QA_APPROVED_CAMPAIGN_ID", env);
  if (!approvedCampaign) {
    return {
      ok: false,
      code: "MISSING_APPROVED_CAMPAIGN",
      messageIt:
        "Manca META_QA_APPROVED_CAMPAIGN_ID (campagna Ally QA esplicita).",
    };
  }
  if (input.allyCampaignId.trim() !== approvedCampaign) {
    return {
      ok: false,
      code: "CAMPAIGN_MISMATCH",
      messageIt:
        "Campagna non approvata per write QA. Richiesta rifiutata.",
    };
  }

  const requiredToken = envTrim("META_QA_WRITE_CONFIRM_TOKEN", env);
  if (!requiredToken) {
    return {
      ok: false,
      code: "MISSING_CONFIRM_TOKEN",
      messageIt:
        "Manca META_QA_WRITE_CONFIRM_TOKEN (conferma esplicita server-side).",
    };
  }
  const provided = (input.confirmationToken ?? "").trim();
  if (!provided || provided !== requiredToken) {
    return {
      ok: false,
      code: "CONFIRM_TOKEN_MISMATCH",
      messageIt: "Token di conferma write QA non valido.",
    };
  }

  return {
    ok: true,
    code: "OK",
    messageIt: "Gate QA controllato superato.",
  };
}

/**
 * True when M14 full-publish may attempt live Graph mutations.
 * Requires Ally QA Supabase + non-production Vercel + META_WRITES_LIVE
 * AND ADV.2.4.0.3 META_QA_LEGACY_WRITE_LIVE=1 (Preview fail-closed).
 */
export function isQaScopedMetaWritesEnvironment(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (envTrim("META_WRITES_LIVE", env) !== "1") return false;
  // Preview/QA secondary legacy gate — absent/off ⇒ blocked.
  if (envTrim("VERCEL_ENV", env).toLowerCase() !== "production") {
    if (envTrim("META_QA_LEGACY_WRITE_LIVE", env) !== "1") return false;
  }
  const ref = supabaseProjectRefFromUrl(envTrim("NEXT_PUBLIC_SUPABASE_URL", env));
  if (ref === ALLY_PRODUCTION_SUPABASE_PROJECT_REF) return false;
  if (ref !== ALLY_QA_SUPABASE_PROJECT_REF) return false;
  if (envTrim("VERCEL_ENV", env).toLowerCase() === "production") return false;
  return true;
}
