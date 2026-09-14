import "server-only";
import { importClientCampaignHierarchy } from "@/lib/meta/hierarchy-import";
import { importClientCampaignHierarchyInsights } from "@/lib/meta/hierarchy-insights";
import { isMetaError } from "@/lib/meta/errors";

export type HierarchySyncResult = {
  ok: boolean;
  partial: boolean;
  adSetsUpserted: number;
  adsUpserted: number;
  adSetInsightRows: number;
  adInsightRows: number;
  /** Safe MetaError code when available — never tokens. */
  lastErrorCode?: string;
};

/**
 * Entities then insights. Swallows hierarchy failures so campaign insights
 * remain valid. Logs category only — never tokens.
 */
export async function syncClientCampaignHierarchy(
  userId: string,
  clientId: string,
  campaignUuid: string,
  options?: {
    fetchImpl?: (
      input: string,
      init?: { method?: string; headers?: Record<string, string> },
    ) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;
    skipInsights?: boolean;
  },
): Promise<HierarchySyncResult> {
  let adSetsUpserted = 0;
  let adsUpserted = 0;
  let adSetInsightRows = 0;
  let adInsightRows = 0;
  let partial = false;
  let lastErrorCode: string | undefined;

  try {
    const entities = await importClientCampaignHierarchy(
      userId,
      clientId,
      campaignUuid,
      options,
    );
    adSetsUpserted = entities.adSetsUpserted;
    adsUpserted = entities.adsUpserted;
  } catch (error) {
    lastErrorCode = isMetaError(error) ? error.code : "UNKNOWN";
    return {
      ok: false,
      partial: true,
      adSetsUpserted: 0,
      adsUpserted: 0,
      adSetInsightRows: 0,
      adInsightRows: 0,
      lastErrorCode,
    };
  }

  if (options?.skipInsights) {
    return {
      ok: true,
      partial: false,
      adSetsUpserted,
      adsUpserted,
      adSetInsightRows: 0,
      adInsightRows: 0,
    };
  }

  try {
    const insights = await importClientCampaignHierarchyInsights(
      userId,
      clientId,
      campaignUuid,
      options,
    );
    adSetInsightRows = insights.adSetInsightRows;
    adInsightRows = insights.adInsightRows;
  } catch (error) {
    lastErrorCode = isMetaError(error) ? error.code : "UNKNOWN";
    partial = true;
  }

  return {
    ok: true,
    partial,
    adSetsUpserted,
    adsUpserted,
    adSetInsightRows,
    adInsightRows,
    lastErrorCode,
  };
}
