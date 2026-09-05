"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AllyPanel } from "@/components/shell/AllyPanel";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  buildAllyOggiBriefContext,
  buildAllyOggiFallback,
  type AllyOggiBrief,
} from "@/lib/ally-oggi";
import type { ControlRoomAttentionItem } from "@/lib/monday-control-room";
import { readBearerToken } from "@/lib/meta-import-client";
import {
  allyOggiCacheFingerprint,
  readAllyOggiSessionCache,
  writeAllyOggiSessionCache,
} from "@/lib/ally-oggi/session-cache";

type Props = {
  items: readonly ControlRoomAttentionItem[];
  enabled: boolean;
};

export function AllyOggiBriefPanel({ items, enabled }: Props) {
  const { user } = useAuth();
  const context = useMemo(
    () => buildAllyOggiBriefContext(items),
    [items],
  );
  const fingerprint = useMemo(
    () => allyOggiCacheFingerprint(context),
    [context],
  );
  const fallback = useMemo(
    () => buildAllyOggiFallback(context),
    [context],
  );

  const [brief, setBrief] = useState<AllyOggiBrief | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !user?.id || context.totalMonitored === 0) {
      setBrief(null);
      return;
    }
    const cached = readAllyOggiSessionCache(user.id, fingerprint);
    if (cached) {
      setBrief(cached);
    } else {
      setBrief(null);
    }
  }, [enabled, user?.id, fingerprint, context.totalMonitored]);

  if (!enabled || context.totalMonitored === 0) return null;

  const display = brief ?? fallback;
  const primaryHref =
    display.priorityItems[0]?.recommendedHref ??
    display.configurationItems[0]?.recommendedHref ??
    "/risultati";

  async function loadBrief(force: boolean) {
    if (!user?.id || loading) return;
    if (!force) {
      const cached = readAllyOggiSessionCache(user.id, fingerprint);
      if (cached) {
        setBrief(cached);
        return;
      }
    }
    setLoading(true);
    try {
      const token = await readBearerToken();
      if (!token) {
        setBrief(fallback);
        return;
      }
      const res = await fetch("/api/ally-oggi", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          context,
          isFirstRunOnboarding: false,
        }),
      });
      const data = (await res.json()) as {
        brief?: AllyOggiBrief | null;
        skipped?: boolean;
      };
      if (!res.ok || data.skipped || !data.brief) {
        setBrief(fallback);
        writeAllyOggiSessionCache(user.id, fingerprint, fallback);
        return;
      }
      setBrief(data.brief);
      writeAllyOggiSessionCache(user.id, fingerprint, data.brief);
    } catch {
      setBrief(fallback);
      if (user?.id) {
        writeAllyOggiSessionCache(user.id, fingerprint, fallback);
      }
    } finally {
      setLoading(false);
    }
  }

  const highlightLines = [
    ...display.priorityItems.map((i) => `${i.title}: ${i.sentence}`),
    ...display.watchItems.map((i) => `${i.title}: ${i.sentence}`),
    ...display.configurationItems.map((i) => `${i.title}: ${i.sentence}`),
  ].slice(0, 3);

  return (
    <AllyPanel className="p-5 sm:p-6" as="section">
      <div className="flex items-start gap-3">
        <div className="aff-ally-mark shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium uppercase tracking-[0.04em] text-[var(--ink-muted)]">
            Ally oggi
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

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={
                brief?.fromAi
                  ? "text-sm font-medium text-[var(--primary)] hover:opacity-80 disabled:opacity-60"
                  : "aff-btn-primary text-sm"
              }
              disabled={loading}
              onClick={() => void loadBrief(Boolean(brief?.fromAi))}
            >
              {loading
                ? brief?.fromAi
                  ? "Aggiorno…"
                  : "Sto preparando il briefing…"
                : brief?.fromAi
                  ? "Aggiorna briefing"
                  : "Leggi il briefing di Ally"}
            </button>

            {(display.priorityItems.length > 0 ||
              display.configurationItems.length > 0) && (
              <Link
                href={primaryHref}
                className="text-sm font-medium text-[var(--primary)] hover:opacity-80"
              >
                {display.priorityItems.length > 0
                  ? "Vai a ciò che richiede attenzione"
                  : "Vai alla configurazione"}
              </Link>
            )}
          </div>

          {display.priorityItems.length > 0 ||
          display.configurationItems.length > 0 ? (
            <ul className="mt-4 space-y-2 border-t border-[var(--border-soft)] pt-3">
              {[...display.priorityItems, ...display.configurationItems]
                .slice(0, 3)
                .map((item) => (
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
      </div>
    </AllyPanel>
  );
}
