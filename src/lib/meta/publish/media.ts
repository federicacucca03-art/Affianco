/**
 * M14.1 — Ally Storage → Meta media bytes (no public insecure URLs).
 * Downloads via service-role from private campaign-creatives bucket.
 */

import "server-only";
import { createHash } from "node:crypto";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import type { CreativitaMeta } from "@/lib/creativita";

export const ALLY_CREATIVE_BUCKET = "campaign-creatives";

export type AllyCreativeAssetBytes = {
  storagePath: string;
  fileName: string;
  bytes: Uint8Array;
  contentType: string;
  isVideo: boolean;
};

function asCreativitaList(raw: unknown): CreativitaMeta[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is CreativitaMeta =>
      Boolean(x) &&
      typeof x === "object" &&
      typeof (x as CreativitaMeta).id === "string",
  );
}

/** Stable idempotency key for Ally Storage → Meta image_hash (same asset, no re-upload). */
export function computeAllyMediaAssetFingerprint(input: {
  creativitaId: string;
  storagePath: string;
  byteLength: number;
}): string {
  return createHash("sha256")
    .update(
      `${input.creativitaId}|${input.storagePath}|${input.byteLength}`,
      "utf8",
    )
    .digest("hex");
}

export type PersistedMetaMediaAssetMeta = {
  creativitaId: string;
  storagePath: string;
  contentType: string;
  byteLength: number;
  width: number | null;
  height: number | null;
  source: "ally_storage_campaign_creatives";
};

export function readPersistedMetaMediaFromSummary(
  summary: Record<string, unknown> | null | undefined,
): {
  metaImageHash: string | null;
  mediaAssetFingerprint: string | null;
  mediaAsset: PersistedMetaMediaAssetMeta | null;
} {
  const metaImageHash =
    typeof summary?.metaImageHash === "string" && summary.metaImageHash.trim()
      ? summary.metaImageHash.trim()
      : null;
  const mediaAssetFingerprint =
    typeof summary?.mediaAssetFingerprint === "string" &&
    summary.mediaAssetFingerprint.trim()
      ? summary.mediaAssetFingerprint.trim()
      : null;
  const raw = summary?.mediaAsset;
  let mediaAsset: PersistedMetaMediaAssetMeta | null = null;
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const creativitaId =
      typeof o.creativitaId === "string" ? o.creativitaId.trim() : "";
    const storagePath =
      typeof o.storagePath === "string" ? o.storagePath.trim() : "";
    if (creativitaId && storagePath) {
      mediaAsset = {
        creativitaId,
        storagePath,
        contentType:
          typeof o.contentType === "string" ? o.contentType : "image/jpeg",
        byteLength:
          typeof o.byteLength === "number" && Number.isFinite(o.byteLength)
            ? o.byteLength
            : 0,
        width:
          typeof o.width === "number" && Number.isFinite(o.width)
            ? o.width
            : null,
        height:
          typeof o.height === "number" && Number.isFinite(o.height)
            ? o.height
            : null,
        source: "ally_storage_campaign_creatives",
      };
    }
  }
  return { metaImageHash, mediaAssetFingerprint, mediaAsset };
}

export function pickPrincipalCreativita(
  creativitaRaw: unknown,
): CreativitaMeta | null {
  const list = asCreativitaList(creativitaRaw);
  if (list.length === 0) return null;
  return list.find((a) => a.ruolo === "principale") ?? list[0] ?? null;
}

function guessContentType(fileName: string, isVideo: boolean): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (isVideo) {
    if (ext === "mov") return "video/quicktime";
    if (ext === "webm") return "video/webm";
    return "video/mp4";
  }
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

/**
 * Server-only download of private Ally creative bytes for Meta upload.
 * Never exposes a long-lived public URL to Meta.
 */
export async function downloadAllyCreativeBytes(
  creativitaRaw: unknown,
): Promise<
  | { ok: true; asset: AllyCreativeAssetBytes }
  | { ok: false; reason: "MISSING_CREATIVE_ASSET" | "STORAGE_DOWNLOAD_FAILED"; messageIt: string }
> {
  const principal = pickPrincipalCreativita(creativitaRaw);
  const path = principal?.storagePath?.trim() ?? "";
  if (!principal || !path) {
    return {
      ok: false,
      reason: "MISSING_CREATIVE_ASSET",
      messageIt: "Manca la creatività (immagine o video) in Ally Storage.",
    };
  }

  const admin = createSupabaseAdmin();
  const { data, error } = await admin.storage
    .from(ALLY_CREATIVE_BUCKET)
    .download(path);
  if (error || !data) {
    return {
      ok: false,
      reason: "STORAGE_DOWNLOAD_FAILED",
      messageIt:
        "Download creatività da Ally Storage non riuscito. Verifica l'asset e riprova.",
    };
  }

  const buf = new Uint8Array(await data.arrayBuffer());
  if (buf.byteLength === 0) {
    return {
      ok: false,
      reason: "STORAGE_DOWNLOAD_FAILED",
      messageIt: "Creatività Ally vuota o non leggibile.",
    };
  }

  const isVideo = Boolean(principal.isVideo);
  const fileName = principal.nomeFile?.trim() || (isVideo ? "creative.mp4" : "creative.jpg");
  return {
    ok: true,
    asset: {
      storagePath: path,
      fileName,
      bytes: buf,
      contentType: guessContentType(fileName, isVideo),
      isVideo,
    },
  };
}
