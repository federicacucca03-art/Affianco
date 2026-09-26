/**
 * M11A.2 — Server-side Marketing API create helpers (Campaign + Ad Set only).
 * Injectable transport for tests. No browser token. Status always PAUSED.
 *
 * validate_only: Meta runs field validation without mutation.
 * Success shape: { success: true } — never an object id.
 */

import "server-only";
import { getMetaServerConfig } from "@/lib/meta/config";
import { graphApiBase } from "@/lib/meta/graph";
import { META_WRITE_SAFE_STATUS } from "@/lib/meta/write/types";
import { normalizeMetaWriteError } from "@/lib/meta/write/error-normalize";

export type MetaGraphWriteTransport = (input: {
  url: string;
  body: URLSearchParams;
}) => Promise<{ ok: boolean; status: number; json: unknown }>;

export type MetaWriteCreateResult =
  | { ok: true; id: string }
  | {
      ok: false;
      category: ReturnType<typeof normalizeMetaWriteError>["category"];
      safeMessage: string;
      graphCode: number | null;
    };

export type MetaWriteValidateResult =
  | { ok: true; createdIdLeaked: false }
  | {
      ok: false;
      category: ReturnType<typeof normalizeMetaWriteError>["category"];
      safeMessage: string;
      graphCode: number | null;
      errorSubcode?: number | null;
      blameFields?: string[] | null;
      /** True if Meta unexpectedly returned an object id (mutation leak). */
      createdIdLeaked: boolean;
      /** Sanitized Meta user-facing bits — never tokens. */
      metaUserTitle?: string | null;
      metaUserMsg?: string | null;
      metaMessageSafe?: string | null;
      metaErrorType?: string | null;
      metaIsTransient?: boolean | null;
      metaErrorDataSafe?: Record<string, unknown> | null;
    };

/** Official Graph/Marketing API: campaigns + adsets accept validate_only. */
export const META_CAMPAIGN_VALIDATE_ONLY_SUPPORTED = true;
export const META_ADSET_VALIDATE_ONLY_SUPPORTED = true;

async function defaultTransport(input: {
  url: string;
  body: URLSearchParams;
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

function extractGraphErrorBits(json: unknown): {
  code: number | null;
  subcode: number | null;
  message: string | null;
  userTitle: string | null;
  userMsg: string | null;
  blameFields: string[] | null;
  errorType: string | null;
  isTransient: boolean | null;
  errorDataSafe: Record<string, unknown> | null;
} {
  const err =
    json && typeof json === "object" && "error" in json
      ? (json as { error: Record<string, unknown> }).error
      : null;
  if (!err) {
    return {
      code: null,
      subcode: null,
      message: null,
      userTitle: null,
      userMsg: null,
      blameFields: null,
      errorType: null,
      isTransient: null,
      errorDataSafe: null,
    };
  }
  const errorData =
    err.error_data && typeof err.error_data === "object"
      ? (err.error_data as Record<string, unknown>)
      : null;
  const blameRaw = errorData?.blame_fields ?? err.blame_fields;
  const blameSpecs = errorData?.blame_field_specs ?? err.blame_field_specs;
  const blameFromSpecs = Array.isArray(blameSpecs)
    ? blameSpecs
        .map((s) => {
          if (!s || typeof s !== "object") return null;
          const o = s as Record<string, unknown>;
          const path =
            typeof o.path === "string"
              ? o.path
              : typeof o.field === "string"
                ? o.field
                : null;
          return path;
        })
        .filter((x): x is string => Boolean(x))
    : [];
  const blameFields = Array.isArray(blameRaw)
    ? [
        ...blameRaw.filter((x): x is string => typeof x === "string"),
        ...blameFromSpecs,
      ].slice(0, 12)
    : blameFromSpecs.length > 0
      ? blameFromSpecs.slice(0, 12)
      : null;
  // Safe error_data: keep keys/values that are strings/numbers/bools/arrays of those.
  let errorDataSafe: Record<string, unknown> | null = null;
  if (errorData) {
    errorDataSafe = {};
    for (const [k, v] of Object.entries(errorData)) {
      if (typeof v === "string") errorDataSafe[k] = v.slice(0, 240);
      else if (typeof v === "number" || typeof v === "boolean")
        errorDataSafe[k] = v;
      else if (Array.isArray(v))
        errorDataSafe[k] = v
          .slice(0, 12)
          .map((x) =>
            typeof x === "string"
              ? x.slice(0, 80)
              : typeof x === "number" || typeof x === "boolean"
                ? x
                : typeof x === "object" && x
                  ? JSON.stringify(x).slice(0, 120)
                  : null,
          )
          .filter((x) => x != null);
    }
  }
  return {
    code: typeof err.code === "number" ? err.code : null,
    subcode: typeof err.error_subcode === "number" ? err.error_subcode : null,
    message: typeof err.message === "string" ? err.message.slice(0, 400) : null,
    userTitle:
      typeof err.error_user_title === "string"
        ? err.error_user_title.slice(0, 200)
        : null,
    userMsg:
      typeof err.error_user_msg === "string"
        ? err.error_user_msg.slice(0, 400)
        : null,
    blameFields,
    errorType: typeof err.type === "string" ? err.type.slice(0, 80) : null,
    isTransient: typeof err.is_transient === "boolean" ? err.is_transient : null,
    errorDataSafe,
  };
}

function isValidateSuccess(json: unknown): boolean {
  if (!json || typeof json !== "object") return false;
  return (json as { success?: unknown }).success === true;
}

function graphFail(
  status: number,
  json: unknown,
): MetaWriteCreateResult {
  const err =
    json && typeof json === "object" && "error" in json
      ? (json as { error: Record<string, unknown> }).error
      : null;
  const code =
    err && typeof err.code === "number" ? err.code : null;
  const message =
    err && typeof err.message === "string" ? err.message : null;
  const norm = normalizeMetaWriteError({
    httpStatus: status,
    graphCode: code,
    message,
  });
  return {
    ok: false,
    category: norm.category,
    safeMessage: norm.safeMessage,
    graphCode: norm.graphCode,
  };
}

function validateFail(
  status: number,
  json: unknown,
  createdIdLeaked: boolean,
): MetaWriteValidateResult {
  const fail = graphFail(status, json);
  const bits = extractGraphErrorBits(json);
  if (fail.ok) {
    return { ok: true, createdIdLeaked: false };
  }
  return {
    ok: false,
    category: fail.category,
    safeMessage: fail.safeMessage,
    graphCode: fail.graphCode ?? bits.code,
    errorSubcode: bits.subcode,
    blameFields: bits.blameFields,
    createdIdLeaked,
    metaUserTitle: bits.userTitle,
    metaUserMsg: bits.userMsg,
    metaMessageSafe: bits.message,
    metaErrorType: bits.errorType,
    metaIsTransient: bits.isTransient,
    metaErrorDataSafe: bits.errorDataSafe,
  };
}

function campaignBody(input: {
  accessToken: string;
  name: string;
  objective: string;
  specialAdCategories: string[];
  dailyBudgetMinor?: number | null;
  isAdsetBudgetSharingEnabled?: boolean | null;
  validateOnly?: boolean;
}): URLSearchParams {
  const body = new URLSearchParams();
  body.set("name", input.name);
  body.set("objective", input.objective);
  body.set("status", META_WRITE_SAFE_STATUS);
  body.set("special_ad_categories", JSON.stringify(input.specialAdCategories));
  body.set("buying_type", "AUCTION");
  if (input.dailyBudgetMinor != null) {
    body.set("daily_budget", String(input.dailyBudgetMinor));
  }
  // Meta requires an explicit boolean when campaign budget is absent (Ad Set budget).
  if (input.isAdsetBudgetSharingEnabled != null) {
    body.set(
      "is_adset_budget_sharing_enabled",
      input.isAdsetBudgetSharingEnabled ? "true" : "false",
    );
  }
  if (input.validateOnly) {
    body.set("execution_options", JSON.stringify(["validate_only"]));
  }
  body.set("access_token", input.accessToken);
  return body;
}

function adSetBody(input: {
  accessToken: string;
  name: string;
  campaignId: string;
  optimizationGoal: string;
  billingEvent: string;
  dailyBudgetMinor?: number | null;
  targeting: Record<string, unknown>;
  startTime?: string | null;
  endTime?: string | null;
  promotedObject?: Record<string, unknown> | null;
  destinationType?: string | null;
  bidStrategy?: string | null;
  bidAmount?: number | null;
  validateOnly?: boolean;
}): URLSearchParams {
  const body = new URLSearchParams();
  body.set("name", input.name);
  body.set("campaign_id", input.campaignId);
  body.set("optimization_goal", input.optimizationGoal);
  body.set("billing_event", input.billingEvent);
  body.set("status", META_WRITE_SAFE_STATUS);
  body.set("targeting", JSON.stringify(input.targeting));
  if (input.dailyBudgetMinor != null) {
    body.set("daily_budget", String(input.dailyBudgetMinor));
  }
  if (input.startTime) body.set("start_time", input.startTime);
  if (input.endTime) body.set("end_time", input.endTime);
  if (input.promotedObject) {
    body.set("promoted_object", JSON.stringify(input.promotedObject));
  }
  if (input.destinationType) {
    body.set("destination_type", input.destinationType);
  }
  if (input.bidStrategy) {
    body.set("bid_strategy", input.bidStrategy);
  }
  if (input.bidAmount != null) {
    body.set("bid_amount", String(input.bidAmount));
  }
  if (input.validateOnly) {
    body.set("execution_options", JSON.stringify(["validate_only"]));
  }
  body.set("access_token", input.accessToken);
  return body;
}

export async function createMetaCampaignPaused(input: {
  accessToken: string;
  adAccountId: string;
  name: string;
  objective: string;
  specialAdCategories: string[];
  dailyBudgetMinor?: number | null;
  isAdsetBudgetSharingEnabled?: boolean | null;
  transport?: MetaGraphWriteTransport;
}): Promise<MetaWriteCreateResult> {
  const act = input.adAccountId.replace(/^act_/, "");
  const config = getMetaServerConfig();
  const url = graphApiBase(config.graphApiVersion, `act_${act}/campaigns`);
  const body = campaignBody({ ...input, validateOnly: false });
  const transport = input.transport ?? defaultTransport;
  const res = await transport({ url, body });
  if (!res.ok) return graphFail(res.status, res.json);
  const id = parseId(res.json);
  if (!id) return graphFail(res.status, res.json);
  return { ok: true, id };
}

/**
 * Meta-side Campaign validation without create/persist.
 * Mutates nothing when Meta honors validate_only.
 */
export async function validateMetaCampaignPaused(input: {
  accessToken: string;
  adAccountId: string;
  name: string;
  objective: string;
  specialAdCategories: string[];
  dailyBudgetMinor?: number | null;
  isAdsetBudgetSharingEnabled?: boolean | null;
  transport?: MetaGraphWriteTransport;
}): Promise<MetaWriteValidateResult> {
  const act = input.adAccountId.replace(/^act_/, "");
  const config = getMetaServerConfig();
  const url = graphApiBase(config.graphApiVersion, `act_${act}/campaigns`);
  const body = campaignBody({ ...input, validateOnly: true });
  const transport = input.transport ?? defaultTransport;
  const res = await transport({ url, body });
  const leakedId = parseId(res.json);
  if (leakedId) {
    return {
      ok: false,
      category: "INVALID_PARAM",
      safeMessage:
        "Meta ha restituito un ID campagna durante validate_only. Nessuna creazione Ally prevista.",
      graphCode: null,
      createdIdLeaked: true,
    };
  }
  if (res.ok && isValidateSuccess(res.json)) {
    return { ok: true, createdIdLeaked: false };
  }
  // Some Graph versions return 200 with empty body on validate — treat as fail-closed
  // unless success:true. Prefer explicit success.
  if (res.ok && !isValidateSuccess(res.json)) {
    return validateFail(res.status || 400, res.json ?? { error: { message: "validate_response_invalid" } }, false);
  }
  return validateFail(res.status, res.json, false);
}

export async function createMetaAdSetPaused(input: {
  accessToken: string;
  adAccountId: string;
  name: string;
  campaignId: string;
  optimizationGoal: string;
  billingEvent: string;
  dailyBudgetMinor?: number | null;
  targeting: Record<string, unknown>;
  startTime?: string | null;
  endTime?: string | null;
  promotedObject?: Record<string, unknown> | null;
  destinationType?: string | null;
  bidStrategy?: string | null;
  bidAmount?: number | null;
  transport?: MetaGraphWriteTransport;
}): Promise<MetaWriteCreateResult> {
  const act = input.adAccountId.replace(/^act_/, "");
  const config = getMetaServerConfig();
  const url = graphApiBase(config.graphApiVersion, `act_${act}/adsets`);
  const body = adSetBody({ ...input, validateOnly: false });
  const transport = input.transport ?? defaultTransport;
  const res = await transport({ url, body });
  if (!res.ok) return graphFail(res.status, res.json);
  const id = parseId(res.json);
  if (!id) return graphFail(res.status, res.json);
  return { ok: true, id };
}

/**
 * Meta-side Ad Set validation without create.
 * Requires a real campaign_id — do not invent placeholders.
 */
export async function validateMetaAdSetPaused(input: {
  accessToken: string;
  adAccountId: string;
  name: string;
  campaignId: string;
  optimizationGoal: string;
  billingEvent: string;
  dailyBudgetMinor?: number | null;
  targeting: Record<string, unknown>;
  startTime?: string | null;
  endTime?: string | null;
  promotedObject?: Record<string, unknown> | null;
  destinationType?: string | null;
  bidStrategy?: string | null;
  bidAmount?: number | null;
  transport?: MetaGraphWriteTransport;
}): Promise<MetaWriteValidateResult> {
  const campaignId = input.campaignId.trim();
  if (!campaignId || campaignId.includes("pending") || campaignId === "0") {
    return {
      ok: false,
      category: "INVALID_PARAM",
      safeMessage:
        "Validazione Ad Set richiede un campaign_id Meta reale. Non inventato.",
      graphCode: null,
      createdIdLeaked: false,
    };
  }
  const act = input.adAccountId.replace(/^act_/, "");
  const config = getMetaServerConfig();
  const url = graphApiBase(config.graphApiVersion, `act_${act}/adsets`);
  const body = adSetBody({ ...input, campaignId, validateOnly: true });
  const transport = input.transport ?? defaultTransport;
  const res = await transport({ url, body });
  const leakedId = parseId(res.json);
  if (leakedId) {
    return {
      ok: false,
      category: "INVALID_PARAM",
      safeMessage:
        "Meta ha restituito un ID Ad Set durante validate_only. Nessuna creazione Ally prevista.",
      graphCode: null,
      createdIdLeaked: true,
    };
  }
  if (res.ok && isValidateSuccess(res.json)) {
    return { ok: true, createdIdLeaked: false };
  }
  if (res.ok && !isValidateSuccess(res.json)) {
    return validateFail(
      res.status || 400,
      res.json ?? { error: { message: "validate_response_invalid" } },
      false,
    );
  }
  return validateFail(res.status, res.json, false);
}
