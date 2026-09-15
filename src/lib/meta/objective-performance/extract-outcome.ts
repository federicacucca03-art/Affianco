/**
 * M10C — Extract primary outcome from Graph actions by objective profile.
 * Objective prioritizes candidates; evidence still required for CONFIDENT.
 * Multiple positive candidate types → AMBIGUOUS (never invent a winner).
 */

import {
  extractPrimaryLeadResult,
  extractPurchaseValue,
  type NormalizedMetaAction,
  type ResultMappingConfidence,
} from "@/lib/meta/insight-actions";
import type {
  ObjectiveOutcomeExtraction,
  ObjectivePerformanceProfile,
} from "@/lib/meta/objective-performance/types";

function hitsForTypes(
  actions: NormalizedMetaAction[],
  types: readonly string[],
): NormalizedMetaAction[] {
  return types
    .map((type) => actions.find((a) => a.actionType === type && a.value > 0))
    .filter((a): a is NormalizedMetaAction => a != null);
}

function singleOrAmbiguous(
  hits: NormalizedMetaAction[],
): {
  primaryResultType: string | null;
  primaryResults: number | null;
  mappingConfidence: ResultMappingConfidence;
} {
  if (hits.length === 0) {
    return {
      primaryResultType: null,
      primaryResults: null,
      mappingConfidence: "UNKNOWN",
    };
  }
  if (hits.length > 1) {
    return {
      primaryResultType: null,
      primaryResults: null,
      mappingConfidence: "AMBIGUOUS",
    };
  }
  return {
    primaryResultType: hits[0].actionType,
    primaryResults: hits[0].value,
    mappingConfidence: "CONFIDENT",
  };
}

/**
 * Traffic: prefer landing_page_view; if only link_click, use it with limitation.
 * Do not treat link_click as a lead.
 */
function extractTrafficOutcome(
  actions: NormalizedMetaAction[],
): ObjectiveOutcomeExtraction {
  const lpv = hitsForTypes(actions, [
    "landing_page_view",
    "omni_landing_page_view",
  ]);
  if (lpv.length === 1) {
    return {
      primaryResultType: lpv[0].actionType,
      primaryResults: lpv[0].value,
      primaryResultValue: null,
      mappingConfidence: "CONFIDENT",
      outcomeLimitation: null,
    };
  }
  if (lpv.length > 1) {
    return {
      primaryResultType: null,
      primaryResults: null,
      primaryResultValue: null,
      mappingConfidence: "AMBIGUOUS",
      outcomeLimitation: null,
    };
  }
  const clicks = hitsForTypes(actions, ["link_click"]);
  if (clicks.length === 1) {
    return {
      primaryResultType: clicks[0].actionType,
      primaryResults: clicks[0].value,
      primaryResultValue: null,
      mappingConfidence: "CONFIDENT",
      outcomeLimitation:
        "Disponibili solo click sul link, non visite landing page.",
    };
  }
  if (clicks.length > 1) {
    return {
      primaryResultType: null,
      primaryResults: null,
      primaryResultValue: null,
      mappingConfidence: "AMBIGUOUS",
      outcomeLimitation: null,
    };
  }
  return {
    primaryResultType: null,
    primaryResults: null,
    primaryResultValue: null,
    mappingConfidence: "UNKNOWN",
    outcomeLimitation: null,
  };
}

export function extractOutcomeForProfile(
  profile: ObjectivePerformanceProfile,
  actions: NormalizedMetaAction[],
  actionValues: NormalizedMetaAction[],
): ObjectiveOutcomeExtraction {
  switch (profile.family) {
    case "LEADS": {
      const lead = extractPrimaryLeadResult(actions);
      return {
        ...lead,
        primaryResultValue: null,
        outcomeLimitation: null,
      };
    }
    case "SALES": {
      const purchase = singleOrAmbiguous(
        hitsForTypes(actions, profile.resultActionCandidates),
      );
      const value = extractPurchaseValue(actionValues);
      return {
        primaryResultType: purchase.primaryResultType,
        primaryResults: purchase.primaryResults,
        // Value only when CONFIDENT purchase value mapping (separate from count).
        primaryResultValue:
          value.mappingConfidence === "CONFIDENT"
            ? value.primaryResultValue
            : null,
        mappingConfidence: purchase.mappingConfidence,
        outcomeLimitation:
          purchase.mappingConfidence === "CONFIDENT" &&
          value.mappingConfidence !== "CONFIDENT"
            ? "Acquisti presenti, ma valore di conversione non affidabile per ROAS."
            : purchase.mappingConfidence === "UNKNOWN"
              ? "Tracking acquisti non sufficiente."
              : null,
      };
    }
    case "TRAFFIC":
      return extractTrafficOutcome(actions);
    case "ENGAGEMENT": {
      const eng = singleOrAmbiguous(
        hitsForTypes(actions, profile.resultActionCandidates),
      );
      return { ...eng, primaryResultValue: null, outcomeLimitation: null };
    }
    case "AWARENESS":
      return {
        primaryResultType: null,
        primaryResults: null,
        primaryResultValue: null,
        mappingConfidence: "UNKNOWN",
        outcomeLimitation: null,
      };
    default:
      return {
        primaryResultType: null,
        primaryResults: null,
        primaryResultValue: null,
        mappingConfidence: "UNKNOWN",
        outcomeLimitation: null,
      };
  }
}
