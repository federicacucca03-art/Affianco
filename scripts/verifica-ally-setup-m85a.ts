/**
 * M8.5A — derived setup state (no DB, no AI).
 * Run: npx tsx scripts/verifica-ally-setup-m85a.ts
 */
import { readFileSync } from "node:fs";
import {
  buildAllySetupGuidance,
  deriveAllySetupPhase,
  explainMonitoringGap,
  type AllySetupSignals,
} from "../src/lib/ally-setup";
import { buildAllyNavPresentation } from "../src/lib/ally-nav";
import type { ControlRoomAttentionItem } from "../src/lib/monday-control-room";

let failed = 0;

function assert(cond: unknown, msg: string) {
  if (!cond) {
    failed += 1;
    console.error(`FAIL  ${msg}`);
    return;
  }
  console.log(`PASS  ${msg}`);
}

function item(
  partial: Partial<ControlRoomAttentionItem> &
    Pick<ControlRoomAttentionItem, "attentionState">,
): ControlRoomAttentionItem {
  return {
    campaignId: partial.campaignId ?? "c1",
    clientId: partial.clientId ?? "cl1",
    clientName: partial.clientName ?? "Cliente",
    campaignName: partial.campaignName ?? "Campagna",
    source: partial.source ?? "NATIVE",
    campaignStatus: partial.campaignStatus ?? "ACTIVE",
    attentionState: partial.attentionState,
    reason: partial.reason ?? "",
    urgencyLevel: partial.urgencyLevel ?? "LATER",
    urgencyReason: partial.urgencyReason ?? "",
    primaryMetric: partial.primaryMetric ?? null,
    primaryMetricValue: partial.primaryMetricValue ?? null,
    targetValue: partial.targetValue ?? null,
    trend: partial.trend ?? "STABLE",
    lastUpdated: partial.lastUpdated ?? null,
    href: partial.href ?? "/risultati",
    healthStatus: partial.healthStatus ?? null,
    suppressedByLink: partial.suppressedByLink ?? false,
    insightsLastSyncedAt: partial.insightsLastSyncedAt ?? null,
    resultsCount: partial.resultsCount ?? null,
    healthAvailability: partial.healthAvailability ?? null,
    configurationKind: partial.configurationKind ?? null,
  };
}

function base(over: Partial<AllySetupSignals> = {}): AllySetupSignals {
  return {
    hasClient: false,
    hasDbClient: false,
    primaryClientId: null,
    primaryClientName: null,
    hasNativeCampaign: false,
    hasMetaCampaign: false,
    hasMetaConnection: false,
    hasMetaAdAccount: false,
    pathPreference: null,
    attentionItems: [],
    ...over,
  };
}

console.log("\n— UX state dump —");
const states: Array<[string, AllySetupSignals]> = [
  ["CHOOSE_ZERO", base()],
  [
    "NO_CLIENT_PLAN",
    base({ pathPreference: "native" }),
  ],
  [
    "CHOOSE_START_PATH",
    base({
      hasClient: true,
      hasDbClient: true,
      primaryClientId: "uuid",
      primaryClientName: "Studio",
    }),
  ],
  [
    "META_CONNECTION",
    base({
      hasClient: true,
      hasDbClient: true,
      primaryClientId: "uuid",
      hasMetaConnection: false,
      hasMetaAdAccount: false,
      pathPreference: "meta",
    }),
  ],
  [
    "META_IMPORT",
    base({
      hasClient: true,
      hasDbClient: true,
      primaryClientId: "uuid",
      hasMetaConnection: true,
      hasMetaAdAccount: true,
      pathPreference: "meta",
    }),
  ],
  [
    "TARGET",
    base({
      hasClient: true,
      hasMetaCampaign: true,
      attentionItems: [
        item({
          attentionState: "CONFIGURATION_REQUIRED",
          configurationKind: "ACTIVE_MISSING_TARGET",
          source: "META",
        }),
      ],
    }),
  ],
  [
    "RESULT_MAPPING",
    base({
      hasClient: true,
      hasMetaCampaign: true,
      attentionItems: [
        item({
          attentionState: "CONFIGURATION_REQUIRED",
          configurationKind: "RESULT_MAPPING",
          source: "META",
        }),
      ],
    }),
  ],
  [
    "INSUFFICIENT",
    base({
      hasClient: true,
      hasMetaCampaign: true,
      attentionItems: [
        item({ attentionState: "INSUFFICIENT_DATA", source: "META" }),
      ],
    }),
  ],
  [
    "ACTIVE",
    base({
      hasClient: true,
      hasNativeCampaign: true,
      attentionItems: [
        item({
          attentionState: "NEEDS_ATTENTION",
          healthStatus: "YELLOW",
        }),
      ],
    }),
  ],
];

for (const [label, signals] of states) {
  const g = buildAllySetupGuidance(signals);
  console.log(
    `\n[${label}] phase=${g.phase} primary="${g.primaryLabel}" cards=${g.startPathCards} quick=${g.showQuickActions} tools=${g.showHeroTools} checklist=${g.checklistVisible}`,
  );
  console.log(`  hero: ${g.heroTitle}`);
  console.log(`  heroSub: ${g.heroSubtitle}`);
  console.log(`  panelTitle: ${g.title}`);
  for (const line of g.bodyLines) console.log(`  body: ${line}`);
}

// A — brand-new user sees Import vs Plan immediately
assert(
  deriveAllySetupPhase(base()) === "CHOOSE_START_PATH",
  "A zero clients → CHOOSE_START_PATH",
);
{
  const g = buildAllySetupGuidance(base());
  assert(g.startPathCards === true, "A start cards without client");
  assert(g.heroTitle === "Come vuoi iniziare?", "A choose hero");
  assert(g.checklistVisible === false, "A checklist hidden");
  assert(g.showQuickActions === false, "A no quick actions");
  assert(g.showHeroTools === false, "A no hero tools");
  assert(g.heroBadge === "Ciao, sono Ally", "A hero badge");
  assert(!g.heroTitle.includes("Capisci cosa conta"), "A no active hero");
}

assert(
  deriveAllySetupPhase(base({ pathPreference: "native" })) === "NO_CLIENT",
  "A2 plan preference without client → NO_CLIENT",
);
{
  const g = buildAllySetupGuidance(base({ pathPreference: "native" }));
  assert(g.primaryAction === "create_client", "A2 plan asks for client");
  assert(
    g.primaryLabel.toLowerCase().includes("cliente"),
    "A2 primary CTA client",
  );
}

// B
assert(
  deriveAllySetupPhase(
    base({
      hasClient: true,
      hasDbClient: true,
      primaryClientId: "uuid",
      primaryClientName: "Studio",
    }),
  ) === "CHOOSE_START_PATH",
  "B client no campaign → CHOOSE_START_PATH",
);
{
  const g = buildAllySetupGuidance(
    base({
      hasClient: true,
      hasDbClient: true,
      primaryClientId: "uuid",
    }),
  );
  assert(g.startPathCards === true, "B equal path cards");
  assert(g.showQuickActions === false, "B no quick actions");
  assert(g.heroTitle === "Come vuoi iniziare?", "B hero choose path");
  assert(g.panelOmitsHeading === true, "B panel omits duplicate heading");
  assert(g.checklistVisible === false, "B checklist hidden on choose path");
  assert(
    !g.bodyLines.some((l) => /obbligatoria/i.test(l)),
    "B no obbligatoria copy",
  );
  assert(
    g.bodyLines.some((l) => /comodo per iniziare/i.test(l)),
    "B soft supporting copy",
  );
}

// C native draft → unlocks workspace (not Configura Ally / start-choice)
{
  const draftItem = item({
    attentionState: "CONFIGURATION_REQUIRED",
    configurationKind: "DRAFT",
    campaignStatus: "DRAFT",
    source: "NATIVE",
    campaignId: "c1",
    href: "/campagne/c1",
  });
  const phase = deriveAllySetupPhase(
    base({
      hasClient: true,
      hasNativeCampaign: true,
      attentionItems: [draftItem],
    }),
  );
  assert(
    phase === "MONITORING_CONFIGURATION_REQUIRED",
    "C native draft → workspace monitoring (unlocked)",
  );
  const g = buildAllySetupGuidance(
    base({
      hasClient: true,
      hasNativeCampaign: true,
      attentionItems: [draftItem],
    }),
  );
  assert(g.heroTitle === "Capisci cosa conta oggi.", "C workspace hero");
  assert(g.startPathCards === false, "C no start-choice after draft");
  assert(g.showControlRoom === true, "C Control Room with draft config");
  const nav = buildAllyNavPresentation(phase);
  assert(nav.homeLabel === "Home", "C draft unlocks Home label");
  assert(nav.isActiveWorkspace === true, "C draft is workspace");
  assert(nav.showCampagne && nav.showRisultati, "C full nav with draft");
  assert(nav.showImportMetaCta === true, "C Importa da Meta in workspace");
}

// C2 zero drafts → plan_new on choose
{
  const g = buildAllySetupGuidance(
    base({
      hasClient: true,
      hasDbClient: true,
      primaryClientId: "u",
    }),
  );
  assert(g.startPathMode === "plan_new", "C2 plan_new without draft");
  assert(g.heroTitle === "Come vuoi iniziare?", "C2 start hero");
  assert(g.resumeDraftHref === null, "C2 no resume href");
}

// C3 approved is not a resumable draft
{
  const phase = deriveAllySetupPhase(
    base({
      hasClient: true,
      hasNativeCampaign: true,
      attentionItems: [
        item({
          attentionState: "CONFIGURATION_REQUIRED",
          configurationKind: "ACTIVE_MISSING_TARGET",
          campaignStatus: "APPROVED",
          source: "NATIVE",
        }),
      ],
    }),
  );
  assert(
    phase === "MONITORING_CONFIGURATION_REQUIRED",
    "C3 approved → monitoring not choose",
  );
}

// C4 Meta campaign is not a native draft
{
  const g = buildAllySetupGuidance(
    base({
      hasClient: true,
      hasMetaCampaign: true,
      attentionItems: [
        item({
          attentionState: "CONFIGURATION_REQUIRED",
          configurationKind: "ACTIVE_MISSING_TARGET",
          source: "META",
        }),
      ],
    }),
  );
  assert(g.phase === "MONITORING_CONFIGURATION_REQUIRED", "C4 meta → monitoring");
  assert(g.startPathMode === null, "C4 no start path mode");
}

// C5 multiple drafts → most recent first in attention order (for Plan resume)
{
  const g = buildAllySetupGuidance(
    base({
      hasClient: true,
      hasNativeCampaign: true,
      attentionItems: [
        item({
          campaignId: "newer",
          attentionState: "CONFIGURATION_REQUIRED",
          configurationKind: "DRAFT",
          campaignStatus: "DRAFT",
          source: "NATIVE",
        }),
        item({
          campaignId: "older",
          attentionState: "CONFIGURATION_REQUIRED",
          configurationKind: "DRAFT",
          campaignStatus: "DRAFT",
          source: "NATIVE",
        }),
      ],
    }),
  );
  assert(
    g.phase === "MONITORING_CONFIGURATION_REQUIRED",
    "C5 drafts unlock workspace monitoring",
  );
  assert(g.startPathCards === false, "C5 no start cards after unlock");
}

// D Meta readiness alone must NOT auto-select Import branch
assert(
  deriveAllySetupPhase(
    base({
      hasClient: true,
      hasDbClient: true,
      primaryClientId: "uuid",
      hasMetaConnection: true,
      hasMetaAdAccount: true,
    }),
  ) === "CHOOSE_START_PATH",
  "D meta connected mapped without intent → CHOOSE (no auto Import)",
);

assert(
  deriveAllySetupPhase(
    base({
      hasClient: true,
      hasDbClient: true,
      primaryClientId: "uuid",
      hasMetaConnection: true,
      hasMetaAdAccount: false,
    }),
  ) === "CHOOSE_START_PATH",
  "D meta connected no account without intent → CHOOSE",
);

assert(
  deriveAllySetupPhase(
    base({
      hasClient: true,
      hasDbClient: true,
      primaryClientId: "uuid",
      hasMetaConnection: true,
      hasMetaAdAccount: true,
      pathPreference: "meta",
    }),
  ) === "META_IMPORT_REQUIRED",
  "D explicit Import + mapped → META_IMPORT_REQUIRED",
);

assert(
  deriveAllySetupPhase(
    base({
      hasClient: true,
      hasDbClient: true,
      primaryClientId: "uuid",
      hasMetaConnection: false,
      pathPreference: "meta",
    }),
  ) === "META_CONNECTION_REQUIRED",
  "D explicit Import disconnected → META_CONNECTION_REQUIRED",
);

assert(
  deriveAllySetupPhase(
    base({
      hasClient: true,
      hasDbClient: true,
      primaryClientId: "uuid",
      hasMetaConnection: true,
      hasMetaAdAccount: false,
      pathPreference: "meta",
    }),
  ) === "META_IMPORT_REQUIRED",
  "D explicit Import connected no account → account/import phase",
);

// E target missing
{
  const g = buildAllySetupGuidance(
    base({
      hasClient: true,
      hasMetaCampaign: true,
      attentionItems: [
        item({
          attentionState: "CONFIGURATION_REQUIRED",
          configurationKind: "ACTIVE_MISSING_TARGET",
          source: "META",
          href: "/risultati",
        }),
      ],
    }),
  );
  assert(g.phase === "MONITORING_CONFIGURATION_REQUIRED", "E target → config");
  assert(g.primaryLabel === "Imposta soglia", "E CTA Imposta soglia");
  assert(
    g.title.toLowerCase().includes("soglia"),
    "E explains target threshold",
  );
  assert(g.heroTitle.includes("Capisci cosa conta"), "E workspace hero");
  assert(/soglia/i.test(g.heroSubtitle), "E target hero subtitle");
  assert(!/configurazione richiesta/i.test(g.title), "E no generic config title");
  assert(g.showQuickActions === true, "E workspace quick actions");
}

// F result mapping
{
  const expl = explainMonitoringGap(
    item({
      attentionState: "CONFIGURATION_REQUIRED",
      configurationKind: "RESULT_MAPPING",
    }),
  );
  assert(expl.title.toLowerCase().includes("risultato"), "F mapping copy");
  assert(!/mapping/i.test(expl.title + expl.reason), "F no technical mapping");
  assert(expl.cta === "Indica risultato", "F CTA Indica risultato");
  const g = buildAllySetupGuidance(
    base({
      hasClient: true,
      hasMetaCampaign: true,
      attentionItems: [
        item({
          attentionState: "CONFIGURATION_REQUIRED",
          configurationKind: "RESULT_MAPPING",
          source: "META",
        }),
      ],
    }),
  );
  assert(g.heroTitle.includes("Capisci cosa conta"), "F result hero");
  assert(/risultato/i.test(g.heroSubtitle), "F result hero subtitle");
}

// Meta heroes (only after explicit Import intent)
{
  const connect = buildAllySetupGuidance(
    base({
      hasClient: true,
      hasDbClient: true,
      primaryClientId: "uuid",
      hasMetaConnection: false,
      pathPreference: "meta",
    }),
  );
  assert(connect.heroTitle === "Collega Meta", "META_CONNECTION hero");
  assert(
    /da cui vuoi importare/i.test(connect.heroSubtitle),
    "META_CONNECTION subtitle import account",
  );
  assert(connect.secondaryHref === "/home", "META_CONNECTION back to choice");
  const pickAccount = buildAllySetupGuidance(
    base({
      hasClient: true,
      hasDbClient: true,
      primaryClientId: "uuid",
      hasMetaConnection: true,
      hasMetaAdAccount: false,
      pathPreference: "meta",
    }),
  );
  assert(
    pickAccount.heroTitle.includes("account pubblicitario"),
    "META connected → choose ad account hero",
  );
  const imp = buildAllySetupGuidance(
    base({
      hasClient: true,
      hasDbClient: true,
      primaryClientId: "uuid",
      hasMetaConnection: true,
      hasMetaAdAccount: true,
      pathPreference: "meta",
    }),
  );
  assert(imp.heroTitle.includes("Importa le tue campagne"), "META_IMPORT hero");
}

// Start card labels + no duplicate heading in Home wiring
{
  const cards = readFileSync(
    "./src/components/dashboard/FirstClientForm.tsx",
    "utf8",
  );
  assert(cards.includes("Importa campagne da Meta"), "start card meta label");
  assert(
    cards.includes("Pianifica una nuova campagna"),
    "start card plan label",
  );
  assert(
    cards.includes("Continua la campagna in bozza"),
    "start card continue draft label",
  );
  assert(cards.includes("continue_draft"), "start cards mode continue_draft");
  assert(cards.includes("AllyFeatureCard"), "start cards use AllyFeatureCard");
  assert(cards.includes("tone={4}"), "Meta uses objective blue-cyan tone 4");
  assert(cards.includes("tone={3}"), "Plan uses objective violet-pink tone 3");
  assert(!/actionHint/i.test(cards), "no onboarding Continua affordance");
  assert(!/obbligatoria/i.test(cards), "cards no obbligatoria");
  const feature = readFileSync(
    "./src/components/shell/AllyFeatureCard.tsx",
    "utf8",
  );
  assert(!/text-left/.test(feature), "AllyFeatureCard no text-left override");
  assert(!/actionHint/.test(feature), "AllyFeatureCard no actionHint skin");
  assert(feature.includes("aff-quick-card"), "shared aff-quick-card class");
  assert(feature.includes("aff-card-icon"), "shared aff-card-icon class");
  const panel = readFileSync(
    "./src/components/dashboard/HomeSetupPanel.tsx",
    "utf8",
  );
  assert(panel.includes("panelOmitsHeading"), "panel respects omit heading");
  assert(
    /if \(isChoosePath\)/.test(panel) || /startPathCards/.test(panel),
    "choose-path has dedicated layout",
  );
  assert(
    !/isChoosePath[\s\S]{0,400}AllyPanel/.test(panel) ||
      /if \(isChoosePath\) \{[\s\S]*?StartPathCards/.test(panel),
    "choose-path cards not wrapped in AllyPanel",
  );
  // Stronger: StartPathCards must appear before any AllyPanel in choose-path branch
  const chooseIdx = panel.indexOf("isChoosePath");
  const startCardsIdx = panel.indexOf("<StartPathCards");
  const firstPanelIdx = panel.indexOf("<AllyPanel");
  assert(chooseIdx >= 0 && startCardsIdx >= 0, "choose path + cards present");
  assert(
    startCardsIdx < firstPanelIdx,
    "StartPathCards render before AllyPanel (no outer white panel)",
  );
  const griglia = readFileSync(
    "./src/components/GrigliaSituazioni.tsx",
    "utf8",
  );
  assert(
    griglia.includes("AllyFeatureCard"),
    "campagne objectives use AllyFeatureCard",
  );
}

// G insufficient data
assert(
  deriveAllySetupPhase(
    base({
      hasClient: true,
      hasMetaCampaign: true,
      attentionItems: [
        item({ attentionState: "INSUFFICIENT_DATA", source: "META" }),
      ],
    }),
  ) === "READY_FOR_FIRST_CONTROL",
  "G insufficient → READY_FOR_FIRST_CONTROL",
);

{
  const g = buildAllySetupGuidance(
    base({
      hasClient: true,
      hasMetaCampaign: true,
      attentionItems: [
        item({ attentionState: "INSUFFICIENT_DATA", source: "META" }),
      ],
    }),
  );
  assert(g.heroTitle.includes("Capisci cosa conta"), "G ready workspace hero");
  assert(
    /abbastanza dati/i.test(g.heroSubtitle),
    "G waiting-for-data copy",
  );
  assert(g.primaryLabel.includes("Control Room"), "G CTA Control Room");
  assert(g.showQuickActions === true, "G workspace quick actions");
  assert(g.showControlRoom === true, "G ready shows Control Room");
}

// H / I active
assert(
  deriveAllySetupPhase(
    base({
      hasClient: true,
      hasNativeCampaign: true,
      attentionItems: [
        item({
          attentionState: "NEEDS_ATTENTION",
          healthStatus: "YELLOW",
        }),
      ],
    }),
  ) === "ACTIVE_WORKSPACE",
  "H monitored → ACTIVE_WORKSPACE",
);
{
  const g = buildAllySetupGuidance(
    base({
      hasClient: true,
      hasNativeCampaign: true,
      attentionItems: [
        item({
          attentionState: "NEEDS_ATTENTION",
          healthStatus: "YELLOW",
        }),
      ],
    }),
  );
  assert(g.checklistVisible === false, "H no checklist");
  assert(g.showQuickActions === true, "H quick actions restored");
  assert(g.showHeroTools === true, "H hero tools restored");
  assert(g.heroTitle === "Capisci cosa conta oggi.", "H active hero unchanged");
}

// J existing configured — campaigns alone skip NO_CLIENT
assert(
  deriveAllySetupPhase(
    base({
      hasClient: false,
      hasNativeCampaign: true,
      attentionItems: [
        item({ attentionState: "STABLE", healthStatus: "GREEN" }),
      ],
    }),
  ) === "ACTIVE_WORKSPACE",
  "J existing user without local client list → ACTIVE",
);

// Existing user with campaign but target missing stays in config (not choose-start)
assert(
  deriveAllySetupPhase(
    base({
      hasClient: true,
      hasMetaCampaign: true,
      hasMetaConnection: true,
      hasMetaAdAccount: true,
      attentionItems: [
        item({
          attentionState: "CONFIGURATION_REQUIRED",
          configurationKind: "ACTIVE_MISSING_TARGET",
          source: "META",
        }),
      ],
    }),
  ) === "MONITORING_CONFIGURATION_REQUIRED",
  "existing campaign + missing target → config not choose-start",
);

// K native only — Meta not required
{
  const g = buildAllySetupGuidance(
    base({
      hasClient: true,
      hasNativeCampaign: true,
      hasMetaConnection: false,
      attentionItems: [
        item({ attentionState: "STABLE", healthStatus: "GREEN" }),
      ],
    }),
  );
  assert(g.phase === "ACTIVE_WORKSPACE", "K native only active");
  assert(!g.checklistVisible, "K checklist hidden when active");
}

// L meta only
assert(
  deriveAllySetupPhase(
    base({
      hasClient: true,
      hasMetaCampaign: true,
      hasNativeCampaign: false,
      attentionItems: [
        item({
          attentionState: "MONITOR",
          source: "META",
          healthStatus: "YELLOW",
        }),
      ],
    }),
  ) === "ACTIVE_WORKSPACE",
  "L meta only → ACTIVE",
);

// M checklist progress
{
  const g = buildAllySetupGuidance(
    base({
      hasClient: true,
      hasDbClient: true,
      primaryClientId: "uuid",
    }),
  );
  assert(g.checklist[0]?.done === true, "M client step done");
  assert(g.checklist[1]?.done === false, "M campaign step open");
  assert(g.checklist[1]?.current === true, "M campaign is current");
  assert(g.completedCount === 1, "M 1/4");
}

// N no UI-only regression: campaign available keeps campaign done
{
  const g = buildAllySetupGuidance(
    base({
      hasClient: true,
      hasMetaCampaign: true,
      attentionItems: [
        item({
          attentionState: "CONFIGURATION_REQUIRED",
          configurationKind: "ACTIVE_MISSING_TARGET",
        }),
      ],
    }),
  );
  assert(g.checklist[1]?.done === true, "N campaign step stays done");
  assert(g.checklist[2]?.done === false, "N monitoring open");
}

// Priority: target beats choose-start when campaign exists
{
  const g = buildAllySetupGuidance(
    base({
      hasClient: true,
      hasMetaCampaign: true,
      hasMetaConnection: true,
      pathPreference: null,
      attentionItems: [
        item({
          attentionState: "CONFIGURATION_REQUIRED",
          configurationKind: "ACTIVE_MISSING_TARGET",
        }),
      ],
    }),
  );
  assert(g.phase === "MONITORING_CONFIGURATION_REQUIRED", "priority target");
  assert(g.primaryLabel === "Imposta soglia", "priority CTA");
}

// Multi-client: one evaluable campaign → ACTIVE even if another needs config
{
  const g = buildAllySetupGuidance(
    base({
      hasClient: true,
      hasNativeCampaign: true,
      hasMetaCampaign: true,
      attentionItems: [
        item({
          campaignId: "a",
          attentionState: "STABLE",
          healthStatus: "GREEN",
        }),
        item({
          campaignId: "b",
          attentionState: "CONFIGURATION_REQUIRED",
          configurationKind: "ACTIVE_MISSING_TARGET",
          source: "META",
        }),
      ],
    }),
  );
  assert(g.phase === "ACTIVE_WORKSPACE", "multi-client: evaluable wins globally");
}

// Search/workspace visibility: unlocked workspace (not first-run)
{
  const home = readFileSync(
    "./src/components/dashboard/DashboardHome.tsx",
    "utf8",
  );
  assert(
    /isFirstRunOnboardingPhase/.test(home),
    "Home uses first-run vs workspace gate",
  );
  assert(
    /showHeroTools/.test(home),
    "Home search follows workspace showHeroTools",
  );
}

// M8.5A.7 / M8.5C — navigation: onboarding vs workspace unlock
{
  const noClient = buildAllyNavPresentation("NO_CLIENT");
  assert(noClient.homeLabel === "Configura Ally", "NO_CLIENT home label");
  assert(!noClient.showRisultati, "NO_CLIENT hides Risultati");
  assert(!noClient.showNotifiche, "NO_CLIENT hides Notifiche");
  assert(!noClient.showCampagne, "NO_CLIENT hides Campagne");
  assert(!noClient.showNewCampaignCta, "NO_CLIENT hides Nuova campagna");
  assert(!noClient.showImportMetaCta, "NO_CLIENT hides Importa da Meta");
  assert(noClient.showClienti && noClient.showMeta, "NO_CLIENT keeps Clienti+Meta");

  const choose = buildAllyNavPresentation("CHOOSE_START_PATH");
  assert(choose.homeLabel === "Configura Ally", "CHOOSE home label");
  assert(!choose.showCampagne, "CHOOSE hides Campagne (central cards only)");
  assert(!choose.showClienti, "CHOOSE hides Clienti until provisioned");
  assert(choose.showMeta, "CHOOSE keeps Meta");
  assert(!choose.showRisultati && !choose.showNotifiche, "CHOOSE hides Results/Notif");
  assert(!choose.showNewCampaignCta, "CHOOSE hides Nuova campagna");

  for (const phase of [
    "META_CONNECTION_REQUIRED",
    "META_IMPORT_REQUIRED",
  ] as const) {
    const n = buildAllyNavPresentation(phase);
    assert(n.isSetupIncomplete, `${phase} incomplete`);
    assert(n.homeLabel === "Configura Ally", `${phase} Configura Ally`);
    assert(!n.showCampagne, `${phase} hides Campagne until import`);
    assert(!n.showRisultati, `${phase} hides Risultati`);
    assert(!n.showNotifiche, `${phase} hides Notifiche`);
    assert(n.showMeta, `${phase} shows Meta`);
    assert(!n.showNewCampaignCta, `${phase} hides CTA`);
  }

  for (const phase of [
    "MONITORING_CONFIGURATION_REQUIRED",
    "READY_FOR_FIRST_CONTROL",
    "ACTIVE_WORKSPACE",
  ] as const) {
    const n = buildAllyNavPresentation(phase);
    assert(n.isActiveWorkspace, `${phase} workspace unlocked`);
    assert(n.homeLabel === "Home", `${phase} Home label`);
    assert(n.showCampagne, `${phase} shows Campagne`);
    assert(n.showRisultati, `${phase} shows Risultati`);
    assert(n.showNotifiche, `${phase} shows Notifiche`);
    assert(n.showNewCampaignCta, `${phase} shows Nuova campagna`);
    assert(n.showImportMetaCta, `${phase} shows Importa da Meta`);
  }

  const loading = buildAllyNavPresentation(null);
  assert(loading.homeLabel === "Home", "loading keeps full workspace nav");

  const sidebar = readFileSync(
    "./src/components/shell/SecondarySidebar.tsx",
    "utf8",
  );
  assert(
    /Importa da Meta/.test(sidebar),
    "Sidebar has Importa da Meta workspace action",
  );
  assert(
    /showImportMetaCta/.test(sidebar),
    "Sidebar gates Importa da Meta CTA",
  );
  assert(
    /startMetaImportFlow|preferredClientIdFromPathname/.test(sidebar),
    "Sidebar Import uses safe client-scoped import flow",
  );

  const home = readFileSync(
    "./src/components/dashboard/DashboardHome.tsx",
    "utf8",
  );
  assert(
    /function chooseContinueDraft|onContinueDraft|resumeDraftHref/.test(home),
    "Home continue draft opens exact draft route",
  );
  assert(
    /setup=plan|searchParams\.get\(["']setup["']\)/.test(home),
    "Home uses ?setup= for explicit Plan branch",
  );
  assert(
    /pathPreference:\s*null/.test(home),
    "Neutral /home forces pathPreference null (no auto branch)",
  );
  assert(
    /function chooseNative\(\)[\s\S]*?apriModaleCampagna\(\)/.test(home),
    "Home plan card opens campaign creation modal",
  );
  assert(
    !/function chooseNative\(\)[\s\S]*?router\.push\(["']\/campagne["']\)/.test(
      home,
    ),
    "Home plan card does not route via /campagne listing",
  );

  const clientDetail = readFileSync(
    "./src/app/clienti/[id]/page.tsx",
    "utf8",
  );
  assert(
    /campagne\/nuova\/richieste-contatto/.test(clientDetail),
    "Client plan path enters creation route",
  );
  assert(
    !/router\.push\(["']\/campagne["']\)/.test(clientDetail),
    "Client plan path skips /campagne listing",
  );

  const rail = readFileSync("./src/components/shell/IconRail.tsx", "utf8");
  assert(
    /useAllySetupNav/.test(rail) && /allyNavItemVisible/.test(rail),
    "IconRail uses progressive nav",
  );
  const header = readFileSync("./src/components/BarraSuperiore.tsx", "utf8");
  assert(
    /nav\.showNotifiche/.test(header),
    "Header bell gated like Notifiche nav",
  );
  assert(
    /showNewCampaignCta/.test(sidebar),
    "Sidebar gates Nuova campagna CTA",
  );
  assert(
    !/redirect.*\/risultati|router\.replace\("\/home"\)/.test(sidebar),
    "No hard route blocking in sidebar",
  );
}

// M8.5A.8 — checklist hidden during early / mid onboarding
{
  const phases: Array<[string, ReturnType<typeof buildAllySetupGuidance>]> = [
    ["CHOOSE_ZERO", buildAllySetupGuidance(base())],
    [
      "NO_CLIENT",
      buildAllySetupGuidance(base({ pathPreference: "native" })),
    ],
    [
      "CHOOSE_START_PATH",
      buildAllySetupGuidance(
        base({ hasClient: true, hasDbClient: true, primaryClientId: "u" }),
      ),
    ],
    [
      "META_CONNECTION",
      buildAllySetupGuidance(
        base({
          hasClient: true,
          hasDbClient: true,
          pathPreference: "meta",
          hasMetaConnection: false,
        }),
      ),
    ],
    [
      "META_IMPORT",
      buildAllySetupGuidance(
        base({
          hasClient: true,
          hasDbClient: true,
          hasMetaConnection: true,
          hasMetaAdAccount: true,
          pathPreference: "meta",
        }),
      ),
    ],
    [
      "MONITORING",
      buildAllySetupGuidance(
        base({
          hasClient: true,
          hasNativeCampaign: true,
          attentionItems: [
            item({
              attentionState: "CONFIGURATION_REQUIRED",
              configurationKind: "ACTIVE_MISSING_TARGET",
            }),
          ],
        }),
      ),
    ],
    [
      "READY",
      buildAllySetupGuidance(
        base({
          hasClient: true,
          hasMetaCampaign: true,
          attentionItems: [
            item({ attentionState: "INSUFFICIENT_DATA", source: "META" }),
          ],
        }),
      ),
    ],
    [
      "ACTIVE",
      buildAllySetupGuidance(
        base({
          hasClient: true,
          hasNativeCampaign: true,
          attentionItems: [
            item({ attentionState: "STABLE", healthStatus: "GREEN" }),
          ],
        }),
      ),
    ],
  ];
  for (const [label, g] of phases) {
    assert(g.checklistVisible === false, `${label} checklistVisible=false`);
  }

  const panelSrc = readFileSync(
    "./src/components/dashboard/HomeSetupPanel.tsx",
    "utf8",
  );
  const chooseBranch = panelSrc.slice(
    panelSrc.indexOf("if (isChoosePath)"),
    panelSrc.indexOf("return (", panelSrc.indexOf("if (isChoosePath)") + 1) > 0
      ? panelSrc.indexOf("\n  return (", panelSrc.indexOf("if (isChoosePath)"))
      : panelSrc.length,
  );
  // Choose-path branch must not mount AllySetupChecklist
  const chooseStart = panelSrc.indexOf("if (isChoosePath)");
  const chooseEnd = panelSrc.indexOf("\n  return (", chooseStart + 1);
  const chooseSrc = panelSrc.slice(chooseStart, chooseEnd);
  assert(
    !chooseSrc.includes("AllySetupChecklist"),
    "CHOOSE_START_PATH layout omits checklist component",
  );
  assert(
    panelSrc.includes("AllySetupChecklist"),
    "AllySetupChecklist retained for gated later use",
  );
  assert(
    /space-y-4/.test(chooseSrc) || /space-y-4/.test(panelSrc),
    "choose-path spacing tightened after checklist removal",
  );
  void chooseBranch;
}

// M8.5A.9 — brand + Meta import entry (no Affianco UX, no native-campaign gate)
{
  const metaPanel = readFileSync(
    "./src/components/clienti/PannelloAccountMetaCliente.tsx",
    "utf8",
  );
  assert(!/Affianco/.test(metaPanel), "Meta panel: no Affianco brand");
  assert(
    !/Crea una campagna per poterlo collegare/.test(metaPanel),
    "Meta panel: no native-campaign requirement copy",
  );
  assert(/Collega Meta/.test(metaPanel), "Meta panel: Collega Meta guidance");
  assert(
    /Scegli l.account pubblicitario|Scegli l&apos;account pubblicitario|Scegli account pubblicitario/.test(
      metaPanel,
    ),
    "Meta panel: ad account guidance",
  );
  assert(/Importa campagne/.test(metaPanel), "Meta panel: import CTA");

  const clientPage = readFileSync("./src/app/clienti/[id]/page.tsx", "utf8");
  assert(
    /resolveDbClientId|\.eq\("id",/.test(clientPage),
    "Client page resolves DB id by UUID first",
  );
  assert(/focusMeta|focus=meta/.test(clientPage), "Client page honors Meta focus");
  assert(
    /showStartCards/.test(clientPage),
    "Meta focus skips competing start cards",
  );

  const homeSrc = readFileSync(
    "./src/components/dashboard/DashboardHome.tsx",
    "utf8",
  );
  assert(
    /startMetaImportFlow|ensureMetaImportClient/.test(homeSrc),
    "Home Import auto-provisions canonical client",
  );
  assert(
    /startMetaImportFlow|applyMetaImportStart/.test(homeSrc),
    "Home Import starts OAuth or Meta panel without client form",
  );

  const importHelper = readFileSync("./src/lib/meta-import-client.ts", "utf8");
  assert(
    /trovaOCreaCliente/.test(importHelper),
    "Import client uses canonical DB creation",
  );
  assert(
    /Cliente Meta/.test(importHelper),
    "Import uses placeholder display name before Meta account",
  );
  assert(
    /startMetaImportFlow/.test(importHelper),
    "Canonical startMetaImportFlow present",
  );
  assert(
    /Never pick an arbitrary|never pick an arbitrary|Never pick an arbitrary named/i.test(
      importHelper,
    ) || !/\.order\("created_at"[\s\S]*maybeSingle/.test(importHelper),
    "Generic Import does not pick arbitrary first client",
  );

  const settingsMeta = readFileSync(
    "./src/components/impostazioni/PannelloIntegrazioneMeta.tsx",
    "utf8",
  );
  assert(
    /Importa campagne da Meta/.test(settingsMeta),
    "Settings Meta title is import-first",
  );
  assert(/Collega Meta/.test(settingsMeta), "Settings primary Collega Meta");
  assert(
    !/Continua su cliente/.test(settingsMeta),
    "Settings Continua su cliente removed",
  );
  assert(
    !/Apri il cliente/.test(settingsMeta),
    "Settings Apri il cliente copy removed",
  );
  assert(
    !/Aggiungi prima un cliente/.test(settingsMeta),
    "Settings no manual client prerequisite",
  );
  assert(
    /startMetaImportFlow/.test(settingsMeta),
    "Settings uses canonical zero-client import flow",
  );

  const accountsLib = readFileSync(
    "./src/lib/meta/client-accounts.ts",
    "utf8",
  );
  assert(
    /findClientIdByMetaAdAccount/.test(accountsLib),
    "Ad account reuse lookup present",
  );
  assert(
    /Cliente Meta/.test(accountsLib),
    "Placeholder client renamed from Meta account name",
  );

  assert(
    deriveAllySetupPhase(
      base({
        hasClient: true,
        hasDbClient: true,
        hasMetaCampaign: true,
        attentionItems: [
          item({ attentionState: "STABLE", healthStatus: "GREEN" }),
        ],
      }),
    ) === "ACTIVE_WORKSPACE",
    "Imported Meta campaign can reach ACTIVE",
  );

  assert(
    deriveAllySetupPhase(base({ pathPreference: "meta" })) ===
      "META_CONNECTION_REQUIRED",
    "Meta preference alone → Import branch (connect), client provisioned on click",
  );

  const oauth = readFileSync("./src/lib/meta/oauth.ts", "utf8");
  assert(
    /set\("focus", "meta"\)/.test(oauth),
    "OAuth return keeps Meta focus on client",
  );

  for (const f of [
    "./src/app/layout.tsx",
    "./src/app/login/LoginForm.tsx",
    "./src/app/impostazioni/integrazioni/page.tsx",
    "./src/components/clienti/PannelloAccountMetaCliente.tsx",
  ]) {
    const src = readFileSync(f, "utf8");
    assert(!/\bAffianco\b/.test(src), `no Affianco in ${f}`);
  }

  const metaConn = buildAllySetupGuidance(
    base({
      hasClient: true,
      hasDbClient: true,
      primaryClientId: "uuid-1",
      pathPreference: "meta",
      hasMetaConnection: false,
    }),
  );
  assert(
    metaConn.primaryHref?.includes("focus=meta"),
    "META_CONNECTION primaryHref carries client Meta focus",
  );

  const route = readFileSync(
    "./src/app/api/meta/client-account/route.ts",
    "utf8",
  );
  assert(
    /META_ACCOUNT_ALREADY_MAPPED/.test(route),
    "API rejects duplicate ad-account mapping across clients",
  );
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nALL PASS — M8.5A ally-setup");
