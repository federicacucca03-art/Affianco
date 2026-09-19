/**
 * M10F — Evidence-based deep diagnosis for Meta campaigns.
 * Deterministic composer over M10C/D/E + trend. No Meta writes.
 */

export type {
  DeepDiagnosis,
  DeepDiagnosisInput,
  DeepDiagnosisEvaluability,
  DeepDiagnosticLayer,
  DeepDiagnosisConfidence,
  DeepFinding,
  DeepFindingSeverity,
} from "@/lib/meta/deep-diagnosis/types";

export {
  buildDeepDiagnosis,
  etichettaLayer,
  etichettaEvaluability,
  etichettaConfidence,
  formatCtrPercentagePoints,
} from "@/lib/meta/deep-diagnosis/build";

export {
  MATERIAL_CHANGE_PCT,
  isMaterialChange,
  isMaterialWorsening,
  isMaterialImproving,
  isApproximatelyStable,
  findDiagnostic,
} from "@/lib/meta/deep-diagnosis/change-gates";

export { deepFocusToDiagnosisArea } from "@/lib/meta/deep-diagnosis/next-action-bridge";
