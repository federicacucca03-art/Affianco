/**
 * M6C orchestration: eligibility → AI (if available) → response.
 * Does not mutate health/urgency/attention. No DB writes.
 */

import "server-only";

import { loadDiagnosisBundle } from "@/lib/campaign-diagnosis/load-context";
import { runCampaignAiDiagnosis } from "@/lib/campaign-diagnosis/service";
import { isDiagnosisUiEligible } from "@/lib/campaign-diagnosis/eligibility";
import type {
  CampaignDiagnosisResponse,
  DiagnosisSource,
} from "@/lib/campaign-diagnosis/types";

function messageForEligibility(
  eligibility: CampaignDiagnosisResponse["eligibility"],
): string {
  switch (eligibility) {
    case "AI_DIAGNOSIS_AVAILABLE":
      return "";
    case "AI_DIAGNOSIS_NOT_NEEDED":
      return "Questa campagna non richiede una diagnosi AI al momento.";
    case "AI_DIAGNOSIS_BLOCKED_INSUFFICIENT_DATA":
      return "Dati ancora insufficienti per una diagnosi affidabile.";
    case "AI_DIAGNOSIS_BLOCKED_CONFIGURATION":
      return "Completa la configurazione (target o risultato Meta) prima della diagnosi.";
    case "AI_DIAGNOSIS_HISTORICAL":
      return "La diagnosi storica AI non è ancora disponibile.";
  }
}

export async function diagnoseCampaignForUser(input: {
  userId: string;
  campaignId: string;
  source: DiagnosisSource;
}): Promise<CampaignDiagnosisResponse> {
  const bundle = await loadDiagnosisBundle(
    input.userId,
    input.source,
    input.campaignId,
  );

  if (!isDiagnosisUiEligible(bundle.eligibility)) {
    return {
      eligibility: bundle.eligibility,
      facts: bundle.facts,
      diagnosis: null,
      message: messageForEligibility(bundle.eligibility),
    };
  }

  try {
    const diagnosis = await runCampaignAiDiagnosis({
      payload: bundle.aiPayload,
      facts: bundle.facts,
    });
    return {
      eligibility: bundle.eligibility,
      facts: bundle.facts,
      diagnosis,
      message: null,
    };
  } catch (err) {
    const code = err instanceof Error ? err.message : "UNKNOWN";
    if (code === "CONFIG_MISSING") {
      return {
        eligibility: bundle.eligibility,
        facts: bundle.facts,
        diagnosis: null,
        message: "Analisi non disponibile al momento.",
      };
    }
    return {
      eligibility: bundle.eligibility,
      facts: bundle.facts,
      diagnosis: null,
      message: "Analisi non disponibile al momento.",
    };
  }
}
