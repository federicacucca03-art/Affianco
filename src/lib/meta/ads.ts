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

export const META_AD_FIELDS =
  "id,name,adset_id,campaign_id,status,effective_status,creative{id,name,title,body,call_to_action_type,thumbnail_url,image_url,link_url,object_url}";
export const META_ADS_PAGE_LIMIT = 50;
export const META_ADS_MAX_PAGES = 5;

export type MetaAdCreativeSummary = {
  creativeId: string | null;
  body: string | null;
  title: string | null;
  name: string | null;
  cta: string | null;
  thumbnailUrl: string | null;
  linkUrl: string | null;
};

export type MetaAdSummary = {
  metaAdId: string;
  metaAdSetId: string;
  metaCampaignId: string;
  name: string;
  status: string | null;
  effectiveStatus: string | null;
  creative: MetaAdCreativeSummary;
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

function normalizeActId(adAccountId: string): string {
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
  return `act_${numeric}`;
}

/** Account-level ads edge — prefer over per-adset N+1. */
export function graphAccountAdsEdge(adAccountId: string): string {
  return `${normalizeActId(adAccountId)}/ads`;
}

function extractCreative(raw: unknown): MetaAdCreativeSummary {
  const empty: MetaAdCreativeSummary = {
    creativeId: null,
    body: null,
    title: null,
    name: null,
    cta: null,
    thumbnailUrl: null,
    linkUrl: null,
  };
  if (!raw || typeof raw !== "object") return empty;
  const c = raw as Record<string, unknown>;
  const thumb =
    asText(c.thumbnail_url) ?? asText(c.image_url) ?? null;
  const link =
    asText(c.link_url) ?? asText(c.object_url) ?? null;
  return {
    creativeId: asText(c.id),
    body: asText(c.body),
    title: asText(c.title),
    name: asText(c.name),
    cta: asText(c.call_to_action_type),
    thumbnailUrl: thumb,
    linkUrl: link,
  };
}

export function normalizeMetaAd(raw: unknown): MetaAdSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const metaAdId = asText(row.id);
  if (!metaAdId) return null;
  const metaAdSetId = asText(row.adset_id);
  const metaCampaignId = asText(row.campaign_id);
  if (!metaAdSetId || !metaCampaignId) return null;
  return {
    metaAdId,
    metaAdSetId,
    metaCampaignId,
    name: asText(row.name) || metaAdId,
    status: asText(row.status),
    effectiveStatus: asText(row.effective_status),
    creative: extractCreative(row.creative),
  };
}

function parseAdsPage(raw: unknown): {
  ads: MetaAdSummary[];
  after: string | null;
} {
  if (!raw || typeof raw !== "object") {
    throw new MetaError(
      "META_CAMPAIGN_DISCOVERY_FAILED",
      "Lettura inserzioni Meta non riuscita.",
    );
  }
  const obj = raw as { data?: unknown; paging?: { cursors?: { after?: unknown } } };
  const data = Array.isArray(obj.data) ? obj.data : [];
  const ads = data
    .map(normalizeMetaAd)
    .filter((a): a is MetaAdSummary => a != null);
  const after =
    obj.paging &&
    obj.paging.cursors &&
    typeof obj.paging.cursors.after === "string" &&
    obj.paging.cursors.after.trim()
      ? obj.paging.cursors.after.trim()
      : null;
  return { ads, after };
}

export async function fetchAdsForCampaign(
  accessToken: string,
  version: string,
  adAccountId: string,
  campaignId: string,
  fetchImpl: FetchLike,
): Promise<MetaAdSummary[]> {
  const collected: MetaAdSummary[] = [];
  let after: string | null = null;
  const edge = graphAccountAdsEdge(adAccountId);
  const campaignFilter = JSON.stringify([
    {
      field: "campaign.id",
      operator: "IN",
      value: [campaignId.trim()],
    },
  ]);

  for (let page = 0; page < META_ADS_MAX_PAGES; page += 1) {
    const url = new URL(graphApiBase(version, edge));
    url.searchParams.set("fields", META_AD_FIELDS);
    url.searchParams.set("limit", String(META_ADS_PAGE_LIMIT));
    url.searchParams.set(
      "effective_status",
      JSON.stringify([
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
      ]),
    );
    url.searchParams.set("filtering", campaignFilter);
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
        "Lettura inserzioni Meta non riuscita.",
      );
    }

    if (!ok) {
      throw mapGraphErrorToMetaError(json, "META_CAMPAIGN_DISCOVERY_FAILED");
    }

    const parsed = parseAdsPage(json);
    collected.push(...parsed.ads);
    if (!parsed.after || parsed.after === after) {
      return collected;
    }
    after = parsed.after;
  }

  return collected;
}

export async function discoverClientCampaignAds(
  userId: string,
  clientId: string,
  campaignUuid: string,
  options?: { fetchImpl?: FetchLike },
): Promise<{
  ads: MetaAdSummary[];
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
  const ads = await fetchAdsForCampaign(
    token,
    config.graphApiVersion,
    campaign.metaAdAccountId,
    campaign.metaCampaignId,
    fetchImpl,
  );
  return {
    ads,
    metaCampaignId: campaign.metaCampaignId,
    metaAdAccountId: campaign.metaAdAccountId,
    metaConnectionId: connection.id,
  };
}
