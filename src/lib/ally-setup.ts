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
  /** Equal-weight Meta / Plan cards for CHOOSE_START_PATH. */
  startPathCards: boolean;
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
 * Priority when several incomplete conditions exist:
 * 1. NO_CLIENT (no client AND no campaign)
 * 2. Meta connect / import / choose-start (only while no campaign yet)
 * 3. MONITORING_CONFIGURATION (target → result → results → draft → other)
 * 4. READY_FOR_FIRST_CONTROL (configured, waiting on data)
 * 5. ACTIVE_WORKSPACE (any evaluable attention row)
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

export function hasCampaignAvailable(signals: AllySetupSignals): boolean {
  return signals.hasNativeCampaign || signals.hasMetaCampaign;
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
  if (!signals.hasClient && !campaignOk) {
    return "NO_CLIENT";
  }

  if (!campaignOk) {
    if (signals.hasMetaConnection && !signals.hasMetaAdAccount) {
      return "META_CONNECTION_REQUIRED";
    }
    if (signals.hasMetaConnection && signals.hasMetaAdAccount) {
      return "META_IMPORT_REQUIRED";
    }
    if (signals.pathPreference === "meta" && signals.hasDbClient) {
      return signals.hasMetaConnection
        ? "META_IMPORT_REQUIRED"
        : "META_CONNECTION_REQUIRED";
    }
    return "CHOOSE_START_PATH";
  }

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

function clientHref(signals: AllySetupSignals): string {
  if (signals.primaryClientId) {
    return `/clienti/${encodeURIComponent(signals.primaryClientId)}`;
  }
  return "/clienti";
}

function buildChecklist(
  phase: AllySetupPhase,
  signals: AllySetupSignals,
): AllyChecklistStep[] {
  const campaignOk = hasCampaignAvailable(signals);
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
  const configItem = pickConfigItem(
    signals.attentionItems.filter((i) => !i.suppressedByLink),
  );

  const base = {
    checklist,
    completedCount,
    totalCount,
    checklistVisible: phase !== "ACTIVE_WORKSPACE",
    startPathCards: false,
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
        heroTitle: "Iniziamo dal tuo primo cliente.",
        heroSubtitle:
          "Aggiungi il cliente che vuoi gestire e ti guiderò passo passo.",
        eyebrow: "",
        title: "",
        bodyLines: [],
        panelOmitsHeading: true,
        primaryLabel: "Aggiungi il primo cliente",
        primaryHref: null,
        primaryAction: "create_client",
      };

    case "CHOOSE_START_PATH":
      return {
        ...base,
        phase,
        heroTitle: "Come vuoi iniziare?",
        heroSubtitle:
          "Importa le campagne che gestisci già oppure pianificane una nuova.",
        eyebrow: "",
        title: "",
        bodyLines: ["Scegli il modo più comodo per iniziare."],
        panelOmitsHeading: true,
        primaryLabel: "Importa da Meta",
        primaryHref: clientLink,
        primaryAction: "navigate",
        secondaryLabel: "Pianifica una campagna",
        secondaryHref: "/campagne",
        secondaryAction: "open_campaign_modal",
        startPathCards: true,
      };

    case "META_CONNECTION_REQUIRED":
      return {
        ...base,
        phase,
        heroTitle: "Collega Meta per continuare.",
        heroSubtitle:
          "Così Ally può importare le campagne che stai già gestendo.",
        eyebrow: "PROSSIMO PASSO",
        title: "Collega Meta",
        bodyLines: ["Poi scegli l'account e importa le campagne."],
        primaryLabel: "Collega Meta",
        primaryHref: clientLink,
        primaryAction: "navigate",
        secondaryLabel: "Preferisco pianificare",
        secondaryHref: "/campagne",
        secondaryAction: "open_campaign_modal",
      };

    case "META_IMPORT_REQUIRED":
      return {
        ...base,
        phase,
        heroTitle: "Importa le tue campagne.",
        heroSubtitle:
          "Scegli le campagne Meta che vuoi portare dentro Ally.",
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
        primaryHref: clientLink,
        primaryAction: "navigate",
        secondaryLabel: "Preferisco pianificare",
        secondaryHref: "/campagne",
        secondaryAction: "open_campaign_modal",
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
        heroTitle: "Completa il monitoraggio.",
        heroSubtitle,
        eyebrow: "PROSSIMO PASSO",
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
      };
    }

    case "READY_FOR_FIRST_CONTROL":
      return {
        ...base,
        phase,
        heroTitle: "Ally è pronta.",
        heroSubtitle:
          "La configurazione è completata. Ora servono dati prima di suggerire interventi.",
        eyebrow: "PRONTO",
        title: "Apri Control Room",
        bodyLines: [
          "Ally monitorerà questa campagna appena ci sono abbastanza dati.",
        ],
        primaryLabel: "Apri Control Room",
        primaryHref: "/risultati",
        primaryAction: "navigate",
        showControlRoom: false,
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
      return;
    }
    window.sessionStorage.setItem(SETUP_PATH_STORAGE_KEY, path);
  } catch {
    // ignore
  }
}
