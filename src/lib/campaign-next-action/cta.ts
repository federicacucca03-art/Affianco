/**
 * Safe internal CTAs only — never Meta write / budget mutation / pause.
 */

import type { AttentionSource } from "@/lib/monday-control-room";
import type { NextActionType } from "@/lib/campaign-next-action/types";

export function resolveNextActionCta(input: {
  actionType: NextActionType;
  source: AttentionSource;
  campaignId: string;
  /** Existing Monday row href (fallback). */
  rowHref: string;
}): { href: string | null; label: string | null } {
  const { actionType, source, campaignId, rowHref } = input;
  const nativeDetail = `/campagne/${encodeURIComponent(campaignId)}`;
  const risultati = `/risultati?campaignId=${encodeURIComponent(campaignId)}`;

  switch (actionType) {
    case "SET_TARGET":
      return {
        href: source === "NATIVE" ? risultati : "/risultati",
        label: "Apri target",
      };
    case "CONTACT_CLIENT":
      return {
        href: source === "NATIVE" ? nativeDetail : rowHref,
        label: "Apri campagna",
      };
    case "REVIEW_CAMPAIGN_SETUP":
      return {
        href: source === "NATIVE" ? nativeDetail : rowHref,
        label: "Apri campagna",
      };
    case "REVIEW_CREATIVE":
    case "CREATE_CREATIVE_VARIANT":
    case "REVIEW_COPY":
      return {
        href: source === "NATIVE" ? nativeDetail : rowHref,
        label: "Apri campagna",
      };
    case "VERIFY_TRACKING":
    case "REVIEW_LANDING_OR_FORM":
    case "REVIEW_AUDIENCE":
    case "REVIEW_BUDGET":
    case "REVIEW_OFFER":
    case "REVIEW_RESULT_QUALITY":
    case "WAIT_FOR_MORE_DATA":
    case "HISTORICAL_LEARNING":
      return { href: rowHref || null, label: rowHref ? "Apri" : null };
    case "NO_ACTION":
      return { href: null, label: null };
  }
}
