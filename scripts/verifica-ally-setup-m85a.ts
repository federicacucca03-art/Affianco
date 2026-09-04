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
  ["NO_CLIENT", base()],
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
      hasMetaConnection: true,
      hasMetaAdAccount: false,
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

// A
assert(
  deriveAllySetupPhase(base()) === "NO_CLIENT",
  "A no clients → NO_CLIENT",
);
{
  const g = buildAllySetupGuidance(base());
  assert(g.primaryLabel === "Aggiungi il primo cliente", "A primary CTA");
  assert(g.showQuickActions === false, "A no quick actions");
  assert(g.showHeroTools === false, "A no hero tools");
  assert(
    g.heroTitle.includes("primo cliente"),
    "A contextual hero",
  );
  assert(g.heroBadge === "Ciao, sono Ally", "A hero badge");
  assert(!g.heroTitle.includes("Capisci cosa conta"), "A no active hero");
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
  assert(
    !g.bodyLines.some((l) => /obbligatoria/i.test(l)),
    "B no obbligatoria copy",
  );
  assert(
    g.bodyLines.some((l) => /comodo per iniziare/i.test(l)),
    "B soft supporting copy",
  );
}

// C native draft
{
  const phase = deriveAllySetupPhase(
    base({
      hasClient: true,
      hasNativeCampaign: true,
      attentionItems: [
        item({
          attentionState: "CONFIGURATION_REQUIRED",
          configurationKind: "DRAFT",
          href: "/campagne/c1",
        }),
      ],
    }),
  );
  assert(phase === "MONITORING_CONFIGURATION_REQUIRED", "C native draft → config");
  const g = buildAllySetupGuidance(
    base({
      hasClient: true,
      hasNativeCampaign: true,
      attentionItems: [
        item({
          attentionState: "CONFIGURATION_REQUIRED",
          configurationKind: "DRAFT",
          href: "/campagne/c1",
        }),
      ],
    }),
  );
  assert(g.primaryHref === "/campagne/c1", "C draft CTA to campaign");
  assert(g.primaryLabel === "Continua la campagna", "C draft verb CTA");
}

// D meta connected no import
assert(
  deriveAllySetupPhase(
    base({
      hasClient: true,
      hasDbClient: true,
      primaryClientId: "uuid",
      hasMetaConnection: true,
      hasMetaAdAccount: true,
    }),
  ) === "META_IMPORT_REQUIRED",
  "D meta connected mapped → META_IMPORT_REQUIRED",
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
  ) === "META_CONNECTION_REQUIRED",
  "D meta connected no account → META_CONNECTION_REQUIRED",
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
  assert(g.heroTitle.includes("Completa il monitoraggio"), "E target hero");
  assert(/soglia/i.test(g.heroSubtitle), "E target hero subtitle");
  assert(!/configurazione richiesta/i.test(g.title), "E no generic config title");
  assert(g.showQuickActions === false, "E no quick actions");
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
  assert(g.heroTitle.includes("Completa il monitoraggio"), "F result hero");
  assert(/risultato/i.test(g.heroSubtitle), "F result hero subtitle");
}

// Meta heroes
{
  const connect = buildAllySetupGuidance(
    base({
      hasClient: true,
      hasDbClient: true,
      primaryClientId: "uuid",
      hasMetaConnection: true,
      hasMetaAdAccount: false,
    }),
  );
  assert(
    connect.heroTitle.includes("Collega Meta"),
    "META_CONNECTION hero",
  );
  const imp = buildAllySetupGuidance(
    base({
      hasClient: true,
      hasDbClient: true,
      primaryClientId: "uuid",
      hasMetaConnection: true,
      hasMetaAdAccount: true,
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
      /if \(isChoosePath\) \{[\s\S]*?StartPathCards[\s\S]*?checklistVisible/.test(
        panel,
      ),
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
  assert(g.heroTitle.includes("Ally è pronta"), "G ready hero");
  assert(
    /configurazione è completata/i.test(g.heroSubtitle),
    "G complete subtitle",
  );
  assert(/servono dati/i.test(g.heroSubtitle), "G waiting-for-data copy");
  assert(g.primaryLabel.includes("Control Room"), "G CTA Control Room");
  assert(g.showQuickActions === false, "G no quick actions yet");
  assert(!/Capisci cosa conta/i.test(g.heroTitle), "G no active hero");
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

// Search/workspace visibility contract (Home): ACTIVE only
{
  const home = readFileSync(
    "./src/components/dashboard/DashboardHome.tsx",
    "utf8",
  );
  assert(
    /const showSearchShell = isActiveWorkspace;/.test(home),
    "Home search gated to ACTIVE_WORKSPACE only",
  );
  assert(
    !/showSetup && guidance\?\.phase !== "NO_CLIENT"/.test(home),
    "Home no longer shows search during incomplete setup",
  );
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nALL PASS — M8.5A ally-setup");
