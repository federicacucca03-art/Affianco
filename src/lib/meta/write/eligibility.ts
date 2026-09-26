/**
 * M11A.2 — Write eligibility.
 * Ally-native only. Imported Meta never. Already-linked never for CREATE NEW.
 */

export function isAllyNativeWriteEligible(input: {
  /** True when the surface is a pure imported Meta campaign row. */
  isImportedMetaOnly: boolean;
}): boolean {
  return !input.isImportedMetaOnly;
}

export function isMetaCreateWriteEligible(input: {
  isImportedMetaOnly: boolean;
  /** Existing Meta campaign id already linked to this Ally campaign. */
  existingMetaCampaignId: string | null | undefined;
}): { ok: true } | { ok: false; reason: "IMPORTED_META_NOT_ELIGIBLE" | "ALREADY_LINKED_META" } {
  if (input.isImportedMetaOnly) {
    return { ok: false, reason: "IMPORTED_META_NOT_ELIGIBLE" };
  }
  const linked = (input.existingMetaCampaignId ?? "").trim();
  if (linked) {
    return { ok: false, reason: "ALREADY_LINKED_META" };
  }
  return { ok: true };
}
