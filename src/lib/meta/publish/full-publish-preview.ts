/**
 * Full-publish GET preview adapter.
 * Reuses M11A write-preview payloads but labels the plan as FULL_PUBLISH_PAUSED
 * when Campaign → Ad Set → Creative → Ad are present. Does not change Graph execute.
 */

import type { MetaWritePreviewResult } from "@/lib/meta/write/types";

const CAMPAIGN_ADSET_SLICE_FOOTNOTE =
  "Quando confermata, la creazione su Meta produce 1 campagna e 1 gruppo di inserzioni in stato non attivo (PAUSED). Nessuna pubblicazione automatica. Creatività e inserzione non create in questo slice.";

const RESUME_ADSET_SLICE_FOOTNOTE =
  "Ripresa gerarchia parziale: la campagna Meta esiste già (PAUSED). Alla conferma verrà creato solo il gruppo di inserzioni mancante in stato non attivo. Nessuna nuova campagna, nessuna creatività, nessuna inserzione, nessuna attivazione automatica.";

const FULL_PUBLISH_FOOTNOTE =
  "Quando confermata, Ally crea Campagna, Gruppo, Creatività e Annuncio su Meta in stato non attivo (PAUSED). Nessuna attivazione automatica.";

/**
 * Normalize nested writePreview so GET /api/meta/publish-plan matches
 * executeMetaPublishPlan (FULL_PUBLISH_PAUSED + creative/ad included).
 * Leaves Campaign+AdSet-only previews unchanged when creative/ad are absent.
 */
export function normalizeWritePreviewForFullPublish(
  writePreview: MetaWritePreviewResult,
  opts: { hasCreative: boolean; hasAd: boolean },
): MetaWritePreviewResult {
  if (!opts.hasCreative || !opts.hasAd) {
    return writePreview;
  }

  let footnote = writePreview.summaryIt.footnote;
  if (
    footnote.includes(CAMPAIGN_ADSET_SLICE_FOOTNOTE) ||
    footnote.includes(RESUME_ADSET_SLICE_FOOTNOTE) ||
    footnote.includes("Creatività e inserzione non create in questo slice")
  ) {
    footnote = footnote
      .replace(CAMPAIGN_ADSET_SLICE_FOOTNOTE, FULL_PUBLISH_FOOTNOTE)
      .replace(RESUME_ADSET_SLICE_FOOTNOTE, FULL_PUBLISH_FOOTNOTE)
      .replace(/Creatività e inserzione non create in questo slice\.?/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  return {
    ...writePreview,
    operationType: "FULL_PUBLISH_PAUSED",
    creative: { enabled: true, reason: "FULL_PUBLISH_INCLUDED" },
    ad: { enabled: true, reason: "FULL_PUBLISH_INCLUDED" },
    summaryIt: {
      ...writePreview.summaryIt,
      footnote,
    },
    safePayloadSummary: {
      ...writePreview.safePayloadSummary,
      operationType: "FULL_PUBLISH_PAUSED",
    },
  };
}
