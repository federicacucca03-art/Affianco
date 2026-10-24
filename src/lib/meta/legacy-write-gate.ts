/**
 * ADV.2.4.0.3 — Legacy Meta mutation gate (M11 / M14 compatibility paths).
 *
 * Preview / non-Production: META_WRITES_LIVE=1 alone is NEVER enough.
 * Requires also META_QA_LEGACY_WRITE_LIVE=1 (explicit "1" only).
 *
 * Production (VERCEL_ENV=production): preserves prior semantics —
 * META_WRITES_LIVE=1 alone may authorize legacy writes (this phase does
 * not deploy Production).
 *
 * Distinct from META_ADV23_WRITE_PLAN_LIVE (new WritePlan executor).
 */

export type LegacyWriteGateEnv = {
  META_WRITES_LIVE?: string | undefined;
  META_QA_LEGACY_WRITE_LIVE?: string | undefined;
  META_ADV23_WRITE_PLAN_LIVE?: string | undefined;
  VERCEL_ENV?: string | undefined;
  NODE_ENV?: string | undefined;
};

export type LegacyWriteGateCode =
  | "OK_PRODUCTION_COMPAT"
  | "OK_QA_DUAL_GATE"
  | "LIVE_OFF"
  | "QA_LEGACY_SECONDARY_OFF"
  | "QA_LEGACY_SECONDARY_MISSING";

export type LegacyWriteGateResult = {
  allowed: boolean;
  code: LegacyWriteGateCode;
  messageIt: string;
  /** True when VERCEL_ENV === production (case-insensitive). */
  isProductionVercel: boolean;
  metaWritesLive: boolean;
  qaLegacySecondaryLive: boolean;
};

function trim(v: string | undefined): string {
  return (v ?? "").trim();
}

export function isVercelProductionEnv(
  env: LegacyWriteGateEnv = process.env as LegacyWriteGateEnv,
): boolean {
  return trim(env.VERCEL_ENV).toLowerCase() === "production";
}

/** Explicit "1" only — never true/yes/preview/qa. */
export function isMetaQaLegacyWriteLiveEnabled(
  env: LegacyWriteGateEnv = process.env as LegacyWriteGateEnv,
): boolean {
  return trim(env.META_QA_LEGACY_WRITE_LIVE) === "1";
}

export function isMetaWritesLiveFlagOn(
  env: LegacyWriteGateEnv = process.env as LegacyWriteGateEnv,
): boolean {
  return trim(env.META_WRITES_LIVE) === "1";
}

/**
 * Authoritative legacy mutation gate. Call BEFORE any Graph POST/DELETE/PATCH.
 * Does not authorize the new WritePlan executor.
 */
export function evaluateLegacyMetaMutationGate(
  env: LegacyWriteGateEnv = process.env as LegacyWriteGateEnv,
): LegacyWriteGateResult {
  // Ignore NODE_ENV / ADV23 for legacy authorization.
  void env.NODE_ENV;
  void env.META_ADV23_WRITE_PLAN_LIVE;

  const metaWritesLive = isMetaWritesLiveFlagOn(env);
  const qaLegacySecondaryLive = isMetaQaLegacyWriteLiveEnabled(env);
  const isProductionVercel = isVercelProductionEnv(env);

  if (!metaWritesLive) {
    return {
      allowed: false,
      code: "LIVE_OFF",
      messageIt:
        "Creazione su Meta non disponibile: scrittura live disabilitata.",
      isProductionVercel,
      metaWritesLive,
      qaLegacySecondaryLive,
    };
  }

  if (isProductionVercel) {
    return {
      allowed: true,
      code: "OK_PRODUCTION_COMPAT",
      messageIt: "Gate Production (compatibilità legacy).",
      isProductionVercel,
      metaWritesLive,
      qaLegacySecondaryLive,
    };
  }

  // Preview / Development / unset VERCEL_ENV → fail-closed secondary.
  const secondaryRaw = trim(env.META_QA_LEGACY_WRITE_LIVE);
  if (!secondaryRaw) {
    return {
      allowed: false,
      code: "QA_LEGACY_SECONDARY_MISSING",
      messageIt:
        "Scrittura Meta bloccata in QA/Preview: manca il gate secondario di sicurezza.",
      isProductionVercel,
      metaWritesLive,
      qaLegacySecondaryLive: false,
    };
  }
  if (secondaryRaw !== "1") {
    return {
      allowed: false,
      code: "QA_LEGACY_SECONDARY_OFF",
      messageIt:
        "Scrittura Meta bloccata in QA/Preview: gate secondario non attivo.",
      isProductionVercel,
      metaWritesLive,
      qaLegacySecondaryLive: false,
    };
  }

  return {
    allowed: true,
    code: "OK_QA_DUAL_GATE",
    messageIt: "Gate QA legacy duale superato.",
    isProductionVercel,
    metaWritesLive,
    qaLegacySecondaryLive: true,
  };
}

/** Convenience: true only when legacy Graph mutation may proceed. */
export function isLegacyMetaMutationAllowed(
  env: LegacyWriteGateEnv = process.env as LegacyWriteGateEnv,
): boolean {
  return evaluateLegacyMetaMutationGate(env).allowed;
}
