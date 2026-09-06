/**
 * M9.3A — Ally brief-to-campaign public exports.
 */

export type {
  AllyBriefProposal,
  AllyBriefField,
  AllyBriefFieldId,
  AllyBriefFieldValue,
  AllyBriefProvenance,
  AllyBriefAcceptedPayload,
  AllyBriefExistingClientContext,
} from "@/lib/ally-brief/types";

export {
  ALLY_BRIEF_MAX_CHARS,
  ALLY_BRIEF_SESSION_KEY,
  ALLY_BRIEF_FAILURE_MESSAGE,
  provenanceLabelIt,
  objectiveLabelIt,
  ALLY_BRIEF_FIELD_LABELS,
  OBJECTIVES_CANONICI,
} from "@/lib/ally-brief/types";

export {
  parseAllyBriefProposal,
  buildAllyBriefFallbackProposal,
  assertNoInventedEconomics,
  assertNoInventedMetaIds,
  isMeaningfulAllyBriefProposal,
} from "@/lib/ally-brief/parse";

export {
  saveAcceptedAllyBrief,
  readAcceptedAllyBrief,
  clearAcceptedAllyBrief,
  proposalToAcceptedPayload,
  editableValuesFromProposal,
} from "@/lib/ally-brief/session";

export {
  hrefWizardFromAcceptedBrief,
  seedBozzaFromAcceptedBrief,
  hydrationFromAcceptedBrief,
} from "@/lib/ally-brief/apply";
