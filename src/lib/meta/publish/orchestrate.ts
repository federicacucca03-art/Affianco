/**
 * M14 — Orchestration: dry-run + re-export execute.
 * Dry-run never contacts Meta mutation endpoints and never marks SYNCED.
 */

import "server-only";
import { isMetaWritesLiveEnabled } from "@/lib/meta/config";
import {
  buildMetaPublishPlan,
  validateMetaPublishPlan,
} from "@/lib/meta/publish/plan";
import {
  META_PUBLISH_ORDER,
  type MetaPublishDryRunResult,
  type MetaPublishStepResult,
} from "@/lib/meta/publish/types";

export {
  executeMetaPublishPlan,
  isFullPublishLiveExecutionAllowed,
  __resetFullPublishMemoryOpsForTests,
} from "@/lib/meta/publish/execute";

function step(
  id: MetaPublishStepResult["step"],
  status: MetaPublishStepResult["status"],
  messageIt: string | null,
): MetaPublishStepResult {
  return {
    step: id,
    status,
    metaObjectId: null,
    mockOnly: false,
    messageIt,
  };
}

/**
 * Dry-run full publish flow. Never performs Graph mutations.
 */
export async function dryRunMetaPublishPlan(input: {
  userId: string;
  allyCampaignId: string;
}): Promise<MetaPublishDryRunResult> {
  const plan = await buildMetaPublishPlan(input);
  const validation = validateMetaPublishPlan(plan);
  const live = isMetaWritesLiveEnabled();
  const steps: MetaPublishStepResult[] = [];

  if (!validation.ready) {
    steps.push(
      step(
        "VALIDATE",
        "FAILED",
        validation.blockingIssues[0]?.messageIt ??
          "Validazione pubblicazione non superata.",
      ),
    );
    for (const s of META_PUBLISH_ORDER.slice(1)) {
      steps.push(step(s, "SKIPPED", "Bloccato dalla validazione."));
    }
    return {
      plan,
      executed: false,
      liveWritesGated: !live,
      steps,
      failedAt: "VALIDATE",
      markedSynced: false,
      markedPublished: false,
    };
  }

  steps.push(step("VALIDATE", "VALID", "Piano completo e coerente."));

  const campaignOk = Boolean(plan.writePreview.campaign);
  const adSetOk = Boolean(plan.writePreview.adSet);
  const creativeOk = Boolean(plan.creative);
  const adOk = Boolean(plan.ad);

  steps.push(
    step(
      "CREATE_CAMPAIGN",
      campaignOk ? "VALID" : "FAILED",
      campaignOk
        ? "Payload campagna Meta VALID (PAUSED)."
        : "Payload campagna incompleto.",
    ),
  );
  if (!campaignOk) {
    for (const s of [
      "CREATE_ADSET",
      "CREATE_CREATIVE",
      "CREATE_AD",
      "ESTABLISH_LINK",
      "MARK_SYNC_BASELINE",
    ] as const) {
      steps.push(step(s, "SKIPPED", "Dipendenza precedente fallita."));
    }
    return {
      plan,
      executed: false,
      liveWritesGated: !live,
      steps,
      failedAt: "CREATE_CAMPAIGN",
      markedSynced: false,
      markedPublished: false,
    };
  }

  steps.push(
    step(
      "CREATE_ADSET",
      adSetOk ? "VALID" : "FAILED",
      adSetOk
        ? "Payload ad set Meta VALID (PAUSED)."
        : "Payload ad set incompleto.",
    ),
  );
  if (!adSetOk) {
    for (const s of [
      "CREATE_CREATIVE",
      "CREATE_AD",
      "ESTABLISH_LINK",
      "MARK_SYNC_BASELINE",
    ] as const) {
      steps.push(step(s, "SKIPPED", "Dipendenza precedente fallita."));
    }
    return {
      plan,
      executed: false,
      liveWritesGated: !live,
      steps,
      failedAt: "CREATE_ADSET",
      markedSynced: false,
      markedPublished: false,
    };
  }

  steps.push(
    step(
      "CREATE_CREATIVE",
      creativeOk ? "VALID" : "FAILED",
      creativeOk
        ? "Payload creatività Meta VALID (media upload via Ally Storage → Meta)."
        : "Payload creatività incompleto.",
    ),
  );
  if (!creativeOk) {
    for (const s of [
      "CREATE_AD",
      "ESTABLISH_LINK",
      "MARK_SYNC_BASELINE",
    ] as const) {
      steps.push(step(s, "SKIPPED", "Dipendenza precedente fallita."));
    }
    return {
      plan,
      executed: false,
      liveWritesGated: !live,
      steps,
      failedAt: "CREATE_CREATIVE",
      markedSynced: false,
      markedPublished: false,
    };
  }

  steps.push(
    step(
      "CREATE_AD",
      adOk ? "VALID" : "FAILED",
      adOk
        ? "Payload annuncio Meta VALID (PAUSED)."
        : "Payload annuncio incompleto.",
    ),
  );
  if (!adOk) {
    steps.push(
      step("ESTABLISH_LINK", "SKIPPED", "Dipendenza precedente fallita."),
    );
    steps.push(
      step("MARK_SYNC_BASELINE", "SKIPPED", "Dipendenza precedente fallita."),
    );
    return {
      plan,
      executed: false,
      liveWritesGated: !live,
      steps,
      failedAt: "CREATE_AD",
      markedSynced: false,
      markedPublished: false,
    };
  }

  steps.push(
    step(
      "ESTABLISH_LINK",
      "GATED",
      "Collegamento Ally ↔ Meta solo dopo write live verificate.",
    ),
  );
  steps.push(
    step(
      "MARK_SYNC_BASELINE",
      "GATED",
      "Baseline SYNCED solo dopo verifica Meta reale (mai in dry-run).",
    ),
  );

  return {
    plan,
    executed: false,
    liveWritesGated: !live,
    steps,
    failedAt: null,
    markedSynced: false,
    markedPublished: false,
  };
}

export { buildMetaPublishPlan, validateMetaPublishPlan };
