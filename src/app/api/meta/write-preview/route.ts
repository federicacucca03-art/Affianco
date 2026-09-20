import { NextResponse } from "next/server";
import { requireRouteUserId } from "@/lib/api-auth";
import { isUuid } from "@/lib/meta/ids";
import { isMetaError } from "@/lib/meta/errors";
import { metaHttpStatus } from "@/lib/meta/graph";
import { getMetaServerConfig } from "@/lib/meta/config";
import { buildWritePreviewForAllyCampaign } from "@/lib/meta/write/load-preview";
import type { MetaWritePlanInput } from "@/lib/meta/write/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * M11A.1 — Dry-run Meta write preview.
 * MARKETING API CREATE CALLS: 0
 * Client may send campaignId + optional specialAdCategories decision only.
 */
export async function POST(request: Request) {
  const userId = await requireRouteUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato." }, { status: 401 });
  }

  // Fail closed if Graph config incomplete (same central config as reads).
  try {
    getMetaServerConfig();
  } catch {
    return NextResponse.json(
      { error: "Configurazione Meta incompleta.", code: "META_CONFIG_MISSING" },
      { status: 503 },
    );
  }

  let body: {
    campaignId?: unknown;
    specialAdCategories?: unknown;
    previousFingerprint?: unknown;
    countryCode?: unknown;
    metaGeoKey?: unknown;
    startAtIso?: unknown;
    endAtIso?: unknown;
    persist?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body non valido." }, { status: 400 });
  }

  const campaignId =
    typeof body.campaignId === "string" ? body.campaignId.trim() : "";
  if (!isUuid(campaignId)) {
    return NextResponse.json({ error: "Campagna mancante." }, { status: 400 });
  }

  // Reject any client-supplied Meta create payload keys.
  const raw = body as Record<string, unknown>;
  if (
    raw.campaignPayload != null ||
    raw.adSetPayload != null ||
    raw.metaPayload != null ||
    raw.accessToken != null
  ) {
    return NextResponse.json(
      { error: "Payload Meta non accettato dal client.", code: "INVALID_PARAM" },
      { status: 400 },
    );
  }

  let specialAdCategories: MetaWritePlanInput["specialAdCategories"] = {
    kind: "UNRESOLVED",
  };
  const sac = body.specialAdCategories;
  if (sac && typeof sac === "object") {
    const kind = (sac as { kind?: unknown }).kind;
    if (kind === "NONE") specialAdCategories = { kind: "NONE" };
    else if (kind === "CATEGORIES") {
      const cats = (sac as { categories?: unknown }).categories;
      if (Array.isArray(cats) && cats.every((c) => typeof c === "string")) {
        specialAdCategories = {
          kind: "CATEGORIES",
          categories: cats.map((c) => String(c)),
        };
      }
    }
  }

  try {
    const preview = await buildWritePreviewForAllyCampaign({
      userId,
      allyCampaignId: campaignId,
      specialAdCategories,
      previousFingerprint:
        typeof body.previousFingerprint === "string"
          ? body.previousFingerprint
          : null,
      countryCode:
        typeof body.countryCode === "string" ? body.countryCode : null,
      metaGeoKey: typeof body.metaGeoKey === "string" ? body.metaGeoKey : null,
      startAtIso: typeof body.startAtIso === "string" ? body.startAtIso : null,
      endAtIso: typeof body.endAtIso === "string" ? body.endAtIso : null,
      persist: body.persist === true,
    });
    return NextResponse.json({
      preview,
      writeEnabled: false,
      metaWrites: 0,
    });
  } catch (error) {
    if (isMetaError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: metaHttpStatus(error.code) },
      );
    }
    return NextResponse.json(
      { error: "Anteprima Meta non riuscita." },
      { status: 500 },
    );
  }
}
