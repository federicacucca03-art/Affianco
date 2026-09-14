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
import { getOwnedImportedMetaCampaign } from "@/lib/meta/campaign-import";
import {
  getDecryptedMetaAccessToken,
  getMetaConnectionForClient,
} from "@/lib/meta/connections";
import { MetaError } from "@/lib/meta/errors";
import { graphApiBase, mapGraphErrorToMetaError } from "@/lib/meta/graph";

export const META_ADSET_FIELDS =
  "id,name,campaign_id,status,effective_status";
export const META_ADSETS_PAGE_LIMIT = 50;
export const META_ADSETS_MAX_PAGES = 5;

/** Mirror campaign discovery: include PAUSED / CAMPAIGN_PAUSED ad sets. */
export const META_ADSET_EFFECTIVE_STATUSES = [
  "ACTIVE",
  "PAUSED",
  "CAMPAIGN_PAUSED",
  "PENDING_REVIEW",
  "DISAPPROVED",
  "PREAPPROVED",
  "PENDING_BILLING_INFO",
  "ARCHIVED",
  "ADSET_PAUSED",
  "IN_PROCESS",
  "WITH_ISSUES",
] as const;

/** Prefer account-level filtered edge to avoid brittle campaign-edge permission quirks. */
export function graphAccountAdSetsEdge(adAccountId: string): string {
  const raw = adAccountId.trim();
  if (!raw || raw.includes("/") || raw.includes("?")) {
    throw new MetaError(
      "META_CONNECTION_INVALID",
      "Account pubblicitario non valido.",
    );
  }
  const numeric = raw.replace(/^act_/i, "");
  if (!/^\d+$/.test(numeric)) {
    throw new MetaError(
      "META_CONNECTION_INVALID",
      "Account pubblicitario non valido.",
    );
  }
  return `act_${numeric}/adsets`;
}

export function graphCampaignAdSetsEdge(campaignId: string): string {
  const raw = campaignId.trim();
  if (!raw || raw.includes("/") || raw.includes("?") || !/^\d+$/.test(raw)) {
    throw new MetaError("META_CONNECTION_INVALID", "Campagna Meta non valida.");
  }
  return `${raw}/adsets`;
}

export type MetaAdSetSummary = {
  metaAdSetId: string;
  metaCampaignId: string;
  name: string;
  status: string | null;
  effectiveStatus: string | null;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  optimizationGoal: string | null;
  startAt: string | null;
  endAt: string | null;
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

export function normalizeMetaAdSet(
  raw: unknown,
  fallbackCampaignId?: string | null,
): MetaAdSetSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const metaAdSetId = asText(row.id);
  if (!metaAdSetId) return null;
  const metaCampaignId =
    asText(row.campaign_id) ??
    (fallbackCampaignId && fallbackCampaignId.trim()
      ? fallbackCampaignId.trim()
      : null);
  if (!metaCampaignId) return null;
  return {
    metaAdSetId,
    metaCampaignId,
    name: asText(row.name) || metaAdSetId,
    status: asText(row.status),
    effectiveStatus: asText(row.effective_status),
    dailyBudget: asBudget(row.daily_budget),
    lifetimeBudget: asBudget(row.lifetime_budget),
    optimizationGoal: asText(row.optimization_goal),
    startAt: asIso(row.start_time),
    endAt: asIso(row.end_time),
  };
}

function parseAdSetsPage(
  raw: unknown,
  fallbackCampaignId?: string | null,
): {
  adSets: MetaAdSetSummary[];
  after: string | null;
} {
  if (!raw || typeof raw !== "object") {
    throw new MetaError(
      "META_CAMPAIGN_DISCOVERY_FAILED",
      "Lettura gruppi di inserzioni Meta non riuscita.",
    );
  }
  const obj = raw as { data?: unknown; paging?: { cursors?: { after?: unknown } } };
  const data = Array.isArray(obj.data) ? obj.data : [];
  const adSets = data
    .map((item) => normalizeMetaAdSet(item, fallbackCampaignId))
    .filter((a): a is MetaAdSetSummary => a != null);
  const after =
    obj.paging &&
    obj.paging.cursors &&
    typeof obj.paging.cursors.after === "string" &&
    obj.paging.cursors.after.trim()
      ? obj.paging.cursors.after.trim()
      : null;
  return { adSets, after };
}

async function fetchAdSetsPages(
  accessToken: string,
  version: string,
  edge: string,
  campaignId: string,
  fetchImpl: FetchLike,
  extraParams?: Record<string, string>,
): Promise<MetaAdSetSummary[]> {
  const collected: MetaAdSetSummary[] = [];
  let after: string | null = null;

  for (let page = 0; page < META_ADSETS_MAX_PAGES; page += 1) {
    const url = new URL(graphApiBase(version, edge));
    url.searchParams.set("fields", META_ADSET_FIELDS);
    url.searchParams.set("limit", String(META_ADSETS_PAGE_LIMIT));
    url.searchParams.set(
      "effective_status",
      JSON.stringify([...META_ADSET_EFFECTIVE_STATUSES]),
    );
    if (extraParams) {
      for (const [k, v] of Object.entries(extraParams)) {
        url.searchParams.set(k, v);
      }
    }
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
        "Lettura gruppi di inserzioni Meta non riuscita.",
      );
    }

    if (!ok) {
      throw mapGraphErrorToMetaError(json, "META_CAMPAIGN_DISCOVERY_FAILED");
    }

    const parsed = parseAdSetsPage(json, campaignId);
    collected.push(...parsed.adSets);
    if (!parsed.after || parsed.after === after) {
      return collected;
    }
    after = parsed.after;
  }

  return collected;
}

export async function fetchAdSetsForCampaign(
  accessToken: string,
  version: string,
  adAccountId: string,
  campaignId: string,
  fetchImpl: FetchLike,
): Promise<MetaAdSetSummary[]> {
  const campaignFilter = JSON.stringify([
    {
      field: "campaign.id",
      operator: "IN",
      value: [campaignId.trim()],
    },
  ]);

  try {
    const accountLevel = await fetchAdSetsPages(
      accessToken,
      version,
      graphAccountAdSetsEdge(adAccountId),
      campaignId,
      fetchImpl,
      { filtering: campaignFilter },
    );
    if (accountLevel.length > 0) return accountLevel;
  } catch {
    // Account-level filtering failed — fall back to campaign edge.
  }

  // Fallback: campaign edge (no filtering param).
  return fetchAdSetsPages(
    accessToken,
    version,
    graphCampaignAdSetsEdge(campaignId),
    campaignId,
    fetchImpl,
  );
}

export async function discoverClientCampaignAdSets(
  userId: string,
  clientId: string,
  campaignUuid: string,
  options?: { fetchImpl?: FetchLike },
): Promise<{
  adSets: MetaAdSetSummary[];
  metaCampaignId: string;
  metaAdAccountId: string;
  metaConnectionId: string;
}> {
  const campaign = await getOwnedImportedMetaCampaign(
    userId,
    clientId,
    campaignUuid,
  );
  const connection = assertMetaConnectionReadyForAdsRead(
    await getMetaConnectionForClient(userId, clientId),
  );
  // Allow reconnect: campaign row may still reference a prior connection id
  // as long as ownership + current account mapping remain valid.
  const mapping = await getClientMetaAccount(userId, clientId);
  if (!mapping) {
    throw new MetaError(
      "META_AD_ACCOUNT_NOT_SELECTED",
      "Seleziona prima un account pubblicitario Meta.",
    );
  }
  if (mapping.metaAdAccountId !== campaign.metaAdAccountId) {
    throw new MetaError(
      "META_AD_ACCOUNT_ACCESS_LOST",
      "Account pubblicitario Meta non più accessibile.",
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
  const adSets = await fetchAdSetsForCampaign(
    token,
    config.graphApiVersion,
    campaign.metaAdAccountId,
    campaign.metaCampaignId,
    fetchImpl,
  );
  return {
    adSets,
    metaCampaignId: campaign.metaCampaignId,
    metaAdAccountId: campaign.metaAdAccountId,
    metaConnectionId: connection.id,
  };
}
