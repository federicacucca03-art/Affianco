"use client";

import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import {
  buildAllyOggiBriefContext,
  buildAllyOggiFallback,
  type AllyOggiBrief,
} from "@/lib/ally-oggi";
import type { ControlRoomAttentionItem } from "@/lib/monday-control-room";
import type { Campagna } from "@/types/campagne";
import { HOME_ASK_PROMPTS } from "@/lib/home-action-explanation";
import { readBearerToken } from "@/lib/meta-import-client";

type Props = {
  attentionItems: readonly ControlRoomAttentionItem[];
  nativeCampaigns: readonly Pick<Campagna, "id" | "status">[];
  metaItems: readonly ControlRoomAttentionItem[];
  linkedNativeIds: ReadonlySet<string>;
  enabled: boolean;
};

/**
 * Compact workspace Ask entry for returning Home.
 * Visually distinct from search. 0 AI on render; max 1 AI call per submit.
 */
export function HomeAskAllyBar({
  attentionItems,
  nativeCampaigns,
  metaItems,
  linkedNativeIds,
  enabled,
}: Props) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brief, setBrief] = useState<AllyOggiBrief | null>(null);

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

  const fallback = useMemo(
    () => buildAllyOggiFallback(context),
    [context],
  );

  if (!enabled || context.workspace.totalWorkspaceCampaigns <= 0) {
    return null;
  }

  async function ask(raw: string) {
    const q = raw.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    setBrief(null);
    try {
      const token = await readBearerToken();
      if (!token) {
        setError("Accedi di nuovo per fare una domanda.");
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
          question: q,
        }),
      });
      const data = (await res.json()) as {
        brief?: AllyOggiBrief | null;
        skipped?: boolean;
      };
      if (!res.ok) {
        setBrief(fallback);
        setError("Risposta non disponibile al momento.");
        return;
      }
      setBrief(data.brief ?? fallback);
    } catch {
      setBrief(fallback);
      setError("Risposta non disponibile al momento.");
    } finally {
      setLoading(false);
      setQuestion("");
    }
  }

  const display = brief;
  const canSubmit = question.trim().length > 0 && !loading;

  return (
    <section
      className="min-w-0 rounded-[14px] border border-[color-mix(in_srgb,var(--accent)_22%,var(--border))] bg-[color-mix(in_srgb,var(--accent-soft)_55%,white)] p-3.5 sm:p-4"
      aria-label="Chiedi ad Ally"
    >
      <div className="flex items-center gap-1.5">
        <Sparkles
          className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]"
          strokeWidth={1.75}
          aria-hidden
        />
        <p className="text-[13px] font-medium text-[var(--ink)]">
          Chiedi ad Ally
        </p>
      </div>
      <p className="mt-1 text-[12px] leading-snug text-[var(--ink-muted)]">
        Fai una domanda sulle tue campagne e sulle priorità di oggi.
      </p>

      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
      >
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Scrivi una domanda..."
          className="min-w-0 flex-1 rounded-[10px] border border-[var(--border)] bg-white/90 px-3 py-2 text-[14px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-subtle)] focus-visible:border-[var(--accent)]/40"
          disabled={loading}
          maxLength={500}
          aria-label="Scrivi una domanda ad Ally"
        />
        <button
          type="submit"
          className={[
            "shrink-0 rounded-full px-3.5 py-2 text-[12px] font-medium transition-colors",
            canSubmit
              ? "bg-[var(--accent)] text-white hover:opacity-90"
              : "border border-[var(--border)] bg-transparent text-[var(--ink-muted)]",
          ].join(" ")}
          disabled={!canSubmit}
        >
          {loading ? "…" : "Chiedi"}
        </button>
      </form>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {HOME_ASK_PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            className="rounded-full border border-[color-mix(in_srgb,var(--accent)_18%,var(--border))] bg-white/70 px-2.5 py-1 text-[11px] text-[var(--ink-muted)] hover:border-[var(--accent)]/40 hover:text-[var(--ink)] disabled:opacity-50"
            disabled={loading}
            onClick={() => void ask(p)}
          >
            {p}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-2 text-[12px] text-[var(--ink-muted)]" role="status">
          {error}
        </p>
      ) : null}

      {display ? (
        <div className="mt-3 border-t border-[color-mix(in_srgb,var(--accent)_12%,var(--border))] pt-3">
          <p className="text-[13px] font-medium text-[var(--ink)]">
            {display.headline}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-muted)]">
            {display.summary}
          </p>
          {display.priorityItems[0] ? (
            <p className="mt-2 text-[12px] text-[var(--ink)]">
              Priorità: {display.priorityItems[0].title} —{" "}
              {display.priorityItems[0].sentence}
            </p>
          ) : null}
          {!display.fromAi ? (
            <p className="mt-1.5 text-[11px] text-[var(--ink-muted)]">
              Sintesi dai dati del workspace
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
