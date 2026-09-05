"use client";

import Link from "next/link";
import type { AllySetupGuidance } from "@/lib/ally-setup";
import { AllySetupChecklist } from "@/components/shell/AllySetupChecklist";
import {
  FirstClientForm,
  StartPathCards,
} from "@/components/dashboard/FirstClientForm";
import { AllyPanel } from "@/components/shell/AllyPanel";

type Props = {
  guidance: AllySetupGuidance;
  onCreateClientDone: (client: { id: string; name: string }) => void;
  onChooseMeta: () => void;
  onChooseNative: () => void;
  onContinueDraft: () => void;
  onPrimaryClick: () => void;
  showForm: boolean;
  onShowForm: () => void;
};

export function HomeSetupPanel({
  guidance,
  onCreateClientDone,
  onChooseMeta,
  onChooseNative,
  onContinueDraft,
  onPrimaryClick,
  showForm,
  onShowForm,
}: Props) {
  if (guidance.phase === "ACTIVE_WORKSPACE") return null;

  const omitHeading = guidance.panelOmitsHeading;
  const isNoClient = guidance.phase === "NO_CLIENT";
  const isChoosePath = guidance.startPathCards;

  /* CHOOSE_START_PATH: cards sit on dotted canvas — no outer white panel. */
  if (isChoosePath) {
    return (
      <section className="mt-6 space-y-4 text-center sm:mt-7">
        {guidance.bodyLines[0] ? (
          <p className="mx-auto max-w-xl text-[14px] leading-relaxed text-[var(--ink-muted)]">
            {guidance.bodyLines[0]}
          </p>
        ) : null}

        <div>
          <StartPathCards
            mode={guidance.startPathMode ?? "plan_new"}
            onMeta={onChooseMeta}
            onNative={onChooseNative}
            onContinueDraft={onContinueDraft}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="mt-6 space-y-3 text-left sm:mt-8">
      <AllyPanel className="px-5 py-6 sm:px-6 sm:py-7">
        {!omitHeading && guidance.eyebrow ? (
          <p className="aff-eyebrow">{guidance.eyebrow}</p>
        ) : null}
        {!omitHeading ? (
          <>
            <h2 className="aff-page-title mt-2 max-w-2xl">{guidance.title}</h2>
            {guidance.bodyLines.map((line) => (
              <p key={line} className="aff-page-subtitle mt-2 max-w-xl">
                {line}
              </p>
            ))}
          </>
        ) : null}

        {isNoClient ? (
          <div>
            {showForm ? (
              <FirstClientForm embedded onCreated={onCreateClientDone} />
            ) : (
              <button
                type="button"
                className="aff-btn-primary"
                onClick={onShowForm}
              >
                {guidance.primaryLabel}
              </button>
            )}
          </div>
        ) : null}

        {!isNoClient && guidance.primaryLabel ? (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {guidance.primaryAction === "open_campaign_modal" ? (
              <button
                type="button"
                className="aff-btn-primary"
                onClick={onPrimaryClick}
              >
                {guidance.primaryLabel}
              </button>
            ) : guidance.primaryHref ? (
              <Link href={guidance.primaryHref} className="aff-btn-primary">
                {guidance.primaryLabel}
              </Link>
            ) : null}

            {guidance.secondaryLabel ? (
              guidance.secondaryAction === "open_campaign_modal" ? (
                <button
                  type="button"
                  className="aff-btn-secondary"
                  onClick={onChooseNative}
                >
                  {guidance.secondaryLabel}
                </button>
              ) : guidance.secondaryHref ? (
                <Link
                  href={guidance.secondaryHref}
                  className="aff-btn-secondary"
                >
                  {guidance.secondaryLabel}
                </Link>
              ) : null
            ) : null}
          </div>
        ) : null}
      </AllyPanel>

      {/* Kept for optional later phases; guidance.checklistVisible gates it. */}
      {guidance.checklistVisible ? (
        <AllySetupChecklist
          steps={guidance.checklist}
          completedCount={guidance.completedCount}
          totalCount={guidance.totalCount}
        />
      ) : null}
    </section>
  );
}
