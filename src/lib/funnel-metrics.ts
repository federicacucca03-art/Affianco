import type { CampagnaObjective } from "@/types/campagne";

/**
 * Derivate canoniche CTR / CPC / CPM / conversion rate (click → result).
 * Unico punto con le formule. Health non usa questi helper.
 *
 * Tolleranza mismatch (manuale vs derivato): si ignora la sola differenza
 * da arrotondamento. Mismatch se
 * |manuale − derivato| > max(ε_assoluto, 2% × |derivato|)
 * con ε_assoluto = 0.05 punti % per CTR, 0.01 € per CPC/CPM.
 */

export type FunnelMetricSource = "derived" | "manual" | "none";

export type FunnelMetricKey = "ctr" | "cpc" | "cpm";

export type FunnelMetricMismatch = {
  metric: FunnelMetricKey;
  manual: number;
  derived: number;
  message: string;
};

export type DeriveFunnelMetricsInput = {
  spend: number | null;
  results: number | null;
  clicks: number | null;
  impressions: number | null;
  manualCtr: number | null;
  manualCpc: number | null;
  manualCpm: number | null;
};

export type DeriveFunnelMetricsResult = {
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  conversionRate: number | null;
  sources: {
    ctr: FunnelMetricSource;
    cpc: FunnelMetricSource;
    cpm: FunnelMetricSource;
    conversionRate: FunnelMetricSource;
  };
  mismatches: FunnelMetricMismatch[];
};

const RELATIVE_TOLERANCE = 0.02;
const CTR_ABS_TOLERANCE = 0.05;
const MONEY_ABS_TOLERANCE = 0.01;

function finiteOrNull(n: number): number | null {
  return Number.isFinite(n) ? n : null;
}

function isSignificantMismatch(
  manual: number,
  derived: number,
  kind: "percent" | "money",
): boolean {
  const absTol = kind === "percent" ? CTR_ABS_TOLERANCE : MONEY_ABS_TOLERANCE;
  const tol = Math.max(absTol, Math.abs(derived) * RELATIVE_TOLERANCE);
  return Math.abs(manual - derived) > tol;
}

export type ParseCountResult =
  | { ok: true; value: number | null }
  | { ok: false; error: string };

/**
 * Campo vuoto → null. "0" → 0. Decimali e negativi → errore.
 * Non usa Number("") (che in JS è 0).
 */
export function parseOptionalNonNegativeInteger(raw: string): ParseCountResult {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: true, value: null };
  if (!/^\d+$/.test(trimmed)) {
    return {
      ok: false,
      error: "Click e impression devono essere interi maggiori o uguali a 0.",
    };
  }
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0 || !Number.isFinite(n)) {
    return {
      ok: false,
      error: "Click e impression devono essere interi maggiori o uguali a 0.",
    };
  }
  return { ok: true, value: n };
}

/**
 * Conteggio da screenshot. Integer | null.
 * Supporta 100, 1.000, 1,000, 10.000, 10,000.
 * Decimali significativi (es. 100.5) → null, senza arrotondare.
 * Abbreviazioni 1K / 1.2K / 1M → null (euristica troppo fragile).
 */
export function parseScreenshotCount(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < 0 || !Number.isInteger(raw)) return null;
    return raw;
  }
  if (typeof raw !== "string") return null;
  const s = raw.trim().replace(/[\s\u00a0]/g, "");
  if (!s || s.startsWith("-")) return null;
  if (/[eEkKmMbB]/.test(s)) return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let normalized: string;

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalIsComma = lastComma > lastDot;
    normalized = decimalIsComma
      ? s.replace(/\./g, "").replace(",", ".")
      : s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    const parts = s.split(",");
    const last = parts[parts.length - 1] ?? "";
    if (parts.length > 2) {
      if (!parts.every((p, i) => (i === 0 ? /^\d+$/.test(p) : /^\d{3}$/.test(p)))) {
        return null;
      }
      normalized = s.replace(/,/g, "");
    } else if (last.length === 3 && /^\d+$/.test(last)) {
      normalized = s.replace(/,/g, "");
    } else if (last.length <= 2) {
      normalized = s.replace(",", ".");
    } else {
      return null;
    }
  } else if (lastDot >= 0) {
    const parts = s.split(".");
    const last = parts[parts.length - 1] ?? "";
    if (parts.length > 2) {
      if (!parts.every((p, i) => (i === 0 ? /^\d+$/.test(p) : /^\d{3}$/.test(p)))) {
        return null;
      }
      normalized = s.replace(/\./g, "");
    } else if (last.length === 3 && /^\d+$/.test(last)) {
      normalized = s.replace(/\./g, "");
    } else if (last.length <= 2) {
      normalized = s;
    } else {
      return null;
    }
  } else {
    normalized = s;
  }

  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return null;
  return n;
}

export function conteggiFormDaScreenshot(raw: {
  clicks?: unknown;
  impressions?: unknown;
}): { clicks: string; impressions: string; apriFunnel: boolean } {
  const clicks = parseScreenshotCount(raw.clicks);
  const impressions = parseScreenshotCount(raw.impressions);
  return {
    clicks: clicks == null ? "" : String(clicks),
    impressions: impressions == null ? "" : String(impressions),
    apriFunnel: clicks != null || impressions != null,
  };
}

export function avvisiConteggiFunnel(
  clicks: number | null,
  impressions: number | null,
): string[] {
  const avvisi: string[] = [];
  if (clicks != null && impressions != null && clicks > impressions) {
    avvisi.push(
      "I click risultano superiori alle impression. Controlla che i dati provengano dallo stesso intervallo.",
    );
  }
  if (impressions === 0 && clicks != null && clicks > 0) {
    avvisi.push(
      "Le impression sono 0 ma risultano dei click. Controlla che i dati provengano dallo stesso intervallo.",
    );
  }
  return avvisi;
}

export function deriveFunnelMetrics(
  input: DeriveFunnelMetricsInput,
): DeriveFunnelMetricsResult {
  const { spend, results, clicks, impressions, manualCtr, manualCpc, manualCpm } =
    input;

  const derivedCtr =
    clicks != null && impressions != null && impressions > 0
      ? finiteOrNull((clicks / impressions) * 100)
      : null;
  const derivedCpc =
    spend != null && clicks != null && clicks > 0
      ? finiteOrNull(spend / clicks)
      : null;
  const derivedCpm =
    spend != null && impressions != null && impressions > 0
      ? finiteOrNull((spend / impressions) * 1000)
      : null;
  const conversionRate =
    results != null && clicks != null && clicks > 0
      ? finiteOrNull((results / clicks) * 100)
      : null;

  const mismatches: FunnelMetricMismatch[] = [];

  function pick(
    derived: number | null,
    manual: number | null,
    metric: FunnelMetricKey,
    kind: "percent" | "money",
    message: string,
  ): { value: number | null; source: FunnelMetricSource } {
    if (derived != null) {
      if (
        manual != null &&
        isSignificantMismatch(manual, derived, kind)
      ) {
        mismatches.push({ metric, manual, derived, message });
      }
      return { value: derived, source: "derived" };
    }
    if (manual != null && Number.isFinite(manual)) {
      return { value: manual, source: "manual" };
    }
    return { value: null, source: "none" };
  }

  const ctrPick = pick(
    derivedCtr,
    manualCtr,
    "ctr",
    "percent",
    "CTR ricalcolato da click e impression.",
  );
  const cpcPick = pick(
    derivedCpc,
    manualCpc,
    "cpc",
    "money",
    "CPC ricalcolato da spesa e click.",
  );
  const cpmPick = pick(
    derivedCpm,
    manualCpm,
    "cpm",
    "money",
    "CPM ricalcolato da spesa e impression.",
  );

  return {
    ctr: ctrPick.value,
    cpc: cpcPick.value,
    cpm: cpmPick.value,
    conversionRate,
    sources: {
      ctr: ctrPick.source,
      cpc: cpcPick.source,
      cpm: cpmPick.source,
      conversionRate: conversionRate != null ? "derived" : "none",
    },
    mismatches,
  };
}

export function etichettaTassoClickRisultato(
  objective: CampagnaObjective,
): string | null {
  switch (objective) {
    case "LEADS":
      return "Tasso click → lead";
    case "BOOKINGS":
      return "Tasso click → prenotazione";
    case "ECOMMERCE":
      return "Tasso click → acquisto";
    case "IN_STORE":
      return "Tasso click → risultato (proxy)";
    case "RETARGETING":
      return "Tasso click → risultato";
    case "AWARENESS":
      return null;
    default:
      return "Tasso click → risultato";
  }
}

export function formatFunnelPercent(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}
