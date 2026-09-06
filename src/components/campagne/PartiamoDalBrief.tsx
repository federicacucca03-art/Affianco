"use client";

/**
 * M9.3A — Partiamo dal brief + review (not a chat).
 * Visual polish only in M9.3A.5 — field logic unchanged.
 */

import { useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Info } from "lucide-react";
import { AllyBadge, type AllyBadgeVariant } from "@/components/shell/AllyBadge";
import { AllyPanel } from "@/components/shell/AllyPanel";
import { readBearerToken } from "@/lib/meta-import-client";
import {
  ALLY_BRIEF_MAX_CHARS,
  ALLY_BRIEF_FAILURE_MESSAGE,
  ALLY_BRIEF_FIELD_LABELS,
  ALLY_BRIEF_WEBSITE_BLOCKED_MESSAGE,
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
import { isMeaningfulAllyBriefProposal } from "@/lib/ally-brief/parse";
import type { CampagnaObjective } from "@/types/campagne";
import { OBJECTIVES_CANONICI } from "@/lib/ally-brief/types";

const PLACEHOLDER =
  "Es. Studio dentistico a Roma. Vuole acquisire nuovi pazienti per implantologia. Prima visita gratuita. Budget 25€ al giorno. Target adulti 35–65 anni entro 15 km.";

const REVIEW_GROUPS: {
  title: string;
  ids: AllyBriefFieldId[];
}[] = [
  {
    title: "Strategia",
    ids: ["objective", "settore", "frontEndOffer"],
  },
  {
    title: "Cliente",
    ids: ["nomeCliente"],
  },
  {
    title: "Pubblico",
    ids: ["citta", "raggioKm", "etaMin", "etaMax", "targetType"],
  },
  {
    title: "Budget e monitoraggio",
    ids: ["budgetGiornaliero", "maxSustainableCpa"],
  },
  {
    title: "Messaggio",
    ids: ["elevatorPitch", "marketingAngle"],
  },
  {
    title: "Asset tecnici",
    ids: ["sitoWeb", "pageId", "formId"],
  },
];

const NUMERIC_FIELD_IDS: AllyBriefFieldId[] = [
  "budgetGiornaliero",
  "raggioKm",
  "etaMin",
  "etaMax",
  "maxSustainableCpa",
  "scontrinoMedio",
  "tassoConversione",
  "productMargin",
  "targetMargin",
];

function badgeVariant(p: AllyBriefProvenance): AllyBadgeVariant {
  switch (p) {
    case "EXPLICIT":
      return "success";
    case "WEBSITE":
      return "violet";
    case "INFERRED":
      return "violet";
    case "EXISTING":
      return "neutral";
    default:
      return "warning";
  }
}

type Props = {
  /** When true, hide manual objective grid link (already on page). */
  compactManual?: boolean;
  /**
   * Manual objective chooser — shown only when AI review is not active,
   * so it does not compete with the prepared configuration.
   */
  manualChooser?: ReactNode;
};

function ReviewField({
  id,
  value,
  provenance,
  onChange,
}: {
  id: AllyBriefFieldId;
  value: AllyBriefFieldValue | undefined;
  provenance: AllyBriefProvenance;
  onChange: (id: AllyBriefFieldId, value: AllyBriefFieldValue) => void;
}) {
  const label = ALLY_BRIEF_FIELD_LABELS[id];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-[13px] font-medium text-[var(--ink)]">
          {label}
        </span>
        <AllyBadge variant={badgeVariant(provenance)} pill>
          {provenanceLabelIt(provenance)}
        </AllyBadge>
      </div>
      {id === "objective" ? (
        <select
          className="aff-input"
          value={typeof value === "string" ? value : ""}
          onChange={(e) =>
            onChange(
              id,
              e.target.value ? (e.target.value as CampagnaObjective) : null,
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
          className="aff-input min-h-[88px]"
          value={typeof value === "string" ? value : ""}
          onChange={(e) =>
            onChange(id, e.target.value.trim() ? e.target.value : null)
          }
          placeholder="Da completare"
        />
      ) : (
        <input
          className="aff-input"
          type={NUMERIC_FIELD_IDS.includes(id) ? "number" : "text"}
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
              onChange(id, null);
              return;
            }
            if (NUMERIC_FIELD_IDS.includes(id)) {
              const n = Number(raw);
              onChange(id, Number.isFinite(n) ? n : null);
            } else {
              onChange(id, raw);
            }
          }}
          placeholder="Da completare"
        />
      )}
    </div>
  );
}

export function PartiamoDalBrief({
  compactManual = false,
  manualChooser,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clienteId = searchParams.get("clienteId")?.trim() || null;

  const [brief, setBrief] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [websiteWarning, setWebsiteWarning] = useState<string | null>(null);
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

  const canAccept =
    proposal != null && isMeaningfulAllyBriefProposal(proposal);

  async function preparaConAlly() {
    const text = brief.trim();
    const site = websiteUrl.trim();
    if (!text && !site) {
      setError("Inserisci un brief o un sito cliente.");
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
    setWebsiteWarning(null);
    setProposal(null);
    setEdits({});
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
          ...(site ? { websiteUrl: site } : {}),
          ...(clienteId ? { clienteId } : {}),
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        proposal?: AllyBriefProposal;
        code?: string;
        error?: string;
        websiteWarning?: string | null;
        websiteStatus?: string | null;
      };

      if (res.status === 400 && data.error === ALLY_BRIEF_WEBSITE_BLOCKED_MESSAGE) {
        setProposal(null);
        setEdits({});
        setError(ALLY_BRIEF_WEBSITE_BLOCKED_MESSAGE);
        return;
      }

      if (
        res.ok &&
        data.ok === true &&
        data.proposal &&
        isMeaningfulAllyBriefProposal(data.proposal)
      ) {
        setProposal(data.proposal);
        setEdits(editableValuesFromProposal(data.proposal));
        setError(null);
        setWebsiteWarning(
          typeof data.websiteWarning === "string" && data.websiteWarning.trim()
            ? data.websiteWarning.trim()
            : null,
        );
        return;
      }

      // Complete failure: keep brief, no fake all-MISSING review.
      setProposal(null);
      setEdits({});
      setWebsiteWarning(null);
      setError(
        typeof data.error === "string" && data.error.trim()
          ? data.error.trim()
          : ALLY_BRIEF_FAILURE_MESSAGE,
      );
    } catch {
      setProposal(null);
      setEdits({});
      setWebsiteWarning(null);
      setError(ALLY_BRIEF_FAILURE_MESSAGE);
    } finally {
      setLoading(false);
    }
  }

  function setField(id: AllyBriefFieldId, value: AllyBriefFieldValue) {
    setEdits((prev) => ({ ...prev, [id]: value }));
  }

  function usaConfigurazione() {
    if (!proposal || !isMeaningfulAllyBriefProposal(proposal)) return;
    const payload = proposalToAcceptedPayload(brief, proposal, edits);
    if (!payload) {
      setError("Seleziona un obiettivo campagna prima di continuare.");
      return;
    }
    saveAcceptedAllyBrief(payload);
    seedBozzaFromAcceptedBrief(payload);
    router.push(hrefWizardFromAcceptedBrief(payload));
  }

  function vaiManuale() {
    if (compactManual) {
      setShowManualHint(true);
      document
        .getElementById("obiettivi-manuali")
        ?.scrollIntoView({ behavior: "smooth" });
    } else {
      router.push("/campagne#obiettivi-manuali");
    }
  }

  if (canAccept && proposal) {
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
      <AllyPanel className="mx-auto max-w-[860px] space-y-8 p-5 sm:p-7">
        <header className="space-y-3">
          <p className="aff-eyebrow">Ally</p>
          <div className="space-y-2">
            <h2 className="text-[20px] font-medium tracking-tight text-[var(--ink)] sm:text-[22px]">
              Ally ha preparato una prima configurazione
            </h2>
            <p className="text-[14.5px] leading-relaxed text-[var(--ink-muted)]">
              {proposal.summary}
            </p>
          </div>
          {websiteWarning ? (
            <div className="flex gap-3 rounded-[var(--radius)] border border-[var(--border-soft)] bg-[var(--lavender-muted)]/55 px-4 py-3.5">
              <Info
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]"
                strokeWidth={1.75}
                aria-hidden
              />
              <p className="text-[13.5px] leading-relaxed text-[var(--ink)]">
                {websiteWarning}
              </p>
            </div>
          ) : null}
          {missingCount > 0 ? (
            <div className="flex gap-3 rounded-[var(--radius)] border border-[var(--border-soft)] bg-[var(--lavender-muted)]/55 px-4 py-3.5">
              <Info
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]"
                strokeWidth={1.75}
                aria-hidden
              />
              <p className="text-[13.5px] leading-relaxed text-[var(--ink)]">
                Mi servono ancora {missingCount} informazioni — puoi
                completarle qui o nel wizard.
              </p>
            </div>
          ) : null}
        </header>

        <div className="space-y-0">
          {REVIEW_GROUPS.map((group) => (
            <section
              key={group.title}
              className="space-y-5 border-t border-[var(--border-soft)] py-7 first:border-t-0 first:pt-0 last:pb-0"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--primary)]">
                {group.title}
              </p>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {group.ids.map((id) => {
                  const spanFull =
                    id === "elevatorPitch" ||
                    id === "marketingAngle" ||
                    id === "frontEndOffer" ||
                    id === "sitoWeb" ||
                    group.ids.length === 1;
                  return (
                    <div
                      key={id}
                      className={spanFull ? "sm:col-span-2" : undefined}
                    >
                      <ReviewField
                        id={id}
                        value={edits[id]}
                        provenance={provenanceById.get(id) ?? "MISSING"}
                        onChange={setField}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {proposal.assumptions.length > 0 ? (
          <div className="rounded-[var(--radius)] border border-[var(--border-soft)] bg-[var(--surface-hover)]/40 px-4 py-3.5 text-[13.5px] leading-relaxed text-[var(--ink-muted)]">
            <p className="text-[13px] font-medium text-[var(--ink)]">
              Assunzioni
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {proposal.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-[var(--border-soft)] pt-6 sm:flex-row-reverse sm:items-center">
          <button
            type="button"
            className="aff-btn-primary min-h-11 flex-1 px-5 text-[14px]"
            onClick={usaConfigurazione}
          >
            Usa questa configurazione
          </button>
          <button
            type="button"
            className="aff-btn-secondary min-h-11 px-5"
            onClick={() => {
              setProposal(null);
              setEdits({});
              setError(null);
              setWebsiteWarning(null);
            }}
          >
            Modifica brief
          </button>
        </div>
      </AllyPanel>
    );
  }

  return (
    <>
    <AllyPanel className="mx-auto max-w-[860px] space-y-6 p-5 sm:p-7">
      <header className="space-y-2">
        <p className="aff-eyebrow">Ally</p>
        <h2 className="text-[20px] font-medium tracking-tight text-[var(--ink)] sm:text-[22px]">
          Partiamo dal brief
        </h2>
        <p className="text-[14.5px] leading-relaxed text-[var(--ink-muted)]">
          Descrivi il cliente, cosa vuole ottenere e tutto quello che sai già.
          Ally preparerà una prima configurazione che potrai rivedere.
        </p>
      </header>

      <label className="block space-y-2">
        <span className="sr-only">Brief campagna</span>
        <textarea
          className="aff-input min-h-[152px] text-[14.5px] leading-relaxed"
          value={brief}
          maxLength={ALLY_BRIEF_MAX_CHARS}
          onChange={(e) => setBrief(e.target.value)}
          placeholder={PLACEHOLDER}
          disabled={loading}
        />
        <span className="block text-right text-[12.5px] text-[var(--ink-muted)]">
          {brief.length}/{ALLY_BRIEF_MAX_CHARS}
        </span>
      </label>

      <label className="block space-y-1.5">
        <span className="text-[13px] font-medium text-[var(--ink)]">
          Sito cliente (opzionale)
        </span>
        <input
          type="url"
          className="aff-input"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          placeholder="https://www.esempio.it"
          disabled={loading}
          autoComplete="url"
        />
      </label>

      {error ? (
        <div className="space-y-4" role="alert">
          <p className="text-[14px] leading-relaxed text-[var(--ink-muted)]">
            {error}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row-reverse">
            <button
              type="button"
              className="aff-btn-primary min-h-11 flex-1 disabled:opacity-60"
              disabled={loading || (!brief.trim() && !websiteUrl.trim())}
              onClick={() => void preparaConAlly()}
            >
              {loading ? "Sto preparando…" : "Riprova"}
            </button>
            <button
              type="button"
              className="aff-btn-secondary min-h-11"
              disabled={loading}
              onClick={vaiManuale}
            >
              Compila manualmente
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row-reverse sm:items-center">
          <button
            type="button"
            className="aff-btn-primary min-h-11 flex-1 disabled:opacity-60"
            disabled={loading || (!brief.trim() && !websiteUrl.trim())}
            onClick={() => void preparaConAlly()}
          >
            {loading ? "Sto preparando…" : "Prepara con Ally"}
          </button>
          <button
            type="button"
            className="aff-btn-secondary min-h-11"
            disabled={loading}
            onClick={vaiManuale}
          >
            Compila manualmente
          </button>
        </div>
      )}
      {showManualHint ? (
        <p className="text-[13px] text-[var(--ink-muted)]">
          Scegli un obiettivo qui sotto per aprire il wizard classico.
        </p>
      ) : null}
    </AllyPanel>
    {manualChooser}
    </>
  );
}
