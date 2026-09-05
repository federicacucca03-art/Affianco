"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AllyPanel } from "@/components/shell/AllyPanel";
import { readBearerToken } from "@/lib/meta-import-client";
import {
  ALLY_COPILOT_MAX_HISTORY_TURNS,
  type AllyCopilotAnswer,
  type AllyCopilotHistoryTurn,
} from "@/lib/ally-copilot";

type Source = "NATIVE" | "META";

type Props = {
  campaignId: string;
  source: Source;
  /** Optional status for instant deterministic chips before bootstrap. */
  statusHint?: string | null;
};

function provisionalSuggestions(statusHint: string | null | undefined): string[] {
  const s = (statusHint ?? "").toUpperCase();
  if (s === "DRAFT" || !s) {
    return [
      "Cosa manca prima del lancio?",
      "La campagna è pronta per Meta?",
      "Cosa testeresti per primo?",
    ];
  }
  if (s === "REVISION_REQUESTED") {
    return [
      "Cosa dovrei sistemare per la revisione?",
      "Qual è il prossimo passo dopo le modifiche?",
    ];
  }
  return [
    "Come sta andando?",
    "Aspetteresti ancora o interverresti?",
    "Cosa faresti come prossimo passo?",
  ];
}

export function ChiediAdAllyPanel({
  campaignId,
  source,
  statusHint,
}: Props) {
  const [suggestions, setSuggestions] = useState<string[]>(() =>
    provisionalSuggestions(statusHint),
  );
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<AllyCopilotHistoryTurn[]>([]);
  const [latest, setLatest] = useState<AllyCopilotAnswer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let attivo = true;
    void (async () => {
      try {
        const token = await readBearerToken();
        if (!token || !attivo) return;
        const qs = new URLSearchParams({ campaignId, source });
        const res = await fetch(`/api/ally-copilot?${qs.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || !attivo) return;
        const data = (await res.json()) as { suggestions?: string[] };
        if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
          setSuggestions(data.suggestions);
        }
      } catch {
        // Keep provisional chips.
      }
    })();
    return () => {
      attivo = false;
    };
  }, [campaignId, source]);

  const visibleHistory = useMemo(
    () => history.slice(-ALLY_COPILOT_MAX_HISTORY_TURNS),
    [history],
  );

  async function ask(rawQuestion: string) {
    const q = rawQuestion.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    setLatest(null);
    try {
      const token = await readBearerToken();
      if (!token) {
        setError("Accedi di nuovo per chiedere ad Ally.");
        return;
      }
      const res = await fetch("/api/ally-copilot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          campaignId,
          source,
          question: q,
          history: visibleHistory,
        }),
      });
      const data = (await res.json()) as {
        answer?: AllyCopilotAnswer;
        suggestions?: string[];
        error?: string;
      };
      if (!res.ok || !data.answer) {
        setError(
          res.status === 403 || res.status === 404
            ? "Campagna non disponibile."
            : "Non riesco a rispondere in questo momento.",
        );
        return;
      }
      const answer = data.answer;
      setLatest(answer);
      setHistory((prev) =>
        [
          ...prev,
          { role: "user" as const, content: q },
          { role: "assistant" as const, content: answer.answer },
        ].slice(-ALLY_COPILOT_MAX_HISTORY_TURNS),
      );
      if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
      } else if (answer.suggestedNextQuestions.length > 0) {
        setSuggestions(answer.suggestedNextQuestions);
      }
      setQuestion("");
    } catch {
      setError("Non riesco a rispondere in questo momento.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AllyPanel className="p-5 sm:p-6" as="section">
      <div className="flex items-start gap-3">
        <div className="aff-ally-mark shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium uppercase tracking-[0.04em] text-[var(--ink-muted)]">
            Ally
          </p>
          <h2 className="mt-1 text-lg font-semibold leading-snug text-[var(--ink)]">
            Chiedi ad Ally
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-muted)]">
            Domande su questa campagna: Ally conosce già contesto, stato e
            dati disponibili.
          </p>

          <form
            className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center"
            onSubmit={(e) => {
              e.preventDefault();
              void ask(question);
            }}
          >
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Fai una domanda su questa campagna…"
              className="aff-input min-w-0 flex-1"
              disabled={loading}
              maxLength={500}
              aria-label="Domanda ad Ally"
            />
            <button
              type="submit"
              className="aff-btn-primary shrink-0"
              disabled={loading || !question.trim()}
            >
              {loading ? "Sto pensando…" : "Chiedi"}
            </button>
          </form>

          {suggestions.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="rounded-full border border-[var(--border-soft)] bg-[var(--ally-surface)] px-3 py-1.5 text-left text-[12px] font-medium text-[var(--ink)] hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-60"
                  disabled={loading}
                  onClick={() => void ask(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          ) : null}

          {error ? (
            <p className="mt-3 text-sm text-[var(--ink-muted)]" role="status">
              {error}
            </p>
          ) : null}

          {latest ? (
            <div className="mt-4 space-y-3 border-t border-[var(--border-soft)] pt-4">
              <p className="text-[14px] leading-relaxed text-[var(--ink)]">
                {latest.answer}
              </p>
              {latest.evidence.length > 0 ? (
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--ink-muted)]">
                    Fatti
                  </p>
                  <ul className="mt-1 space-y-1">
                    {latest.evidence.map((e) => (
                      <li
                        key={e}
                        className="text-[13px] leading-snug text-[var(--ink-muted)]"
                      >
                        {e}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {latest.hypotheses.length > 0 ? (
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--ink-muted)]">
                    Ipotesi
                  </p>
                  <ul className="mt-1 space-y-1">
                    {latest.hypotheses.map((h) => (
                      <li
                        key={h}
                        className="text-[13px] leading-snug text-[var(--ink-muted)]"
                      >
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {latest.missingInformation.length > 0 ? (
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--ink-muted)]">
                    Dati mancanti
                  </p>
                  <ul className="mt-1 space-y-1">
                    {latest.missingInformation.map((m) => (
                      <li
                        key={m}
                        className="text-[13px] leading-snug text-[var(--ink-muted)]"
                      >
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {latest.recommendedActionHref ? (
                <Link
                  href={latest.recommendedActionHref}
                  className="inline-block text-sm font-medium text-[var(--primary)] hover:opacity-80"
                >
                  Vai al prossimo passo
                </Link>
              ) : null}
              <p className="text-[11px] text-[var(--ink-muted)]">
                Confidenza: {latest.confidence}
                {latest.fromAi ? "" : " · risposta di riserva"}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </AllyPanel>
  );
}
