/**
 * M11A.2J — Deterministic Ally bid mode → Meta bid_strategy / bid_amount.
 * No AI. Automatic/no-cap never invents a bid_amount.
 */

export type AllyBidMode =
  | "AUTOMATIC_NO_CAP"
  | "BID_CAP"
  | "COST_CAP"
  | "MIN_ROAS";

/** Official Meta Ad Set bid_strategy enum (Marketing API / Graph Ad Set). */
export const META_BID_STRATEGY_LOWEST_COST_WITHOUT_CAP =
  "LOWEST_COST_WITHOUT_CAP" as const;
export const META_BID_STRATEGY_LOWEST_COST_WITH_BID_CAP =
  "LOWEST_COST_WITH_BID_CAP" as const;
export const META_BID_STRATEGY_COST_CAP = "COST_CAP" as const;
export const META_BID_STRATEGY_LOWEST_COST_WITH_MIN_ROAS =
  "LOWEST_COST_WITH_MIN_ROAS" as const;

/** Contract: LOWEST_COST_WITHOUT_CAP is automatic bidding; bid_amount must be omitted. */
export const LOWEST_COST_WITHOUT_CAP_SUPPORTED = true;
export const BID_AMOUNT_REQUIRED_WITH_LOWEST_COST_WITHOUT_CAP = false;

export type MetaBidResolve =
  | {
      ok: true;
      allyBidMode: AllyBidMode;
      bidStrategy: string;
      bidAmount: number | null;
      humanLabelIt: string;
    }
  | {
      ok: false;
      allyBidMode: AllyBidMode;
      bidStrategy: string | null;
      bidAmount: number | null;
      reason:
        | "MISSING_BID_AMOUNT"
        | "MISSING_MIN_ROAS"
        | "UNSUPPORTED_BID_MODE";
      humanLabelIt: string | null;
    };

/**
 * Default Ally write slice: automatic / no cap.
 * Manual modes require their own amount/ROAS — never silently map to automatic.
 */
export function resolveMetaBidStrategy(input: {
  allyBidMode?: AllyBidMode | null;
  bidAmountMinor?: number | null;
  minRoas?: number | null;
}): MetaBidResolve {
  const mode: AllyBidMode = input.allyBidMode ?? "AUTOMATIC_NO_CAP";

  if (mode === "AUTOMATIC_NO_CAP") {
    return {
      ok: true,
      allyBidMode: mode,
      bidStrategy: META_BID_STRATEGY_LOWEST_COST_WITHOUT_CAP,
      bidAmount: null,
      humanLabelIt: "Costo più basso, senza limite di offerta",
    };
  }

  if (mode === "BID_CAP") {
    const amount = input.bidAmountMinor;
    if (amount == null || !Number.isFinite(amount) || amount <= 0) {
      return {
        ok: false,
        allyBidMode: mode,
        bidStrategy: META_BID_STRATEGY_LOWEST_COST_WITH_BID_CAP,
        bidAmount: null,
        reason: "MISSING_BID_AMOUNT",
        humanLabelIt: "Limite di offerta (importo mancante)",
      };
    }
    return {
      ok: true,
      allyBidMode: mode,
      bidStrategy: META_BID_STRATEGY_LOWEST_COST_WITH_BID_CAP,
      bidAmount: Math.round(amount),
      humanLabelIt: "Costo più basso, con limite di offerta",
    };
  }

  if (mode === "COST_CAP") {
    const amount = input.bidAmountMinor;
    if (amount == null || !Number.isFinite(amount) || amount <= 0) {
      return {
        ok: false,
        allyBidMode: mode,
        bidStrategy: META_BID_STRATEGY_COST_CAP,
        bidAmount: null,
        reason: "MISSING_BID_AMOUNT",
        humanLabelIt: "Limite di costo (importo mancante)",
      };
    }
    return {
      ok: true,
      allyBidMode: mode,
      bidStrategy: META_BID_STRATEGY_COST_CAP,
      bidAmount: Math.round(amount),
      humanLabelIt: "Limite di costo",
    };
  }

  if (mode === "MIN_ROAS") {
    const roas = input.minRoas;
    if (roas == null || !Number.isFinite(roas) || roas <= 0) {
      return {
        ok: false,
        allyBidMode: mode,
        bidStrategy: META_BID_STRATEGY_LOWEST_COST_WITH_MIN_ROAS,
        bidAmount: null,
        reason: "MISSING_MIN_ROAS",
        humanLabelIt: "ROAS minimo (valore mancante)",
      };
    }
    // bid_amount must be omitted for MIN_ROAS; ROAS lives in bid_constraints (deferred).
    return {
      ok: false,
      allyBidMode: mode,
      bidStrategy: META_BID_STRATEGY_LOWEST_COST_WITH_MIN_ROAS,
      bidAmount: null,
      reason: "UNSUPPORTED_BID_MODE",
      humanLabelIt: "ROAS minimo (non supportato in questo slice)",
    };
  }

  return {
    ok: false,
    allyBidMode: mode,
    bidStrategy: null,
    bidAmount: null,
    reason: "UNSUPPORTED_BID_MODE",
    humanLabelIt: null,
  };
}
