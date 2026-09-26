/**
 * M11A.2 — Confirm + execute Campaign + Ad Set PAUSED create.
 * Live Graph POST gated by META_WRITES_LIVE=1.
 * Injectable transport for tests. No AI. No browser token.
 */

import "server-only";
import { isMetaWritesLiveEnabled } from "@/lib/meta/config";
import {
  getMetaConnectionForClient,
  getDecryptedMetaAccessToken,
} from "@/lib/meta/connections";
import { getClientMetaAccount } from "@/lib/meta/client-accounts";
import { MetaError } from "@/lib/meta/errors";
import { assertPreviewFingerprintMatch } from "@/lib/meta/write/preview";
import { buildWritePreviewForAllyCampaign } from "@/lib/meta/write/load-preview";
import {
  createMetaAdSetPaused,
  createMetaCampaignPaused,
  validateMetaAdSetPaused,
  type MetaGraphWriteTransport,
} from "@/lib/meta/write/graph-write";
import {
  getMetaWriteOperationByIdempotency,
  getProtectedMetaWriteOperation,
  logMetaWritePreviewOperation,
  updateMetaWriteOperation,
} from "@/lib/meta/write/operations";
import { normalizeMetaWriteError } from "@/lib/meta/write/error-normalize";
import { META_WRITE_SCOPE } from "@/lib/meta/oauth";
import { connectionHasScope } from "@/lib/meta/scopes";
import type { MetaWritePreviewResult } from "@/lib/meta/write/types";
import { META_WRITE_SAFE_STATUS } from "@/lib/meta/write/types";

export type ConfirmWriteInput = {
  userId: string;
  allyCampaignId: string;
  fingerprint: string;
  /** Explicit human confirmation flag from client — required. */
  humanConfirmed: boolean;
  transport?: MetaGraphWriteTransport;
};

export type ConfirmWriteResult = {
  executed: boolean;
  liveWritesGated: boolean;
  preview: MetaWritePreviewResult;
  operationId: string | null;
  state: string;
  metaCampaignId: string | null;
  metaAdSetId: string | null;
  errorCategory: string | null;
  errorSafeMessage: string | null;
};

export async function confirmAndExecuteMetaWrite(
  input: ConfirmWriteInput,
): Promise<ConfirmWriteResult> {
  if (!input.humanConfirmed) {
    throw new MetaError(
      "META_CONNECTION_INVALID",
      "Conferma esplicita richiesta.",
    );
  }

  const preview = await buildWritePreviewForAllyCampaign({
    userId: input.userId,
    allyCampaignId: input.allyCampaignId,
    hydrateFromCanonical: true,
    persist: true,
  });

  const match = assertPreviewFingerprintMatch(
    preview.fingerprint,
    input.fingerprint,
  );
  if (!match.ok) {
    const norm = normalizeMetaWriteError({ localCode: "STALE_PREVIEW" });
    return {
      executed: false,
      liveWritesGated: !isMetaWritesLiveEnabled(),
      preview: {
        ...preview,
        readinessCodes: [...preview.readinessCodes, "STALE_PREVIEW"],
        canWrite: false,
      },
      operationId: null,
      state: "FAILED",
      metaCampaignId: null,
      metaAdSetId: null,
      errorCategory: norm.category,
      errorSafeMessage: norm.safeMessage,
    };
  }

  if (!preview.canWrite) {
    return {
      executed: false,
      liveWritesGated: !isMetaWritesLiveEnabled(),
      preview,
      operationId: null,
      state: "PREVIEWED",
      metaCampaignId: null,
      metaAdSetId: null,
      errorCategory: "INVALID_PARAM",
      errorSafeMessage: "Configurazione non pronta per la creazione su Meta.",
    };
  }

  // Prefer recovery/partial row over a fresh PREVIEWED fingerprint row.
  const protectedOp = await getProtectedMetaWriteOperation({
    userId: input.userId,
    allyCampaignId: input.allyCampaignId,
  });

  const existing =
    protectedOp ??
    (await getMetaWriteOperationByIdempotency({
      userId: input.userId,
      allyCampaignId: input.allyCampaignId,
      idempotencyKey: preview.idempotencyKey,
    }));

  if (existing?.state === "COMPLETED") {
    return {
      executed: false,
      liveWritesGated: false,
      preview,
      operationId: existing.id,
      state: "COMPLETED",
      metaCampaignId: existing.meta_campaign_id,
      metaAdSetId: existing.meta_adset_id,
      errorCategory: "DUPLICATE_OPERATION",
      errorSafeMessage: "Operazione già completata. Nessuna nuova creazione.",
    };
  }

  // Double-click / already-have-adset: never create a second Ad Set.
  if (existing?.meta_adset_id) {
    return {
      executed: false,
      liveWritesGated: false,
      preview,
      operationId: existing.id,
      state: existing.state,
      metaCampaignId: existing.meta_campaign_id,
      metaAdSetId: existing.meta_adset_id,
      errorCategory: "DUPLICATE_OPERATION",
      errorSafeMessage:
        "Gruppo di inserzioni già presente. Nessuna nuova creazione.",
    };
  }

  // RESUME_ADSET: must have PARTIALLY_CREATED + campaign id + null adset.
  if (preview.resumeMode === "RESUME_ADSET") {
    if (
      !existing ||
      existing.state !== "PARTIALLY_CREATED" ||
      !existing.meta_campaign_id
    ) {
      return {
        executed: false,
        liveWritesGated: !isMetaWritesLiveEnabled(),
        preview,
        operationId: existing?.id ?? null,
        state: existing?.state ?? "FAILED",
        metaCampaignId: existing?.meta_campaign_id ?? null,
        metaAdSetId: null,
        errorCategory: "PARTIAL_HIERARCHY",
        errorSafeMessage:
          "Ripresa Ad Set non disponibile: operazione di recupero incompleta.",
      };
    }
  }

  const clientId =
    typeof preview.safePayloadSummary.clientId === "string"
      ? preview.safePayloadSummary.clientId
      : "";

  if (!existing) {
    await logMetaWritePreviewOperation({
      userId: input.userId,
      clientId,
      allyCampaignId: input.allyCampaignId,
      preview,
    });
  }

  const op =
    existing ??
    (await getMetaWriteOperationByIdempotency({
      userId: input.userId,
      allyCampaignId: input.allyCampaignId,
      idempotencyKey: preview.idempotencyKey,
    }));
  const operationId = op?.id ?? null;

  if (!operationId || !op) {
    return {
      executed: false,
      liveWritesGated: !isMetaWritesLiveEnabled(),
      preview,
      operationId: null,
      state: "FAILED",
      metaCampaignId: null,
      metaAdSetId: null,
      errorCategory: "NETWORK",
      errorSafeMessage: "Operazione non persistita.",
    };
  }

  const live = isMetaWritesLiveEnabled();
  if (!live) {
    await updateMetaWriteOperation({
      id: operationId,
      patch: {
        state: "CONFIRMED",
        confirmed_at: new Date().toISOString(),
        error_category: null,
        error_safe_message: "LIVE_WRITES_GATED",
        safe_payload_summary: {
          ...preview.safePayloadSummary,
          liveWritesGated: true,
          status: META_WRITE_SAFE_STATUS,
        },
      },
    });
    return {
      executed: false,
      liveWritesGated: true,
      preview: {
        ...preview,
        readinessCodes: [...preview.readinessCodes, "LIVE_WRITES_GATED"],
      },
      operationId,
      state: "CONFIRMED",
      metaCampaignId: op.meta_campaign_id,
      metaAdSetId: op.meta_adset_id,
      errorCategory: null,
      errorSafeMessage:
        "Conferma registrata. Creazione live su Meta ancora disabilitata (META_WRITES_LIVE).",
    };
  }

  // --- LIVE WRITE PATH ---
  const connection = await getMetaConnectionForClient(
    input.userId,
    op.client_id,
  );
  if (!connection || !connectionHasScope(connection, META_WRITE_SCOPE)) {
    return {
      executed: false,
      liveWritesGated: false,
      preview,
      operationId,
      state: op.state,
      metaCampaignId: op.meta_campaign_id,
      metaAdSetId: op.meta_adset_id,
      errorCategory: "PERMISSION",
      errorSafeMessage:
        "Manca il permesso per creare campagne su Meta (ads_management).",
    };
  }
  const accessToken = await getDecryptedMetaAccessToken(
    input.userId,
    op.client_id,
  );
  const account = await getClientMetaAccount(input.userId, op.client_id);
  if (!account?.metaAdAccountId) {
    throw new MetaError(
      "META_AD_ACCOUNT_NOT_SELECTED",
      "Account pubblicitario Meta mancante.",
    );
  }

  await updateMetaWriteOperation({
    id: operationId,
    patch: {
      state: "IN_PROGRESS",
      confirmed_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
    },
  });

  const campaign = preview.campaign!;
  const adSet = preview.adSet!;
  let metaCampaignId = op.meta_campaign_id;
  let metaAdSetId = op.meta_adset_id;

  if (!metaCampaignId) {
    const cats =
      campaign.special_ad_categories == null
        ? null
        : campaign.special_ad_categories;
    if (cats == null || !campaign.objective) {
      await updateMetaWriteOperation({
        id: operationId,
        patch: {
          state: "FAILED",
          error_category: "INVALID_PARAM",
          error_safe_message: "Payload campagna incompleto.",
        },
      });
      return {
        executed: false,
        liveWritesGated: false,
        preview,
        operationId,
        state: "FAILED",
        metaCampaignId: null,
        metaAdSetId: null,
        errorCategory: "INVALID_PARAM",
        errorSafeMessage: "Payload campagna incompleto.",
      };
    }

    const created = await createMetaCampaignPaused({
      accessToken,
      adAccountId: account.metaAdAccountId,
      name: campaign.name,
      objective: campaign.objective,
      specialAdCategories: cats,
      dailyBudgetMinor: campaign.daily_budget,
      isAdsetBudgetSharingEnabled: campaign.is_adset_budget_sharing_enabled,
      transport: input.transport,
    });
    if (!created.ok) {
      await updateMetaWriteOperation({
        id: operationId,
        patch: {
          state: "FAILED",
          error_category: created.category,
          error_safe_message: created.safeMessage,
          completed_at: new Date().toISOString(),
        },
      });
      return {
        executed: false,
        liveWritesGated: false,
        preview,
        operationId,
        state: "FAILED",
        metaCampaignId: null,
        metaAdSetId: null,
        errorCategory: created.category,
        errorSafeMessage: created.safeMessage,
      };
    }
    metaCampaignId = created.id;
    // Persist ID immediately before Ad Set
    await updateMetaWriteOperation({
      id: operationId,
      patch: { meta_campaign_id: metaCampaignId },
    });
  }

  if (!metaAdSetId) {
    if (
      !adSet.optimization_goal ||
      !adSet.billing_event ||
      !adSet.targeting
    ) {
      await updateMetaWriteOperation({
        id: operationId,
        patch: {
          state: "PARTIALLY_CREATED",
          meta_campaign_id: metaCampaignId,
          error_category: "PARTIAL_HIERARCHY",
          error_safe_message:
            "Campagna creata, ma il gruppo non è configurabile (campi mancanti).",
          completed_at: new Date().toISOString(),
        },
      });
      return {
        executed: true,
        liveWritesGated: false,
        preview,
        operationId,
        state: "PARTIALLY_CREATED",
        metaCampaignId,
        metaAdSetId: null,
        errorCategory: "PARTIAL_HIERARCHY",
        errorSafeMessage:
          "Campagna creata su Meta (PAUSED), gruppo non creato. Nessuna eliminazione automatica.",
      };
    }

    // M11A.2D — Ad Set validate_only with real campaign_id BEFORE create.
    // Fail → PARTIALLY_CREATED; Campaign stays PAUSED; no delete/rollback.
    const adsetValidated = await validateMetaAdSetPaused({
      accessToken,
      adAccountId: account.metaAdAccountId,
      name: adSet.name,
      campaignId: metaCampaignId,
      optimizationGoal: adSet.optimization_goal,
      billingEvent: adSet.billing_event,
      dailyBudgetMinor: adSet.daily_budget,
      targeting: adSet.targeting,
      startTime: adSet.start_time,
      endTime: adSet.end_time,
      promotedObject: adSet.promoted_object,
      destinationType: adSet.destination_type,
      bidStrategy: adSet.bid_strategy,
      bidAmount: adSet.bid_amount,
      transport: input.transport,
    });
    if (!adsetValidated.ok) {
      await updateMetaWriteOperation({
        id: operationId,
        patch: {
          state: "PARTIALLY_CREATED",
          meta_campaign_id: metaCampaignId,
          error_category: adsetValidated.category,
          error_safe_message: adsetValidated.safeMessage,
          completed_at: new Date().toISOString(),
        },
      });
      return {
        executed: true,
        liveWritesGated: false,
        preview,
        operationId,
        state: "PARTIALLY_CREATED",
        metaCampaignId,
        metaAdSetId: null,
        errorCategory: adsetValidated.category,
        errorSafeMessage: `${adsetValidated.safeMessage} Campagna Meta già creata (PAUSED). Ad Set non creato. Nessuna eliminazione automatica.`,
      };
    }

    const adsetCreated = await createMetaAdSetPaused({
      accessToken,
      adAccountId: account.metaAdAccountId,
      name: adSet.name,
      campaignId: metaCampaignId,
      optimizationGoal: adSet.optimization_goal,
      billingEvent: adSet.billing_event,
      dailyBudgetMinor: adSet.daily_budget,
      targeting: adSet.targeting,
      startTime: adSet.start_time,
      endTime: adSet.end_time,
      promotedObject: adSet.promoted_object,
      destinationType: adSet.destination_type,
      bidStrategy: adSet.bid_strategy,
      bidAmount: adSet.bid_amount,
      transport: input.transport,
    });

    if (!adsetCreated.ok) {
      await updateMetaWriteOperation({
        id: operationId,
        patch: {
          state: "PARTIALLY_CREATED",
          meta_campaign_id: metaCampaignId,
          error_category: adsetCreated.category,
          error_safe_message: adsetCreated.safeMessage,
          completed_at: new Date().toISOString(),
        },
      });
      return {
        executed: true,
        liveWritesGated: false,
        preview,
        operationId,
        state: "PARTIALLY_CREATED",
        metaCampaignId,
        metaAdSetId: null,
        errorCategory: adsetCreated.category,
        errorSafeMessage: `${adsetCreated.safeMessage} Campagna Meta già creata (PAUSED). Nessuna eliminazione automatica.`,
      };
    }

    metaAdSetId = adsetCreated.id;
    await updateMetaWriteOperation({
      id: operationId,
      patch: {
        state: "COMPLETED",
        meta_campaign_id: metaCampaignId,
        meta_adset_id: metaAdSetId,
        error_category: null,
        error_safe_message: null,
        completed_at: new Date().toISOString(),
      },
    });
  }

  return {
    executed: true,
    liveWritesGated: false,
    preview,
    operationId,
    state: "COMPLETED",
    metaCampaignId,
    metaAdSetId,
    errorCategory: null,
    errorSafeMessage: null,
  };
}
