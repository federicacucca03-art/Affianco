/**
 * M11A.1 — Centralized major currency → Meta minor units.
 * Meta Marketing API budgets are integer minor units (cents for EUR/USD).
 */

export type BudgetConversionResult =
  | { ok: true; minor: number; currency: string }
  | {
      ok: false;
      reason:
        | "MISSING_CURRENCY"
        | "UNSUPPORTED_CURRENCY"
        | "INVALID_AMOUNT"
        | "ZERO_OR_NEGATIVE";
    };

const SUPPORTED = new Set(["EUR", "USD", "GBP"]);

/**
 * Convert a major-unit daily budget to Meta minor units.
 * Uses integer arithmetic after scaling to avoid float cent bugs.
 */
export function majorCurrencyToMetaMinorUnits(
  major: number | null | undefined,
  currency: string | null | undefined,
): BudgetConversionResult {
  const cur = (currency ?? "").trim().toUpperCase();
  if (!cur) return { ok: false, reason: "MISSING_CURRENCY" };
  if (!SUPPORTED.has(cur)) return { ok: false, reason: "UNSUPPORTED_CURRENCY" };
  if (major == null || !Number.isFinite(major)) {
    return { ok: false, reason: "INVALID_AMOUNT" };
  }
  if (major <= 0) return { ok: false, reason: "ZERO_OR_NEGATIVE" };

  // Scale to cents via string to avoid 25.50 * 100 float quirks.
  const fixed = major.toFixed(2);
  const [whole, frac = "00"] = fixed.split(".");
  const wholeN = Number(whole);
  const fracN = Number(frac.slice(0, 2).padEnd(2, "0"));
  if (!Number.isFinite(wholeN) || !Number.isFinite(fracN)) {
    return { ok: false, reason: "INVALID_AMOUNT" };
  }
  const minor = wholeN * 100 + fracN;
  if (!Number.isInteger(minor) || minor <= 0) {
    return { ok: false, reason: "INVALID_AMOUNT" };
  }
  return { ok: true, minor, currency: cur };
}
