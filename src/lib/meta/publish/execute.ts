/**
 * M14.1 — executeMetaPublishPlan: full PAUSED publish orchestration.
 * Order: validate → campaign → adset → media → creative → ad → persist → link → M13 baseline.
 * Authoritative guard: META_WRITES_LIVE !== 1 → no Graph mutations.
 * Injectable transport + download + persist for tests (no live Meta).
 */

import "server-only";
import {
  evaluateControlledQaWriteGate,
  isQaScopedMetaWritesEnvironment,
} from "@/lib/meta/publish/qa-write-gate";
import {
  getMetaConnectionForClient,
  getDecryptedMetaAccessToken,
} from "@/lib/meta/connections";
import { getClientMetaAccount } from "@/lib/meta/client-accounts";
import { MetaError } from "@/lib/meta/errors";
import { META_WRITE_SCOPE } from "@/lib/meta/oauth";
import { connectionHasScope } from "@/lib/meta/scopes";
import {
  createMetaAdSetPaused,
  createMetaCampaignPaused,
  toSafeGraphErrorDiagnostics,
  validateMetaAdSetPaused,
  type MetaGraphErrorDiagnostics,
  type MetaGraphWriteTransport,
} from "@/lib/meta/write/graph-write";
import {
  getFullPublishOperationByIdempotency,
  getProtectedFullPublishOperation,
  logFullPublishPreviewOperation,
  updateMetaWriteOperation,
} from "@/lib/meta/write/operations";
import { normalizeMetaWriteError } from "@/lib/meta/write/error-normalize";
import { META_WRITE_SAFE_STATUS } from "@/lib/meta/write/types";
import {
  buildMetaPublishPlan,
  validateMetaPublishPlan,
} from "@/lib/meta/publish/plan";
import {
  createMetaAdCreative,
  createMetaAdPaused,
  uploadMetaAdImageHash,
  uploadMetaAdVideoId,
} from "@/lib/meta/publish/graph-publish";
import { buildObjectStorySpecForPublish } from "@/lib/meta/publish/payloads";
import {
  computeAllyMediaAssetFingerprint,
  downloadAllyCreativeBytes,
  pickPrincipalCreativita,
  readPersistedMetaMediaFromSummary,
  type AllyCreativeAssetBytes,
  type PersistedMetaMediaAssetMeta,
} from "@/lib/meta/publish/media";
import { persistFullPublishHierarchyAndLink } from "@/lib/meta/publish/persist";
import {
  META_PUBLISH_ORDER,
  type MetaPublishExecuteResult,
  type MetaPublishPlan,
  type MetaPublishStepId,
  type MetaPublishStepResult,
} from "@/lib/meta/publish/types";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export type ExecuteMetaPublishInput = {
  userId: string;
  allyCampaignId: string;
  fingerprint: string;
  humanConfirmed: boolean;
  /** M14.2 — must match META_QA_WRITE_CONFIRM_TOKEN for live QA writes. */
  qaConfirmToken?: string | null;
  /**
   * Controlled QA isolation: after this step succeeds, stop without further
   * Graph mutations (e.g. CREATE_ADSET → no media/creative/ad).
   */
  stopAfter?: "CREATE_ADSET" | "MEDIA_UPLOAD" | "CREATE_CREATIVE" | null;
  transport?: MetaGraphWriteTransport;
  /**
   * Test-only: run orchestration with injected transport even when
   * META_WRITES_LIVE is off. Must never be set from HTTP routes.
   */
  __allowMockExecuteWithoutLiveFlag?: boolean;
  /** Test-only download override. */
  __downloadAsset?: (
    creativitaRaw: unknown,
  ) => Promise<
    | { ok: true; asset: AllyCreativeAssetBytes }
    | {
        ok: false;
        reason: "MISSING_CREATIVE_ASSET" | "STORAGE_DOWNLOAD_FAILED";
        messageIt: string;
      }
  >;
  /** Test-only: skip DB hierarchy/link (assertor still tracks flags). */
  __skipPersist?: boolean;
  /** Test-only in-memory operation store. */
  __memoryOps?: boolean;
  /** Test-only: skip buildMetaPublishPlan / DB. */
  __planOverride?: MetaPublishPlan;
};

function step(
  id: MetaPublishStepResult["step"],
  status: MetaPublishStepResult["status"],
  messageIt: string | null,
  metaObjectId: string | null = null,
): MetaPublishStepResult {
  return {
    step: id,
    status,
    metaObjectId,
    mockOnly: false,
    messageIt,
  };
}

function skipRest(
  fromExclusive: MetaPublishStepId,
  messageIt: string,
): MetaPublishStepResult[] {
  const idx = META_PUBLISH_ORDER.indexOf(fromExclusive);
  return META_PUBLISH_ORDER.slice(idx + 1).map((s) =>
    step(s, "SKIPPED", messageIt),
  );
}

type MemOp = {
  id: string;
  state: string;
  meta_campaign_id: string | null;
  meta_adset_id: string | null;
  meta_creative_id: string | null;
  meta_ad_id: string | null;
  error_category: string | null;
  error_safe_message: string | null;
  safe_payload_summary: Record<string, unknown>;
};

const memOps = new Map<string, MemOp>();

function memKey(userId: string, allyCampaignId: string, idem: string) {
  return `${userId}:${allyCampaignId}:${idem}`;
}

async function loadCreativitaRaw(allyCampaignId: string): Promise<unknown> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("campaigns")
    .select("creativita")
    .eq("id", allyCampaignId)
    .maybeSingle();
  return (data as { creativita?: unknown } | null)?.creativita ?? null;
}

function destinationFromPlan(plan: MetaPublishPlan): string | null {
  const summary = plan.writePreview.safePayloadSummary;
  if (
    summary &&
    typeof summary === "object" &&
    "destination" in summary &&
    typeof (summary as { destination?: unknown }).destination === "string"
  ) {
    return (summary as { destination: string }).destination;
  }
  return null;
}

function formIdFromPlan(plan: MetaPublishPlan): string | null {
  const summary = plan.writePreview.safePayloadSummary;
  if (summary && typeof summary === "object") {
    if (
      "formId" in summary &&
      typeof (summary as { formId?: unknown }).formId === "string"
    ) {
      const f = (summary as { formId: string }).formId.trim();
      if (f) return f;
    }
    const canon = (summary as { canonicalPlan?: { formId?: unknown } })
      .canonicalPlan;
    if (canon && typeof canon.formId === "string" && canon.formId.trim()) {
      return canon.formId.trim();
    }
  }
  return null;
}

function formPrivacyPolicyUrlFromPlan(plan: MetaPublishPlan): string | null {
  const summary = plan.writePreview.safePayloadSummary;
  if (!summary || typeof summary !== "object") return null;
  if (
    "formPrivacyPolicyUrl" in summary &&
    typeof (summary as { formPrivacyPolicyUrl?: unknown }).formPrivacyPolicyUrl ===
      "string"
  ) {
    const u = (
      summary as { formPrivacyPolicyUrl: string }
    ).formPrivacyPolicyUrl.trim();
    if (u) return u;
  }
  const canon = (
    summary as { canonicalPlan?: { formPrivacyPolicyUrl?: unknown } }
  ).canonicalPlan;
  if (
    canon &&
    typeof canon.formPrivacyPolicyUrl === "string" &&
    canon.formPrivacyPolicyUrl.trim()
  ) {
    return canon.formPrivacyPolicyUrl.trim();
  }
  return null;
}

/**
 * Controlled QA write activation: META_WRITES_LIVE alone is insufficient.
 * Requires Ally QA Supabase + non-production Vercel (secondary gate).
 * Approved ad account / campaign / confirm token are checked at execute time.
 */
export function isFullPublishLiveExecutionAllowed(): boolean {
  return isQaScopedMetaWritesEnvironment();
}

export async function executeMetaPublishPlan(
  input: ExecuteMetaPublishInput,
): Promise<MetaPublishExecuteResult> {
  if (!input.humanConfirmed) {
    throw new MetaError(
      "META_CONNECTION_INVALID",
      "Conferma esplicita richiesta.",
    );
  }

  const plan =
    input.__planOverride ??
    (await buildMetaPublishPlan({
      userId: input.userId,
      allyCampaignId: input.allyCampaignId,
    }));
  const validation = validateMetaPublishPlan(plan);
  const live = isFullPublishLiveExecutionAllowed();
  const mockBypass =
    input.__allowMockExecuteWithoutLiveFlag === true &&
    Boolean(input.transport);
  const canMutate = live || mockBypass;
  const skipRealMetaAuth = mockBypass && Boolean(input.__memoryOps);

  const base = (
    partial: Omit<
      MetaPublishExecuteResult,
      "plan" | "liveWritesGated"
    > & { liveWritesGated?: boolean },
  ): MetaPublishExecuteResult => ({
    plan,
    liveWritesGated: partial.liveWritesGated ?? !canMutate,
    ...partial,
  });

  if (plan.fingerprint !== input.fingerprint.trim()) {
    const norm = normalizeMetaWriteError({ localCode: "STALE_PREVIEW" });
    return base({
      executed: false,
      steps: [
        step("VALIDATE", "FAILED", "Anteprima pubblicazione non aggiornata."),
        ...skipRest("VALIDATE", "Bloccato da fingerprint non valido."),
      ],
      failedAt: "VALIDATE",
      markedSynced: false,
      markedPublished: false,
      operationId: null,
      metaCampaignId: null,
      metaAdSetId: null,
      metaCreativeId: null,
      metaAdId: null,
      errorCategory: norm.category,
      errorSafeMessage: norm.safeMessage,
    });
  }

  // Ally product gate — never bypass client approval on live write.
  const approvalBlock = plan.blockingIssues.find((b) => b.code === "NOT_APPROVED");
  if (approvalBlock) {
    return base({
      executed: false,
      steps: [
        step("VALIDATE", "FAILED", approvalBlock.messageIt),
        ...skipRest("VALIDATE", "Bloccato da approvazione Ally."),
      ],
      failedAt: "VALIDATE",
      markedSynced: false,
      markedPublished: false,
      operationId: null,
      metaCampaignId: null,
      metaAdSetId: null,
      metaCreativeId: null,
      metaAdId: null,
      errorCategory: "INVALID_PARAM",
      errorSafeMessage: approvalBlock.messageIt,
    });
  }

  const steps: MetaPublishStepResult[] = [
    step("VALIDATE", "VALID", "Piano completo e coerente."),
  ];

  // --- Operation row ---
  let operationId: string | null = null;
  let metaCampaignId: string | null = null;
  let metaAdSetId: string | null = null;
  let metaCreativeId: string | null = null;
  let metaAdId: string | null = null;
  let operationSummary: Record<string, unknown> = {};

  if (input.__memoryOps) {
    const k = memKey(input.userId, input.allyCampaignId, plan.idempotencyKey);
    let op = memOps.get(k);
    if (!op) {
      op = {
        id: `mem-op-${memOps.size + 1}`,
        state: "PREVIEWED",
        meta_campaign_id: null,
        meta_adset_id: null,
        meta_creative_id: null,
        meta_ad_id: null,
        error_category: null,
        error_safe_message: null,
        safe_payload_summary: {},
      };
      memOps.set(k, op);
    }
    operationId = op.id;
    metaCampaignId = op.meta_campaign_id;
    metaAdSetId = op.meta_adset_id;
    metaCreativeId = op.meta_creative_id;
    metaAdId = op.meta_ad_id;
    operationSummary = { ...op.safe_payload_summary };
  } else {
    const protectedOp = await getProtectedFullPublishOperation({
      userId: input.userId,
      allyCampaignId: input.allyCampaignId,
    });
    if (protectedOp?.state === "COMPLETED" && protectedOp.meta_ad_id) {
      return base({
        executed: false,
        liveWritesGated: false,
        steps: [
          ...steps,
          step(
            "CREATE_CAMPAIGN",
            "VALID",
            "Già pubblicata (operazione completa).",
            protectedOp.meta_campaign_id,
          ),
          step(
            "CREATE_ADSET",
            "VALID",
            "Già presente.",
            protectedOp.meta_adset_id,
          ),
          step(
            "CREATE_CREATIVE",
            "VALID",
            "Già presente.",
            protectedOp.meta_creative_id,
          ),
          step("CREATE_AD", "VALID", "Già presente.", protectedOp.meta_ad_id),
          step("ESTABLISH_LINK", "VALID", "Collegamento già stabilito."),
          step("MARK_SYNC_BASELINE", "VALID", "Baseline già verificata."),
        ],
        failedAt: null,
        markedSynced: true,
        markedPublished: true,
        operationId: protectedOp.id,
        metaCampaignId: protectedOp.meta_campaign_id,
        metaAdSetId: protectedOp.meta_adset_id,
        metaCreativeId: protectedOp.meta_creative_id,
        metaAdId: protectedOp.meta_ad_id,
        errorCategory: "DUPLICATE_OPERATION",
        errorSafeMessage: "Pubblicazione già completata. Nessuna nuova creazione.",
      });
    }

    if (!protectedOp) {
      await logFullPublishPreviewOperation({
        userId: input.userId,
        clientId: plan.clientId,
        allyCampaignId: input.allyCampaignId,
        fingerprint: plan.fingerprint,
        idempotencyKey: plan.idempotencyKey,
        safePayloadSummary: {
          kind: "FULL_PUBLISH_PAUSED",
          status: META_WRITE_SAFE_STATUS,
          objective: plan.objectiveMapping.metaObjective,
        },
      });
    }

    const op =
      protectedOp ??
      (await getFullPublishOperationByIdempotency({
        userId: input.userId,
        allyCampaignId: input.allyCampaignId,
        idempotencyKey: plan.idempotencyKey,
      }));
    operationId = op?.id ?? null;
    metaCampaignId = op?.meta_campaign_id ?? null;
    metaAdSetId = op?.meta_adset_id ?? null;
    metaCreativeId = op?.meta_creative_id ?? null;
    metaAdId = op?.meta_ad_id ?? null;
    operationSummary =
      (op?.safe_payload_summary as Record<string, unknown> | undefined) ?? {};
  }

  const controlledPartialResumeOk =
    Boolean(metaCampaignId) &&
    Boolean(metaAdSetId) &&
    (
      // Isolate MEDIA_UPLOAD before creative exists.
      (input.stopAfter === "MEDIA_UPLOAD" && !metaCreativeId) ||
      // Isolate CREATE_CREATIVE (ad must still be absent).
      (input.stopAfter === "CREATE_CREATIVE" && !metaAdId) ||
      // Resume full publish through CREATE_AD on existing creative hierarchy.
      // Plan may report ALREADY_LINKED_META; that is expected for resume.
      (input.stopAfter == null &&
        Boolean(metaCreativeId) &&
        !metaAdId)
    );

  if (!validation.ready && !controlledPartialResumeOk) {
    return base({
      executed: false,
      steps: [
        step(
          "VALIDATE",
          "FAILED",
          validation.blockingIssues.find((b) => b.code !== "NOT_APPROVED")
            ?.messageIt ??
            validation.blockingIssues[0]?.messageIt ??
            "Validazione pubblicazione non superata.",
        ),
        ...skipRest("VALIDATE", "Bloccato dalla validazione."),
      ],
      failedAt: "VALIDATE",
      markedSynced: false,
      markedPublished: false,
      operationId,
      metaCampaignId,
      metaAdSetId,
      metaCreativeId,
      metaAdId,
      errorCategory: "INVALID_PARAM",
      errorSafeMessage: "Configurazione non pronta per la pubblicazione su Meta.",
    });
  }

  const patchOp = async (patch: {
    state?: "CONFIRMED" | "IN_PROGRESS" | "PARTIALLY_CREATED" | "COMPLETED" | "FAILED";
    meta_campaign_id?: string | null;
    meta_adset_id?: string | null;
    meta_creative_id?: string | null;
    meta_ad_id?: string | null;
    error_category?: string | null;
    error_safe_message?: string | null;
    confirmed_at?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
    failed_step?: string;
    /** Intentional controlled stop (not a Graph failure). */
    stopped_after?: string;
    /** Sanitized Meta Graph diagnostics for QA — never tokens. */
    graphError?: MetaGraphErrorDiagnostics | null;
    /** Merge into safe_payload_summary (media hash, fingerprints). */
    summaryExtras?: Record<string, unknown>;
  }) => {
    if (!operationId) return;
    const summaryForFailure =
      patch.failed_step || patch.stopped_after || patch.summaryExtras
        ? {
            ...operationSummary,
            kind: "FULL_PUBLISH_PAUSED",
            status: META_WRITE_SAFE_STATUS,
            ...(patch.failed_step ? { failedAt: patch.failed_step } : {}),
            ...(patch.stopped_after
              ? { stoppedAfter: patch.stopped_after }
              : {}),
            meta_campaign_id: patch.meta_campaign_id ?? metaCampaignId,
            meta_adset_id: patch.meta_adset_id ?? metaAdSetId,
            meta_creative_id: patch.meta_creative_id ?? metaCreativeId,
            meta_ad_id: patch.meta_ad_id ?? metaAdId,
            ...(patch.summaryExtras ?? {}),
            ...(patch.graphError
              ? {
                  graphError: {
                    code: patch.graphError.code,
                    subcode: patch.graphError.subcode,
                    type: patch.graphError.type,
                    message: patch.graphError.message,
                    userTitle: patch.graphError.userTitle,
                    userMsg: patch.graphError.userMsg,
                    blameFields: patch.graphError.blameFields,
                    source: patch.graphError.source,
                  },
                }
              : {}),
          }
        : undefined;
    if (summaryForFailure) {
      operationSummary = summaryForFailure;
    }
    if (input.__memoryOps) {
      const k = memKey(input.userId, input.allyCampaignId, plan.idempotencyKey);
      const op = memOps.get(k);
      if (!op) return;
      if (patch.state) op.state = patch.state;
      if ("meta_campaign_id" in patch) op.meta_campaign_id = patch.meta_campaign_id ?? null;
      if ("meta_adset_id" in patch) op.meta_adset_id = patch.meta_adset_id ?? null;
      if ("meta_creative_id" in patch)
        op.meta_creative_id = patch.meta_creative_id ?? null;
      if ("meta_ad_id" in patch) op.meta_ad_id = patch.meta_ad_id ?? null;
      if ("error_category" in patch)
        op.error_category = patch.error_category ?? null;
      if ("error_safe_message" in patch)
        op.error_safe_message = patch.error_safe_message ?? null;
      if (summaryForFailure) {
        op.safe_payload_summary = {
          ...op.safe_payload_summary,
          ...summaryForFailure,
        };
      }
      return;
    }
    await updateMetaWriteOperation({
      id: operationId,
      patch: {
        state: patch.state,
        meta_campaign_id: patch.meta_campaign_id,
        meta_adset_id: patch.meta_adset_id,
        meta_creative_id: patch.meta_creative_id,
        meta_ad_id: patch.meta_ad_id,
        error_category: patch.error_category as never,
        error_safe_message: patch.error_safe_message,
        confirmed_at: patch.confirmed_at,
        started_at: patch.started_at,
        completed_at: patch.completed_at,
        safe_payload_summary: summaryForFailure,
      },
    });
  };

  // --- Guard: no Graph when live off (unless explicit mock test bypass) ---
  if (!canMutate) {
    await patchOp({
      state: "CONFIRMED",
      confirmed_at: new Date().toISOString(),
      error_safe_message: "LIVE_WRITES_GATED",
    });
    for (const s of [
      "CREATE_CAMPAIGN",
      "CREATE_ADSET",
      "CREATE_CREATIVE",
      "CREATE_AD",
    ] as const) {
      steps.push(
        step(
          s,
          "GATED",
          "Pubblicazione Meta non ancora attiva (META_WRITES_LIVE off).",
        ),
      );
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
        "Baseline SYNCED solo dopo verifica Meta reale.",
      ),
    );
    return base({
      executed: false,
      liveWritesGated: true,
      steps,
      failedAt: null,
      markedSynced: false,
      markedPublished: false,
      operationId,
      metaCampaignId,
      metaAdSetId,
      metaCreativeId,
      metaAdId,
      errorCategory: null,
      errorSafeMessage:
        "Conferma registrata. Pubblicazione Meta non attiva (guard).",
    });
  }

  // --- LIVE / MOCK EXECUTE ---
  const campaign = plan.writePreview.campaign;
  const adSet = plan.writePreview.adSet;
  const creativePlan = plan.creative;
  const adPlan = plan.ad;
  const needsCreativePayload = input.stopAfter !== "MEDIA_UPLOAD";
  const needsAdPayload =
    input.stopAfter !== "MEDIA_UPLOAD" &&
    input.stopAfter !== "CREATE_CREATIVE";
  if (
    !campaign ||
    !adSet ||
    (needsCreativePayload && !creativePlan) ||
    (needsAdPayload && !adPlan)
  ) {
    await patchOp({
      state: "FAILED",
      error_category: "INVALID_PARAM",
      error_safe_message: "Payload pubblicazione incompleto.",
      completed_at: new Date().toISOString(),
      failed_step: "VALIDATE",
    });
    return base({
      executed: false,
      steps: [
        ...steps.slice(0, 1),
        step("VALIDATE", "FAILED", "Payload incompleto."),
        ...skipRest("VALIDATE", "Bloccato."),
      ],
      failedAt: "VALIDATE",
      markedSynced: false,
      markedPublished: false,
      operationId,
      metaCampaignId: null,
      metaAdSetId: null,
      metaCreativeId: null,
      metaAdId: null,
      errorCategory: "INVALID_PARAM",
      errorSafeMessage: "Payload pubblicazione incompleto.",
    });
  }

  let accessToken = "mock-access-token";
  let adAccountId = "act_mock_test";
  let metaConnectionId = "00000000-0000-4000-8000-000000000001";

  if (!skipRealMetaAuth) {
    const connection = await getMetaConnectionForClient(
      input.userId,
      plan.clientId,
    );
    if (!connection || !connectionHasScope(connection, META_WRITE_SCOPE)) {
      await patchOp({
        state: "FAILED",
        error_category: "PERMISSION",
        error_safe_message:
          "Manca il permesso per creare campagne su Meta (ads_management).",
        completed_at: new Date().toISOString(),
      });
      return base({
        executed: false,
        steps: [
          ...steps,
          step("CREATE_CAMPAIGN", "FAILED", "Permesso ads_management mancante."),
          ...skipRest("CREATE_CAMPAIGN", "Bloccato."),
        ],
        failedAt: "CREATE_CAMPAIGN",
        markedSynced: false,
        markedPublished: false,
        operationId,
        metaCampaignId,
        metaAdSetId,
        metaCreativeId,
        metaAdId,
        errorCategory: "PERMISSION",
        errorSafeMessage:
          "Manca il permesso per creare campagne su Meta (ads_management).",
      });
    }
    metaConnectionId = connection.id;
    accessToken = await getDecryptedMetaAccessToken(
      input.userId,
      plan.clientId,
    );
    const account = await getClientMetaAccount(input.userId, plan.clientId);
    if (!account?.metaAdAccountId) {
      throw new MetaError(
        "META_AD_ACCOUNT_NOT_SELECTED",
        "Account pubblicitario Meta mancante.",
      );
    }
    adAccountId = account.metaAdAccountId;
  }

  // Secondary QA gate: approved campaign + ad account + confirm token.
  // Mock transport tests skip (never hit real Graph).
  if (!skipRealMetaAuth) {
    const gate = evaluateControlledQaWriteGate({
      allyCampaignId: input.allyCampaignId,
      metaAdAccountId: adAccountId,
      confirmationToken: input.qaConfirmToken,
    });
    if (!gate.ok) {
      await patchOp({
        state: "FAILED",
        error_category: "PERMISSION",
        error_safe_message: gate.messageIt,
        completed_at: new Date().toISOString(),
        failed_step: "VALIDATE",
      });
      return base({
        executed: false,
        liveWritesGated: true,
        steps: [
          ...steps,
          step("CREATE_CAMPAIGN", "FAILED", gate.messageIt),
          ...skipRest("CREATE_CAMPAIGN", "Gate QA: bloccato."),
        ],
        failedAt: "CREATE_CAMPAIGN",
        markedSynced: false,
        markedPublished: false,
        operationId,
        metaCampaignId,
        metaAdSetId,
        metaCreativeId,
        metaAdId,
        errorCategory: "PERMISSION",
        errorSafeMessage: gate.messageIt,
      });
    }
  }

  await patchOp({
    state: "IN_PROGRESS",
    confirmed_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
  });

  const transport = input.transport;
  const failPartial = async (
    failedAt: MetaPublishStepId,
    category: string,
    message: string,
    graphError?: MetaGraphErrorDiagnostics | null,
  ): Promise<MetaPublishExecuteResult> => {
    await patchOp({
      state: "PARTIALLY_CREATED",
      meta_campaign_id: metaCampaignId,
      meta_adset_id: metaAdSetId,
      meta_creative_id: metaCreativeId,
      meta_ad_id: metaAdId,
      error_category: category,
      error_safe_message: message,
      completed_at: new Date().toISOString(),
      failed_step: failedAt,
      graphError: graphError ?? null,
    });
    steps.push(step(failedAt, "FAILED", message, null));
    steps.push(...skipRest(failedAt, "Dipendenza precedente fallita."));
    return base({
      executed: Boolean(metaCampaignId),
      liveWritesGated: false,
      steps,
      failedAt,
      markedSynced: false,
      markedPublished: false,
      operationId,
      metaCampaignId,
      metaAdSetId,
      metaCreativeId,
      metaAdId,
      errorCategory: category,
      errorSafeMessage: message,
      graphError: graphError
        ? {
            code: graphError.code,
            subcode: graphError.subcode,
            type: graphError.type,
            message: graphError.message,
            userTitle: graphError.userTitle,
            userMsg: graphError.userMsg,
            blameFields: graphError.blameFields,
            source: graphError.source,
          }
        : null,
    });
  };

  // 1) Campaign
  if (!metaCampaignId) {
    if (!campaign.objective || campaign.special_ad_categories == null) {
      return failPartial(
        "CREATE_CAMPAIGN",
        "INVALID_PARAM",
        "Payload campagna incompleto.",
      );
    }
    const created = await createMetaCampaignPaused({
      accessToken,
      adAccountId,
      name: campaign.name,
      objective: campaign.objective,
      specialAdCategories: campaign.special_ad_categories,
      specialAdCategoryCountry: campaign.special_ad_category_country ?? null,
      dailyBudgetMinor: campaign.daily_budget,
      isAdsetBudgetSharingEnabled: campaign.is_adset_budget_sharing_enabled,
      transport,
    });
    if (!created.ok) {
      await patchOp({
        state: "FAILED",
        error_category: created.category,
        error_safe_message: created.safeMessage,
        completed_at: new Date().toISOString(),
        failed_step: "CREATE_CAMPAIGN",
      });
      steps.push(step("CREATE_CAMPAIGN", "FAILED", created.safeMessage));
      steps.push(...skipRest("CREATE_CAMPAIGN", "Dipendenza precedente fallita."));
      return base({
        executed: false,
        liveWritesGated: false,
        steps,
        failedAt: "CREATE_CAMPAIGN",
        markedSynced: false,
        markedPublished: false,
        operationId,
        metaCampaignId: null,
        metaAdSetId: null,
        metaCreativeId: null,
        metaAdId: null,
        errorCategory: created.category,
        errorSafeMessage: created.safeMessage,
      });
    }
    metaCampaignId = created.id;
    await patchOp({ meta_campaign_id: metaCampaignId });
  }
  steps.push(
    step(
      "CREATE_CAMPAIGN",
      "CREATED",
      "Campagna Meta creata (PAUSED).",
      metaCampaignId,
    ),
  );

  // 2) Ad Set
  if (!metaAdSetId) {
    if (
      !adSet.optimization_goal ||
      !adSet.billing_event ||
      !adSet.targeting
    ) {
      return failPartial(
        "CREATE_ADSET",
        "PARTIAL_HIERARCHY",
        "Campagna creata, ma il gruppo non è configurabile (campi mancanti).",
      );
    }
    // Lead Instant Form: Ad Set promoted_object is page_id only.
    // form_id stays on draft for Creative CTA lead_gen_form_id (never on Ad Set).
    let promoted = adSet.promoted_object
      ? { ...adSet.promoted_object }
      : null;
    const dest = destinationFromPlan(plan);
    const formId = formIdFromPlan(plan);
    if (dest === "META_LEAD_FORM") {
      if (!formId) {
        return failPartial(
          "CREATE_ADSET",
          "INVALID_PARAM",
          "Modulo lead (form_id) obbligatorio e mancante.",
        );
      }
      const pageId =
        typeof promoted?.page_id === "string"
          ? promoted.page_id
          : creativePlan?.object_story_spec.page_id;
      if (!pageId) {
        return failPartial(
          "CREATE_ADSET",
          "INVALID_PARAM",
          "Pagina Meta obbligatoria per lead form.",
        );
      }
      promoted = { page_id: pageId };
    }

    // validate_only BEFORE create — no object mutation when Meta honors it.
    // On failure: PARTIALLY_CREATED, keep campaign ID, persist Graph diagnostics.
    const adsetValidated = await validateMetaAdSetPaused({
      accessToken,
      adAccountId,
      name: adSet.name,
      campaignId: metaCampaignId,
      optimizationGoal: adSet.optimization_goal,
      billingEvent: adSet.billing_event,
      dailyBudgetMinor: adSet.daily_budget,
      targeting: adSet.targeting,
      startTime: adSet.start_time,
      endTime: adSet.end_time,
      promotedObject: promoted,
      destinationType: adSet.destination_type,
      bidStrategy: adSet.bid_strategy,
      bidAmount: adSet.bid_amount,
      transport,
    });
    if (!adsetValidated.ok) {
      return failPartial(
        "CREATE_ADSET",
        adsetValidated.category,
        `${adsetValidated.safeMessage} Campagna Meta già creata (PAUSED). Nessuna eliminazione automatica.`,
        toSafeGraphErrorDiagnostics(adsetValidated, "validate_only"),
      );
    }

    const adsetCreated = await createMetaAdSetPaused({
      accessToken,
      adAccountId,
      name: adSet.name,
      campaignId: metaCampaignId,
      optimizationGoal: adSet.optimization_goal,
      billingEvent: adSet.billing_event,
      dailyBudgetMinor: adSet.daily_budget,
      targeting: adSet.targeting,
      startTime: adSet.start_time,
      endTime: adSet.end_time,
      promotedObject: promoted,
      destinationType: adSet.destination_type,
      bidStrategy: adSet.bid_strategy,
      bidAmount: adSet.bid_amount,
      transport,
    });
    if (!adsetCreated.ok) {
      return failPartial(
        "CREATE_ADSET",
        adsetCreated.category,
        `${adsetCreated.safeMessage} Campagna Meta già creata (PAUSED). Nessuna eliminazione automatica.`,
        toSafeGraphErrorDiagnostics(adsetCreated, "create"),
      );
    }
    metaAdSetId = adsetCreated.id;
    await patchOp({
      meta_campaign_id: metaCampaignId,
      meta_adset_id: metaAdSetId,
    });
  }
  steps.push(
    step(
      "CREATE_ADSET",
      "CREATED",
      "Ad set Meta creato (PAUSED).",
      metaAdSetId,
    ),
  );

  // Controlled QA stop: isolate CREATE_ADSET from media/creative/ad.
  if (input.stopAfter === "CREATE_ADSET") {
    await patchOp({
      state: "PARTIALLY_CREATED",
      meta_campaign_id: metaCampaignId,
      meta_adset_id: metaAdSetId,
      meta_creative_id: metaCreativeId,
      meta_ad_id: metaAdId,
      error_category: null,
      error_safe_message:
        "Arresto controllato dopo CREATE_ADSET. Media/creatività/ad non eseguiti.",
      completed_at: new Date().toISOString(),
      stopped_after: "CREATE_ADSET",
    });
    steps.push(...skipRest("CREATE_ADSET", "Arresto controllato dopo CREATE_ADSET."));
    return base({
      executed: true,
      liveWritesGated: false,
      steps,
      failedAt: null,
      markedSynced: false,
      markedPublished: false,
      operationId,
      metaCampaignId,
      metaAdSetId,
      metaCreativeId,
      metaAdId,
      errorCategory: null,
      errorSafeMessage:
        "CREATE_ADSET completato (PAUSED). Arresto controllato — nessun media/creatività/ad.",
      graphError: null,
    });
  }

  // 3) Media + Creative
  if (!metaCreativeId) {
    const creativitaRaw = await loadCreativitaRaw(input.allyCampaignId);
    const principal = pickPrincipalCreativita(creativitaRaw);
    const persistedMedia = readPersistedMetaMediaFromSummary(operationSummary);

    let imageHash: string | null = null;
    let videoId: string | null = null;
    let mediaUploadExisting = false;
    let assetFingerprint: string | null =
      persistedMedia.mediaAssetFingerprint;
    let mediaAssetMeta: PersistedMetaMediaAssetMeta | null =
      persistedMedia.mediaAsset;

    // CREATE_CREATIVE resume: reuse persisted image_hash — never re-upload.
    const reusePersistedImageHash =
      input.stopAfter === "CREATE_CREATIVE" &&
      Boolean(persistedMedia.metaImageHash) &&
      !principal?.isVideo;

    if (reusePersistedImageHash) {
      imageHash = persistedMedia.metaImageHash;
      mediaUploadExisting = true;
      steps.push(
        step(
          "MEDIA_UPLOAD",
          "VALID",
          "Hash immagine Meta già persistito — nessun re-upload.",
          null,
        ),
      );
    } else {
      const download = input.__downloadAsset ?? downloadAllyCreativeBytes;
      const assetResult = input.__downloadAsset
        ? await download(null)
        : await download(creativitaRaw);

      if (!assetResult.ok) {
        return failPartial(
          input.stopAfter === "MEDIA_UPLOAD"
            ? "MEDIA_UPLOAD"
            : "CREATE_CREATIVE",
          "MISSING_ASSET",
          assetResult.messageIt,
        );
      }

      const asset = assetResult.asset;
      assetFingerprint = computeAllyMediaAssetFingerprint({
        creativitaId: principal?.id ?? asset.storagePath,
        storagePath: asset.storagePath,
        byteLength: asset.bytes.byteLength,
      });
      mediaAssetMeta = {
        creativitaId: principal?.id ?? "",
        storagePath: asset.storagePath,
        contentType: asset.contentType,
        byteLength: asset.bytes.byteLength,
        width: principal?.width ?? null,
        height: principal?.height ?? null,
        source: "ally_storage_campaign_creatives",
      };

      if (asset.isVideo) {
        if (input.stopAfter === "MEDIA_UPLOAD") {
          return failPartial(
            "MEDIA_UPLOAD",
            "INVALID_PARAM",
            "Stop controllato MEDIA_UPLOAD supporta solo immagini in questo slice.",
          );
        }
        const uploaded = await uploadMetaAdVideoId({
          accessToken,
          adAccountId,
          fileName: asset.fileName,
          bytes: asset.bytes,
          contentType: asset.contentType,
          transport,
        });
        if (!uploaded.ok) {
          return failPartial(
            "CREATE_CREATIVE",
            uploaded.category,
            `Upload video Meta fallito: ${uploaded.safeMessage}`,
          );
        }
        videoId = uploaded.videoId;
      } else if (
        persistedMedia.metaImageHash &&
        persistedMedia.mediaAssetFingerprint === assetFingerprint
      ) {
        imageHash = persistedMedia.metaImageHash;
        mediaUploadExisting = true;
      } else {
        const uploaded = await uploadMetaAdImageHash({
          accessToken,
          adAccountId,
          fileName: asset.fileName,
          bytes: asset.bytes,
          contentType: asset.contentType,
          transport,
        });
        if (!uploaded.ok) {
          const failStep =
            input.stopAfter === "MEDIA_UPLOAD"
              ? "MEDIA_UPLOAD"
              : "CREATE_CREATIVE";
          return failPartial(
            failStep,
            uploaded.category,
            `Upload immagine Meta fallito: ${uploaded.safeMessage}`,
            toSafeGraphErrorDiagnostics(uploaded, "create"),
          );
        }
        imageHash = uploaded.imageHash;
      }
    }

    if (input.stopAfter === "MEDIA_UPLOAD") {
      if (!imageHash) {
        return failPartial(
          "MEDIA_UPLOAD",
          "INVALID_PARAM",
          "Hash immagine Meta mancante dopo upload.",
        );
      }
      await patchOp({
        state: "PARTIALLY_CREATED",
        meta_campaign_id: metaCampaignId,
        meta_adset_id: metaAdSetId,
        meta_creative_id: null,
        meta_ad_id: null,
        stopped_after: "MEDIA_UPLOAD",
        error_category: null,
        error_safe_message:
          mediaUploadExisting
            ? "Media già caricato per questo asset (idempotente). Arresto controllato — nessuna creatività/ad."
            : "MEDIA_UPLOAD completato. Arresto controllato — nessuna creatività/ad.",
        completed_at: new Date().toISOString(),
        summaryExtras: {
          metaImageHash: imageHash,
          mediaAssetFingerprint: assetFingerprint,
          mediaAsset: mediaAssetMeta,
        },
      });
      steps.push(
        step(
          "MEDIA_UPLOAD",
          mediaUploadExisting ? "VALID" : "CREATED",
          mediaUploadExisting
            ? "Hash immagine Meta già presente per questo asset."
            : "Immagine caricata su Meta (adimages).",
          null,
        ),
      );
      steps.push(
        ...skipRest("MEDIA_UPLOAD", "Arresto controllato dopo MEDIA_UPLOAD."),
      );
      return base({
        executed: true,
        liveWritesGated: false,
        steps,
        failedAt: null,
        markedSynced: false,
        markedPublished: false,
        operationId,
        metaCampaignId,
        metaAdSetId,
        metaCreativeId: null,
        metaAdId: null,
        errorCategory: null,
        errorSafeMessage: mediaUploadExisting
          ? "Media già caricato (idempotente). Prossimo passo: CREATE_CREATIVE."
          : "MEDIA_UPLOAD completato. Prossimo passo: CREATE_CREATIVE.",
        graphError: null,
      });
    }

    if (!creativePlan) {
      return failPartial(
        "CREATE_CREATIVE",
        "INVALID_PARAM",
        "Piano creatività mancante.",
      );
    }

    if (!imageHash && !videoId) {
      return failPartial(
        "CREATE_CREATIVE",
        "MISSING_ASSET",
        "Hash immagine / video Meta mancante per CREATE_CREATIVE.",
      );
    }

    const pageId = creativePlan.object_story_spec.page_id?.trim() ?? "";
    const linkData = creativePlan.object_story_spec.link_data;
    const igFromSpec =
      typeof (creativePlan.object_story_spec as { instagram_user_id?: unknown })
        .instagram_user_id === "string"
        ? String(
            (creativePlan.object_story_spec as { instagram_user_id?: string })
              .instagram_user_id,
          ).trim()
        : "";
    const wp = plan.writePreview as {
      adIdentity?: { instagramUserId?: string | null } | null;
      destinationTracking?: {
        metaUrlTags?: string | null;
        finalDestinationUrl?: string | null;
      } | null;
    };
    const writePreviewIg =
      typeof wp.adIdentity?.instagramUserId === "string"
        ? wp.adIdentity.instagramUserId.trim()
        : "";
    const urlTags =
      typeof wp.destinationTracking?.metaUrlTags === "string"
        ? wp.destinationTracking.metaUrlTags.trim()
        : "";
    const finalUrl =
      typeof wp.destinationTracking?.finalDestinationUrl === "string"
        ? wp.destinationTracking.finalDestinationUrl.trim()
        : "";
    const destKind = destinationFromPlan(plan);
    // Instant Form: never pass clients.website / tracked site URL into creative link.
    const creativeDestinationUrl =
      destKind === "META_LEAD_FORM"
        ? null
        : finalUrl || linkData?.link || null;
    const specBuilt = buildObjectStorySpecForPublish({
      pageId,
      primaryText: linkData?.message ?? "",
      headline: linkData?.name ?? "",
      description: linkData?.description ?? null,
      destinationUrl: creativeDestinationUrl,
      destination: destKind,
      ctaType: linkData?.call_to_action?.type ?? null,
      formId: formIdFromPlan(plan),
      formPrivacyPolicyUrl: formPrivacyPolicyUrlFromPlan(plan),
      imageHash,
      videoId,
      instagramUserId: igFromSpec || writePreviewIg || null,
    });
    if (!specBuilt.ok) {
      return failPartial(
        "CREATE_CREATIVE",
        "INVALID_PARAM",
        `Creatività non costruibile (${specBuilt.reason}).`,
      );
    }

    const createdCreative = await createMetaAdCreative({
      accessToken,
      adAccountId,
      name: creativePlan.name,
      objectStorySpec: specBuilt.spec,
      urlTags: urlTags || null,
      transport,
    });
    if (!createdCreative.ok) {
      return failPartial(
        "CREATE_CREATIVE",
        createdCreative.category,
        `${createdCreative.safeMessage} Campagna e ad set già creati (PAUSED). Nessuna eliminazione automatica.`,
        toSafeGraphErrorDiagnostics(createdCreative, "create"),
      );
    }
    metaCreativeId = createdCreative.id;
    await patchOp({
      state: "PARTIALLY_CREATED",
      meta_campaign_id: metaCampaignId,
      meta_adset_id: metaAdSetId,
      meta_creative_id: metaCreativeId,
      meta_ad_id: null,
      summaryExtras: {
        metaImageHash: imageHash ?? persistedMedia.metaImageHash,
        mediaAssetFingerprint: assetFingerprint,
        mediaAsset: mediaAssetMeta,
      },
    });
  }
  steps.push(
    step(
      "CREATE_CREATIVE",
      "CREATED",
      "Creatività Meta creata.",
      metaCreativeId,
    ),
  );

  // Controlled QA stop: isolate CREATE_CREATIVE from Ad.
  if (input.stopAfter === "CREATE_CREATIVE") {
    await patchOp({
      state: "PARTIALLY_CREATED",
      meta_campaign_id: metaCampaignId,
      meta_adset_id: metaAdSetId,
      meta_creative_id: metaCreativeId,
      meta_ad_id: null,
      error_category: null,
      error_safe_message:
        "Arresto controllato dopo CREATE_CREATIVE. Annuncio non eseguito.",
      completed_at: new Date().toISOString(),
      stopped_after: "CREATE_CREATIVE",
      summaryExtras: {
        metaImageHash:
          typeof operationSummary.metaImageHash === "string"
            ? operationSummary.metaImageHash
            : null,
      },
    });
    steps.push(
      ...skipRest("CREATE_CREATIVE", "Arresto controllato dopo CREATE_CREATIVE."),
    );
    return base({
      executed: true,
      liveWritesGated: false,
      steps,
      failedAt: null,
      markedSynced: false,
      markedPublished: false,
      operationId,
      metaCampaignId,
      metaAdSetId,
      metaCreativeId,
      metaAdId: null,
      errorCategory: null,
      errorSafeMessage:
        "CREATE_CREATIVE completato. Arresto controllato — nessun ad.",
      graphError: null,
    });
  }

  // 4) Ad
  if (!metaAdId) {
    if (!adPlan) {
      return failPartial(
        "CREATE_AD",
        "INVALID_PARAM",
        "Piano annuncio mancante.",
      );
    }
    const createdAd = await createMetaAdPaused({
      accessToken,
      adAccountId,
      name: adPlan.name,
      adSetId: metaAdSetId!,
      creativeId: metaCreativeId!,
      transport,
    });
    if (!createdAd.ok) {
      return failPartial(
        "CREATE_AD",
        createdAd.category,
        `${createdAd.safeMessage} Campagna, ad set e creatività già creati. Annuncio non creato. Nessuna eliminazione automatica.`,
      );
    }
    metaAdId = createdAd.id;
    await patchOp({
      meta_campaign_id: metaCampaignId,
      meta_adset_id: metaAdSetId,
      meta_creative_id: metaCreativeId,
      meta_ad_id: metaAdId,
    });
  }
  steps.push(
    step("CREATE_AD", "CREATED", "Annuncio Meta creato (PAUSED).", metaAdId),
  );

  // 5) Persist hierarchy + link + M13 baseline (only after all four IDs)
  if (
    !metaCampaignId ||
    !metaAdSetId ||
    !metaCreativeId ||
    !metaAdId
  ) {
    return failPartial(
      "ESTABLISH_LINK",
      "PARTIAL_HIERARCHY",
      "ID Meta incompleti: collegamento non stabilito.",
    );
  }

  if (!input.__skipPersist && !input.__memoryOps) {
    try {
      await persistFullPublishHierarchyAndLink({
        userId: input.userId,
        clientId: plan.clientId,
        allyCampaignId: input.allyCampaignId,
        metaConnectionId,
        metaAdAccountId: adAccountId,
        metaCampaignId,
        metaAdSetId,
        metaCreativeId,
        metaAdId,
        campaignName: campaign.name,
        metaObjective: campaign.objective,
        adSetName: adSet.name,
        adName: adPlan?.name ?? "Ad",
        dailyBudgetMinor: campaign.daily_budget,
        optimizationGoal: adSet.optimization_goal,
      });
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : "Persistenza gerarchia / collegamento non riuscita.";
      return failPartial("ESTABLISH_LINK", "NETWORK", msg);
    }
  }

  steps.push(
    step(
      "ESTABLISH_LINK",
      "CREATED",
      "Collegamento Ally ↔ Meta stabilito.",
      metaCampaignId,
    ),
  );
  steps.push(
    step(
      "MARK_SYNC_BASELINE",
      "CREATED",
      "Baseline M13 verificata (SYNCED).",
      metaCampaignId,
    ),
  );

  await patchOp({
    state: "COMPLETED",
    meta_campaign_id: metaCampaignId,
    meta_adset_id: metaAdSetId,
    meta_creative_id: metaCreativeId,
    meta_ad_id: metaAdId,
    error_category: null,
    error_safe_message: null,
    completed_at: new Date().toISOString(),
  });

  return base({
    executed: true,
    liveWritesGated: false,
    steps,
    failedAt: null,
    markedSynced: true,
    markedPublished: true,
    operationId,
    metaCampaignId,
    metaAdSetId,
    metaCreativeId,
    metaAdId,
    errorCategory: null,
    errorSafeMessage: null,
  });
}

/** Clear in-memory ops between tests. */
export function __resetFullPublishMemoryOpsForTests(): void {
  memOps.clear();
}

/** Test helper — inspect memory op summary (no secrets). */
export function __peekFullPublishMemoryOpForTests(input: {
  userId: string;
  allyCampaignId: string;
  idempotencyKey: string;
}): MemOp | null {
  return (
    memOps.get(
      memKey(input.userId, input.allyCampaignId, input.idempotencyKey),
    ) ?? null
  );
}
