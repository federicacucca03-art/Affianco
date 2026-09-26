import { NextResponse } from "next/server";
import { requireRouteUserId } from "@/lib/api-auth";
import { isUuid } from "@/lib/meta/ids";
import { isMetaError } from "@/lib/meta/errors";
import { metaHttpStatus } from "@/lib/meta/graph";
import { getMetaServerConfig } from "@/lib/meta/config";
import { buildWritePreviewBundle } from "@/lib/meta/write/load-preview";
import type { MetaWritePlanInput } from "@/lib/meta/write/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * M11A.2F.1 — Dry-run Meta write preview + form hydrate.
 * MARKETING API CREATE CALLS: 0
 */
export async function POST(request: Request) {
  const userId = await requireRouteUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato." }, { status: 401 });
  }

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
    geoLabel?: unknown;
    startAtIso?: unknown;
    endAtIso?: unknown;
    destination?: unknown;
    pageId?: unknown;
    formId?: unknown;
    persist?: unknown;
    hydrate?: unknown;
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

  const hydrate = body.hydrate === true;

  let specialAdCategories: MetaWritePlanInput["specialAdCategories"] | undefined;
  if (!hydrate && body.specialAdCategories != null) {
    specialAdCategories = { kind: "UNRESOLVED" };
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
  }

  try {
    const destRaw =
      typeof body.destination === "string" ? body.destination : null;
    const destinationOverride =
      !hydrate &&
      (destRaw === "META_LEAD_FORM" ||
        destRaw === "WEBSITE" ||
        destRaw === "WHATSAPP" ||
        destRaw === "PHONE")
        ? destRaw
        : null;

    const bundle = await buildWritePreviewBundle({
      userId,
      allyCampaignId: campaignId,
      specialAdCategories,
      previousFingerprint:
        typeof body.previousFingerprint === "string"
          ? body.previousFingerprint
          : null,
      countryCode:
        !hydrate && typeof body.countryCode === "string"
          ? body.countryCode
          : undefined,
      metaGeoKey:
        !hydrate && typeof body.metaGeoKey === "string"
          ? body.metaGeoKey
          : undefined,
      geoLabel:
        !hydrate && typeof body.geoLabel === "string" ? body.geoLabel : undefined,
      startAtIso:
        !hydrate && typeof body.startAtIso === "string"
          ? body.startAtIso
          : undefined,
      endAtIso:
        !hydrate && typeof body.endAtIso === "string" ? body.endAtIso : undefined,
      destinationOverride,
      pageIdOverride:
        !hydrate && typeof body.pageId === "string" ? body.pageId : undefined,
      formIdOverride:
        !hydrate && typeof body.formId === "string" ? body.formId : undefined,
      hydrateFromCanonical: hydrate,
      persist: body.persist === true || hydrate,
    });

    return NextResponse.json({
      preview: bundle.preview,
      formState: bundle.formState,
      liveWritesEnabled: bundle.liveWritesEnabled,
      writeEnabled:
        bundle.preview.canWrite && bundle.liveWritesEnabled,
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
