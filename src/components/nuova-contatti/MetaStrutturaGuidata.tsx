"use client";

/**
 * M10B — "Come verrà strutturata su Meta"
 * Planning review only. Never implies created on Meta.
 */

import { useState } from "react";
import type {
  GuidedDestinationKind,
  GuidedMetaPlan,
  GuidedProvenance,
} from "@/lib/meta/guided-plan";
import {
  etichettaGuidedAudience,
  etichettaGuidedDestination,
  etichettaGuidedMetaObjective,
  etichettaGuidedPlacements,
  etichettaGuidedProvenance,
  hasMetaTechnicalGaps,
  isGuidedPlanningReady,
} from "@/lib/meta/guided-plan";

type Props = {
  plan: GuidedMetaPlan;
  /** Optional: jump to wizard step for edits. */
  onModificaPasso?: (step: number) => void;
  /** Guided destination choice when MISSING / changeable. */
  onScegliDestinazione?: (kind: GuidedDestinationKind) => void;
};

const DESTINAZIONI_GUIDATE: GuidedDestinationKind[] = [
  "META_LEAD_FORM",
  "WEBSITE",
  "WHATSAPP",
  "PHONE",
];

function ProvenanceBadge({ provenance }: { provenance: GuidedProvenance }) {
  const tone =
    provenance === "MISSING"
      ? "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--ink-muted)]"
      : provenance === "INFERRED" || provenance === "BRIEF"
        ? "border-[var(--primary)]/25 bg-[var(--primary)]/5 text-[var(--primary)]"
        : provenance === "META_MANAGED"
          ? "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--ink-muted)]"
          : provenance === "EXPLICIT"
            ? "border-[var(--primary)]/40 bg-white text-[var(--ink)]"
            : "border-[var(--border)] bg-white text-[var(--ink-muted)]";
  return (
    <span
      className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${tone}`}
    >
      {etichettaGuidedProvenance(provenance)}
    </span>
  );
}

function Row({
  label,
  value,
  provenance,
  note,
}: {
  label: string;
  value: string;
  provenance: GuidedProvenance;
  note?: string | null;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-[var(--border)]/60 py-2.5 last:border-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-[var(--ink-muted)]">{label}</p>
        <p className="mt-0.5 text-[14px] font-medium text-[var(--ink)]">{value}</p>
        {note ? (
          <p className="mt-0.5 text-[12px] leading-snug text-[var(--ink-muted)]">
            {note}
          </p>
        ) : null}
      </div>
      <ProvenanceBadge provenance={provenance} />
    </div>
  );
}

export function MetaStrutturaGuidata({
  plan,
  onModificaPasso,
  onScegliDestinazione,
}: Props) {
  const [avanzateAperte, setAvanzateAperte] = useState(false);
  const [percheAperto, setPercheAperto] = useState(false);
  const planningReady = isGuidedPlanningReady(plan);
  const metaGaps = hasMetaTechnicalGaps(plan);

  return (
    <section
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5"
      aria-labelledby="m10b-struttura-meta-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--primary)]">
            Pianificazione Ally
          </p>
          <h2
            id="m10b-struttura-meta-title"
            className="mt-1 text-[17px] font-semibold text-[var(--ink)]"
          >
            Come verrà strutturata su Meta
          </h2>
          <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-[var(--ink-muted)]">
            Non ancora creata su Meta. Ally traduce il tuo obiettivo di business
            in una struttura professionale — Campagna → Gruppo di inserzioni →
            Inserzioni.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] font-medium text-[var(--ink-muted)]">
            Non ancora creata su Meta
          </span>
          <span className="text-[11px] text-[var(--ink-muted)]">
            {planningReady ? "Pianificazione ok" : "Pianificazione da completare"}
            {metaGaps ? " · Config Meta da verificare" : ""}
          </span>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <div className="rounded-xl border border-[var(--border)] bg-white p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
            Campagna
          </p>
          <p className="mt-1 text-[15px] font-medium text-[var(--ink)]">
            {plan.businessGoal.value ?? "—"}
          </p>
          <p className="mt-1 text-[13px] text-[var(--ink-muted)]">
            Obiettivo Meta:{" "}
            <span className="font-medium text-[var(--ink)]">
              {etichettaGuidedMetaObjective(plan.metaObjective.value)}
            </span>
            <span className="ml-2 inline-block align-middle">
              <ProvenanceBadge provenance={plan.metaObjective.provenance} />
            </span>
          </p>
        </div>

        <div className="flex justify-center text-[var(--ink-muted)]" aria-hidden>
          ↓
        </div>

        {plan.adSets.map((adSet) => (
          <div
            key={adSet.id}
            className="rounded-xl border border-[var(--border)] bg-white p-3.5"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
              Gruppo di inserzioni
            </p>
            <p className="mt-1 text-[15px] font-medium text-[var(--ink)]">
              {adSet.nameBeginner || adSet.name}
            </p>
            {adSet.strategyLabel ? (
              <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">
                {adSet.strategyLabel}
              </p>
            ) : null}
            <ul className="mt-2 space-y-1 text-[13px] text-[var(--ink-muted)]">
              <li>
                Pubblico:{" "}
                <span className="text-[var(--ink)]">
                  {etichettaGuidedAudience(adSet.audienceStrategy)}
                </span>
              </li>
              {adSet.geographySummary ? (
                <li>
                  Geografia:{" "}
                  <span className="text-[var(--ink)]">{adSet.geographySummary}</span>
                </li>
              ) : null}
              {adSet.ageSummary ? (
                <li>
                  Età:{" "}
                  <span className="text-[var(--ink)]">{adSet.ageSummary}</span>
                </li>
              ) : null}
              <li>
                Destinazione:{" "}
                <span className="text-[var(--ink)]">
                  {etichettaGuidedDestination(adSet.destination)}
                </span>
              </li>
              {adSet.budgetNote ? (
                <li>
                  <span className="text-[var(--ink)]">{adSet.budgetNote}</span>
                </li>
              ) : null}
            </ul>
            <p className="mt-2 text-[12px] leading-snug text-[var(--ink-muted)]">
              {adSet.whySingleOrSplit}
            </p>
          </div>
        ))}

        <div className="flex justify-center text-[var(--ink-muted)]" aria-hidden>
          ↓
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-white p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
            Inserzioni
          </p>
          <ul className="mt-2 space-y-2">
            {plan.ads.map((ad) => (
              <li key={ad.id} className="text-[13px]">
                <span className="font-medium text-[var(--ink)]">{ad.name}</span>
                {ad.messagePreview ? (
                  <p className="mt-0.5 line-clamp-2 text-[var(--ink-muted)]">
                    {ad.messagePreview}
                  </p>
                ) : (
                  <p className="mt-0.5 text-[var(--ink-muted)]">
                    Messaggio da completare nel flusso creativo Ally
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-[var(--border)]/80 bg-[var(--surface-muted)]/40 px-3.5 py-2">
        <Row
          label="Cosa vuoi ottenere"
          value={plan.businessGoal.value ?? "Da scegliere"}
          provenance={plan.businessGoal.provenance}
        />
        <Row
          label="Come ricevi il risultato"
          value={etichettaGuidedDestination(plan.destination.value)}
          provenance={plan.destination.provenance}
          note={plan.destination.note}
        />
        {onScegliDestinazione &&
        (plan.destination.provenance === "MISSING" ||
          plan.destination.provenance === "INFERRED") ? (
          <div className="border-b border-[var(--border)]/60 py-2.5 last:border-0">
            <p className="text-[12px] font-medium text-[var(--ink-muted)]">
              Come vuoi ricevere il risultato?
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {DESTINAZIONI_GUIDATE.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className={`rounded-lg border px-2.5 py-1.5 text-[12px] font-medium ${
                    plan.destination.value === kind
                      ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                      : "border-[var(--border)] bg-white text-[var(--ink)] hover:bg-[var(--surface-muted)]"
                  }`}
                  onClick={() => onScegliDestinazione(kind)}
                >
                  {etichettaGuidedDestination(kind)}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <Row
          label="Chi vuoi raggiungere"
          value={etichettaGuidedAudience(plan.audienceStrategy.value)}
          provenance={plan.audienceStrategy.provenance}
          note={plan.audienceStrategy.note}
        />
        {plan.geographyFacts.value ? (
          <Row
            label="Zona"
            value={plan.geographyFacts.value}
            provenance={plan.geographyFacts.provenance}
          />
        ) : null}
        {plan.ageFacts.value ? (
          <Row
            label="Età"
            value={plan.ageFacts.value}
            provenance={plan.ageFacts.provenance}
          />
        ) : null}
        <Row
          label="Quanto investire"
          value={
            plan.budgetDaily.value != null
              ? `€${plan.budgetDaily.value} / giorno`
              : "Da indicare"
          }
          provenance={plan.budgetDaily.provenance}
        />
      </div>

      {plan.missingRequirements.length > 0 ? (
        <div className="mt-4">
          <p className="text-[12px] font-medium text-[var(--ink)]">
            Cosa manca ancora
          </p>
          <ul className="mt-2 space-y-1.5">
            {plan.missingRequirements.map((m) => (
              <li
                key={m.id}
                className="flex gap-2 text-[13px] leading-snug text-[var(--ink-muted)]"
              >
                <span className="mt-0.5 shrink-0 text-[10px] font-semibold uppercase text-[var(--ink-muted)]">
                  {m.scope === "PLANNING" ? "Piano" : "Meta"}
                </span>
                <span>{m.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-[13px] font-medium text-[var(--ink)] hover:bg-[var(--surface-muted)]"
          onClick={() => setPercheAperto((v) => !v)}
          aria-expanded={percheAperto}
        >
          {percheAperto ? "Nascondi perché" : "Perché questa struttura?"}
        </button>
        <button
          type="button"
          className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-[13px] font-medium text-[var(--ink)] hover:bg-[var(--surface-muted)]"
          onClick={() => setAvanzateAperte((v) => !v)}
          aria-expanded={avanzateAperte}
        >
          Impostazioni avanzate
        </button>
        {onModificaPasso ? (
          <button
            type="button"
            className="rounded-lg border border-transparent px-3 py-1.5 text-[13px] font-medium text-[var(--primary)] hover:underline"
            onClick={() => onModificaPasso(1)}
          >
            Modifica obiettivo / target
          </button>
        ) : null}
      </div>

      {percheAperto ? (
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-[var(--ink-muted)]">
          {plan.whySummary.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}

      {avanzateAperte ? (
        <div className="mt-4 rounded-xl border border-[var(--border)] bg-white p-3.5">
          <p className="text-[12px] font-semibold text-[var(--ink)]">
            Vista professionale
          </p>
          <p className="mt-1 text-[12px] text-[var(--ink-muted)]">
            Solo campi che Ally può modellare in sicurezza. Il resto resta su
            Meta.
          </p>
          <div className="mt-2">
            <Row
              label="Obiettivo Meta"
              value={etichettaGuidedMetaObjective(plan.metaObjective.value)}
              provenance={plan.metaObjective.provenance}
              note={
                plan.metaObjective.value
                  ? `Codice tecnico: ${plan.metaObjective.value}`
                  : plan.metaObjective.note
              }
            />
            <Row
              label="Destinazione"
              value={etichettaGuidedDestination(plan.destination.value)}
              provenance={plan.destination.provenance}
              note={plan.destination.note}
            />
            <Row
              label="Strategia pubblico"
              value={etichettaGuidedAudience(plan.audienceStrategy.value)}
              provenance={plan.audienceStrategy.provenance}
              note={plan.audienceStrategy.note}
            />
            <Row
              label="Livello budget"
              value={
                plan.budgetLevel.value === "CAMPAIGN"
                  ? "Campagna"
                  : plan.budgetLevel.value === "AD_SET"
                    ? "Gruppo di inserzioni"
                    : "Da definire"
              }
              provenance={plan.budgetLevel.provenance}
              note={plan.budgetLevel.note}
            />
            <Row
              label="Ottimizzazione"
              value={
                plan.optimizationGoalLabel.value ??
                (plan.optimizationGoal.provenance === "MISSING"
                  ? "Da confermare"
                  : "Da confermare")
              }
              provenance={plan.optimizationGoal.provenance}
              note={
                plan.optimizationGoal.value
                  ? `Codice tecnico: ${plan.optimizationGoal.value}${
                      plan.optimizationGoal.note
                        ? ` — ${plan.optimizationGoal.note}`
                        : ""
                    }`
                  : plan.optimizationGoal.note
              }
            />
            <Row
              label="Posizionamenti"
              value={etichettaGuidedPlacements(plan.placementsStrategy.value)}
              provenance={plan.placementsStrategy.provenance}
              note={plan.placementsStrategy.note}
            />
            <Row
              label="Strategia di offerta"
              value="Gestita su Meta"
              provenance={plan.bidStrategy.provenance}
              note={plan.bidStrategy.note}
            />
            <Row
              label="Attribuzione"
              value="Da configurare su Meta"
              provenance={plan.attribution.provenance}
              note={plan.attribution.note}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
