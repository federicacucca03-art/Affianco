/**
 * M14 — buildMetaPublishPlan: Campaign → Ad Set → Creative → Ad (dry plan).
 * Reuses M11 write preview. No Graph mutations.
 */

import "server-only";
import { createHash } from "node:crypto";
import { isQaScopedMetaWritesEnvironment } from "@/lib/meta/publish/qa-write-gate";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { MetaError } from "@/lib/meta/errors";
import { isUuid } from "@/lib/meta/ids";
import { fingerprintPayload } from "@/lib/meta/write/fingerprint";
import { buildWritePreviewForAllyCampaign } from "@/lib/meta/write/load-preview";
import { resolveMetaObjectiveCode } from "@/lib/meta/write/objective";
import type { MetaWritePreviewResult } from "@/lib/meta/write/types";
import {
  buildMetaAdPayload,
  buildMetaCreativePayload,
  creativeBlockingIssues,
} from "@/lib/meta/publish/payloads";
import { normalizeWritePreviewForFullPublish } from "@/lib/meta/publish/full-publish-preview";
import {
  etichettaPublishProductStatus,
  resolvePublishProductStatus,
} from "@/lib/meta/publish/labels";
import {
  META_PUBLISH_ORDER,
  type MetaPublishIssue,
  type MetaPublishPlan,
  type MetaPublishReviewCard,
} from "@/lib/meta/publish/types";
import { userFacingCampaignText } from "@/lib/campagne-creation-mode";
import { resolvePlanDestinationUrl } from "@/lib/meta/write/destination-tracking";

export { normalizeWritePreviewForFullPublish } from "@/lib/meta/publish/full-publish-preview";

type CampaignCopyRow = {
  id: string;
  user_id: string;
  client_id: string | null;
  name: string;
  objective: string | null;
  status: string | null;
  variante_a: string | null;
  titolo_annuncio: string | null;
  creativita: unknown;
  page_id: string | null;
  form_id: string | null;
  clients: { website: string | null } | { website: string | null }[] | null;
};

function websiteFromJoin(
  clients: CampaignCopyRow["clients"],
): string | null {
  if (!clients) return null;
  if (Array.isArray(clients)) return clients[0]?.website ?? null;
  return clients.website ?? null;
}

/** Prefer persisted titolo; else a short line from copy / campaign name. */
export function derivePublishHeadline(input: {
  titoloAnnuncio: string | null | undefined;
  varianteA: string | null | undefined;
  campaignName: string | null | undefined;
}): string | null {
  const titled = (input.titoloAnnuncio ?? "").trim();
  if (titled) return titled.slice(0, 40);
  const copy = (input.varianteA ?? "").trim();
  if (copy) {
    // Prefer a contact-intent phrase if present in Ally copy.
    if (/richiedi informazioni/i.test(copy)) return "Richiedi informazioni";
    if (/scopri di più/i.test(copy)) return "Scopri di più";
    const first = copy.split(/[.!?\n]/)[0]?.trim() ?? "";
    if (first.length >= 8 && first.length <= 40) return first;
    if (first.length > 40) return `${first.slice(0, 37).trim()}…`;
  }
  const name = (input.campaignName ?? "").trim();
  if (!name) return null;
  // Strip trailing date/client noise for a usable headline.
  const short = name.split(" - ")[0]?.trim() || name;
  return short.slice(0, 40);
}

function mapWriteBlockerToIssue(
  code: string,
  messageIt: string,
): MetaPublishIssue {
  const map: Record<string, MetaPublishIssue["code"]> = {
    MISSING_META_CONNECTION: "MISSING_META_CONNECTION",
    MISSING_AD_ACCOUNT: "MISSING_AD_ACCOUNT",
    MISSING_META_PERMISSION: "MISSING_META_PERMISSION",
    UNSUPPORTED_OBJECTIVE: "UNSUPPORTED_OBJECTIVE",
    MISSING_BUDGET: "MISSING_BUDGET",
    MISSING_GEO: "MISSING_GEO",
    MISSING_GEO_RESOLUTION: "MISSING_GEO_RESOLUTION",
    MISSING_DESTINATION: "MISSING_DESTINATION",
    MISSING_PAGE: "MISSING_PAGE",
    MISSING_FORM: "MISSING_FORM",
    MISSING_FORM_TECHNICAL_URL: "MISSING_FORM_TECHNICAL_URL",
    MISSING_SCHEDULE: "MISSING_SCHEDULE",
    MISSING_SPECIAL_AD_CATEGORY_DECISION: "MISSING_SPECIAL_AD_CATEGORY",
    SPECIAL_AD_CATEGORY_REQUIRED: "MISSING_SPECIAL_AD_CATEGORY",
    SPECIAL_AD_CATEGORY_NEEDS_VERIFICATION: "MISSING_SPECIAL_AD_CATEGORY",
    SPECIAL_AD_CATEGORY_COUNTRY_REQUIRED: "MISSING_SPECIAL_AD_CATEGORY",
    MISSING_AUDIENCE_MODE: "MISSING_AUDIENCE_MODE",
    IMPORTED_META_NOT_ELIGIBLE: "IMPORTED_META_NOT_ELIGIBLE",
    ALREADY_LINKED_META: "ALREADY_LINKED_META",
    LIVE_WRITES_GATED: "LIVE_WRITES_GATED",
    MISSING_CREATIVE_ASSET: "MISSING_CREATIVE_ASSET",
  };
  return {
    code: map[code] ?? "OTHER",
    severity: "BLOCKING",
    messageIt,
  };
}

function destinationLabelIt(kind: string | null): string {
  switch ((kind ?? "").toUpperCase()) {
    case "WEBSITE":
      return "Sito web";
    case "META_LEAD_FORM":
      return "Modulo Lead Meta";
    case "WHATSAPP":
      return "WhatsApp";
    case "PHONE":
      return "Chiamata";
    default:
      return kind?.trim() || "Da definire";
  }
}

function buildReview(input: {
  ready: boolean;
  live: boolean;
  blocking: MetaPublishIssue[];
  warnings: MetaPublishIssue[];
  writePreview: MetaWritePreviewResult;
  creativeName: string;
  creativeText: string;
  ctaType: string | null;
  campaignName: string;
  metaObjective: string | null;
  destinationKind: string | null;
  destinationUrl: string | null;
  pageId: string | null;
  creativeAssetNote: string | null;
  creativeAssetReady: boolean;
}): MetaPublishReviewCard {
  const productStatus = resolvePublishProductStatus({
    ready: input.ready,
    blockingCount: input.blocking.length,
    hasVerifiedMetaObjects: false,
    hasPartialMetaObjects: false,
    hasPublishError: false,
  });

  let ctaState: MetaPublishReviewCard["ctaState"] = "DISABLED_NOT_READY";
  if (!input.writePreview.canPreview && input.blocking.length > 0) {
    ctaState = "DISABLED_NOT_READY";
  } else if (input.ready && !input.live) {
    ctaState = "GATED_LIVE_OFF";
  } else if (input.ready && input.live) {
    ctaState = "ENABLED";
  } else {
    ctaState = "DISABLED_NOT_READY";
  }

  const campaignLine =
    input.writePreview.summaryIt.campaignLines[0] ??
    `${input.metaObjective ?? "Obiettivo"} — ${input.campaignName}`;
  const adSetLine =
    input.writePreview.summaryIt.adSetLines[0] ??
    "Gruppo di inserzioni da configurare";
  const creativeSnippet = input.creativeText.trim()
    ? `"${input.creativeText.trim().slice(0, 48)}${input.creativeText.trim().length > 48 ? "…" : ""}"`
    : "Testo creatività mancante";
  const creativeLine = `${input.creativeName} · ${creativeSnippet}`;
  const adLine = input.ctaType
    ? `CTA: ${input.ctaType}`
    : "Annuncio (CTA da definire)";

  const productRequirementLines = input.blocking
    .filter((b) => b.code === "NOT_APPROVED")
    .map((b) => b.messageIt);
  const metaRequirementLines = input.blocking
    .filter((b) => b.code !== "NOT_APPROVED")
    .map((b) => b.messageIt);

  const summary = input.writePreview.summaryIt;
  const safe = input.writePreview.safePayloadSummary ?? {};
  const adAccountFromSummary =
    typeof (safe as { adAccountId?: unknown }).adAccountId === "string"
      ? String((safe as { adAccountId: string }).adAccountId)
      : typeof (safe as { ad_account_id?: unknown }).ad_account_id === "string"
        ? String((safe as { ad_account_id: string }).ad_account_id)
        : null;
  const adAccountLine = adAccountFromSummary
    ? `Account ${adAccountFromSummary}`
    : "Account Meta da collegare";
  const dailyBudgetMinor =
    input.writePreview.adSet?.daily_budget ??
    input.writePreview.campaign?.daily_budget;
  const budgetLine =
    dailyBudgetMinor != null && dailyBudgetMinor > 0
      ? `${(dailyBudgetMinor / 100).toFixed(2)} €/giorno`
      : summary.adSetLines.find((l) => /budget|€/i.test(l)) ??
        "Budget da verificare";
  const audienceLine =
    summary.adSetLines.find((l) => /età|km|città|raggio|audience|pubblico/i.test(l)) ??
    summary.adSetLines[1] ??
    "Pubblico da verificare";

  const destKind = input.destinationKind;
  let destinationLine = destinationLabelIt(destKind);
  if (destKind === "WEBSITE") {
    destinationLine = input.destinationUrl?.trim()
      ? `Sito web → ${input.destinationUrl.trim()}`
      : "Sito web → URL mancante";
  } else if (destKind === "META_LEAD_FORM") {
    destinationLine = "Modulo Lead Meta";
  }

  return {
    productStatus,
    productStatusLabelIt: etichettaPublishProductStatus(productStatus),
    headlineIt: input.ready ? "Pronta per Meta" : "Non pronta per Meta",
    campaignLine,
    adSetLine,
    creativeLine,
    adLine,
    initialStatusLine: "IN PAUSA",
    productRequirementLines,
    metaRequirementLines,
    adAccountLine,
    objectiveLine: input.metaObjective ?? "Obiettivo da mappare",
    budgetLine,
    audienceLine,
    destinationLine,
    pageLine: input.pageId?.trim()
      ? `Pagina ${input.pageId.trim()}`
      : "Pagina Facebook mancante",
    creativeAssetLine: input.creativeAssetReady
      ? input.creativeAssetNote ?? "Creatività Ally pronta in Storage"
      : input.creativeAssetNote ?? "Creatività Ally mancante",
    blockingIssues: input.blocking.map((b) => b.messageIt),
    warnings: input.warnings.map((w) => w.messageIt),
    canReview: input.writePreview.canPreview || input.ready,
    readyForLiveWrite: input.ready,
    liveWritesEnabled: input.live,
    ctaState,
    ctaLabelIt: "Pubblica su Meta",
    gatedNoteIt:
      ctaState === "GATED_LIVE_OFF"
        ? "Pubblicazione Meta non ancora attiva in QA. Il piano completo è validato; le write live restano disattivate."
        : null,
    destinationKind: destKind,
  };
}

/**
 * Central readiness + full publish plan (campaign → ad set → creative → ad).
 */
export async function buildMetaPublishPlan(input: {
  userId: string;
  allyCampaignId: string;
}): Promise<MetaPublishPlan> {
  if (!isUuid(input.allyCampaignId)) {
    throw new MetaError("META_CONNECTION_INVALID", "Campagna non valida.");
  }

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("campaigns")
    .select(
      "id, user_id, client_id, name, objective, status, variante_a, titolo_annuncio, creativita, page_id, form_id, clients(website)",
    )
    .eq("id", input.allyCampaignId)
    .maybeSingle();
  if (error || !data) {
    throw new MetaError("META_CONNECTION_INVALID", "Campagna non trovata.");
  }
  const row = data as CampaignCopyRow;
  if (row.user_id !== input.userId) {
    throw new MetaError("META_CONNECTION_INVALID", "Campagna non trovata.");
  }
  const clientId = row.client_id?.trim() ?? "";
  if (!isUuid(clientId)) {
    throw new MetaError(
      "META_CONNECTION_INVALID",
      "Cliente campagna mancante.",
    );
  }

  const writePreview = await buildWritePreviewForAllyCampaign({
    userId: input.userId,
    allyCampaignId: input.allyCampaignId,
    hydrateFromCanonical: true,
    persist: false,
  });

  const website = websiteFromJoin(row.clients);
  const destination =
    writePreview.safePayloadSummary &&
    typeof writePreview.safePayloadSummary === "object" &&
    "destination" in writePreview.safePayloadSummary
      ? String(
          (writePreview.safePayloadSummary as { destination?: unknown })
            .destination ?? "",
        )
      : "";

  // Prefer canonical/summary destination. Never invent Lead Form from a website URL.
  let destKind = destination;
  if (!destKind || destKind === "UNRESOLVED" || destKind === "UNKNOWN") {
    if (writePreview.readinessCodes.includes("MISSING_DESTINATION")) {
      destKind = "UNRESOLVED";
    } else if (website) {
      destKind = "WEBSITE";
    } else if (
      writePreview.readinessCodes.includes("MISSING_FORM") &&
      (row.form_id ?? "").trim()
    ) {
      destKind = "META_LEAD_FORM";
    } else {
      destKind = "UNRESOLVED";
    }
  }

  const safePrimary = userFacingCampaignText(row.variante_a);
  const safeTitolo = userFacingCampaignText(row.titolo_annuncio);
  const derivedHeadline = derivePublishHeadline({
    titoloAnnuncio: safeTitolo,
    varianteA: safePrimary,
    campaignName: row.name,
  });

  const planDestinationUrl = resolvePlanDestinationUrl({
    destination: destKind || null,
    clientWebsite: website,
  });

  const formPrivacyFromSummary =
    writePreview.safePayloadSummary &&
    typeof writePreview.safePayloadSummary === "object" &&
    typeof (writePreview.safePayloadSummary as { formPrivacyPolicyUrl?: unknown })
      .formPrivacyPolicyUrl === "string"
      ? (
          writePreview.safePayloadSummary as { formPrivacyPolicyUrl: string }
        ).formPrivacyPolicyUrl.trim() || null
      : null;
  const creative = buildMetaCreativePayload({
    campaignName: row.name,
    pageId: row.page_id,
    primaryText: safePrimary,
    headline: derivedHeadline,
    description: null,
    destinationUrl: planDestinationUrl,
    destination: destKind || null,
    creativitaRaw: row.creativita,
    formId: destKind === "META_LEAD_FORM" ? row.form_id : null,
    formPrivacyPolicyUrl:
      destKind === "META_LEAD_FORM" ? formPrivacyFromSummary : null,
  });
  const ad = buildMetaAdPayload({ campaignName: row.name });

  const blocking: MetaPublishIssue[] = [];
  const warnings: MetaPublishIssue[] = [];

  const statusUpper = (row.status ?? "").toUpperCase();
  if (statusUpper !== "APPROVED" && statusUpper !== "ACTIVE") {
    blocking.push({
      code: "NOT_APPROVED",
      severity: "BLOCKING",
      messageIt:
        "Requisito Ally: approvazione cliente ancora in sospeso (non è un requisito tecnico di Meta).",
    });
  }

  // Pair blocker messages with readiness codes that actually emit blockersIt
  // entries. READY_* are prepended to readiness without a matching message, so
  // index-zipping readinessCodes[i] ↔ blockersIt[i] mis-labels resume info as OTHER.
  const readinessCodesWithBlockerMessages = writePreview.readinessCodes.filter(
    (c) =>
      c !== "READY_TO_PREVIEW" &&
      c !== "READY_TO_WRITE" &&
      c !== "LIVE_WRITES_GATED",
  );
  for (let i = 0; i < writePreview.blockersIt.length; i += 1) {
    const code = readinessCodesWithBlockerMessages[i] ?? "OTHER";
    const messageIt = writePreview.blockersIt[i] ?? code;
    // Creative deferred: not a full-publish tech blocker here (own creative check).
    if (code === "MISSING_CREATIVE_ASSET") {
      continue;
    }
    // RESUME_ADSET signal — informational, Campaign POST stays 0.
    if (
      code === "PARTIAL_HIERARCHY" ||
      messageIt.includes("Campagna Meta già creata")
    ) {
      warnings.push({
        code: "OTHER",
        severity: "WARNING",
        messageIt,
      });
      continue;
    }
    // Destination-aware: never surface Lead Form blockers for WEBSITE/WhatsApp/Call.
    if (
      code === "MISSING_FORM" &&
      destKind !== "META_LEAD_FORM"
    ) {
      continue;
    }
    blocking.push(mapWriteBlockerToIssue(code, messageIt));
  }
  // Also map remaining readiness codes not paired 1:1 with blockersIt
  for (const code of writePreview.readinessCodes) {
    if (
      code === "READY_TO_PREVIEW" ||
      code === "READY_TO_WRITE" ||
      code === "LIVE_WRITES_GATED" ||
      code === "MISSING_CREATIVE_ASSET" ||
      code === "PARTIAL_HIERARCHY"
    ) {
      continue;
    }
    if (blocking.some((b) => b.messageIt && writePreview.blockersIt.includes(b.messageIt))) {
      continue;
    }
    const already = blocking.some((b) => b.code !== "OTHER" && b.code === code);
    if (already) continue;
    const msg = writePreview.blockersIt.find(Boolean);
    if (msg && !blocking.some((b) => b.messageIt === msg)) {
      // skip duplicate generic
    }
  }

  for (const issue of creativeBlockingIssues(creative)) {
    if (
      issue.code === "ASSET_UPLOAD_NOT_READY" &&
      creative.assetHandling === "READY"
    ) {
      continue;
    }
    if (
      issue.code === "ASSET_UPLOAD_NOT_READY" &&
      creative.assetHandling === "PARTIAL"
    ) {
      // PARTIAL without storage path is blocking for live publish
      blocking.push({
        code: issue.code,
        severity: "BLOCKING",
        messageIt: issue.messageIt,
      });
      continue;
    }
    blocking.push({
      code: issue.code,
      severity: "BLOCKING",
      messageIt: issue.messageIt,
    });
  }

  // Deduplicate by message
  const seen = new Set<string>();
  const blockingDedup = blocking.filter((b) => {
    if (seen.has(b.messageIt)) return false;
    seen.add(b.messageIt);
    return true;
  });
  const warnSeen = new Set<string>();
  const warningsDedup = warnings.filter((w) => {
    if (warnSeen.has(w.messageIt)) return false;
    warnSeen.add(w.messageIt);
    return true;
  });

  const metaObjective = resolveMetaObjectiveCode(row.objective);
  // Align CTA ENABLED with execute gate (QA-scoped), not META_WRITES_LIVE alone.
  const live = isQaScopedMetaWritesEnvironment();

  // Ready = no Meta blockers + write preview structurally has campaign+adset + creative ok.
  // Ally client approval (NOT_APPROVED) is a product gate — not a Meta tech blocker.
  // Asset PARTIAL is warning only (upload path deferred to live activation).
  const creativeCoreOk =
    creative.fieldStatus.page_id !== "MISSING" &&
    creative.fieldStatus.message !== "MISSING" &&
    creative.fieldStatus.name !== "MISSING" &&
    creative.fieldStatus.image_or_video !== "MISSING" &&
    creative.fieldStatus.link !== "MISSING" &&
    creative.fieldStatus.call_to_action !== "MISSING";

  const writeCoreOk =
    Boolean(writePreview.campaign) &&
    Boolean(writePreview.adSet) &&
    writePreview.readinessCodes.every(
      (c) =>
        c === "READY_TO_PREVIEW" ||
        c === "READY_TO_WRITE" ||
        c === "LIVE_WRITES_GATED" ||
        c === "MISSING_CREATIVE_ASSET" ||
        c === "PARTIAL_HIERARCHY",
    );

  const metaBlocking = blockingDedup.filter((b) => b.code !== "NOT_APPROVED");
  const hasClientApprovalGate = blockingDedup.some(
    (b) => b.code === "NOT_APPROVED",
  );

  const technicalReady =
    metaBlocking.length === 0 &&
    creativeCoreOk &&
    (writePreview.canWrite || writePreview.canPreview) &&
    writeCoreOk;

  const review = buildReview({
    ready: technicalReady && !hasClientApprovalGate,
    live,
    blocking: blockingDedup,
    warnings: warningsDedup,
    writePreview,
    creativeName: creative.name,
    creativeText: creative.object_story_spec.link_data?.message ?? "",
    ctaType: creative.object_story_spec.link_data?.call_to_action?.type ?? null,
    campaignName: row.name,
    metaObjective,
    destinationKind: destKind || null,
    destinationUrl: planDestinationUrl,
    pageId: row.page_id,
    creativeAssetNote: creative.assetNoteIt,
    creativeAssetReady: creative.assetHandling === "READY",
  });

  // plan.ready = technical Meta readiness (dry-run VALIDATE). Approval stays separate.
  const finalReady =
    metaBlocking.length === 0 &&
    creativeCoreOk &&
    Boolean(writePreview.campaign) &&
    Boolean(writePreview.adSet);
  if (!finalReady) {
    review.productStatus = "non_pronta";
    review.productStatusLabelIt = etichettaPublishProductStatus("non_pronta");
    review.headlineIt = "Non pronta per Meta";
    review.readyForLiveWrite = false;
    if (review.ctaState === "GATED_LIVE_OFF" || review.ctaState === "ENABLED") {
      review.ctaState = "DISABLED_NOT_READY";
      review.gatedNoteIt = null;
    }
  } else if (hasClientApprovalGate) {
    review.productStatus = "non_pronta";
    review.productStatusLabelIt = etichettaPublishProductStatus("non_pronta");
    review.headlineIt = "Non pronta per Meta";
    review.readyForLiveWrite = false;
    review.ctaState = "DISABLED_NOT_READY";
    review.gatedNoteIt = null;
  } else if (!live) {
    review.ctaState = "GATED_LIVE_OFF";
    review.readyForLiveWrite = true;
    review.gatedNoteIt =
      "Pubblicazione Meta non ancora attiva in QA. Il piano completo è validato; le write live restano disattivate.";
  }

  const fingerprint = fingerprintPayload({
    v: 1,
    kind: "FULL_PUBLISH_PAUSED",
    allyCampaignId: row.id,
    writeFingerprint: writePreview.fingerprint,
    creative,
    ad,
  });
  const idempotencyKey = createHash("sha256")
    .update(
      JSON.stringify({
        u: input.userId,
        c: row.id,
        t: "FULL_PUBLISH_PAUSED",
        f: fingerprint,
      }),
      "utf8",
    )
    .digest("hex");

  // GET preview must match execute: FULL_PUBLISH_PAUSED + creative/ad included.
  // Do not mutate M11A builder; only adapt the nested writePreview on this path.
  const fullPublishWritePreview = normalizeWritePreviewForFullPublish(
    writePreview,
    { hasCreative: creative != null, hasAd: ad != null },
  );

  return {
    allyCampaignId: row.id,
    clientId,
    fingerprint,
    idempotencyKey,
    ready: finalReady,
    blockingIssues: blockingDedup,
    warnings: warningsDedup,
    writePreview: fullPublishWritePreview,
    creative,
    ad,
    review: {
      ...review,
      canReview: true,
    },
    publishOrder: [...META_PUBLISH_ORDER],
    objectiveMapping: {
      allyObjective: row.objective,
      metaObjective,
      supported:
        Boolean(metaObjective) &&
        !fullPublishWritePreview.readinessCodes.includes("UNSUPPORTED_OBJECTIVE"),
    },
  };
}

/** Pure validation facade over a built plan. */
export function validateMetaPublishPlan(plan: MetaPublishPlan): {
  ready: boolean;
  blockingIssues: MetaPublishIssue[];
  warnings: MetaPublishIssue[];
  publishPayloadSummary: Record<string, unknown>;
} {
  return {
    ready: plan.ready,
    blockingIssues: plan.blockingIssues,
    warnings: plan.warnings,
    publishPayloadSummary: {
      order: plan.publishOrder,
      campaign: plan.writePreview.campaign,
      adSet: plan.writePreview.adSet,
      creative: plan.creative,
      ad: plan.ad,
      fingerprint: plan.fingerprint,
      objectiveMapping: plan.objectiveMapping,
    },
  };
}
