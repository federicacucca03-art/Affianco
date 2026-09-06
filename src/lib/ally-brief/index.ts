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
  ALLY_BRIEF_WEBSITE_CONTEXT_MAX_CHARS,
  ALLY_BRIEF_WEBSITE_FETCH_TIMEOUT_MS,
  ALLY_BRIEF_WEBSITE_MAX_BYTES,
  ALLY_BRIEF_WEBSITE_MAX_REDIRECTS,
  ALLY_BRIEF_WEBSITE_UNAVAILABLE_MESSAGE,
  ALLY_BRIEF_WEBSITE_BLOCKED_MESSAGE,
  validatePublicWebsiteUrl,
  isNonPublicIpAddress,
  isBlockedHostname,
  unwrapIpv4Mapped,
  pinPublicAddressOrReject,
  isAllowedWebsiteContentType,
  readStreamWithByteLimit,
  WEBSITE_FORBIDDEN_FIELD_IDS,
} from "@/lib/ally-brief/website-safety";

export { extractVisibleTextFromHtml } from "@/lib/ally-brief/website-extract";

export {
  parseAllyBriefProposal,
  buildAllyBriefFallbackProposal,
  assertNoInventedEconomics,
  assertNoInventedMetaIds,
  isMeaningfulAllyBriefProposal,
  isPlausibleClientIdentity,
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
  targetAgeBandFromEtaRange,
} from "@/lib/ally-brief/apply";
