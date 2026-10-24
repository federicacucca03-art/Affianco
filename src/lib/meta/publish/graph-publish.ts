/**
 * M14.1 — Graph helpers for Creative + Ad + media (PAUSED only).
 * Reuses MetaGraphWriteTransport from campaign/adset write path.
 * No ACTIVE status. Injectable transport for tests.
 */

import "server-only";
import { getMetaServerConfig } from "@/lib/meta/config";
import { graphApiBase } from "@/lib/meta/graph";
import { META_WRITE_SAFE_STATUS } from "@/lib/meta/write/types";
import { normalizeMetaWriteError } from "@/lib/meta/write/error-normalize";
import type {
  MetaGraphWriteTransport,
  MetaWriteCreateResult,
} from "@/lib/meta/write/graph-write";
import { buildObjectStorySpecForPublish } from "@/lib/meta/publish/payloads";

export { buildObjectStorySpecForPublish };

async function defaultTransport(input: {
  url: string;
  body: URLSearchParams | FormData;
}): Promise<{ ok: boolean; status: number; json: unknown }> {
  const res = await fetch(input.url, {
    method: "POST",
    body: input.body,
    cache: "no-store",
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json };
}

function parseId(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const id = (json as { id?: unknown }).id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function graphFail(
  status: number,
  json: unknown,
): MetaWriteCreateResult {
  const err =
    json && typeof json === "object" && "error" in json
      ? (json as { error: Record<string, unknown> }).error
      : null;
  const code = err && typeof err.code === "number" ? err.code : null;
  const subcode =
    err && typeof err.error_subcode === "number" ? err.error_subcode : null;
  const message =
    err && typeof err.message === "string" ? err.message.slice(0, 400) : null;
  const userTitle =
    err && typeof err.error_user_title === "string"
      ? err.error_user_title.slice(0, 200)
      : null;
  const userMsg =
    err && typeof err.error_user_msg === "string"
      ? err.error_user_msg.slice(0, 400)
      : null;
  const errorType =
    err && typeof err.type === "string" ? err.type.slice(0, 80) : null;
  const blameRaw = err?.error_data;
  let blameFields: string[] | null = null;
  if (blameRaw && typeof blameRaw === "object" && "blame_field_specs" in blameRaw) {
    const specs = (blameRaw as { blame_field_specs?: unknown }).blame_field_specs;
    if (Array.isArray(specs)) {
      blameFields = specs
        .map((s) =>
          s && typeof s === "object" && "blamed_field" in s
            ? String((s as { blamed_field?: unknown }).blamed_field ?? "")
            : "",
        )
        .filter(Boolean)
        .slice(0, 12);
    }
  }
  const norm = normalizeMetaWriteError({
    httpStatus: status,
    graphCode: code,
    graphSubcode: subcode,
    message,
  });
  return {
    ok: false,
    category: norm.category,
    safeMessage: norm.safeMessage,
    graphCode: norm.graphCode,
    errorSubcode: subcode,
    blameFields,
    metaUserTitle: userTitle,
    metaUserMsg: userMsg,
    metaMessageSafe: message,
    metaErrorType: errorType,
  };
}

function actPath(adAccountId: string, suffix: string): string {
  const act = adAccountId.replace(/^act_/, "");
  return `act_${act}/${suffix}`;
}

/** Upload image bytes → Meta image hash (no public Ally URL). */
export async function uploadMetaAdImageHash(input: {
  accessToken: string;
  adAccountId: string;
  fileName: string;
  bytes: Uint8Array;
  contentType?: string;
  transport?: MetaGraphWriteTransport;
}): Promise<
  | { ok: true; imageHash: string }
  | Extract<MetaWriteCreateResult, { ok: false }>
> {
  const config = getMetaServerConfig();
  const url = graphApiBase(
    config.graphApiVersion,
    actPath(input.adAccountId, "adimages"),
  );
  const form = new FormData();
  const blob = new Blob([Buffer.from(input.bytes)], {
    type: input.contentType || "image/jpeg",
  });
  form.append("filename", blob, input.fileName || "creative.jpg");
  form.append("access_token", input.accessToken);
  const transport = input.transport ?? defaultTransport;
  const res = await transport({ url, body: form });
  if (!res.ok) {
    const fail = graphFail(res.status, res.json);
    return fail.ok ? { ok: false, category: "NETWORK", safeMessage: "Upload fallito.", graphCode: null } : fail;
  }
  const images =
    res.json &&
    typeof res.json === "object" &&
    "images" in res.json &&
    (res.json as { images?: unknown }).images &&
    typeof (res.json as { images: unknown }).images === "object"
      ? ((res.json as { images: Record<string, { hash?: unknown }> }).images)
      : null;
  if (!images) {
    const fail = graphFail(res.status, res.json);
    return fail.ok
      ? { ok: false, category: "INVALID_PARAM", safeMessage: "Hash immagine mancante.", graphCode: null }
      : fail;
  }
  const first = Object.values(images)[0];
  const hash =
    first && typeof first.hash === "string" && first.hash.trim()
      ? first.hash.trim()
      : null;
  if (!hash) {
    const fail = graphFail(res.status, res.json);
    return fail.ok
      ? { ok: false, category: "INVALID_PARAM", safeMessage: "Hash immagine mancante.", graphCode: null }
      : fail;
  }
  return { ok: true, imageHash: hash };
}

/** Upload video bytes → Meta video id. */
export async function uploadMetaAdVideoId(input: {
  accessToken: string;
  adAccountId: string;
  fileName: string;
  bytes: Uint8Array;
  contentType?: string;
  transport?: MetaGraphWriteTransport;
}): Promise<
  | { ok: true; videoId: string }
  | Extract<MetaWriteCreateResult, { ok: false }>
> {
  const config = getMetaServerConfig();
  const url = graphApiBase(
    config.graphApiVersion,
    actPath(input.adAccountId, "advideos"),
  );
  const form = new FormData();
  const blob = new Blob([Buffer.from(input.bytes)], {
    type: input.contentType || "video/mp4",
  });
  form.append("source", blob, input.fileName || "creative.mp4");
  form.append("access_token", input.accessToken);
  const name = (input.fileName || "Ally video").replace(/\.[^.]+$/, "");
  form.append("title", name.slice(0, 80));
  const transport = input.transport ?? defaultTransport;
  const res = await transport({ url, body: form });
  if (!res.ok) {
    const fail = graphFail(res.status, res.json);
    return fail.ok
      ? { ok: false, category: "NETWORK", safeMessage: "Upload video fallito.", graphCode: null }
      : fail;
  }
  const id = parseId(res.json);
  if (!id) {
    const fail = graphFail(res.status, res.json);
    return fail.ok
      ? { ok: false, category: "INVALID_PARAM", safeMessage: "Video id mancante.", graphCode: null }
      : fail;
  }
  return { ok: true, videoId: id };
}

export type MetaCreativeObjectStorySpec = {
  page_id: string;
  instagram_user_id?: string;
  link_data?: Record<string, unknown>;
  video_data?: Record<string, unknown>;
};

/** Create ad creative. Returns creative id. */
export async function createMetaAdCreative(input: {
  accessToken: string;
  adAccountId: string;
  name: string;
  objectStorySpec: MetaCreativeObjectStorySpec;
  /** Meta url_tags query string without leading ?. */
  urlTags?: string | null;
  transport?: MetaGraphWriteTransport;
}): Promise<MetaWriteCreateResult> {
  const config = getMetaServerConfig();
  const url = graphApiBase(
    config.graphApiVersion,
    actPath(input.adAccountId, "adcreatives"),
  );
  const body = new URLSearchParams();
  body.set("name", input.name);
  body.set("object_story_spec", JSON.stringify(input.objectStorySpec));
  if ((input.urlTags ?? "").trim()) {
    body.set("url_tags", input.urlTags!.trim());
  }
  body.set("access_token", input.accessToken);
  const transport = input.transport ?? defaultTransport;
  const res = await transport({ url, body });
  if (!res.ok) return graphFail(res.status, res.json);
  const id = parseId(res.json);
  if (!id) return graphFail(res.status, res.json);
  return { ok: true, id };
}

/** Create ad referencing ad set + creative. Status always PAUSED. */
export async function createMetaAdPaused(input: {
  accessToken: string;
  adAccountId: string;
  name: string;
  adSetId: string;
  creativeId: string;
  transport?: MetaGraphWriteTransport;
}): Promise<MetaWriteCreateResult> {
  const config = getMetaServerConfig();
  const url = graphApiBase(
    config.graphApiVersion,
    actPath(input.adAccountId, "ads"),
  );
  const body = new URLSearchParams();
  body.set("name", input.name);
  body.set("adset_id", input.adSetId);
  body.set(
    "creative",
    JSON.stringify({ creative_id: input.creativeId }),
  );
  body.set("status", META_WRITE_SAFE_STATUS);
  body.set("access_token", input.accessToken);
  const transport = input.transport ?? defaultTransport;
  const res = await transport({ url, body });
  if (!res.ok) return graphFail(res.status, res.json);
  const id = parseId(res.json);
  if (!id) return graphFail(res.status, res.json);
  return { ok: true, id };
}
