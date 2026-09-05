"use client";

/**
 * Shell-side setup signal load for progressive navigation.
 * Reuses deriveAllySetupPhase via loadAllySetupSignals — no phase logic changes.
 */

import { leggiInventarioCampagneNative } from "@/lib/campagne-inventory";
import {
  leggiChecksUtenteDal,
  leggiUltimiChecksUtente,
} from "@/lib/campaign-checks-db";
import { isoInizioFinestraGiorni } from "@/lib/dashboard-home";
import { loadAllySetupSignals } from "@/lib/ally-setup-loader";
import { deriveAllySetupPhase, type AllySetupPhase } from "@/lib/ally-setup";
import {
  applyLinkedCampaignSuppression,
  buildMetaAttentionItem,
  buildNativeAttentionItem,
  collectActiveLinkedNativeIds,
  type ControlRoomAttentionItem,
} from "@/lib/monday-control-room";
import { loadMetaMondayBundle } from "@/lib/meta/monday-meta-loader";

const TREND_CHECK_DAYS = 30;

export const ALLY_SETUP_CHANGED_EVENT = "ally-setup-changed";

export function notifyAllySetupChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ALLY_SETUP_CHANGED_EVENT));
}

/** Same signal path as Home — for shell nav only. */
export async function loadAllySetupPhaseForShell(
  userId: string | undefined,
): Promise<AllySetupPhase> {
  const daTrend = isoInizioFinestraGiorni(TREND_CHECK_DAYS);
  const [lista, mappa, trendChecks] = await Promise.all([
    leggiInventarioCampagneNative(),
    leggiUltimiChecksUtente(),
    leggiChecksUtenteDal(daTrend),
  ]);

  let nextMeta: ControlRoomAttentionItem[] = [];
  let nextLinked = new Set<string>();
  if (userId) {
    try {
      const bundle = await loadMetaMondayBundle(userId);
      nextLinked = collectActiveLinkedNativeIds(bundle.rows);
      nextMeta = bundle.rows.map((row) => {
        const t = bundle.trends.get(row.id);
        return buildMetaAttentionItem({
          row,
          trendDirection: t?.direction ?? null,
          trendLevel: t?.level,
        });
      });
    } catch {
      nextMeta = [];
      nextLinked = new Set();
    }
  }

  const checksByCampaign = new Map<string, typeof trendChecks>();
  for (const c of trendChecks) {
    const list = checksByCampaign.get(c.campaignId) ?? [];
    list.push(c);
    checksByCampaign.set(c.campaignId, list);
  }

  const nativeItems = lista
    .filter((c) => c.id)
    .map((campagna) =>
      buildNativeAttentionItem({
        campagna,
        check: mappa.get(campagna.id) ?? null,
        checksForTrend: checksByCampaign.get(campagna.id) ?? [],
      }),
    );

  const merged = applyLinkedCampaignSuppression(
    [...nativeItems, ...nextMeta],
    nextLinked,
  );

  const signals = await loadAllySetupSignals({
    hasNativeCampaign: lista.length > 0,
    hasMetaCampaign: nextMeta.length > 0,
    attentionItems: merged,
  });

  return deriveAllySetupPhase(signals);
}
