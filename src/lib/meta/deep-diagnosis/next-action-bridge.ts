/**
 * M10F — optional bridge to existing M6D next-action vocabulary.
 * Does NOT create a second action engine — only maps diagnostic focus.
 */

import type { DiagnosisLikelyArea } from "@/lib/campaign-diagnosis/types";
import type { DeepDiagnosticLayer } from "@/lib/meta/deep-diagnosis/types";

/** Map M10F focus → M6C/M6D area labels (explanation support only). */
export function deepFocusToDiagnosisArea(
  focus: DeepDiagnosticLayer | null,
): DiagnosisLikelyArea | null {
  switch (focus) {
    case "MEASUREMENT":
      return "TRACKING";
    case "DELIVERY":
      return "DELIVERY";
    case "TRAFFIC":
      return "TRAFFIC_COST";
    case "CONVERSION":
      return "POST_CLICK";
    case "CONFIGURATION":
      return "UNKNOWN";
    case "ECONOMICS":
      return "RESULT_QUALITY";
    default:
      return null;
  }
}
