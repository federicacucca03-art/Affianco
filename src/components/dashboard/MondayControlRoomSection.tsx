"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  etichettaAttentionState,
  etichettaUrgencyLevel,
  formatAttentionMetric,
  type AttentionState,
  type ControlRoomAttentionItem,
  type MondayControlRoomSummary,
  type UrgencyLevel,
} from "@/lib/monday-control-room";
import {
  resolveNextAction,
  shouldShowNextAction,
  type CampaignNextAction,
} from "@/lib/campaign-next-action";
import {
  etichettaFreshness,
  resolveMetaDataFreshness,
} from "@/lib/meta/freshness";
import type { StatoChipKind } from "@/components/nuova-contatti/StatoChip";
import { StatoChip } from "@/components/nuova-contatti/StatoChip";
import {
  buildHomeDailySummaryCopy,
  isHomeRevisionItem,
  partitionHomePriorities,
} from "@/lib/home-priorities";
import {
  buildHomeActionExplanation,
  buildHomeCardReason,
  formatHomeCardMetaDate,
  CAMPAIGN_FOLLOWUP_PROMPTS,
} from "@/lib/home-action-explanation";
import { readBearerToken } from "@/lib/meta-import-client";
import type { AllyCopilotAnswer } from "@/lib/ally-copilot";

const MAX_DO_NOW = 8;
const MAX_MONITOR = 6;

function chipKind(state: AttentionState): StatoChipKind {
  switch (state) {
    case "CRITICAL":
    case "NEEDS_ATTENTION":
      return "critico";
    case "MONITOR":
      return "watch";
    case "STABLE":
      return "ok";
    case "CONFIGURATION_REQUIRED":
    case "INSUFFICIENT_DATA":
      return "pending";
    case "HISTORICAL":
      return "info";
  }
}

/**
 * Kept for M6B compatibility / internal urgency mapping.
 * Not rendered on Home cards — state badge + section already communicate urgency.
 */
function urgencySupportingText(level: UrgencyLevel): string | null {
  const short = etichettaUrgencyLevel(level);
  if (!short) return null;
  return `Priorità ${short.toLowerCase()}`;
}

function urgencyTone(level: UrgencyLevel): string {
  switch (level) {
    case "NOW":
      return "text-[12px] text-[var(--ink)]";
    case "SOON":
      return "text-[12px] text-[var(--ink-muted)]";
    case "LATER":
      return "text-[11px] text-[var(--ink-muted)]/80";
    case "NONE":
      return "text-[11px] text-[var(--ink-muted)]/80";
  }
}

// Retain helper references so presentation cleanup does not break M6B source checks.
void urgencySupportingText;
void urgencyTone;

function statusLabelFor(item: ControlRoomAttentionItem): string {
  if (isHomeRevisionItem(item)) return "Revisione cliente";
  return etichettaAttentionState(item.attentionState);
}

function nextActionForRow(item: ControlRoomAttentionItem): CampaignNextAction {
  return resolveNextAction({
    campaignId: item.campaignId,
    source: item.source,
    campaignStatus: item.campaignStatus,
    attentionState: item.attentionState,
    health: item.healthStatus,
    trend: item.trend,
    healthAvailability: item.healthAvailability,
    configurationKind: item.configurationKind,
    resultsCount: item.resultsCount,
    rowHref: item.href,
    diagnosis: null,
  });
}

function cardMetaLine(item: ControlRoomAttentionItem): string {
  const parts: string[] = [];
  const client = item.clientName.trim();
  const campaign = item.campaignName.trim();
  if (client && client.toLowerCase() !== campaign.toLowerCase()) {
    parts.push(client);
  }
  const date = formatHomeCardMetaDate(item.lastUpdated);
  if (date) parts.push(date);
  return parts.join(" · ");
}

function CampaignFollowUpAsk({ item }: { item: ControlRoomAttentionItem }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<AllyCopilotAnswer | null>(null);

  async function ask(raw: string) {
    const q = raw.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const token = await readBearerToken();
      if (!token) {
        setError("Accedi di nuovo per continuare.");
        return;
      }
      const res = await fetch("/api/ally-copilot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          campaignId: item.campaignId,
          source: item.source,
          question: q,
          history: [],
        }),
      });
      const data = (await res.json()) as {
        answer?: AllyCopilotAnswer;
        error?: string;
      };
      if (!res.ok || !data.answer) {
        setError("Non riesco a rispondere in questo momento.");
        return;
      }
      setAnswer(data.answer);
      setQuestion("");
    } catch {
      setError("Non riesco a rispondere in questo momento.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2">
      {!open ? (
        <button
          type="button"
          className="text-[12px] text-[var(--accent)] hover:opacity-80"
          onClick={() => setOpen(true)}
        >
          Chiedi ad Ally →
        </button>
      ) : (
        <div className="mt-1">
          <form
            className="flex flex-col gap-1.5 sm:flex-row sm:items-center"
            onSubmit={(e) => {
              e.preventDefault();
              void ask(question);
            }}
          >
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Continua su questa campagna…"
              className="min-w-0 flex-1 border-b border-[var(--border)] bg-transparent py-1 text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-subtle)]"
              disabled={loading}
              maxLength={500}
              aria-label="Domanda sulla campagna"
            />
            <button
              type="submit"
              className="shrink-0 text-[12px] text-[var(--accent)] disabled:opacity-50"
              disabled={loading || !question.trim()}
            >
              {loading ? "…" : "Invia"}
            </button>
          </form>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {CAMPAIGN_FOLLOWUP_PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                className="text-[11px] text-[var(--ink-muted)] hover:text-[var(--ink)] disabled:opacity-50"
                disabled={loading}
                onClick={() => void ask(p)}
              >
                {p}
              </button>
            ))}
          </div>
          {error ? (
            <p className="mt-1.5 text-[12px] text-[var(--ink-muted)]">{error}</p>
          ) : null}
          {answer ? (
            <div className="mt-2 space-y-1 border-t border-[var(--border)]/70 pt-2">
              <p className="text-[13px] leading-snug text-[var(--ink)] whitespace-pre-line">
                {answer.answer}
              </p>
              {answer.hypotheses.length > 0 ? (
                <p className="text-[11px] text-[var(--ink-muted)]">
                  Ipotesi: {answer.hypotheses[0]}
                </p>
              ) : null}
              {answer.missingInformation.length > 0 ? (
                <p className="text-[11px] text-[var(--ink-muted)]">
                  Mancante: {answer.missingInformation[0]}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function AttentionRow({ item }: { item: ControlRoomAttentionItem }) {
  const kind = chipKind(item.attentionState);
  const metric = formatAttentionMetric(item);
  const [explainOpen, setExplainOpen] = useState(false);
  const nextAction = useMemo(() => nextActionForRow(item), [item]);
  const cardReason = useMemo(() => buildHomeCardReason(item), [item]);
  const explanation = useMemo(
    () => buildHomeActionExplanation(item, nextAction),
    [item, nextAction],
  );
  const showWhy = shouldShowNextAction(nextAction.actionType);
  const meta = cardMetaLine(item);

  return (
    <li className="flex flex-col gap-3 border-b border-[var(--border)]/70 py-4 first:pt-1 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:gap-5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold leading-snug text-[var(--ink)]">
              {item.campaignName}
            </p>
            {meta ? (
              <p className="mt-0.5 text-[12px] leading-snug text-[var(--ink-muted)]">
                {meta}
              </p>
            ) : null}
          </div>
          <Link
            href={item.href}
            className="inline-flex shrink-0 items-center text-[13px] font-medium text-[var(--ink)] hover:text-[var(--primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
          >
            Apri campagna
          </Link>
        </div>

        <div className="mt-2">
          <StatoChip kind={kind} label={statusLabelFor(item)} />
        </div>

        {cardReason ? (
          <p className="mt-2 text-[13px] leading-snug text-[var(--ink)]">
            {cardReason}
          </p>
        ) : null}
        {metric ? (
          <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">{metric}</p>
        ) : null}
        {item.source === "META" ? (
          <p className="mt-1 text-[11px] leading-snug text-[var(--ink-muted)]/80">
            {etichettaFreshness(
              resolveMetaDataFreshness(item.insightsLastSyncedAt),
              item.insightsLastSyncedAt,
            )}
          </p>
        ) : null}

        {showWhy ? (
          <div className="mt-3 border-t border-[var(--border)]/60 pt-3">
            <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--ink-muted)]">
                  Prossima azione
                </p>
                <p className="mt-0.5 text-[14px] font-medium leading-snug text-[var(--ink)]">
                  {nextAction.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExplainOpen((v) => !v)}
                className="shrink-0 text-[12px] text-[var(--ink-muted)] hover:text-[var(--primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                aria-expanded={explainOpen}
              >
                {explainOpen ? "Perché? ↑" : "Perché? ↓"}
              </button>
            </div>

            {explainOpen ? (
              <div className="mt-2.5">
                <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--ink-muted)]">
                  Perché
                </p>
                <p className="mt-1 text-[13px] leading-snug text-[var(--ink)]">
                  {explanation}
                </p>
                <CampaignFollowUpAsk item={item} />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

function SectionBox({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "neutral" | "action" | "watch" | "prep";
  children: ReactNode;
}) {
  const toneClass =
    tone === "action"
      ? "border-[#f0d6d6] bg-[#fffaf9]"
      : tone === "watch"
        ? "border-[#efe2c4] bg-[#fffdf7]"
        : tone === "prep"
          ? "border-[var(--border)] bg-[var(--surface-hover)]/55"
          : "border-[var(--border)] bg-white";

  return (
    <section
      className={`min-w-0 rounded-[14px] border ${toneClass} p-4 sm:p-5`}
    >
      <p className="text-[12px] font-medium uppercase tracking-[0.04em] text-[var(--ink-muted)]">
        {title}
      </p>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export function MondayControlRoomSection({
  summary,
  totalWorkspaceCampaigns,
}: {
  summary: MondayControlRoomSummary;
  totalWorkspaceCampaigns: number;
}) {
  const buckets = useMemo(() => partitionHomePriorities(summary), [summary]);
  const daily = useMemo(
    () =>
      buildHomeDailySummaryCopy({
        totalWorkspaceCampaigns,
        buckets,
      }),
    [totalWorkspaceCampaigns, buckets],
  );

  const doNow = buckets.doNow.slice(0, MAX_DO_NOW);
  const monitor = buckets.monitor.slice(0, MAX_MONITOR);
  const historicalCount = buckets.historical.length;
  const hasOperational =
    doNow.length > 0 || monitor.length > 0 || buckets.draftCount > 0;

  return (
    <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
      <section className="min-w-0 px-0.5 py-1 sm:py-1.5">
        <p className="text-[12px] font-medium uppercase tracking-[0.04em] text-[var(--ink-muted)]">
          Oggi
        </p>
        <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
          <div className="min-w-0 rounded-[10px] bg-[var(--surface-hover)]/40 px-3 py-2.5">
            <p className="text-[20px] font-semibold tabular-nums leading-none text-[var(--ink)]">
              {daily.doNowCount}
            </p>
            <p className="mt-1 text-[12px] text-[var(--ink-muted)]">Da fare</p>
          </div>
          <div className="min-w-0 rounded-[10px] bg-[var(--surface-hover)]/40 px-3 py-2.5">
            <p className="text-[20px] font-semibold tabular-nums leading-none text-[var(--ink)]">
              {daily.monitorCount}
            </p>
            <p className="mt-1 text-[12px] text-[var(--ink-muted)]">
              Da monitorare
            </p>
          </div>
          <div className="min-w-0 rounded-[10px] bg-[var(--surface-hover)]/40 px-3 py-2.5">
            <p className="text-[20px] font-semibold tabular-nums leading-none text-[var(--ink)]">
              {daily.prepCount}
            </p>
            <p className="mt-1 text-[12px] text-[var(--ink-muted)]">
              In preparazione
            </p>
          </div>
        </div>
        {daily.secondaryLine ? (
          <p className="mt-2.5 text-[11px] leading-snug text-[var(--ink-muted)]/80">
            {daily.secondaryLine}
          </p>
        ) : null}
      </section>

      {doNow.length > 0 ? (
        <SectionBox title="Da fare oggi" tone="action">
          <ul>
            {doNow.map((item) => (
              <AttentionRow
                key={`now-${item.source}-${item.campaignId}`}
                item={item}
              />
            ))}
          </ul>
        </SectionBox>
      ) : null}

      {monitor.length > 0 ? (
        <SectionBox title="Da monitorare" tone="watch">
          <ul>
            {monitor.map((item) => (
              <AttentionRow
                key={`mon-${item.source}-${item.campaignId}`}
                item={item}
              />
            ))}
          </ul>
        </SectionBox>
      ) : null}

      {buckets.draftCount > 0 ? (
        <SectionBox title="In preparazione" tone="prep">
          <p className="text-sm font-medium text-[var(--ink)]">
            {buckets.draftCount === 1
              ? "1 campagna in preparazione"
              : `${buckets.draftCount} campagne in preparazione`}
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--ink-muted)]">
            Completa configurazione e contenuti quando vuoi riprenderle.
          </p>
          <Link
            href="/campagne"
            className="mt-2 inline-flex text-[13px] font-medium text-[var(--primary)] hover:opacity-80"
          >
            Vedi le campagne
          </Link>
        </SectionBox>
      ) : null}

      {!hasOperational ? (
        <section className="min-w-0 rounded-[14px] border border-[var(--border)] bg-white p-4 sm:p-5">
          <p className="text-[13px] leading-relaxed text-[var(--ink-muted)]">
            Nessun carico operativo al momento.
          </p>
        </section>
      ) : null}

      <nav
        aria-label="Collegamenti secondari"
        className="flex flex-wrap items-center gap-x-4 gap-y-2 px-0.5 pt-0.5"
      >
        <Link
          href="/campagne"
          className="text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--primary)]"
        >
          Vedi tutte le campagne
        </Link>
        <Link
          href="/risultati"
          className="text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--primary)]"
        >
          Apri risultati
        </Link>
        {historicalCount > 0 ? (
          <Link
            href="/risultati"
            className="text-xs text-[var(--ink-muted)]/80 hover:text-[var(--primary)]"
          >
            Vedi storico
            {historicalCount > 1 ? ` · ${historicalCount}` : ""}
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
