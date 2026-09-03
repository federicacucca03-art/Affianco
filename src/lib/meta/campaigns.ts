import "server-only";
import { getMetaServerConfig } from "@/lib/meta/config";
import {
  getAccessibleMetaAdAccounts,
  assertMetaConnectionReadyForAdsRead,
  isSafeMetaPagingCursor,
} from "@/lib/meta/accounts";
import {
  findAccessibleAccount,
  getClientMetaAccount,
} from "@/lib/meta/client-accounts";
import {
  getDecryptedMetaAccessToken,
  getMetaConnectionForClient,
} from "@/lib/meta/connections";
import { MetaError } from "@/lib/meta/errors";
import { graphApiBase, mapGraphErrorToMetaError } from "@/lib/meta/graph";
import { mapMetaObjectiveToAffianco } from "@/lib/meta/campaign-objective";
import type { CampagnaObjective } from "@/types/campagne";
import type { ObjectiveMappingConfidence } from "@/lib/meta/campaign-objective";

export const META_CAMPAIGN_FIELDS =
  "id,name,objective,status,effective_status,buying_type,created_time,start_time,stop_time,daily_budget,lifetime_budget";
export const META_CAMPAIGNS_PAGE_LIMIT = 50;
export const META_CAMPAIGNS_MAX_PAGES = 10;

/**
 * Default Meta edge omits archived/deleted.
 * Documented read-only filter: effective_status list (no DELETED — can error).
 */
export const META_CAMPAIGN_EFFECTIVE_STATUSES = [
  "ACTIVE",
  "PAUSED",
  "PENDING_REVIEW",
  "DISAPPROVED",
  "PREAPPROVED",
  "PENDING_BILLING_INFO",
  "CAMPAIGN_PAUSED",
  "ARCHIVED",
  "ADSET_PAUSED",
  "IN_PROCESS",
  "WITH_ISSUES",
] as const;

export type MetaCampaignSummary = {
  metaCampaignId: string;
  metaAdAccountId: string;
  name: string;
  rawObjective: string | null;
  affiancoObjectiveCandidate: CampagnaObjective | null;
  mappingConfidence: ObjectiveMappingConfidence;
  status: string | null;
  effectiveStatus: string | null;
  buyingType: string | null;
  createdAt: string | null;
  startAt: string | null;
  stopAt: string | null;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
};

type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string> },
) => Promise<{
  ok: boolean;
  json: () => Promise<unknown>;
}>;

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asIso(value: unknown): string | null {
  const text = asText(value);
  if (!text) return null;
  const ms = Date.parse(text);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function asBudget(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

export function graphCampaignsEdge(adAccountId: string): string {
  const raw = adAccountId.trim();
  if (!raw || raw.includes("/") || raw.includes("?")) {
    throw new MetaError("META_CONNECTION_INVALID", "Account pubblicitario non valido.");
  }
  const numeric = raw.replace(/^act_/i, "");
  if (!/^\d+$/.test(numeric)) {
    throw new MetaError("META_CONNECTION_INVALID", "Account pubblicitario non valido.");
  }
  return `act_${numeric}/campaigns`;
}

export function normalizeMetaCampaign(
  raw: unknown,
  metaAdAccountId: string,
): MetaCampaignSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const metaCampaignId = asText(row.id);
  if (!metaCampaignId) return null;
  const mapped = mapMetaObjectiveToAffianco(asText(row.objective));
  return {
    metaCampaignId,
    metaAdAccountId,
    name: asText(row.name) || metaCampaignId,
    rawObjective: mapped.rawObjective,
    affiancoObjectiveCandidate: mapped.affiancoObjectiveCandidate,
    mappingConfidence: mapped.mappingConfidence,
    status: asText(row.status),
    effectiveStatus: asText(row.effective_status),
    buyingType: asText(row.buying_type),
    createdAt: asIso(row.created_time),
    startAt: asIso(row.start_time),
    stopAt: asIso(row.stop_time),
    dailyBudget: asBudget(row.daily_budget),
    lifetimeBudget: asBudget(row.lifetime_budget),
  };
}

export function parseCampaignsPage(
  raw: unknown,
  metaAdAccountId: string,
): {
  campaigns: MetaCampaignSummary[];
  after: string | null;
} {
  if (!raw || typeof raw !== "object") {
    throw new MetaError(
      "META_CAMPAIGN_DISCOVERY_FAILED",
      "Lettura campagne Meta non riuscita.",
    );
  }
  const obj = raw as { data?: unknown; paging?: { cursors?: { after?: unknown } } };
  const data = Array.isArray(obj.data) ? obj.data : [];
  const campaigns = data
    .map((item) => normalizeMetaCampaign(item, metaAdAccountId))
    .filter((c): c is MetaCampaignSummary => c != null);
  const after =
    obj.paging &&
    obj.paging.cursors &&
    typeof obj.paging.cursors.after === "string" &&
    obj.paging.cursors.after.trim()
      ? obj.paging.cursors.after.trim()
      : null;
  return { campaigns, after };
}

export async function fetchCampaignPages(
  accessToken: string,
  version: string,
  adAccountId: string,
  fetchImpl: FetchLike,
): Promise<{ campaigns: MetaCampaignSummary[]; truncated: boolean }> {
  const collected: MetaCampaignSummary[] = [];
  let after: string | null = null;
  let truncated = false;
  const edge = graphCampaignsEdge(adAccountId);

  for (let page = 0; page < META_CAMPAIGNS_MAX_PAGES; page += 1) {
    const url = new URL(graphApiBase(version, edge));
    url.searchParams.set("fields", META_CAMPAIGN_FIELDS);
    url.searchParams.set("limit", String(META_CAMPAIGNS_PAGE_LIMIT));
    url.searchParams.set(
      "effective_status",
      JSON.stringify([...META_CAMPAIGN_EFFECTIVE_STATUSES]),
    );
    if (after) {
      if (!isSafeMetaPagingCursor(after)) break;
      url.searchParams.set("after", after);
    }

    let json: unknown;
    let ok = false;
    try {
      const res = await fetchImpl(url.toString(), {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      json = await res.json();
      ok = res.ok;
    } catch (error) {
      if (error instanceof MetaError) throw error;
      throw new MetaError(
        "META_CAMPAIGN_DISCOVERY_FAILED",
        "Lettura campagne Meta non riuscita.",
      );
    }

    if (!ok) {
      throw mapGraphErrorToMetaError(json, "META_CAMPAIGN_DISCOVERY_FAILED");
    }

    const parsed = parseCampaignsPage(json, adAccountId);
    collected.push(...parsed.campaigns);
    if (!parsed.after || parsed.after === after) {
      return { campaigns: collected, truncated };
    }
    after = parsed.after;
    if (page === META_CAMPAIGNS_MAX_PAGES - 1 && parsed.after) {
      truncated = true;
    }
  }

  return { campaigns: collected, truncated };
}

export async function discoverClientMetaCampaigns(
  userId: string,
  clientId: string,
  options?: { fetchImpl?: FetchLike },
): Promise<{
  campaigns: MetaCampaignSummary[];
  truncated: boolean;
  metaAdAccountId: string;
  metaConnectionId: string;
}> {
  const connection = await getMetaConnectionForClient(userId, clientId);
  assertMetaConnectionReadyForAdsRead(connection);
  const mapping = await getClientMetaAccount(userId, clientId);
  if (!mapping) {
    throw new MetaError(
      "META_AD_ACCOUNT_NOT_SELECTED",
      "Seleziona prima un account pubblicitario Meta.",
    );
  }
  const accessible = await getAccessibleMetaAdAccounts(userId, clientId, {
    fetchImpl: options?.fetchImpl,
  });
  const account = findAccessibleAccount(accessible, mapping.metaAdAccountId);
  if (!account) {
    throw new MetaError(
      "META_AD_ACCOUNT_ACCESS_LOST",
      "Account pubblicitario Meta non più accessibile.",
    );
  }
  const token = await getDecryptedMetaAccessToken(userId, clientId);
  const config = getMetaServerConfig();
  const fetchImpl = options?.fetchImpl ?? fetch;
  const result = await fetchCampaignPages(
    token,
    config.graphApiVersion,
    mapping.metaAdAccountId,
    fetchImpl,
  );
  return {
    ...result,
    metaAdAccountId: mapping.metaAdAccountId,
    metaConnectionId: mapping.metaConnectionId,
  };
}
