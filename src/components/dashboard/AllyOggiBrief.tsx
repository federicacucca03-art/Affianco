"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AllyPanel } from "@/components/shell/AllyPanel";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  buildAllyOggiBriefContext,
  buildAllyOggiFallback,
  canGenerateAllyOggiAiBrief,
  type AllyOggiBrief,
} from "@/lib/ally-oggi";
import type { ControlRoomAttentionItem } from "@/lib/monday-control-room";
import type { Campagna } from "@/types/campagne";
import {
  allyOggiCacheFingerprint,
  readAllyOggiSessionCache,
} from "@/lib/ally-oggi/session-cache";

type Props = {
  attentionItems: readonly ControlRoomAttentionItem[];
  nativeCampaigns: readonly Pick<Campagna, "id" | "status">[];
  metaItems: readonly ControlRoomAttentionItem[];
  linkedNativeIds: ReadonlySet<string>;
  enabled: boolean;
};

/**
 * Deterministic daily brief. AI may hydrate from session cache when eligible,
 * but Home does not prompt for a separate "read briefing" click.
 */
export function AllyOggiBriefPanel({
  attentionItems,
  nativeCampaigns,
  metaItems,
  linkedNativeIds,
  enabled,
}: Props) {
  const { user } = useAuth();
  const context = useMemo(
    () =>
      buildAllyOggiBriefContext({
        attentionItems,
        nativeCampaigns,
        metaItems,
        linkedNativeIds,
      }),
    [attentionItems, nativeCampaigns, metaItems, linkedNativeIds],
  );
  const fingerprint = useMemo(
    () => allyOggiCacheFingerprint(context, nativeCampaigns),
    [context, nativeCampaigns],
  );
  const fallback = useMemo(
    () => buildAllyOggiFallback(context),
    [context],
  );
  const aiEligible = useMemo(
    () => canGenerateAllyOggiAiBrief(context),
    [context],
  );

  const [brief, setBrief] = useState<AllyOggiBrief | null>(null);

  const hasWorkspace = context.workspace.totalWorkspaceCampaigns > 0;

  useEffect(() => {
    if (!enabled || !user?.id || !hasWorkspace) {
      setBrief(null);
      return;
    }
    if (!aiEligible) {
      setBrief(null);
      return;
    }
    const cached = readAllyOggiSessionCache(user.id, fingerprint);
    setBrief(cached);
  }, [enabled, user?.id, fingerprint, hasWorkspace, aiEligible]);

  if (!enabled || !hasWorkspace) return null;

  const display = brief ?? fallback;
  const primaryHref =
    display.priorityItems[0]?.recommendedHref ??
    display.configurationItems[0]?.recommendedHref ??
    "/campagne";

  const showCampaignHighlights =
    display.priorityItems.length > 0 ||
    (aiEligible &&
      (display.watchItems.length > 0 || display.configurationItems.length > 0));

  const highlightLines = showCampaignHighlights
    ? [
        ...display.priorityItems.map((i) => `${i.title}: ${i.sentence}`),
        ...display.watchItems.map((i) => `${i.title}: ${i.sentence}`),
        ...display.configurationItems.map((i) => `${i.title}: ${i.sentence}`),
      ].slice(0, 3)
    : [];

  return (
    <AllyPanel className="p-5 sm:p-6" as="section">
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium uppercase tracking-[0.04em] text-[var(--ink-muted)]">
          Oggi
        </p>
        <h2 className="mt-1 text-lg font-semibold leading-snug text-[var(--ink)]">
          {display.headline}
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink)]">
          {display.summary}
        </p>

        {highlightLines.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {highlightLines.map((line, idx) => (
              <li
                key={`${idx}-${line.slice(0, 24)}`}
                className="text-[13px] leading-snug text-[var(--ink-muted)]"
              >
                {line}
              </li>
            ))}
          </ul>
        ) : null}

        {display.closingNote ? (
          <p className="mt-3 text-[13px] leading-relaxed text-[var(--ink-muted)]">
            {display.closingNote}
          </p>
        ) : null}

        {display.priorityItems.length > 0 ? (
          <div className="mt-4">
            <Link
              href={primaryHref}
              className="text-sm font-medium text-[var(--primary)] hover:opacity-80"
            >
              Vai a ciò che richiede attenzione
            </Link>
          </div>
        ) : null}

        {showCampaignHighlights && display.priorityItems.length > 0 ? (
          <ul className="mt-4 space-y-2 border-t border-[var(--border-soft)] pt-3">
            {display.priorityItems.slice(0, 3).map((item) => (
              <li key={`${item.source}-${item.campaignId}`}>
                <Link
                  href={item.recommendedHref}
                  className="group block rounded-[10px] px-1 py-1 hover:bg-[var(--surface-hover)]"
                >
                  <p className="text-sm font-medium text-[var(--ink)] group-hover:text-[var(--primary)]">
                    {item.title}
                  </p>
                  <p className="text-[12px] text-[var(--ink-muted)]">
                    {item.sentence}
                  </p>
                  <span className="mt-0.5 inline-block text-[11px] font-medium text-[var(--primary)]">
                    Apri campagna
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </AllyPanel>
  );
}
