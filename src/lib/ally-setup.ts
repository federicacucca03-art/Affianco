/**
 * M8.5A — derived Ally first-value setup state.
 * Deterministic. No persistence flags. No AI.
 */

import type { ControlRoomAttentionItem } from "@/lib/monday-control-room";

/** Internal phases — never shown as enum names in UI. */
export type AllySetupPhase =
  | "NO_CLIENT"
  | "CHOOSE_START_PATH"
  | "META_CONNECTION_REQUIRED"
  | "META_IMPORT_REQUIRED"
  | "MONITORING_CONFIGURATION_REQUIRED"
  | "READY_FOR_FIRST_CONTROL"
  | "ACTIVE_WORKSPACE";

export type AllySetupPathPreference = "meta" | "native" | null;

export type AllySetupSignals = {
  /** Local and/or DB client exists. */
  hasClient: boolean;
  hasDbClient: boolean;
  /** Prefer DB UUID for Meta deep-links. */
  primaryClientId: string | null;
  primaryClientName: string | null;
  /** Any native campaign row (including DRAFT). */
  hasNativeCampaign: boolean;
  hasMetaCampaign: boolean;
  /** Any ACTIVE meta_connections row for this user. */
  hasMetaConnection: boolean;
  /** Any client_ad_accounts mapping. */
  hasMetaAdAccount: boolean;
  /** Optional session preference after choosing a start path. */
  pathPreference: AllySetupPathPreference;
  attentionItems: readonly ControlRoomAttentionItem[];
};

export type AllyStartPathMode = "plan_new" | "continue_draft";

export type AllyChecklistStepId =
  | "client"
  | "campaign"
  | "monitoring"
  | "control";

export type AllyChecklistStep = {
  id: AllyChecklistStepId;
  label: string;
  done: boolean;
  current: boolean;
};

export type AllySetupGuidance = {
  phase: AllySetupPhase;
  /** Home hero badge (always "Ciao, sono Ally" except rare cases). */
  heroBadge: string;
  heroTitle: string;
  heroSubtitle: string;
  /** Panel eyebrow — unused when panelOmitsHeading. */
  eyebrow: string;
  /** Panel title — unused when panelOmitsHeading. */
  title: string;
  /** Supporting lines in setup panel (not hero). */
  bodyLines: string[];
  /** Hero already carries the message — panel shows actions only. */
  panelOmitsHeading: boolean;
  primaryLabel: string;
  primaryHref: string | null;
  /** When set, Home should invoke campaign modal instead of navigating. */
  primaryAction: "create_client" | "open_campaign_modal" | "navigate" | null;
  secondaryLabel: string | null;
  secondaryHref: string | null;
  secondaryAction: "open_campaign_modal" | "navigate" | null;
  /** Equal-weight Meta / Plan-or-Continue cards for CHOOSE_START_PATH. */
  startPathCards: boolean;
  /** Which second card to show on the start-choice screen. */
  startPathMode: AllyStartPathMode | null;
  /** Exact draft to resume — never invent a new campaign. */
  resumeDraftHref: string | null;
  showControlRoom: boolean;
  /** Quick feature cards — only ACTIVE_WORKSPACE. */
  showQuickActions: boolean;
  /** Search workspace tool chips (Control Room / Meta / …). */
  showHeroTools: boolean;
  checklistVisible: boolean;
  checklist: AllyChecklistStep[];
  completedCount: number;
  totalCount: number;
  configExplain: {
    title: string;
    reason: string;
  } | null;
};

/**
 * Two layers (never mix):
 * A. Branch intent (`pathPreference`): null | meta | native — only from explicit user choice
 * B. Product readiness: client / Meta / campaigns / monitoring
 *
 * Priority when incomplete:
 * 1. Real campaign exists (native incl. DRAFT, or Meta import) → workspace phases
 * 2. Explicit Plan without client → NO_CLIENT
 * 3. Explicit Import → Meta connect / import phases
 * 4. Else → CHOOSE_START_PATH (never infer branch from Meta/draft/client alone)
 */
const EVALUABLE: ReadonlySet<ControlRoomAttentionItem["attentionState"]> =
  new Set([
    "CRITICAL",
    "NEEDS_ATTENTION",
    "MONITOR",
    "STABLE",
  ]);

const CONFIG_KINDS = new Set<
  NonNullable<ControlRoomAttentionItem["configurationKind"]>
>([
  "DRAFT",
  "ACTIVE_MISSING_TARGET",
  "ACTIVE_MISSING_RESULTS",
  "RESULT_MAPPING",
  "OTHER",
]);

/**
 * Canonical resumable native draft — matches Control Room DRAFT classification.
 * Does not include APPROVED / ACTIVE / Meta / historical.
 */
export function isResumableNativeDraftItem(
  item: ControlRoomAttentionItem,
): boolean {
  if (item.source !== "NATIVE" || item.suppressedByLink) return false;
  if (item.configurationKind === "DRAFT") return true;
  const st = (item.campaignStatus ?? "").trim().toUpperCase();
  return st === "DRAFT" || st === "";
}

/**
 * Prefer the first matching draft in attention order.
 * Home builds native items from campaigns ordered by created_at DESC.
 */
export function pickResumableNativeDraftId(
  items: readonly ControlRoomAttentionItem[],
): string | null {
  for (const item of items) {
    if (isResumableNativeDraftItem(item)) return item.campaignId;
  }
  return null;
}

/**
 * First real campaign unlocks the workspace (native incl. DRAFT, or imported Meta).
 * Provisional Meta client / OAuth / ad-account alone do NOT unlock.
 */
export function hasWorkspaceCampaign(signals: AllySetupSignals): boolean {
  return signals.hasNativeCampaign || signals.hasMetaCampaign;
}

/** Launchable / monitorable campaign — drafts alone do not count for evaluable health. */
export function hasLaunchableCampaign(signals: AllySetupSignals): boolean {
  if (signals.hasMetaCampaign) return true;
  return signals.attentionItems.some(
    (i) =>
      i.source === "NATIVE" &&
      !i.suppressedByLink &&
      !isResumableNativeDraftItem(i),
  );
}

/** Onboarding ends when a real campaign exists — drafts unlock the workspace. */
export function hasCampaignAvailable(signals: AllySetupSignals): boolean {
  return hasWorkspaceCampaign(signals);
}

/** Phases that still use first-run / Configura Ally chrome. */
export function isFirstRunOnboardingPhase(phase: AllySetupPhase): boolean {
  return (
    phase === "NO_CLIENT" ||
    phase === "CHOOSE_START_PATH" ||
    phase === "META_CONNECTION_REQUIRED" ||
    phase === "META_IMPORT_REQUIRED"
  );
}

/** Account has entered the normal Ally workspace (nav + Home). */
export function isWorkspacePhase(phase: AllySetupPhase): boolean {
  return !isFirstRunOnboardingPhase(phase);
}

function pickConfigItem(
  items: readonly ControlRoomAttentionItem[],
): ControlRoomAttentionItem | null {
  const configs = items.filter(
    (i) =>
      i.attentionState === "CONFIGURATION_REQUIRED" &&
      i.configurationKind != null &&
      CONFIG_KINDS.has(i.configurationKind),
  );
  if (configs.length === 0) return null;
  const order = [
    "ACTIVE_MISSING_TARGET",
    "RESULT_MAPPING",
    "ACTIVE_MISSING_RESULTS",
    "DRAFT",
    "OTHER",
  ] as const;
  for (const kind of order) {
    const hit = configs.find((c) => c.configurationKind === kind);
    if (hit) return hit;
  }
  return configs[0] ?? null;
}

export function explainMonitoringGap(
  item: ControlRoomAttentionItem,
): { title: string; reason: string; cta: string } {
  switch (item.configurationKind) {
    case "ACTIVE_MISSING_TARGET":
      return {
        title: "Imposta la soglia di riferimento",
        reason:
          "Serve ad Ally per capire quando il costo della campagna richiede attenzione.",
        cta: "Imposta soglia",
      };
    case "RESULT_MAPPING":
      return {
        title: "Indica quale risultato vuoi monitorare",
        reason:
          "Così Ally può calcolare correttamente il costo per risultato.",
        cta: "Indica risultato",
      };
    case "ACTIVE_MISSING_RESULTS":
      return {
        title: "Registra i primi risultati",
        reason: "Senza risultati Ally non può ancora valutare la campagna.",
        cta: "Apri monitoraggio",
      };
    case "DRAFT":
      return {
        title: "Completa la campagna in bozza",
        reason: "Finisci la pianificazione per poterla monitorare.",
        cta: "Continua la campagna",
      };
    default:
      return {
        title: "Completa il monitoraggio",
        reason: "Mancano ancora i dati necessari per valutare questa campagna.",
        cta: "Apri monitoraggio",
      };
  }
}

export function deriveAllySetupPhase(
  signals: AllySetupSignals,
): AllySetupPhase {
  const campaignOk = hasCampaignAvailable(signals);

  // Existing users with campaigns skip first-client even if client list is empty.
  if (campaignOk) {
    const items = signals.attentionItems.filter((i) => !i.suppressedByLink);
    const hasEvaluable = items.some((i) => EVALUABLE.has(i.attentionState));
    if (hasEvaluable) {
      return "ACTIVE_WORKSPACE";
    }
    const configItem = pickConfigItem(items);
    if (configItem) {
      return "MONITORING_CONFIGURATION_REQUIRED";
    }
    return "READY_FOR_FIRST_CONTROL";
  }

  /* Layer A — only after explicit card click (or ?setup= / focus=meta). */
  if (signals.pathPreference === "native" && !signals.hasClient) {
    return "NO_CLIENT";
  }

  if (signals.pathPreference === "meta") {
    if (!signals.hasMetaConnection) {
      return "META_CONNECTION_REQUIRED";
    }
    /* Connected: account picker and/or campaign import (same phase, copy varies). */
    return "META_IMPORT_REQUIRED";
  }

  /* Neutral entry: never auto-enter Meta or Plan from connection/draft/client. */
  return "CHOOSE_START_PATH";
}

function clientHref(
  signals: AllySetupSignals,
  opts?: { focusMeta?: boolean },
): string {
  const q = opts?.focusMeta ? "?focus=meta" : "";
  if (signals.primaryClientId) {
    return `/clienti/${encodeURIComponent(signals.primaryClientId)}${q}`;
  }
  return `/clienti${q}`;
}

function buildChecklist(
  phase: AllySetupPhase,
  signals: AllySetupSignals,
): AllyChecklistStep[] {
  const campaignOk =
    signals.hasNativeCampaign ||
    signals.hasMetaCampaign ||
    hasLaunchableCampaign(signals);
  const clientDone = signals.hasClient || campaignOk;
  const monitoringDone =
    phase === "READY_FOR_FIRST_CONTROL" || phase === "ACTIVE_WORKSPACE";
  const controlDone = phase === "ACTIVE_WORKSPACE";

  const steps: Omit<AllyChecklistStep, "current">[] = [
    { id: "client", label: "Aggiungi il primo cliente", done: clientDone },
    { id: "campaign", label: "Aggiungi una campagna", done: campaignOk },
    {
      id: "monitoring",
      label: "Completa il monitoraggio",
      done: monitoringDone,
    },
    {
      id: "control",
      label: "Guarda il primo controllo",
      done: controlDone,
    },
  ];

  const firstOpen = steps.find((s) => !s.done)?.id ?? null;
  return steps.map((s) => ({
    ...s,
    current: firstOpen != null && s.id === firstOpen,
  }));
}

export function buildAllySetupGuidance(
  signals: AllySetupSignals,
): AllySetupGuidance {
  const phase = deriveAllySetupPhase(signals);
  const checklist = buildChecklist(phase, signals);
  const completedCount = checklist.filter((s) => s.done).length;
  const totalCount = checklist.length;
  const clientLink = clientHref(signals);
  const clientMetaLink = clientHref(signals, { focusMeta: true });
  const configItem = pickConfigItem(
    signals.attentionItems.filter((i) => !i.suppressedByLink),
  );

  const base = {
    checklist,
    completedCount,
    totalCount,
    /*
     * M8.5A.8 — checklist stays off during first-value setup.
     * Central CTAs already name the next action; a 1/4 progress panel
     * only previews future steps and competes with the primary choice.
     * AllySetupChecklist remains for optional later reuse.
     */
    checklistVisible: false,
    startPathCards: false,
    startPathMode: null as AllyStartPathMode | null,
    resumeDraftHref: null as string | null,
    showControlRoom: false,
    showQuickActions: false,
    showHeroTools: false,
    panelOmitsHeading: false,
    heroBadge: "Ciao, sono Ally",
    configExplain: null as AllySetupGuidance["configExplain"],
    secondaryLabel: null as string | null,
    secondaryHref: null as string | null,
    secondaryAction: null as AllySetupGuidance["secondaryAction"],
  };

  switch (phase) {
    case "NO_CLIENT":
      return {
        ...base,
        phase,
        heroTitle: "Aggiungi il cliente da pianificare.",
        heroSubtitle:
          "Per costruire una nuova campagna partiamo dal cliente.",
        eyebrow: "",
        title: "",
        bodyLines: [],
        panelOmitsHeading: true,
        primaryLabel: "Aggiungi il cliente",
        primaryHref: null,
        primaryAction: "create_client",
      };

    case "CHOOSE_START_PATH": {
      const draftId = pickResumableNativeDraftId(signals.attentionItems);
      const hasDraft = Boolean(draftId);
      return {
        ...base,
        phase,
        heroTitle: hasDraft ? "Come vuoi continuare?" : "Come vuoi iniziare?",
        heroSubtitle: hasDraft
          ? "Riprendi la bozza oppure importa le campagne che gestisci già su Meta."
          : "Importa le campagne che gestisci già oppure pianificane una nuova.",
        eyebrow: "",
        title: "",
        bodyLines: hasDraft
          ? ["Scegli se riprendere la bozza o importare da Meta."]
          : ["Scegli il modo più comodo per iniziare."],
        panelOmitsHeading: true,
        primaryLabel: "Importa da Meta",
        primaryHref: clientLink,
        primaryAction: "navigate",
        secondaryLabel: hasDraft
          ? "Continua la campagna in bozza"
          : "Pianifica una campagna",
        secondaryHref: hasDraft
          ? `/campagne/${encodeURIComponent(draftId!)}`
          : "/campagne",
        secondaryAction: hasDraft ? "navigate" : "open_campaign_modal",
        startPathCards: true,
        /* Draft changes the second card only — never auto-enters a branch. */
        startPathMode: hasDraft ? "continue_draft" : "plan_new",
        resumeDraftHref: hasDraft
          ? `/campagne/${encodeURIComponent(draftId!)}`
          : null,
        showControlRoom: false,
      };
    }

    case "META_CONNECTION_REQUIRED":
      return {
        ...base,
        phase,
        heroTitle: "Collega Meta",
        heroSubtitle:
          "Collega l'account da cui vuoi importare le campagne.",
        eyebrow: "PROSSIMO PASSO",
        title: "Collega Meta",
        bodyLines: ["Poi scegli l'account e importa le campagne."],
        primaryLabel: "Collega Meta",
        primaryHref: clientMetaLink,
        primaryAction: "navigate",
        secondaryLabel: "Torna alla scelta",
        secondaryHref: "/home",
        secondaryAction: "navigate",
      };

    case "META_IMPORT_REQUIRED":
      return {
        ...base,
        phase,
        heroTitle: signals.hasMetaAdAccount
          ? "Importa le tue campagne."
          : "Scegli l'account pubblicitario",
        heroSubtitle: signals.hasMetaAdAccount
          ? "Scegli le campagne Meta che vuoi portare dentro Ally."
          : "Scegli l'account da cui vuoi importare le campagne.",
        eyebrow: "PROSSIMO PASSO",
        title: signals.hasMetaAdAccount
          ? "Importa le campagne"
          : "Scegli l'account Meta",
        bodyLines: signals.hasMetaAdAccount
          ? ["Importa le campagne per iniziare il monitoraggio."]
          : ["Scegli l'account, poi importa le campagne."],
        primaryLabel: signals.hasMetaAdAccount
          ? "Importa campagne"
          : "Scegli account",
        primaryHref: clientMetaLink,
        primaryAction: "navigate",
        secondaryLabel: "Torna alla scelta",
        secondaryHref: "/home",
        secondaryAction: "navigate",
      };

    case "MONITORING_CONFIGURATION_REQUIRED": {
      const explain = configItem
        ? explainMonitoringGap(configItem)
        : {
            title: "Completa il monitoraggio",
            reason:
              "Serve ancora un passaggio per valutare questa campagna.",
            cta: "Apri monitoraggio",
          };
      const heroSubtitle =
        configItem?.configurationKind === "ACTIVE_MISSING_TARGET"
          ? "Imposta la soglia che Ally userà per capire quando una campagna richiede attenzione."
          : configItem?.configurationKind === "RESULT_MAPPING"
            ? "Indica quale risultato vuoi monitorare per valutare correttamente la campagna."
            : explain.reason;
      return {
        ...base,
        phase,
        heroTitle: "Capisci cosa conta oggi.",
        heroSubtitle,
        eyebrow: "DA CONFIGURARE",
        title: explain.title,
        bodyLines: [explain.reason],
        primaryLabel: explain.cta,
        primaryHref: configItem?.href ?? "/risultati",
        primaryAction: "navigate",
        configExplain: {
          title: explain.title,
          reason: explain.reason,
        },
        showControlRoom: true,
        showQuickActions: true,
        showHeroTools: true,
      };
    }

    case "READY_FOR_FIRST_CONTROL":
      return {
        ...base,
        phase,
        heroTitle: "Capisci cosa conta oggi.",
        heroSubtitle:
          "La campagna è pronta: Ally monitorerà appena ci sono abbastanza dati.",
        eyebrow: "PRONTO",
        title: "Apri Control Room",
        bodyLines: [
          "Ally monitorerà questa campagna appena ci sono abbastanza dati.",
        ],
        primaryLabel: "Apri Control Room",
        primaryHref: "/risultati",
        primaryAction: "navigate",
        showControlRoom: true,
        showQuickActions: true,
        showHeroTools: true,
      };

    case "ACTIVE_WORKSPACE":
      return {
        ...base,
        phase,
        heroTitle: "Capisci cosa conta oggi.",
        heroSubtitle:
          "Controlla le campagne che richiedono attenzione e il prossimo passo da fare.",
        eyebrow: "",
        title: "",
        bodyLines: [],
        primaryLabel: "",
        primaryHref: null,
        primaryAction: null,
        checklistVisible: false,
        showControlRoom: true,
        showQuickActions: true,
        showHeroTools: true,
      };
  }
}

export const SETUP_PATH_STORAGE_KEY = "affianco-setup-path-v1";

export function readSetupPathPreference(): AllySetupPathPreference {
  if (typeof window === "undefined") return null;
  try {
    const v = window.sessionStorage.getItem(SETUP_PATH_STORAGE_KEY);
    if (v === "meta" || v === "native") return v;
    return null;
  } catch {
    return null;
  }
}

export function writeSetupPathPreference(path: AllySetupPathPreference): void {
  if (typeof window === "undefined") return;
  try {
    if (!path) {
      window.sessionStorage.removeItem(SETUP_PATH_STORAGE_KEY);
    } else {
      window.sessionStorage.setItem(SETUP_PATH_STORAGE_KEY, path);
    }
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new Event("ally-setup-changed"));
  } catch {
    // ignore
  }
}
