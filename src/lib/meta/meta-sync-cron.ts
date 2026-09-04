/**
 * M7A — Scheduled Meta insights sync orchestration.
 * Reuses importClientCampaignInsights. No AI, no notifications, no Meta writes.
 *
 * Hobby MVP cadence: Vercel cron runs once daily (`0 6 * * *` in vercel.json).
 * Sub-daily schedules require Vercel Pro — do not raise cadence on Hobby.
 */

import "server-only";

import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { importClientCampaignInsights } from "@/lib/meta/insight-import";
import { markMetaConnectionStatus } from "@/lib/meta/connections";
import { resolveMonitoringMode } from "@/lib/meta/insights-control-room";
import { isMetaError } from "@/lib/meta/errors";
import { isUuid } from "@/lib/meta/ids";

/**
 * PAUSED campaigns: at most once per day (safety if cron/manual overlap).
 * ACTIVE campaigns sync on every daily cron invocation (no intra-day skip).
 */
export const PAUSED_RESYNC_MIN_MS = 24 * 60 * 60 * 1000;

export type MetaSyncSkipReason =
  | "NOT_DUE"
  | "ARCHIVED_SKIP"
  | "NO_ACCOUNT"
  | "DISCONNECTED"
  | "LEGACY_UNASSIGNED"
  | "RATE_LIMIT_STOP";

export type MetaSyncTarget = {
  userId: string;
  clientId: string;
  campaignUuid: string;
  metaCampaignId: string;
  effectiveStatus: string | null;
  insightsLastSyncedAt: string | null;
  mode: "ACTIVE_MONITORING" | "HISTORICAL_REVIEW";
};

export type MetaSyncRunSummary = {
  connectionsChecked: number;
  campaignsChecked: number;
  campaignsSynced: number;
  campaignsSkipped: number;
  errorsCount: number;
  rateLimited: boolean;
  elapsedMs: number;
};

function admin() {
  return createSupabaseAdmin();
}

function statusUpper(raw: string | null | undefined): string {
  return (raw ?? "").trim().toUpperCase();
}

/** True for ARCHIVED / DELETED — no recurring sync once insights exist. */
export function isTerminalHistoricalStatus(
  effectiveStatus: string | null | undefined,
): boolean {
  const u = statusUpper(effectiveStatus);
  return u === "ARCHIVED" || u === "DELETED";
}

/**
 * Decide whether a campaign is due for scheduled sync.
 * Pure — no I/O.
 */
export function isCampaignDueForScheduledSync(input: {
  effectiveStatus: string | null | undefined;
  insightsLastSyncedAt: string | null | undefined;
  nowMs?: number;
}): { due: boolean; reason: MetaSyncSkipReason | null } {
  const now = input.nowMs ?? Date.now();
  const mode = resolveMonitoringMode(input.effectiveStatus);
  const last = input.insightsLastSyncedAt
    ? Date.parse(input.insightsLastSyncedAt)
    : NaN;
  const hasSynced = Number.isFinite(last);

  if (isTerminalHistoricalStatus(input.effectiveStatus)) {
    if (hasSynced) {
      return { due: false, reason: "ARCHIVED_SKIP" };
    }
    // One-shot historical refresh if never synced.
    return { due: true, reason: null };
  }

  if (mode === "HISTORICAL_REVIEW") {
    // PAUSED family: at most once daily.
    if (!hasSynced) return { due: true, reason: null };
    if (now - last! >= PAUSED_RESYNC_MIN_MS) {
      return { due: true, reason: null };
    }
    return { due: false, reason: "NOT_DUE" };
  }

  // ACTIVE_MONITORING: sync on every daily cron run.
  return { due: true, reason: null };
}

type ConnectionRow = {
  id: string;
  user_id: string;
  client_id: string | null;
  status: string;
};

type AccountRow = {
  user_id: string;
  client_id: string;
  meta_ad_account_id: string;
};

type CampaignRow = {
  id: string;
  user_id: string;
  client_id: string;
  meta_campaign_id: string;
  effective_status: string | null;
  insights_last_synced_at: string | null;
};

/**
 * Server-side discovery of eligible sync targets.
 * Skips legacy unassigned connections and clients without mapped accounts.
 */
export async function listEligibleMetaSyncTargets(options?: {
  nowMs?: number;
}): Promise<{
  targets: MetaSyncTarget[];
  connectionsChecked: number;
  skippedDisconnected: number;
  skippedUnmapped: number;
  skippedLegacy: number;
  skippedNotDue: number;
  skippedArchived: number;
}> {
  const nowMs = options?.nowMs ?? Date.now();
  const { data: connections, error: connErr } = await admin()
    .from("meta_connections")
    .select("id, user_id, client_id, status");

  if (connErr) {
    throw new Error("META_CRON_ENUMERATION_FAILED");
  }

  const rows = (connections ?? []) as ConnectionRow[];
  let skippedDisconnected = 0;
  let skippedUnmapped = 0;
  let skippedLegacy = 0;
  let skippedNotDue = 0;
  let skippedArchived = 0;
  let connectionsChecked = 0;

  const eligiblePairs: { userId: string; clientId: string }[] = [];

  for (const row of rows) {
    connectionsChecked += 1;
    if (!row.client_id || !isUuid(row.client_id)) {
      skippedLegacy += 1;
      continue;
    }
    if (row.status !== "ACTIVE") {
      skippedDisconnected += 1;
      continue;
    }
    if (!isUuid(row.user_id)) continue;
    eligiblePairs.push({ userId: row.user_id, clientId: row.client_id });
  }

  if (eligiblePairs.length === 0) {
    return {
      targets: [],
      connectionsChecked,
      skippedDisconnected,
      skippedUnmapped,
      skippedLegacy,
      skippedNotDue,
      skippedArchived,
    };
  }

  // Load all mappings once.
  const { data: accounts } = await admin()
    .from("client_ad_accounts")
    .select("user_id, client_id, meta_ad_account_id");
  const accountSet = new Set(
    ((accounts ?? []) as AccountRow[]).map(
      (a) => `${a.user_id}:${a.client_id}`,
    ),
  );

  const mappedPairs = eligiblePairs.filter((p) => {
    const ok = accountSet.has(`${p.userId}:${p.clientId}`);
    if (!ok) skippedUnmapped += 1;
    return ok;
  });

  if (mappedPairs.length === 0) {
    return {
      targets: [],
      connectionsChecked,
      skippedDisconnected,
      skippedUnmapped,
      skippedLegacy,
      skippedNotDue,
      skippedArchived,
    };
  }

  const userIds = [...new Set(mappedPairs.map((p) => p.userId))];
  const { data: camps } = await admin()
    .from("meta_campaigns")
    .select(
      "id, user_id, client_id, meta_campaign_id, effective_status, insights_last_synced_at",
    )
    .in("user_id", userIds);

  const pairSet = new Set(mappedPairs.map((p) => `${p.userId}:${p.clientId}`));
  const targets: MetaSyncTarget[] = [];

  for (const c of (camps ?? []) as CampaignRow[]) {
    if (!pairSet.has(`${c.user_id}:${c.client_id}`)) continue;
    const due = isCampaignDueForScheduledSync({
      effectiveStatus: c.effective_status,
      insightsLastSyncedAt: c.insights_last_synced_at,
      nowMs,
    });
    if (!due.due) {
      if (due.reason === "ARCHIVED_SKIP") skippedArchived += 1;
      else skippedNotDue += 1;
      continue;
    }
    targets.push({
      userId: c.user_id,
      clientId: c.client_id,
      campaignUuid: c.id,
      metaCampaignId: c.meta_campaign_id,
      effectiveStatus: c.effective_status,
      insightsLastSyncedAt: c.insights_last_synced_at,
      mode: resolveMonitoringMode(c.effective_status),
    });
  }

  return {
    targets,
    connectionsChecked,
    skippedDisconnected,
    skippedUnmapped,
    skippedLegacy,
    skippedNotDue,
    skippedArchived,
  };
}

function logSafe(category: string, detail: string): void {
  console.error(`[META_CRON] ${category} ${detail}`);
}

/**
 * Sync a provided target list with failure isolation.
 * Used by cron after server-side enumeration; injectable for tests.
 */
export async function syncMetaInsightTargets(
  targets: MetaSyncTarget[],
  options?: {
    connectionsChecked?: number;
    campaignsSkippedBase?: number;
    importFn?: typeof importClientCampaignInsights;
    markStatusFn?: typeof markMetaConnectionStatus;
  },
): Promise<MetaSyncRunSummary> {
  const started = Date.now();
  const importFn = options?.importFn ?? importClientCampaignInsights;
  const markStatus = options?.markStatusFn ?? markMetaConnectionStatus;

  let campaignsSynced = 0;
  let campaignsSkipped = options?.campaignsSkippedBase ?? 0;
  let errorsCount = 0;
  let rateLimited = false;
  const stoppedUsers = new Set<string>();

  for (const target of targets) {
    if (rateLimited) {
      campaignsSkipped += 1;
      continue;
    }
    const key = `${target.userId}:${target.clientId}`;
    if (stoppedUsers.has(key)) {
      campaignsSkipped += 1;
      continue;
    }

    try {
      await importFn(target.userId, target.clientId, target.campaignUuid);
      campaignsSynced += 1;
    } catch (err) {
      errorsCount += 1;
      if (isMetaError(err)) {
        if (err.code === "META_RATE_LIMIT") {
          rateLimited = true;
          logSafe("RATE_LIMIT", `elapsed_ms=${Date.now() - started}`);
          stoppedUsers.add(key);
          continue;
        }
        if (
          err.code === "META_TOKEN_EXPIRED" ||
          err.code === "META_REAUTH_REQUIRED"
        ) {
          logSafe("TOKEN_INVALID", `code=${err.code}`);
          try {
            await markStatus(
              target.userId,
              target.clientId,
              err.code === "META_TOKEN_EXPIRED" ? "EXPIRED" : "REAUTH_REQUIRED",
            );
          } catch {
            // Isolation: status update failure must not abort batch.
          }
          stoppedUsers.add(key);
          continue;
        }
        logSafe("SYNC_ERROR", `code=${err.code}`);
      } else {
        logSafe("SYNC_ERROR", "category=UNKNOWN");
      }
    }
  }

  const elapsedMs = Date.now() - started;
  logSafe(
    "DONE",
    `synced=${campaignsSynced} skipped=${campaignsSkipped} errors=${errorsCount} elapsed_ms=${elapsedMs}`,
  );

  return {
    connectionsChecked: options?.connectionsChecked ?? 0,
    campaignsChecked: targets.length,
    campaignsSynced,
    campaignsSkipped,
    errorsCount,
    rateLimited,
    elapsedMs,
  };
}

/**
 * Run scheduled sync for all due campaigns.
 * Failure isolation: one client/campaign error does not abort others.
 * Rate limit: stops remaining work for that connection and ends batch early.
 */
export async function runScheduledMetaInsightsSync(options?: {
  nowMs?: number;
  importFn?: typeof importClientCampaignInsights;
  markStatusFn?: typeof markMetaConnectionStatus;
}): Promise<MetaSyncRunSummary> {
  const listed = await listEligibleMetaSyncTargets({ nowMs: options?.nowMs });
  logSafe(
    "START",
    `client_count=${listed.connectionsChecked} due=${listed.targets.length}`,
  );

  return syncMetaInsightTargets(listed.targets, {
    connectionsChecked: listed.connectionsChecked,
    campaignsSkippedBase: listed.skippedNotDue + listed.skippedArchived,
    importFn: options?.importFn,
    markStatusFn: options?.markStatusFn,
  });
}

/** Verify Authorization: Bearer <CRON_SECRET>. */
export function assertCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization")?.trim() ?? "";
  if (header === `Bearer ${secret}`) return true;
  // Vercel may also send x-vercel-cron on scheduled invokes; still require secret.
  return false;
}
