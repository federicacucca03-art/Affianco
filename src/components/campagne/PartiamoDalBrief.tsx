"use client";

/**
 * M9.3A — Partiamo dal brief + review (not a chat).
 */

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AllyPanel } from "@/components/shell/AllyPanel";
import { readBearerToken } from "@/lib/meta-import-client";
import {
  ALLY_BRIEF_MAX_CHARS,
  ALLY_BRIEF_FIELD_LABELS,
  provenanceLabelIt,
  objectiveLabelIt,
  type AllyBriefFieldId,
  type AllyBriefFieldValue,
  type AllyBriefProposal,
  type AllyBriefProvenance,
} from "@/lib/ally-brief";
import {
  editableValuesFromProposal,
  proposalToAcceptedPayload,
  saveAcceptedAllyBrief,
} from "@/lib/ally-brief/session";
import {
  hrefWizardFromAcceptedBrief,
  seedBozzaFromAcceptedBrief,
} from "@/lib/ally-brief/apply";
import type { CampagnaObjective } from "@/types/campagne";
import { OBJECTIVES_CANONICI } from "@/lib/ally-brief/types";

const PLACEHOLDER =
  "Es. Studio dentistico a Roma. Vuole acquisire nuovi pazienti per implantologia. Prima visita gratuita. Budget 25€ al giorno. Target adulti 35–65 anni entro 15 km.";

const REVIEW_ORDER: AllyBriefFieldId[] = [
  "objective",
  "nomeCliente",
  "settore",
  "frontEndOffer",
  "citta",
  "raggioKm",
  "etaMin",
  "etaMax",
  "targetType",
  "budgetGiornaliero",
  "maxSustainableCpa",
  "sitoWeb",
  "elevatorPitch",
  "marketingAngle",
  "pageId",
  "formId",
];

function badgeClass(p: AllyBriefProvenance): string {
  switch (p) {
    case "EXPLICIT":
      return "bg-[var(--surface-hover)] text-[var(--ink)]";
    case "INFERRED":
      return "bg-[var(--ally-violet-soft)] text-[var(--ink)]";
    case "EXISTING":
      return "bg-[var(--lavender-muted)] text-[var(--ink)]";
    default:
      return "border border-dashed border-[var(--border)] text-[var(--ink-muted)]";
  }
}

type Props = {
  /** When true, hide manual objective grid link (already on page). */
  compactManual?: boolean;
};

export function PartiamoDalBrief({ compactManual = false }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clienteId = searchParams.get("clienteId")?.trim() || null;

  const [brief, setBrief] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<AllyBriefProposal | null>(null);
  const [edits, setEdits] = useState<
    Partial<Record<AllyBriefFieldId, AllyBriefFieldValue>>
  >({});
  const [showManualHint, setShowManualHint] = useState(false);

  const provenanceById = useMemo(() => {
    const m = new Map<AllyBriefFieldId, AllyBriefProvenance>();
    for (const f of proposal?.fields ?? []) m.set(f.id, f.provenance);
    return m;
  }, [proposal]);

  async function preparaConAlly() {
    const text = brief.trim();
    if (!text) {
      setError("Inserisci un brief per continuare.");
      return;
    }
    if (text.length > ALLY_BRIEF_MAX_CHARS) {
      setError(
        `Il brief può avere al massimo ${ALLY_BRIEF_MAX_CHARS} caratteri.`,
      );
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await readBearerToken();
      if (!token) {
        setError("Accedi per usare Ally.");
        setLoading(false);
        return;
      }
      const res = await fetch("/api/ally-brief", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          brief: text,
          ...(clienteId ? { clienteId } : {}),
        }),
      });
      const data = (await res.json()) as {
        proposal?: AllyBriefProposal;
        error?: string;
      };
      if (!res.ok || !data.proposal) {
        setError(
          "Non riesco a preparare la configurazione in questo momento. Puoi riprovare o continuare manualmente.",
        );
        setLoading(false);
        return;
      }
      setProposal(data.proposal);
      setEdits(editableValuesFromProposal(data.proposal));
      if (!data.proposal.fromAi) {
        setError(
          "Non riesco a preparare la configurazione in questo momento. Puoi riprovare o continuare manualmente.",
        );
      }
    } catch {
      setError(
        "Non riesco a preparare la configurazione in questo momento. Puoi riprovare o continuare manualmente.",
      );
    } finally {
      setLoading(false);
    }
  }

  function setField(id: AllyBriefFieldId, value: AllyBriefFieldValue) {
    setEdits((prev) => ({ ...prev, [id]: value }));
  }

  function usaConfigurazione() {
    if (!proposal) return;
    const payload = proposalToAcceptedPayload(brief, proposal, edits);
    if (!payload) {
      setError("Seleziona un obiettivo campagna prima di continuare.");
      return;
    }
    saveAcceptedAllyBrief(payload);
    seedBozzaFromAcceptedBrief(payload);
    router.push(hrefWizardFromAcceptedBrief(payload));
  }

  if (proposal) {
    const missingCount = proposal.fields.filter(
      (f) =>
        (edits[f.id] == null || edits[f.id] === "") &&
        (f.id === "nomeCliente" ||
          f.id === "objective" ||
          f.id === "frontEndOffer" ||
          f.id === "maxSustainableCpa" ||
          f.id === "pageId" ||
          f.id === "formId"),
    ).length;

    return (
      <AllyPanel className="space-y-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">
            Ally
          </p>
          <h2 className="mt-1 text-lg font-medium text-[var(--ink)]">
            Ally ha preparato una prima configurazione
          </h2>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            {proposal.summary}
          </p>
          {missingCount > 0 ? (
            <p className="mt-2 text-sm text-[var(--ink)]">
              Mi servono ancora {missingCount} informazioni — puoi
              completarle qui o nel wizard.
            </p>
          ) : null}
        </div>

        <div className="space-y-4">
          {REVIEW_ORDER.map((id) => {
            const prov = provenanceById.get(id) ?? "MISSING";
            const value = edits[id] ?? null;
            const label = ALLY_BRIEF_FIELD_LABELS[id];
            return (
              <div key={id} className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-[var(--ink-muted)]">
                    {label}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] ${badgeClass(prov)}`}
                  >
                    {provenanceLabelIt(prov)}
                  </span>
                </div>
                {id === "objective" ? (
                  <select
                    className="aff-input"
                    value={typeof value === "string" ? value : ""}
                    onChange={(e) =>
                      setField(
                        id,
                        e.target.value
                          ? (e.target.value as CampagnaObjective)
                          : null,
                      )
                    }
                  >
                    <option value="">Da completare</option>
                    {OBJECTIVES_CANONICI.map((o) => (
                      <option key={o} value={o}>
                        {objectiveLabelIt(o)}
                      </option>
                    ))}
                  </select>
                ) : id === "elevatorPitch" || id === "marketingAngle" ? (
                  <textarea
                    className="aff-input min-h-[72px]"
                    value={typeof value === "string" ? value : ""}
                    onChange={(e) =>
                      setField(id, e.target.value.trim() ? e.target.value : null)
                    }
                    placeholder="Da completare"
                  />
                ) : (
                  <input
                    className="aff-input"
                    type={
                      [
                        "budgetGiornaliero",
                        "raggioKm",
                        "etaMin",
                        "etaMax",
                        "maxSustainableCpa",
                        "scontrinoMedio",
                        "tassoConversione",
                        "productMargin",
                        "targetMargin",
                      ].includes(id)
                        ? "number"
                        : "text"
                    }
                    value={
                      value == null
                        ? ""
                        : typeof value === "number"
                          ? String(value)
                          : value
                    }
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (!raw.trim()) {
                        setField(id, null);
                        return;
                      }
                      if (
                        [
                          "budgetGiornaliero",
                          "raggioKm",
                          "etaMin",
                          "etaMax",
                          "maxSustainableCpa",
                          "scontrinoMedio",
                          "tassoConversione",
                          "productMargin",
                          "targetMargin",
                        ].includes(id)
                      ) {
                        const n = Number(raw);
                        setField(id, Number.isFinite(n) ? n : null);
                      } else {
                        setField(id, raw);
                      }
                    }}
                    placeholder="Da completare"
                  />
                )}
              </div>
            );
          })}
        </div>

        {proposal.assumptions.length > 0 ? (
          <div className="rounded-[var(--radius)] border border-[var(--border-soft)] bg-[var(--surface-hover)]/40 px-3 py-2 text-xs text-[var(--ink-muted)]">
            <p className="font-medium text-[var(--ink)]">Assunzioni</p>
            <ul className="mt-1 list-disc pl-4">
              {proposal.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-[var(--ink-muted)]" role="status">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            className="aff-btn-primary flex-1"
            onClick={usaConfigurazione}
          >
            Usa questa configurazione
          </button>
          <button
            type="button"
            className="aff-btn-secondary"
            onClick={() => {
              setProposal(null);
              setEdits({});
              setError(null);
            }}
          >
            Modifica brief
          </button>
        </div>
      </AllyPanel>
    );
  }

  return (
    <AllyPanel className="space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">
          Ally
        </p>
        <h2 className="mt-1 text-lg font-medium text-[var(--ink)]">
          Partiamo dal brief
        </h2>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Descrivi il cliente, cosa vuole ottenere e tutto quello che sai già.
          Ally preparerà una prima configurazione che potrai rivedere.
        </p>
      </div>

      <label className="block">
        <span className="sr-only">Brief campagna</span>
        <textarea
          className="aff-input min-h-[140px] text-[14px] leading-relaxed"
          value={brief}
          maxLength={ALLY_BRIEF_MAX_CHARS}
          onChange={(e) => setBrief(e.target.value)}
          placeholder={PLACEHOLDER}
          disabled={loading}
        />
        <span className="mt-1 block text-right text-[11px] text-[var(--ink-muted)]">
          {brief.length}/{ALLY_BRIEF_MAX_CHARS}
        </span>
      </label>

      {error ? (
        <p className="text-sm text-[var(--ink-muted)]" role="status">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row-reverse sm:items-center">
        <button
          type="button"
          className="aff-btn-primary flex-1 disabled:opacity-60"
          disabled={loading || !brief.trim()}
          onClick={() => void preparaConAlly()}
        >
          {loading ? "Sto preparando…" : "Prepara con Ally"}
        </button>
        <button
          type="button"
          className="aff-btn-secondary"
          disabled={loading}
          onClick={() => {
            if (compactManual) {
              setShowManualHint(true);
              document
                .getElementById("obiettivi-manuali")
                ?.scrollIntoView({ behavior: "smooth" });
            } else {
              router.push("/campagne#obiettivi-manuali");
            }
          }}
        >
          Compila manualmente
        </button>
      </div>
      {showManualHint ? (
        <p className="text-xs text-[var(--ink-muted)]">
          Scegli un obiettivo qui sotto per aprire il wizard classico.
        </p>
      ) : null}
    </AllyPanel>
  );
}
