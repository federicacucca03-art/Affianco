/**
 * M11A.1 — Billing event resolver (authoritative, no invented combos).
 */

export type BillingEventResolve =
  | { ok: true; billingEvent: string }
  | { ok: false; reason: "UNSUPPORTED_BILLING_EVENT" };

/**
 * Only combinations Ally is willing to assert for dry-run / future write.
 * Unsupported → blocked, not invented.
 */
export function resolveBillingEvent(input: {
  optimizationGoal: string | null;
}): BillingEventResolve {
  const goal = (input.optimizationGoal ?? "").toUpperCase();
  if (
    goal === "LEAD_GENERATION" ||
    goal === "REACH" ||
    goal === "IMPRESSIONS" ||
    goal === "LINK_CLICKS" ||
    goal === "LANDING_PAGE_VIEWS" ||
    goal === "OFFSITE_CONVERSIONS" ||
    goal === "CONVERSATIONS"
  ) {
    // Meta lead/reach/conversion auction sets commonly bill on IMPRESSIONS.
    return { ok: true, billingEvent: "IMPRESSIONS" };
  }
  return { ok: false, reason: "UNSUPPORTED_BILLING_EVENT" };
}
