/**
 * Full-publish GET preview operationType consistency vs execute.
 * LIVE META WRITES: 0 | DB: 0
 * Esegui: npx tsx scripts/verifica-meta-full-publish-preview-operation-type.ts
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { normalizeWritePreviewForFullPublish } from "../src/lib/meta/publish/full-publish-preview";
import type { MetaWritePreviewResult } from "../src/lib/meta/write/types";

const root = resolve(__dirname, "..");
let falliti = 0;

function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error(`FAIL  ${msg}`);
    falliti += 1;
  } else {
    console.log(`PASS  ${msg}`);
  }
}

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function basePreview(
  overrides: Partial<MetaWritePreviewResult> = {},
): MetaWritePreviewResult {
  return {
    operationType: "CAMPAIGN_ADSET_PAUSED",
    readinessCodes: ["READY_TO_PREVIEW"],
    canPreview: true,
    canWrite: true,
    resumeMode: null,
    writeAlreadyCompleted: false,
    adsManagementPresent: true,
    fingerprint: "fp-test",
    idempotencyKey: "idem-test",
    campaign: null,
    adSet: null,
    creative: { enabled: false, reason: "DEFERRED_SLICE" },
    ad: { enabled: false, reason: "DEFERRED_SLICE" },
    blockersIt: [],
    summaryIt: {
      campaignLines: ["campagna"],
      adSetLines: ["gruppo"],
      missingLines: [],
      footnote:
        "Quando confermata, la creazione su Meta produce 1 campagna e 1 gruppo di inserzioni in stato non attivo (PAUSED). Nessuna pubblicazione automatica. Creatività e inserzione non create in questo slice. Configurazione pronta.",
    },
    safePayloadSummary: {
      operationType: "CAMPAIGN_ADSET_PAUSED",
      fingerprint: "fp-test",
    },
    ...overrides,
  };
}

console.log("FULL_PUBLISH preview operationType consistency\n");

// A — GET full publish plan reports FULL_PUBLISH_PAUSED
{
  const planSrc = read("src/lib/meta/publish/plan.ts");
  assert(
    planSrc.includes("normalizeWritePreviewForFullPublish"),
    "A buildMetaPublishPlan adapts writePreview",
  );
  const adapted = normalizeWritePreviewForFullPublish(basePreview(), {
    hasCreative: true,
    hasAd: true,
  });
  assert(
    adapted.operationType === "FULL_PUBLISH_PAUSED",
    "A adapter operationType FULL_PUBLISH_PAUSED",
  );
}

// B — safePayloadSummary reports FULL_PUBLISH_PAUSED
{
  const adapted = normalizeWritePreviewForFullPublish(basePreview(), {
    hasCreative: true,
    hasAd: true,
  });
  assert(
    adapted.safePayloadSummary.operationType === "FULL_PUBLISH_PAUSED",
    "B safePayloadSummary.operationType FULL_PUBLISH_PAUSED",
  );
}

// C — Creative and Ad included, not deferred
{
  const adapted = normalizeWritePreviewForFullPublish(basePreview(), {
    hasCreative: true,
    hasAd: true,
  });
  assert(
    adapted.creative.enabled === true &&
      adapted.creative.reason === "FULL_PUBLISH_INCLUDED",
    "C creative included in full hierarchy",
  );
  assert(
    adapted.ad.enabled === true && adapted.ad.reason === "FULL_PUBLISH_INCLUDED",
    "C ad included in full hierarchy",
  );
  assert(
    !adapted.summaryIt.footnote.includes("non create in questo slice"),
    "C footnote no longer defers creative/ad",
  );
}

// D — POST execute still resolves FULL_PUBLISH_PAUSED
{
  const exec = read("src/lib/meta/publish/execute.ts");
  const ops = read("src/lib/meta/write/operations.ts");
  assert(
    exec.includes('kind: "FULL_PUBLISH_PAUSED"') ||
      exec.includes("FULL_PUBLISH_PAUSED"),
    "D execute uses FULL_PUBLISH_PAUSED",
  );
  assert(
    ops.includes('operation_type: "FULL_PUBLISH_PAUSED"') ||
      ops.includes('operation_type", "FULL_PUBLISH_PAUSED"'),
    "D full publish ops persist FULL_PUBLISH_PAUSED",
  );
  assert(
    !exec.includes('operationType: "CAMPAIGN_ADSET_PAUSED"'),
    "D execute does not switch to CAMPAIGN_ADSET_PAUSED",
  );
}

// E — legacy Campaign+AdSet-only preview unchanged
{
  const previewSrc = read("src/lib/meta/write/preview.ts");
  assert(
    previewSrc.includes('operationType: "CAMPAIGN_ADSET_PAUSED"'),
    "E M11A preview still hardcodes CAMPAIGN_ADSET_PAUSED",
  );
  assert(
    previewSrc.includes("DEFERRED_SLICE"),
    "E M11A preview still defers creative/ad",
  );
  const untouched = normalizeWritePreviewForFullPublish(basePreview(), {
    hasCreative: false,
    hasAd: false,
  });
  assert(
    untouched.operationType === "CAMPAIGN_ADSET_PAUSED",
    "E adapter no-op without creative+ad",
  );
  assert(
    untouched.creative.enabled === false &&
      untouched.creative.reason === "DEFERRED_SLICE",
    "E adapter leaves deferred creative when hierarchy incomplete",
  );
  const writeConfirm = read("src/app/api/meta/write-confirm/route.ts");
  assert(
    writeConfirm.includes('writeSlice: "CAMPAIGN_ADSET_PAUSED"'),
    "E write-confirm legacy slice intact",
  );
}

// F — all four Meta ID persistence paths remain available
{
  const ops = read("src/lib/meta/write/operations.ts");
  const exec = read("src/lib/meta/publish/execute.ts");
  const persist = read("src/lib/meta/publish/persist.ts");
  assert(
    ops.includes("meta_campaign_id") &&
      ops.includes("meta_adset_id") &&
      ops.includes("meta_creative_id") &&
      ops.includes("meta_ad_id"),
    "F operation model has all four IDs",
  );
  assert(
    exec.includes("meta_creative_id:") && exec.includes("meta_ad_id:"),
    "F execute patches creative + ad IDs",
  );
  assert(
    persist.includes("meta_ad_id") && persist.includes("creative_id"),
    "F persist hierarchy includes ad + creative",
  );
}

console.log(
  falliti === 0
    ? "\n=== FULL_PUBLISH preview operationType: TUTTI I CHECK PASS ===\n"
    : `\n=== FULL_PUBLISH preview operationType: ${falliti} FAIL ===\n`,
);
process.exit(falliti === 0 ? 0 : 1);
