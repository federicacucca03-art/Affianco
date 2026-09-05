/**
 * M8.5A.7 — state-specific navigation during Ally first-value setup.
 * Pure UI rules from phase. Does not change setup-state derivation.
 *
 * Progressive reveal:
 * L1 client setup → Configura Ally, Clienti, Meta
 * L2 campaign exists → + Campagne
 * L3 monitoring useful → + Risultati (ACTIVE only for now)
 * L4 active workspace → + Notifiche, CTA, Control Room label
 */

import type { AllySetupPhase } from "@/lib/ally-setup";

export type AllyNavItemId =
  | "home"
  | "campagne"
  | "risultati"
  | "notifiche"
  | "clienti"
  | "meta";

export type AllyNavPresentation = {
  /** True when full product nav should show (or phase not yet known). */
  isActiveWorkspace: boolean;
  /** Incomplete setup — progressive disclosure active. */
  isSetupIncomplete: boolean;
  homeLabel: string;
  showHome: boolean;
  showCampagne: boolean;
  showRisultati: boolean;
  showNotifiche: boolean;
  showClienti: boolean;
  showMeta: boolean;
  showNewCampaignCta: boolean;
};

const ACTIVE_NAV: AllyNavPresentation = {
  isActiveWorkspace: true,
  isSetupIncomplete: false,
  homeLabel: "Control Room",
  showHome: true,
  showCampagne: true,
  showRisultati: true,
  showNotifiche: true,
  showClienti: true,
  showMeta: true,
  showNewCampaignCta: true,
};

/** Phases before any campaign exists — Campagne stays hidden. */
const PRE_CAMPAIGN: ReadonlySet<AllySetupPhase> = new Set([
  "NO_CLIENT",
  "CHOOSE_START_PATH",
  "META_CONNECTION_REQUIRED",
  "META_IMPORT_REQUIRED",
]);

/**
 * @param phase — derived setup phase, or null while still loading.
 * While loading, keep full nav (avoid flashing incomplete chrome for
 * already-active workspaces).
 */
export function buildAllyNavPresentation(
  phase: AllySetupPhase | null,
): AllyNavPresentation {
  if (phase === null || phase === "ACTIVE_WORKSPACE") {
    return ACTIVE_NAV;
  }

  const campaignExists = !PRE_CAMPAIGN.has(phase);

  return {
    isActiveWorkspace: false,
    isSetupIncomplete: true,
    homeLabel: "Configura Ally",
    showHome: true,
    showCampagne: campaignExists,
    showRisultati: false,
    showNotifiche: false,
    /* Hide Clienti until a real client exists (CHOOSE) or during pure Import start. */
    showClienti: phase !== "CHOOSE_START_PATH",
    showMeta: true,
    showNewCampaignCta: false,
  };
}

export function allyNavItemVisible(
  nav: AllyNavPresentation,
  id: AllyNavItemId,
): boolean {
  switch (id) {
    case "home":
      return nav.showHome;
    case "campagne":
      return nav.showCampagne;
    case "risultati":
      return nav.showRisultati;
    case "notifiche":
      return nav.showNotifiche;
    case "clienti":
      return nav.showClienti;
    case "meta":
      return nav.showMeta;
  }
}
