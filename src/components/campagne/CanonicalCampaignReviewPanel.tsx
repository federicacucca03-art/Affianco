"use client";

import type { ReactNode } from "react";
import { CanonicalPublishPreviewView } from "@/components/campagne/CanonicalPublishPreviewView";
import { MetaExecutionPreviewView } from "@/components/campagne/MetaExecutionPreviewView";
import type { CanonicalPublishPreview } from "@/lib/meta/write/canonical-publish-preview";
import { editTargetLabelIt } from "@/lib/meta/launch-guardian/prewrite";
import type {
  PreWriteGuardianCheck,
  PreWriteGuardianResult,
} from "@/lib/meta/launch-guardian/prewrite-types";
import type { CanonicalCreativePackage } from "@/lib/meta/creative";
import type { MetaExecutionPlan } from "@/lib/meta/execution-plan/types";

type Props = {
  canonical: CanonicalPublishPreview | null | undefined;
  guardian: PreWriteGuardianResult;
  /** P0.17 — one canonical creative package (not a second readiness system). */
  creativePackage?: CanonicalCreativePackage | null;
  /** ADV.2.1 — dry-run execution plan (same truth as Guardian merge). */
  executionPlan?: MetaExecutionPlan | null;
  /** Compact Easy rows already shown above — optional. */
  showCanonicalDetail?: boolean;
  onEditTarget?: (target: NonNullable<PreWriteGuardianCheck["editTarget"]>) => void;
  /**
   * When provided, replaces the inert “prossimamente” launch teaser with the
   * normal FULL_PUBLISH_PAUSED controls (e.g. MetaFullPublishCta).
   */
  publishControls?: ReactNode;
};

function statusBadgeClass(status: PreWriteGuardianResult["reviewStatus"]): string {
  if (status === "READY") {
    return "border-[color-mix(in_srgb,var(--primary)_35%,var(--border))] bg-[color-mix(in_srgb,var(--accent-soft)_35%,white)] text-[var(--ink)]";
  }
  if (status === "READY_WITH_CONFIRMATIONS") {
    return "border-[var(--border)] bg-[var(--surface)] text-[var(--ink)]";
  }
  if (status === "UNSUPPORTED") {
    return "border-[var(--border)] bg-[var(--surface)] text-[var(--ink-muted)]";
  }
  return "border-[color-mix(in_srgb,#b45309_35%,var(--border))] bg-[color-mix(in_srgb,#f59e0b_12%,white)] text-[var(--ink)]";
}

function CheckGroup({
  title,
  items,
  onEditTarget,
}: {
  title: string;
  items: PreWriteGuardianCheck[];
  onEditTarget?: Props["onEditTarget"];
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--primary)]">
        {title}
      </p>
      <ul className="space-y-2">
        {items.map((c) => {
          const editLabel = editTargetLabelIt(c.editTarget);
          return (
            <li
              key={c.id}
              className="rounded-[10px] border border-[var(--border)] px-3 py-2.5 text-[13px]"
            >
              <p className="font-medium text-[var(--ink)]">{c.title}</p>
              <p className="mt-0.5 text-[var(--ink-muted)]">{c.userMessage}</p>
              {editLabel && c.editTarget && onEditTarget ? (
                <button
                  type="button"
                  className="mt-1.5 text-[12px] font-medium text-[var(--primary)] underline-offset-2 hover:underline"
                  onClick={() => onEditTarget(c.editTarget!)}
                >
                  Vai a: {editLabel}
                </button>
              ) : editLabel ? (
                <p className="mt-1 text-[12px] text-[var(--ink-muted)]">
                  Dove sistemare: {editLabel}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * P0.16 — One canonical campaign review: CanonicalPublishPreview + Pre-write Guardian.
 * Full Meta publish is optional via `publishControls` (FULL_PUBLISH_PAUSED).
 */
export function CanonicalCampaignReviewPanel({
  canonical,
  guardian,
  creativePackage,
  executionPlan,
  showCanonicalDetail = true,
  onEditTarget,
  publishControls,
}: Props) {
  const showLaunchTeaser =
    !publishControls &&
    (guardian.reviewStatus === "READY" ||
      guardian.reviewStatus === "READY_WITH_CONFIRMATIONS");

  return (
    <div className="space-y-5">
      <div
        className={`rounded-[12px] border px-4 py-3 ${statusBadgeClass(guardian.reviewStatus)}`}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] opacity-80">
          Revisione campagna · Guardian pre-write
        </p>
        <p className="mt-1 text-[15px] font-semibold text-[var(--ink)]">
          {guardian.headlineIt}
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-muted)]">
          {guardian.summaryIt}
        </p>
        <p className="mt-2 text-[11px] text-[var(--ink-muted)]">
          Stato: {guardian.reviewStatus} · fase {guardian.phase} · mutazioni Meta:{" "}
          {guardian.mutationsPerformed}
        </p>
      </div>

      {creativePackage ? (
        <div className="rounded-[12px] border border-[var(--border)] px-4 py-3 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--primary)]">
            Creatività · package canonico
          </p>
          <p className="text-[13px] text-[var(--ink)]">
            Formato: {creativePackage.format} (
            {creativePackage.formatSupport}) · stato{" "}
            {creativePackage.status}
          </p>
          <ul className="space-y-1 text-[13px] text-[var(--ink-muted)]">
            <li>
              Pagina:{" "}
              {creativePackage.identity.facebookPageName ||
                creativePackage.identity.facebookPageId ||
                "Da completare"}
            </li>
            <li>
              Instagram:{" "}
              {creativePackage.identity.preferPageOnly
                ? "Solo Pagina"
                : creativePackage.identity.instagramActorId || "—"}
            </li>
            <li>
              Media:{" "}
              {creativePackage.media.primaryAsset?.nomeFile ||
                (creativePackage.media.mediaStatus === "MISSING"
                  ? "Mancante"
                  : "Presente")}{" "}
              · {creativePackage.media.formatReadiness.summaryIt}
            </li>
            <li>
              Testo:{" "}
              {creativePackage.copy.primaryText || "Da completare"}{" "}
              <span className="text-[11px]">
                ({creativePackage.copy.primaryTextProvenance})
              </span>
            </li>
            <li>
              Titolo:{" "}
              {creativePackage.copy.headline || "Da completare"}{" "}
              <span className="text-[11px]">
                ({creativePackage.copy.headlineProvenance})
              </span>
            </li>
            <li>
              CTA: {creativePackage.copy.callToActionLabelIt} (
              {creativePackage.copy.callToActionType ?? "—"})
            </li>
            <li>
              Destinazione: {creativePackage.destination.type ?? "—"}
              {creativePackage.destination.type === "META_LEAD_FORM"
                ? ` · Form ${creativePackage.destination.instantFormName || creativePackage.destination.instantFormId || "da selezionare"}`
                : creativePackage.destination.url
                  ? ` · ${creativePackage.destination.url}`
                  : ""}
            </li>
          </ul>
        </div>
      ) : null}

      {executionPlan ? (
        <MetaExecutionPreviewView plan={executionPlan} mode="facile" />
      ) : null}

      {showCanonicalDetail && canonical ? (
        <div className="space-y-2">
          <p className="text-[12px] font-medium text-[var(--ink)]">
            Cosa creerà Ally su Meta
          </p>
          {/* P0.16.3 — never show raw CanonicalPublishPreview.blockers here;
              Guardian CheckGroups below are the single semantic issue source. */}
          <CanonicalPublishPreviewView
            preview={canonical}
            showLegacyIssueLists={false}
          />
        </div>
      ) : null}

      <CheckGroup
        title="Blocchi"
        items={guardian.blockers}
        onEditTarget={onEditTarget}
      />
      <CheckGroup
        title="Da confermare"
        items={guardian.confirmations}
        onEditTarget={onEditTarget}
      />
      <CheckGroup title="Avvisi" items={guardian.warnings} />
      {guardian.passed.length > 0 ? (
        <details className="rounded-[10px] border border-[var(--border)] px-3 py-2">
          <summary className="cursor-pointer text-[12px] font-medium text-[var(--ink-muted)]">
            Controlli superati ({guardian.passed.length})
          </summary>
          <ul className="mt-2 space-y-1 text-[12px] text-[var(--ink-muted)]">
            {guardian.passed.map((c) => (
              <li key={c.id}>
                <span className="font-medium text-[var(--ink)]">{c.title}</span>
                {" — "}
                {c.userMessage}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {publishControls ? (
        <div className="pt-1">{publishControls}</div>
      ) : (
        <div className="rounded-[10px] border border-dashed border-[var(--border)] px-3 py-3 text-[12px] text-[var(--ink-muted)]">
          <p className="font-medium text-[var(--ink)]">Lancio su Meta</p>
          <p className="mt-1">
            {guardian.reviewStatus === "UNSUPPORTED"
              ? "Nessun lancio disponibile: configurazione non ancora eseguibile in Ally."
              : showLaunchTeaser && guardian.futureLaunchEligible
                ? "Pronta per il controllo finale. Collega i controlli di pubblicazione completa per creare su Meta in PAUSA."
                : "Completa blocchi e conferme prima del controllo finale."}
          </p>
          <button
            type="button"
            disabled
            className="aff-btn-primary mt-3 w-full opacity-50 sm:w-auto"
            title="Controlli pubblicazione non collegati in questa vista"
          >
            Lancia su Meta (non collegato)
          </button>
          <p className="mt-1.5 text-[11px]">
            Nessuna scrittura Graph da questo riquadro. Usa i controlli di
            pubblicazione completa quando disponibili.
          </p>
        </div>
      )}
    </div>
  );
}
