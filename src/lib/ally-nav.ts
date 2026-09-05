/**
 * M8.5A.7 / M8.5C — navigation during Ally first-value setup vs workspace.
 * Pure UI rules from phase. Does not change setup-state derivation.
 *
 * Onboarding (no real campaign yet): Configura Ally + minimal nav
 * Workspace (native and/or Meta campaign exists): full nav labeled Home
 */

import {
  isFirstRunOnboardingPhase,
  isWorkspacePhase,
  type AllySetupPhase,
} from "@/lib/ally-setup";

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
  /** Incomplete first-run setup — progressive disclosure active. */
  isSetupIncomplete: boolean;
  homeLabel: string;
  showHome: boolean;
  showCampagne: boolean;
  showRisultati: boolean;
  showNotifiche: boolean;
  showClienti: boolean;
  showMeta: boolean;
  showNewCampaignCta: boolean;
  /** Persistent Importa da Meta action in workspace action area. */
  showImportMetaCta: boolean;
};

const WORKSPACE_NAV: AllyNavPresentation = {
  isActiveWorkspace: true,
  isSetupIncomplete: false,
  homeLabel: "Home",
  showHome: true,
  showCampagne: true,
  showRisultati: true,
  showNotifiche: true,
  showClienti: true,
  showMeta: true,
  showNewCampaignCta: true,
  showImportMetaCta: true,
};

/**
 * @param phase — derived setup phase, or null while still loading.
 * While loading, keep full nav (avoid flashing incomplete chrome for
 * already-active workspaces).
 */
export function buildAllyNavPresentation(
  phase: AllySetupPhase | null,
): AllyNavPresentation {
  if (phase === null || isWorkspacePhase(phase)) {
    return WORKSPACE_NAV;
  }

  /* First-run onboarding only. */
  return {
    isActiveWorkspace: false,
    isSetupIncomplete: true,
    homeLabel: "Configura Ally",
    showHome: true,
    showCampagne: false,
    showRisultati: false,
    showNotifiche: false,
    showClienti: phase !== "CHOOSE_START_PATH",
    showMeta: true,
    showNewCampaignCta: false,
    showImportMetaCta: false,
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

export { isFirstRunOnboardingPhase, isWorkspacePhase };
