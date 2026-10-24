/**
 * M14 — User-facing publish status labels.
 */

import type { MetaPublishProductStatus } from "@/lib/meta/publish/types";

export function etichettaPublishProductStatus(
  status: MetaPublishProductStatus,
): string {
  switch (status) {
    case "non_pronta":
      return "Non pronta per Meta";
    case "pronta":
      return "Pronta per Meta";
    case "in_preparazione":
      return "Pubblicazione in preparazione";
    case "incompleta":
      return "Pubblicazione incompleta";
    case "pubblicata":
      return "Pubblicata su Meta";
    case "problema":
      return "Problema di pubblicazione";
    default:
      return "Non pronta per Meta";
  }
}

export function resolvePublishProductStatus(input: {
  ready: boolean;
  blockingCount: number;
  hasVerifiedMetaObjects: boolean;
  hasPartialMetaObjects: boolean;
  hasPublishError: boolean;
}): MetaPublishProductStatus {
  if (input.hasVerifiedMetaObjects) return "pubblicata";
  if (input.hasPublishError) return "problema";
  if (input.hasPartialMetaObjects) return "incompleta";
  if (input.ready) return "pronta";
  if (input.blockingCount > 0) return "non_pronta";
  return "non_pronta";
}
