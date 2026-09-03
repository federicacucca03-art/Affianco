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
import { resolveInsightDateRange } from "@/lib/meta/insight-dates";
import {
  normalizeInsightRow,
  parseInsightsPage,
  parseNonNegInt,
  parseNonNegNumber,
  type NormalizedDailyInsight,
} from "@/lib/meta/insight-normalize";

/**
 * Documented Insights fields used by M4.1.
 * Meta `ctr` is typically all-clicks / impressions, not link-click CTR.
 * Stored separately as meta_ctr / meta_cpc / meta_cpm.
 */
export const META_INSIGHT_FIELDS = [
  "date_start",
  "date_stop",
  "campaign_id",
  "impressions",
  "reach",
  "clicks",
  "spend",
  "frequency",
  "ctr",
  "cpc",
  "cpm",
  "actions",
  "action_values",
  "outbound_clicks",
  "inline_link_clicks",
].join(",");

export const META_INSIGHTS_PAGE_LIMIT = 50;
export const META_INSIGHTS_MAX_PAGES = 5;

type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string> },
) => Promise<{
  ok: boolean;
  json: () => Promise<unknown>;
}>;

export function graphCampaignInsightsEdge(metaCampaignId: string): string {
  const raw = metaCampaignId.trim();
  if (!raw || raw.includes("/") || raw.includes("?") || !/^\d+$/.test(raw)) {
    throw new MetaError("META_CONNECTION_INVALID", "Campagna Meta non valida.");
  }
  return `${raw}/insights`;
}

export async function fetchInsightsPages(
  accessToken: string,
  version: string,
  metaCampaignId: string,
  params: {
    since: string;
    until: string;
    timeIncrement: "1" | "all_days";
  },
  fetchImpl: FetchLike,
): Promise<unknown[]> {
  const collected: unknown[] = [];
  let after: string | null = null;
  const edge = graphCampaignInsightsEdge(metaCampaignId);

  for (let page = 0; page < META_INSIGHTS_MAX_PAGES; page += 1) {
    const url = new URL(graphApiBase(version, edge));
    url.searchParams.set("fields", META_INSIGHT_FIELDS);
    url.searchParams.set("limit", String(META_INSIGHTS_PAGE_LIMIT));
    url.searchParams.set("time_increment", params.timeIncrement);
    url.searchParams.set(
      "time_range",
      JSON.stringify({ since: params.since, until: params.until }),
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
        "META_INSIGHTS_DISCOVERY_FAILED",
        "Lettura Insights Meta non riuscita.",
      );
    }

    if (!ok) {
      throw mapGraphErrorToMetaError(json, "META_INSIGHTS_DISCOVERY_FAILED");
    }

    collected.push(...parseInsightsPage(json));
    const paging =
      json && typeof json === "object"
        ? (json as { paging?: { cursors?: { after?: unknown } } }).paging
        : undefined;
    const nextAfter =
      paging &&
      paging.cursors &&
      typeof paging.cursors.after === "string" &&
      paging.cursors.after.trim()
        ? paging.cursors.after.trim()
        : null;
    if (!nextAfter || nextAfter === after) {
      return collected;
    }
    after = nextAfter;
  }

  return collected;
}

export async function discoverClientCampaignInsights(
  userId: string,
  clientId: string,
  campaignId: string,
  options?: { fetchImpl?: FetchLike },
): Promise<{
  daily: NormalizedDailyInsight[];
  periodReach: number | null;
  periodFrequency: number | null;
  dateRange: ReturnType<typeof resolveInsightDateRange>;
  metaCampaignId: string;
  metaAdAccountId: string;
  metaConnectionId: string;
  currency: string | null;
  rawObjective: string | null;
}> {
  const campaign = await getOwnedImportedMetaCampaign(
    userId,
    clientId,
    campaignId,
  );
  const connection = assertMetaConnectionReadyForAdsRead(
    await getMetaConnectionForClient(userId, clientId),
  );
  if (connection.id !== campaign.metaConnectionId) {
    throw new MetaError(
      "META_CAMPAIGN_ACCESS_LOST",
      "Campagna Meta non trovata per questo cliente.",
    );
  }
  const mapping = await getClientMetaAccount(userId, clientId);
  if (!mapping) {
    throw new MetaError(
      "META_AD_ACCOUNT_NOT_SELECTED",
      "Seleziona prima un account pubblicitario Meta.",
    );
  }
  if (
    mapping.metaAdAccountId !== campaign.metaAdAccountId ||
    mapping.metaConnectionId !== campaign.metaConnectionId
  ) {
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
  const dateRange = resolveInsightDateRange({
    metaStartAt: campaign.startAt,
    metaStopAt: campaign.stopAt,
    metaCreatedAt: campaign.createdAt,
  });

  const dailyRaw = await fetchInsightsPages(
    token,
    config.graphApiVersion,
    campaign.metaCampaignId,
    { since: dateRange.since, until: dateRange.until, timeIncrement: "1" },
    fetchImpl,
  );
  const periodRaw = await fetchInsightsPages(
    token,
    config.graphApiVersion,
    campaign.metaCampaignId,
    {
      since: dateRange.since,
      until: dateRange.until,
      timeIncrement: "all_days",
    },
    fetchImpl,
  );

  const daily = dailyRaw
    .map((row) =>
      normalizeInsightRow(row, { rawObjective: campaign.rawObjective }),
    )
    .filter((row): row is NormalizedDailyInsight => row != null);

  const periodRow = periodRaw[0];
  let periodReach: number | null = null;
  let periodFrequency: number | null = null;
  if (periodRow && typeof periodRow === "object") {
    const rec = periodRow as Record<string, unknown>;
    periodReach = parseNonNegInt(rec.reach);
    periodFrequency = parseNonNegNumber(rec.frequency);
  }

  return {
    daily,
    periodReach,
    periodFrequency,
    dateRange,
    metaCampaignId: campaign.metaCampaignId,
    metaAdAccountId: campaign.metaAdAccountId,
    metaConnectionId: campaign.metaConnectionId,
    currency: mapping.currency,
    rawObjective: campaign.rawObjective,
  };
}
