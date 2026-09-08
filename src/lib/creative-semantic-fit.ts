/**
 * M9.3D — Creative semantic fit (coherence with campaign context).
 * AI interprets; deterministic Ally code decides product consequences.
 * Does NOT replace missing-creative checks. Does NOT hard-block launch.
 */

import type { CreativeVisionAnalysis } from "@/lib/analyze-creative";
import type {
  LaunchReadinessInput,
  LaunchReadinessResult,
} from "@/lib/launch-readiness";
import { calculateLaunchReadiness } from "@/lib/launch-readiness";

export const CREATIVE_SEMANTIC_STATUSES = [
  "NOT_AVAILABLE",
  "INSUFFICIENT_EVIDENCE",
  "MATCH",
  "POSSIBLE_MISMATCH",
  "CLEAR_MISMATCH",
] as const;

export type CreativeSemanticStatus =
  (typeof CREATIVE_SEMANTIC_STATUSES)[number];

export type CreativeSemanticConfidence = "LOW" | "MEDIUM" | "HIGH";

export type CreativeSemanticFit = {
  status: CreativeSemanticStatus;
  confidence: CreativeSemanticConfidence;
  creativeSummary: string | null;
  campaignContextSummary: string | null;
  reason: string | null;
  evidence: string[];
};

/** Minimal snapshot nestable in campaigns.creativita JSONB (no migration). */
export type CreativitaSemanticSnapshot = {
  status: Exclude<CreativeSemanticStatus, "NOT_AVAILABLE">;
  confidence: CreativeSemanticConfidence;
  reason: string | null;
  creativeSummary: string | null;
  campaignContextSummary: string | null;
  evidence: string[];
  fingerprint: string;
  analyzedAt: string;
};

export type LaunchReadinessWarning = {
  id: string;
  title: string;
  description: string;
  cta?: string;
};

export type LaunchReadinessWithSemantic = LaunchReadinessResult & {
  warnings: LaunchReadinessWarning[];
  /**
   * Always 0 in MVP: Launch Readiness % is technical completeness only
   * (completati/totale). Semantic fit is a separate coherence warning —
   * no invented score weight (see M9.3D.1).
   */
  semanticPenaltyPoints: 0;
};

const EMPTY_FIT: CreativeSemanticFit = {
  status: "NOT_AVAILABLE",
  confidence: "LOW",
  creativeSummary: null,
  campaignContextSummary: null,
  reason: null,
  evidence: [],
};

export function emptyCreativeSemanticFit(): CreativeSemanticFit {
  return { ...EMPTY_FIT, evidence: [] };
}

/** Map legacy relevance → semantic status (backward compatible). */
export function semanticStatusFromRelevance(
  relevance: CreativeVisionAnalysis["relevance"],
): Exclude<CreativeSemanticStatus, "NOT_AVAILABLE"> {
  if (relevance === "HIGH") return "MATCH";
  if (relevance === "MEDIUM") return "POSSIBLE_MISMATCH";
  if (relevance === "LOW") return "CLEAR_MISMATCH";
  return "INSUFFICIENT_EVIDENCE";
}

export function relevanceFromSemanticStatus(
  status: Exclude<CreativeSemanticStatus, "NOT_AVAILABLE">,
): CreativeVisionAnalysis["relevance"] {
  if (status === "MATCH") return "HIGH";
  if (status === "POSSIBLE_MISMATCH") return "MEDIUM";
  if (status === "CLEAR_MISMATCH") return "LOW";
  return "UNKNOWN";
}

/**
 * Derive product semantic fit from vision analysis.
 * CLEAR_MISMATCH requires HIGH confidence (high precision).
 * Legacy LOW relevance without structured HIGH → POSSIBLE_MISMATCH.
 */
export function deriveCreativeSemanticFit(
  analysis: CreativeVisionAnalysis | null | undefined,
  opts?: { hasCreative: boolean },
): CreativeSemanticFit {
  if (!opts?.hasCreative) {
    return emptyCreativeSemanticFit();
  }
  if (!analysis) {
    return {
      status: "INSUFFICIENT_EVIDENCE",
      confidence: "LOW",
      creativeSummary: null,
      campaignContextSummary: null,
      reason: "Analisi non disponibile.",
      evidence: [],
    };
  }

  const structured = analysis.semanticStatus;
  let status: Exclude<CreativeSemanticStatus, "NOT_AVAILABLE"> =
    structured ?? semanticStatusFromRelevance(analysis.relevance);

  let confidence: CreativeSemanticConfidence =
    analysis.confidence ??
    (status === "MATCH"
      ? "HIGH"
      : status === "INSUFFICIENT_EVIDENCE"
        ? "LOW"
        : "MEDIUM");

  // High-precision gate for CLEAR_MISMATCH
  if (status === "CLEAR_MISMATCH" && confidence !== "HIGH") {
    // Structured CLEAR without HIGH → demote
    if (structured === "CLEAR_MISMATCH") {
      status = "POSSIBLE_MISMATCH";
    } else {
      // Legacy relevance LOW without HIGH confidence → POSSIBLE
      status = "POSSIBLE_MISMATCH";
      confidence = "MEDIUM";
    }
  }

  return {
    status,
    confidence,
    creativeSummary: analysis.creativeSummary ?? null,
    campaignContextSummary: analysis.campaignContextSummary ?? null,
    reason: analysis.relevanceReason ?? null,
    evidence: (analysis.evidence ?? []).slice(0, 3),
  };
}

export function creativeSemanticContextFingerprint(input: {
  assetId: string;
  /** Prefer storagePath when present — stable across refresh; not filename. */
  storagePath?: string;
  settore: string;
  offerta: string;
  brief: string;
  nomeCliente?: string;
  objective?: string;
}): string {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);
  return [
    input.assetId,
    norm(input.storagePath ?? ""),
    norm(input.settore),
    norm(input.offerta),
    norm(input.brief),
    norm(input.nomeCliente ?? ""),
    norm(input.objective ?? ""),
  ].join("::");
}

export function creativeSemanticFitToReadiness(fit: CreativeSemanticFit): {
  warnings: LaunchReadinessWarning[];
  semanticPenaltyPoints: 0;
} {
  if (fit.status === "CLEAR_MISMATCH" && fit.confidence === "HIGH") {
    const detailParts = [
      fit.reason?.trim(),
      fit.creativeSummary
        ? `Creatività: ${fit.creativeSummary}`
        : null,
      fit.campaignContextSummary
        ? `Campagna: ${fit.campaignContextSummary}`
        : null,
    ].filter(Boolean);
    return {
      warnings: [
        {
          id: "creative-semantic-clear-mismatch",
          title: "La creatività sembra poco coerente con questa campagna.",
          description:
            detailParts.join(" ") ||
            "Il visual non sembra allineato al settore o all'offerta.",
          cta: "Controlla creatività",
        },
      ],
      semanticPenaltyPoints: 0,
    };
  }

  if (fit.status === "POSSIBLE_MISMATCH") {
    return {
      warnings: [
        {
          id: "creative-semantic-possible-mismatch",
          title: "Verifica che la creatività rappresenti bene l'offerta.",
          description:
            fit.reason?.trim() ||
            "Il visual è generico o solo parzialmente allineato al contesto.",
        },
      ],
      semanticPenaltyPoints: 0,
    };
  }

  return { warnings: [], semanticPenaltyPoints: 0 };
}

/**
 * Thin adapter: canonical calculateLaunchReadiness unchanged;
 * semantic fit only appends warnings (never mutates isReady / items / %).
 */
export function calculateLaunchReadinessWithSemantic(
  input: LaunchReadinessInput,
  fit: CreativeSemanticFit | null,
): LaunchReadinessWithSemantic {
  const base = calculateLaunchReadiness(input);
  const adapted = creativeSemanticFitToReadiness(
    fit ?? emptyCreativeSemanticFit(),
  );
  return {
    ...base,
    warnings: adapted.warnings,
    semanticPenaltyPoints: 0,
  };
}

/** True only when persisted snapshot matches current creative+context fingerprint. */
export function isSemanticSnapshotCurrent(
  snap: CreativitaSemanticSnapshot | null | undefined,
  fingerprintInput: Parameters<typeof creativeSemanticContextFingerprint>[0],
): boolean {
  if (!snap?.fingerprint) return false;
  return snap.fingerprint === creativeSemanticContextFingerprint(fingerprintInput);
}

export function labelSemanticFitIt(status: CreativeSemanticStatus): string {
  switch (status) {
    case "MATCH":
      return "Coerente";
    case "POSSIBLE_MISMATCH":
      return "Possibile incoerenza";
    case "CLEAR_MISMATCH":
      return "Da verificare";
    case "INSUFFICIENT_EVIDENCE":
      return "Non verificabile";
    case "NOT_AVAILABLE":
      return "Nessuna creatività";
  }
}

export function recommendationForMismatch(settore: string): string {
  const s = settore.toLowerCase();
  if (
    /distribuzion|industrial|tecnica|manifattur|nastro|adesiv|logistica|ingegner/.test(
      s,
    )
  ) {
    return "Usa una creatività che mostri prodotto, applicazione tecnica o contesto industriale.";
  }
  if (/dentist|odonto|implant|clinic|salut/.test(s)) {
    return "Usa una creatività che mostri studio, staff o contesto clinico rassicurante.";
  }
  return "Usa una creatività allineata al settore e all'offerta della campagna.";
}

export function fitToSnapshot(
  fit: CreativeSemanticFit,
  fingerprint: string,
): CreativitaSemanticSnapshot | null {
  if (
    fit.status === "NOT_AVAILABLE" ||
    fit.status === "INSUFFICIENT_EVIDENCE"
  ) {
    return null;
  }
  return {
    status: fit.status,
    confidence: fit.confidence,
    reason: fit.reason,
    creativeSummary: fit.creativeSummary,
    campaignContextSummary: fit.campaignContextSummary,
    evidence: fit.evidence.slice(0, 3),
    fingerprint,
    analyzedAt: new Date().toISOString(),
  };
}

export function snapshotToFit(
  snap: CreativitaSemanticSnapshot | null | undefined,
): CreativeSemanticFit | null {
  if (!snap) return null;
  return {
    status: snap.status,
    confidence: snap.confidence,
    creativeSummary: snap.creativeSummary,
    campaignContextSummary: snap.campaignContextSummary,
    reason: snap.reason,
    evidence: (snap.evidence ?? []).slice(0, 3),
  };
}

export function parseCreativitaSemanticSnapshot(
  raw: unknown,
): CreativitaSemanticSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const status = o.status;
  if (
    status !== "MATCH" &&
    status !== "POSSIBLE_MISMATCH" &&
    status !== "CLEAR_MISMATCH" &&
    status !== "INSUFFICIENT_EVIDENCE"
  ) {
    return null;
  }
  const confidence = o.confidence;
  if (confidence !== "LOW" && confidence !== "MEDIUM" && confidence !== "HIGH") {
    return null;
  }
  if (typeof o.fingerprint !== "string" || !o.fingerprint.trim()) return null;
  const evidence = Array.isArray(o.evidence)
    ? o.evidence
        .filter((e): e is string => typeof e === "string")
        .map((e) => e.trim().slice(0, 160))
        .filter(Boolean)
        .slice(0, 3)
    : [];
  return {
    status,
    confidence,
    reason:
      typeof o.reason === "string" ? o.reason.trim().slice(0, 220) || null : null,
    creativeSummary:
      typeof o.creativeSummary === "string"
        ? o.creativeSummary.trim().slice(0, 180) || null
        : null,
    campaignContextSummary:
      typeof o.campaignContextSummary === "string"
        ? o.campaignContextSummary.trim().slice(0, 180) || null
        : null,
    evidence,
    fingerprint: o.fingerprint.trim(),
    analyzedAt:
      typeof o.analyzedAt === "string" && o.analyzedAt
        ? o.analyzedAt
        : new Date(0).toISOString(),
  };
}

/** Principal creative snapshot from campaigns.creativita JSONB. */
export function extractPrincipalSemanticSnapshot(
  raw: unknown,
): CreativitaSemanticSnapshot | null {
  if (!raw) return null;
  const list = Array.isArray(raw) ? raw : [raw];
  let principale: Record<string, unknown> | null = null;
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (o.ruolo === "principale") {
      principale = o;
      break;
    }
    if (!principale) principale = o;
  }
  if (!principale) return null;
  return parseCreativitaSemanticSnapshot(principale.semanticFit);
}

/**
 * Short Italian note for Ask Ally — only when snapshot is CURRENT
 * (caller must pass fingerprint-validated snap; stale → null).
 */
export function creativeSemanticNoteForAlly(
  snap: CreativitaSemanticSnapshot | null,
  opts?: { current?: boolean },
): string | null {
  if (!snap) return null;
  if (opts && opts.current === false) return null;
  if (snap.status === "CLEAR_MISMATCH" && snap.confidence === "HIGH") {
    return (
      snap.reason?.trim() ||
      "La creatività merita una verifica: sembra rappresentare un contesto diverso dal settore della campagna."
    );
  }
  if (snap.status === "POSSIBLE_MISMATCH") {
    return (
      snap.reason?.trim() ||
      "Verifica che la creatività rappresenti bene l'offerta."
    );
  }
  if (snap.status === "MATCH") {
    return "Analisi creatività: visual coerente con il contesto campagna.";
  }
  return null;
}

/**
 * Principal snapshot only if fingerprint matches current campaign context.
 * Stale JSONB analysis must not enter Ask Ally as fact.
 */
export function currentPrincipalSemanticSnapshot(input: {
  creativita: unknown;
  settore: string;
  offerta: string;
  brief: string;
  nomeCliente?: string;
  objective?: string;
}): CreativitaSemanticSnapshot | null {
  const snap = extractPrincipalSemanticSnapshot(input.creativita);
  if (!snap) return null;
  const list = Array.isArray(input.creativita)
    ? input.creativita
    : input.creativita
      ? [input.creativita]
      : [];
  let principale: Record<string, unknown> | null = null;
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (o.ruolo === "principale") {
      principale = o;
      break;
    }
    if (!principale) principale = o;
  }
  const assetId =
    typeof principale?.id === "string" ? principale.id : "";
  const storagePath =
    typeof principale?.storagePath === "string"
      ? principale.storagePath
      : typeof principale?.storage_path === "string"
        ? principale.storage_path
        : "";
  if (!assetId) return null;
  if (
    !isSemanticSnapshotCurrent(snap, {
      assetId,
      storagePath,
      settore: input.settore,
      offerta: input.offerta,
      brief: input.brief,
      nomeCliente: input.nomeCliente,
      objective: input.objective,
    })
  ) {
    return null;
  }
  return snap;
}
