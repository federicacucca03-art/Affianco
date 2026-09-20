/**
 * M11A.1 — Eligibility: Ally-native only. Imported Meta never create-eligible.
 */

export function isAllyNativeWriteEligible(input: {
  /** True when the surface is a pure imported Meta campaign row. */
  isImportedMetaOnly: boolean;
}): boolean {
  return !input.isImportedMetaOnly;
}
