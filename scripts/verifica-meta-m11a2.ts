/**
 * M11A.2 — Permission upgrade + first safe Meta write regression.
 * LIVE META WRITES DURING TESTS: 0
 * Avoids importing server-only Graph/OAuth modules.
 * Esegui: npx tsx scripts/verifica-meta-m11a2.ts
 */
process.env.META_WRITES_LIVE ||= "0";

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  buildMetaWritePreview,
  connectionHasAdsManagement,
} from "../src/lib/meta/write/preview";
import { isMetaCreateWriteEligible } from "../src/lib/meta/write/eligibility";
import { normalizeMetaWriteError } from "../src/lib/meta/write/error-normalize";
import { META_WRITE_SAFE_STATUS } from "../src/lib/meta/write/types";
import type { MetaWritePlanInput } from "../src/lib/meta/write/types";
import { resolveWriteSchedule } from "../src/lib/meta/write/schedule";
import {
  writeUpgradeScopesComplete,
  assertWriteUpgradeScopesForPersist,
} from "../src/lib/meta/scopes";
import {
  isObjectiveOptimizationSupported,
  validateWriteObjectiveConfiguration,
} from "../src/lib/meta/write/objective-matrix";
import {
  resolveMetaBidStrategy,
  META_BID_STRATEGY_LOWEST_COST_WITHOUT_CAP,
  BID_AMOUNT_REQUIRED_WITH_LOWEST_COST_WITHOUT_CAP,
  LOWEST_COST_WITHOUT_CAP_SUPPORTED,
} from "../src/lib/meta/write/bid-strategy";
import {
  resolveMetaAudienceMode,
  META_ADVANTAGE_AUDIENCE_ON,
  META_ADVANTAGE_AUDIENCE_OFF,
} from "../src/lib/meta/write/audience-mode";
import { resolveWriteAgeFields } from "../src/lib/meta/write/age-model";

let falliti = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    falliti += 1;
    console.error(`FAIL  ${msg}`);
  } else {
    console.log(`PASS  ${msg}`);
  }
}
function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}
function exists(rel: string): boolean {
  return existsSync(join(process.cwd(), rel));
}

function basePlan(overrides: Partial<MetaWritePlanInput> = {}): MetaWritePlanInput {
  return {
    allyCampaignId: "11111111-1111-4111-8111-111111111111",
    clientId: "22222222-2222-4222-8222-222222222222",
    campaignName: "QA Contatti M11A2",
    objectiveRaw: "LEADS",
    destination: "META_LEAD_FORM",
    destinationUrl: null,
    pageId: "page-1",
    formId: "form-1",
    whatsappNumber: null,
    budgetDailyMajor: 20,
    budgetLevel: "AD_SET",
    specialAdCategories: { kind: "NONE" },
    citta: "Roma",
    raggioKm: 20,
    countryCode: "IT",
    metaGeoKey: "2421836",
    geoLabel: null,
    etaMin: 25,
    etaMax: 55,
    placementsAdvantage: true,
    startAtIso: "2026-12-01T09:00:00.000Z",
    endAtIso: null,
    creativitaCount: 0,
    targetType: "B2C",
    isImportedMetaOnly: false,
    existingMetaCampaignId: null,
    partialHierarchyPending: false,
    writeHierarchyCompleted: false,
    grantedScopes: ["ads_read", "ads_management"],
    hasMetaConnection: true,
    hasAdAccount: true,
    adAccountCurrency: "EUR",
    adAccountTimezone: "Europe/Rome",
    buyingType: "AUCTION",
    ...overrides,
  };
}

console.log("\n=== M11A.2 PERMISSION + SAFE WRITE ===\n");

{
  const oauth = read("src/lib/meta/oauth.ts");
  assert(oauth.includes('META_REQUIRED_SCOPE = "ads_read"'), "READ scope ads_read");
  assert(oauth.includes('META_WRITE_SCOPE = "ads_management"'), "WRITE scope ads_management");
  assert(oauth.includes("write_upgrade"), "write_upgrade purpose supported");
  assert(!/searchParams\.set\(\s*["']scope["']/.test(oauth), "no silent scope URL param");
  const cfg = read("src/lib/meta/config.ts");
  assert(cfg.includes("META_WRITE_LOGIN_CONFIG_ID"), "separate write login config");
  assert(cfg.includes("isMetaWritesLiveEnabled"), "live writes gate");
  assert(cfg.includes('=== "1"'), "META_WRITES_LIVE requires explicit 1");
}

{
  assert(
    !connectionHasAdsManagement(["ads_read"]),
    "permission missing blocks write capability",
  );
  const p = buildMetaWritePreview(
    basePlan({ grantedScopes: ["ads_read"] }),
  );
  assert(!p.canWrite, "canWrite false without ads_management");
  assert(p.canPreview, "preview still available");
  assert(
    p.readinessCodes.includes("MISSING_META_PERMISSION"),
    "MISSING_META_PERMISSION",
  );
}

{
  // permission granted mocked
  const p = buildMetaWritePreview(basePlan());
  assert(p.canWrite, "canWrite true when ready + ads_management");
  assert(p.adsManagementPresent, "adsManagementPresent true");
  assert(p.readinessCodes.includes("READY_TO_WRITE"), "READY_TO_WRITE");
  assert(p.campaign?.status === "PAUSED", "campaign PAUSED");
  assert(p.adSet?.status === "PAUSED", "adset PAUSED");
  assert(p.adSet?.daily_budget === 2000, "budget 20 EUR → 2000");
  assert(p.creative.enabled === false, "creative disabled");
  assert(p.ad.enabled === false, "ad disabled");
}

{
  // M11A.2E — objective × optimization matrix
  const matrix = read("src/lib/meta/write/objective-matrix.ts");
  assert(matrix.includes("OUTCOME_AWARENESS"), "OBJECTIVE MATRIX awareness");
  assert(matrix.includes("OUTCOME_TRAFFIC"), "OBJECTIVE MATRIX traffic");
  assert(matrix.includes("LINK_CLICKS"), "OBJECTIVE MATRIX link clicks");

  const badAwareness = buildMetaWritePreview(
    basePlan({
      objectiveRaw: "AWARENESS",
      destination: "WEBSITE",
      destinationUrl: "https://affianco.vercel.app",
      pageId: null,
      formId: null,
    }),
  );
  // Resolver must not emit LINK_CLICKS for awareness+website
  assert(
    badAwareness.adSet?.optimization_goal !== "LINK_CLICKS",
    "AWARENESS + WEBSITE does not resolve LINK_CLICKS",
  );
  assert(
    badAwareness.adSet?.optimization_goal === "REACH",
    "AWARENESS + WEBSITE → REACH",
  );

  // Force invalid combo via raw OUTCOME_AWARENESS still gets REACH from resolver;
  // matrix blocks if somehow LINK_CLICKS were paired — verify TRAFFIC path ready.
  const traffic = buildMetaWritePreview(
    basePlan({
      objectiveRaw: "OUTCOME_TRAFFIC",
      destination: "WEBSITE",
      destinationUrl: "https://affianco.vercel.app",
      pageId: null,
      formId: null,
    }),
  );
  assert(
    traffic.adSet?.optimization_goal === "LINK_CLICKS",
    "TRAFFIC + LINK_CLICKS supported",
  );
  assert(
    traffic.adSet?.billing_event === "IMPRESSIONS",
    "TRAFFIC + LINK_CLICKS bills IMPRESSIONS",
  );
  assert(traffic.canWrite, "TRAFFIC + WEBSITE + LINK_CLICKS → canWrite");
  assert(
    traffic.readinessCodes.includes("READY_TO_WRITE"),
    "TRAFFIC config READY_TO_WRITE",
  );

  const awarenessReach = buildMetaWritePreview(
    basePlan({
      objectiveRaw: "AWARENESS",
      destination: "WEBSITE",
      destinationUrl: "https://affianco.vercel.app",
      pageId: null,
      formId: null,
    }),
  );
  assert(
    awarenessReach.adSet?.optimization_goal === "REACH",
    "AWARENESS + REACH supported",
  );
  assert(
    awarenessReach.canWrite,
    "AWARENESS + REACH + WEBSITE canWrite when other gates pass",
  );

  // Static matrix rejects AWARENESS + LINK_CLICKS
  assert(
    !isObjectiveOptimizationSupported("OUTCOME_AWARENESS", "LINK_CLICKS"),
    "AWARENESS + LINK_CLICKS blocked in matrix",
  );
  assert(
    isObjectiveOptimizationSupported("OUTCOME_AWARENESS", "REACH"),
    "AWARENESS + REACH in matrix",
  );
  assert(
    isObjectiveOptimizationSupported("OUTCOME_AWARENESS", "IMPRESSIONS"),
    "AWARENESS + IMPRESSIONS in matrix",
  );
  assert(
    isObjectiveOptimizationSupported("OUTCOME_TRAFFIC", "LINK_CLICKS"),
    "TRAFFIC + LINK_CLICKS in matrix",
  );
  const cross = validateWriteObjectiveConfiguration({
    metaObjective: "OUTCOME_AWARENESS",
    destination: "WEBSITE",
    optimizationGoal: "LINK_CLICKS",
  });
  assert(!cross.ok, "invalid cross-level never ok");
}

{
  // write-upgrade pre-persist scope gate (ads_read + ads_management)
  assert(
    writeUpgradeScopesComplete(["ads_read", "ads_management"]),
    "write upgrade: ads_read + ads_management → persist eligible",
  );
  assert(
    !writeUpgradeScopesComplete(["ads_read"]),
    "write upgrade: ads_read only → reject before persist",
  );
  assert(
    !writeUpgradeScopesComplete(["ads_management"]),
    "write upgrade: ads_management only → reject before persist",
  );
  assert(
    !writeUpgradeScopesComplete([]),
    "write upgrade: neither → reject",
  );
  let threw = false;
  try {
    assertWriteUpgradeScopesForPersist(["ads_read"]);
  } catch {
    threw = true;
  }
  assert(threw, "assertWriteUpgradeScopesForPersist throws on ads_read-only");
  threw = false;
  try {
    assertWriteUpgradeScopesForPersist(["ads_management"]);
  } catch {
    threw = true;
  }
  assert(threw, "assertWriteUpgradeScopesForPersist throws on ads_management-only");
  threw = false;
  try {
    assertWriteUpgradeScopesForPersist(["ads_read", "ads_management"]);
  } catch {
    threw = true;
  }
  assert(!threw, "full grant does not throw — eligible to persist");
}

{
  // permission denied / partial grant mocked — ads_management absent
  const denied = buildMetaWritePreview(
    basePlan({ grantedScopes: ["ads_read", "pages_show_list"] }),
  );
  assert(!denied.canWrite, "partial grant without ads_management → blocked");
  assert(!denied.adsManagementPresent, "partial: adsManagementPresent false");
  assert(
    denied.readinessCodes.includes("MISSING_META_PERMISSION"),
    "partial → MISSING_META_PERMISSION",
  );
}

{
  // ads_read preservation + write gate + oauth hardening (static)
  const oauth = read("src/lib/meta/oauth.ts");
  assert(
    oauth.includes("assertMetaConnectionHasScope") &&
      oauth.includes("META_REQUIRED_SCOPE"),
    "persist requires ads_read",
  );
  const cb = read("src/app/api/meta/oauth/callback/route.ts");
  assert(cb.includes('purpose === "write_upgrade"'), "callback checks purpose");
  assert(
    cb.includes("assertWriteUpgradeScopesForPersist"),
    "write_upgrade verifies scopes BEFORE persist",
  );
  // Call sites (not imports): gate must run before persist on write_upgrade.
  const assertIdx = cb.indexOf("assertWriteUpgradeScopesForPersist(debug.scopes)");
  const persistIdx = cb.indexOf("await persistExchangedMetaConnection(");
  assert(
    assertIdx >= 0 && persistIdx > assertIdx,
    "pre-persist gate runs before saveMetaConnection path",
  );
  assert(cb.includes("inspectMetaUserToken"), "callback uses debug_token");
  assert(cb.includes('"expired"'), "expired state redirects with meta=expired");
  assert(
    !cb.includes("m11a2b-oauth-diag"),
    "no diagnostic route reference in callback",
  );
  const stateSrc = read("src/lib/meta/oauth-state.ts");
  assert(
    stateSrc.includes("META_OAUTH_STATE_TTL_SEC = 10 * 60"),
    "STATE TTL remains 600 seconds",
  );
  assert(
    stateSrc.includes("L'autorizzazione Meta è scaduta"),
    "expired state Italian copy in oauth-state",
  );
  const panel = read("src/components/clienti/PannelloAccountMetaCliente.tsx");
  assert(
    panel.includes("L'autorizzazione Meta è scaduta"),
    "expired state Italian copy in UI",
  );
  assert(
    !exists("src/app/api/internal/qa/m11a2a-v26/route.ts"),
    "temporary M11A.2 QA route removed",
  );
  const ex = read("src/lib/meta/write/execute.ts");
  assert(ex.includes("LIVE_WRITES_GATED"), "LIVE_WRITES_GATED when writes off");
  assert(ex.includes("isMetaWritesLiveEnabled"), "write gate function used");
  assert(
    process.env.META_WRITES_LIVE !== "1",
    "write gate disabled during this regression (META_WRITES_LIVE≠1)",
  );
  const ui = read("src/components/campagne/MetaWritePreviewPanel.tsx");
  assert(ui.includes("useEffect"), "hydrate on mount via useEffect");
  assert(ui.includes("hydrateFromServer"), "mount hydrates canonical");
  // Mount effect only hydrates — oauth stays behind explicit CTA
  const mountEffect = ui.match(
    /useEffect\(\(\)\s*=>\s*\{[\s\S]*?\},\s*\[[^\]]*\]\)/,
  );
  assert(Boolean(mountEffect), "mount useEffect present");
  assert(
    Boolean(mountEffect && !mountEffect[0].includes("oauth/start")),
    "no auto oauth on mount",
  );
  assert(ui.includes('purpose: "write_upgrade"'), "CTA uses write_upgrade only");
  assert(
    !read("src/lib/ally-copilot/load-context.ts").includes("write_upgrade"),
    "Ask Ally no write oauth",
  );
  assert(
    !read("src/app/approvazione/[token]/page.tsx").includes("write_upgrade"),
    "approval page no write oauth",
  );
}

{
  const elig = isMetaCreateWriteEligible({
    isImportedMetaOnly: true,
    existingMetaCampaignId: null,
  });
  assert(!elig.ok && elig.reason === "IMPORTED_META_NOT_ELIGIBLE", "Technon-like blocked");
  const linked = isMetaCreateWriteEligible({
    isImportedMetaOnly: false,
    existingMetaCampaignId: "120000",
  });
  assert(!linked.ok && linked.reason === "ALREADY_LINKED_META", "already linked blocked");
  const p = buildMetaWritePreview(
    basePlan({ existingMetaCampaignId: "120000" }),
  );
  assert(!p.canWrite && !p.canPreview, "linked: no preview create path");
  assert(p.readinessCodes.includes("ALREADY_LINKED_META"), "ALREADY_LINKED_META code");
}

{
  const a = buildMetaWritePreview(basePlan());
  const b = buildMetaWritePreview(basePlan({ budgetDailyMajor: 25 }));
  assert(a.fingerprint !== b.fingerprint, "fingerprint changes with budget");
}

{
  const past = resolveWriteSchedule({
    startAtIso: "2020-01-01T00:00:00.000Z",
    endAtIso: null,
    timezoneName: "Europe/Rome",
    nowMs: Date.parse("2026-09-20T00:00:00.000Z"),
  });
  assert(!past.ok && past.reason === "PAST_SCHEDULE", "past schedule blocked");
}

{
  const n = normalizeMetaWriteError({ graphCode: 190 });
  assert(n.category === "TOKEN", "token error category");
  const p = normalizeMetaWriteError({ localCode: "PARTIAL_HIERARCHY" });
  assert(p.category === "PARTIAL_HIERARCHY", "partial hierarchy");
  const perm = normalizeMetaWriteError({ graphCode: 200 });
  assert(perm.category === "PERMISSION", "permission category");
}

{
  const gw = read("src/lib/meta/write/graph-write.ts");
  assert(gw.includes("META_WRITE_SAFE_STATUS"), "PAUSED via safe status constant");
  assert(!/["']ACTIVE["']/.test(gw), "no ACTIVE status string");
  assert(!gw.includes("/adcreatives"), "no creative create");
  assert(!gw.includes("/adimages"), "no image upload");
  assert(!gw.includes("/advideos"), "no video upload");
  assert(gw.includes("/campaigns"), "campaign create path");
  assert(gw.includes("/adsets"), "adset create path");
  assert(gw.includes("MetaGraphWriteTransport"), "injectable transport");
  assert(gw.includes('["validate_only"]'), "validate_only execution option");
  assert(gw.includes("validateMetaCampaignPaused"), "campaign validate helper");
  assert(gw.includes("validateMetaAdSetPaused"), "adset validate helper");
}

{
  const ex = read("src/lib/meta/write/execute.ts");
  assert(ex.includes("isMetaWritesLiveEnabled"), "live gate");
  assert(ex.includes("PARTIALLY_CREATED"), "partial failure state");
  assert(ex.includes("assertPreviewFingerprintMatch"), "stale fingerprint");
  assert(ex.includes("COMPLETED"), "completed state");
  assert(!ex.includes('method: "DELETE"'), "no automatic rollback DELETE");
  assert(ex.includes("validateMetaAdSetPaused"), "adset validate before create");
}

{
  const ui = read("src/components/campagne/MetaWritePreviewPanel.tsx");
  assert(ui.includes("Autorizza creazione su Meta"), "upgrade CTA");
  assert(ui.includes("Autorizzazione Meta attiva"), "authorized status");
  assert(ui.includes("Conferma creazione su Meta"), "confirm CTA");
  assert(ui.includes("confirmEnabled"), "confirm gate variable");
  assert(ui.includes("formDirty"), "stale form disables confirm");
  assert(ui.includes("hydrate: true"), "hydrate from canonical");
  assert(ui.includes("verifiedFingerprint"), "fingerprint-bound confirm");
  assert(ui.includes("non attivo"), "PAUSED human copy");
  assert(ui.includes("Cerca su Meta"), "geo search UI");
  assert(ui.includes("Riepilogo finale"), "final human summary");
  assert(
    !ui.includes("graph.facebook.com") && !ui.includes("META_TOKEN"),
    "no Meta token/graph URL in UI",
  );
  assert(
    ui.includes("Configurazione verificata anche da Meta"),
    "meta validation UX copy",
  );
}

{
  const conf = read("src/app/api/meta/write-confirm/route.ts");
  assert(conf.includes("humanConfirmed"), "human confirmation required");
  assert(conf.includes("confirmAndExecuteMetaWrite"), "server execute path");
  assert(conf.includes("metaWrites"), "metaWrites reported");
  assert(
    conf.includes("canonical") ||
      read("src/lib/meta/write/execute.ts").includes("hydrateFromCanonical"),
    "confirm uses canonical plan",
  );
  assert(
    read("src/app/api/meta/oauth/start/route.ts").includes("write_upgrade"),
    "oauth start purpose",
  );
}

{
  const load = read("src/lib/meta/write/load-preview.ts");
  assert(load.includes("hydrateFromCanonical"), "hydrate path");
  assert(load.includes("loadPersistedCanonicalPlan"), "persisted plan load");
}

{
  // Visible blocker → confirm disabled
  const ui = read("src/components/campagne/MetaWritePreviewPanel.tsx");
  assert(ui.includes("hasVisibleUnresolved"), "visible unresolved helper");
  assert(ui.includes("unresolvedVisible"), "visible blocker wired");
  assert(
    ui.includes("!unresolvedVisible") && ui.includes("confirmEnabled"),
    "server READY + visible stale → confirm disabled",
  );
}

{
  const geo = read("src/lib/meta/write/geo-search.ts");
  assert(geo.includes("adgeolocation"), "targeting search type");
}

{
  // M11A.2H — partial recovery + destination omit + resume
  const ops = read("src/lib/meta/write/operations.ts");
  assert(ops.includes("getProtectedMetaWriteOperation"), "protected op lookup");
  assert(ops.includes("preservedWriteState"), "preview preserves protected state");
  assert(
    ops.includes('"PARTIALLY_CREATED"') &&
      ops.includes('"COMPLETED"') &&
      ops.includes('"IN_PROGRESS"') &&
      ops.includes('"CONFIRMED"'),
    "protected states include PARTIAL/COMPLETED/IN_PROGRESS/CONFIRMED",
  );
  assert(
    ops.includes("never state / Meta IDs"),
    "preview must not mutate state/Meta IDs",
  );

  const ex = read("src/lib/meta/write/execute.ts");
  assert(
    ex.includes("getProtectedMetaWriteOperation"),
    "execute prefers protected recovery row",
  );
  assert(ex.includes("if (!metaCampaignId)"), "campaign create skipped when id present");

  const trafficFixed = buildMetaWritePreview(
    basePlan({
      objectiveRaw: "OUTCOME_TRAFFIC",
      destination: "WEBSITE",
      destinationUrl: "https://affianco.vercel.app",
      pageId: null,
      formId: null,
    }),
  );
  assert(
    trafficFixed.adSet?.destination_type == null,
    "TRAFFIC + WEBSITE → no destination_type=WEBSITE",
  );
  assert(
    trafficFixed.summaryIt.adSetLines.some((l) =>
      l.includes("URL da definire nella creatività"),
    ),
    "human destination copy for website creative deferral",
  );
  assert(
    trafficFixed.summaryIt.adSetLines.some((l) =>
      l.includes("Ad Set destination_type: Non inviato"),
    ),
    "technical destination_type omitted in summary",
  );

  const ui = read("src/components/campagne/MetaWritePreviewPanel.tsx");
  assert(
    ui.includes("Sito web — URL da definire nella creatività"),
    "panel human destination copy",
  );

  assert(
    !exists("src/lib/meta/m11a2a-v26-qa.ts") &&
      !exists("src/app/api/internal/qa/m11a2a-v26/route.ts"),
    "temporary recovery QA modules removed",
  );
}

{
  // M11A.2J — bid strategy
  assert(LOWEST_COST_WITHOUT_CAP_SUPPORTED === true, "LOWEST_COST_WITHOUT_CAP supported");
  assert(
    BID_AMOUNT_REQUIRED_WITH_LOWEST_COST_WITHOUT_CAP === false,
    "bid_amount not required with LOWEST_COST_WITHOUT_CAP",
  );

  const auto = resolveMetaBidStrategy({ allyBidMode: "AUTOMATIC_NO_CAP" });
  assert(auto.ok === true, "automatic-no-cap ok");
  if (auto.ok) {
    assert(
      auto.bidStrategy === META_BID_STRATEGY_LOWEST_COST_WITHOUT_CAP,
      "automatic → LOWEST_COST_WITHOUT_CAP",
    );
    assert(auto.bidAmount == null, "automatic → bid_amount omitted");
  }

  const capMissing = resolveMetaBidStrategy({ allyBidMode: "BID_CAP" });
  assert(capMissing.ok === false, "manual bid cap without amount → not ok");
  assert(
    !capMissing.ok &&
      capMissing.bidStrategy !== META_BID_STRATEGY_LOWEST_COST_WITHOUT_CAP,
    "manual bid cap must not silently use automatic strategy",
  );

  const costMissing = resolveMetaBidStrategy({ allyBidMode: "COST_CAP" });
  assert(costMissing.ok === false, "cost cap without amount → not ok");

  const roasMissing = resolveMetaBidStrategy({ allyBidMode: "MIN_ROAS" });
  assert(roasMissing.ok === false, "min ROAS without config → not ok");

  const trafficBid = buildMetaWritePreview(
    basePlan({
      objectiveRaw: "OUTCOME_TRAFFIC",
      destination: "WEBSITE",
      destinationUrl: "https://affianco.vercel.app",
      pageId: null,
      formId: null,
      allyBidMode: "AUTOMATIC_NO_CAP",
    }),
  );
  assert(
    trafficBid.adSet?.bid_strategy === "LOWEST_COST_WITHOUT_CAP",
    "preview emits LOWEST_COST_WITHOUT_CAP",
  );
  assert(trafficBid.adSet?.bid_amount == null, "preview omits bid_amount");
  assert(
    trafficBid.summaryIt.adSetLines.some((l) =>
      l.includes("Costo più basso, senza limite di offerta"),
    ),
    "human bid strategy copy",
  );

  const noCapMissing = buildMetaWritePreview(
    basePlan({
      objectiveRaw: "OUTCOME_TRAFFIC",
      destination: "WEBSITE",
      destinationUrl: "https://affianco.vercel.app",
      pageId: null,
      formId: null,
      allyBidMode: "BID_CAP",
      bidAmountMinor: null,
    }),
  );
  assert(
    noCapMissing.readinessCodes.includes("MISSING_BID_STRATEGY"),
    "missing bid amount → not READY (MISSING_BID_STRATEGY)",
  );
  assert(!noCapMissing.canWrite, "missing explicit bid strategy config → not canWrite");

  const ex = read("src/lib/meta/write/execute.ts");
  assert(ex.includes("bidStrategy: adSet.bid_strategy"), "execute sends bid_strategy");
  assert(ex.includes("if (!metaCampaignId)"), "partial retry Campaign POST 0");

  assert(
    !exists("src/lib/meta/m11a2j-bid-diag.ts"),
    "temporary bid diag module removed",
  );
}

{
  // M11A.2K — Advantage Audience
  const unresolved = resolveMetaAudienceMode({
    allyAudienceMode: "UNRESOLVED",
  });
  assert(unresolved.ok === false, "audience unresolved → not ok");

  const unresolvedPreview = buildMetaWritePreview(
    basePlan({
      objectiveRaw: "OUTCOME_TRAFFIC",
      destination: "WEBSITE",
      destinationUrl: "https://affianco.vercel.app",
      pageId: null,
      formId: null,
      allyAudienceMode: "UNRESOLVED",
    }),
  );
  assert(
    unresolvedPreview.readinessCodes.includes("MISSING_AUDIENCE_MODE"),
    "unresolved audience → not READY_TO_WRITE",
  );
  assert(!unresolvedPreview.canWrite, "unresolved audience → canWrite false");

  const adv = resolveMetaAudienceMode({
    allyAudienceMode: "ADVANTAGE_AUDIENCE",
  });
  assert(adv.ok === true, "ADVANTAGE_AUDIENCE ok");
  if (adv.ok) {
    assert(
      adv.advantageAudience === META_ADVANTAGE_AUDIENCE_ON,
      "ADVANTAGE_AUDIENCE → advantage_audience=1",
    );
  }

  const manual = resolveMetaAudienceMode({
    allyAudienceMode: "MANUAL_AUDIENCE",
  });
  assert(manual.ok === true, "MANUAL_AUDIENCE ok");
  if (manual.ok) {
    assert(
      manual.advantageAudience === META_ADVANTAGE_AUDIENCE_OFF,
      "MANUAL_AUDIENCE → advantage_audience=0",
    );
  }

  const indep = buildMetaWritePreview(
    basePlan({
      objectiveRaw: "OUTCOME_TRAFFIC",
      destination: "WEBSITE",
      destinationUrl: "https://affianco.vercel.app",
      pageId: null,
      formId: null,
      placementsAdvantage: true,
      allyAudienceMode: "MANUAL_AUDIENCE",
    }),
  );
  assert(
    Boolean(
      indep.adSet?.targeting &&
        (
          indep.adSet.targeting as {
            targeting_automation?: { advantage_audience?: number };
          }
        ).targeting_automation?.advantage_audience === 0,
    ),
    "placements automatic + audience manual → advantage_audience=0",
  );
  assert(
    indep.summaryIt.adSetLines.some((l) => l.startsWith("Distribuzione:")),
    "placement copy independent",
  );
  assert(
    indep.summaryIt.adSetLines.some((l) => l.startsWith("Pubblico:")),
    "audience copy independent",
  );

  const advPreview = buildMetaWritePreview(
    basePlan({
      objectiveRaw: "OUTCOME_TRAFFIC",
      destination: "WEBSITE",
      destinationUrl: "https://affianco.vercel.app",
      pageId: null,
      formId: null,
      allyAudienceMode: "ADVANTAGE_AUDIENCE",
      allyBidMode: "AUTOMATIC_NO_CAP",
    }),
  );
  assert(
    (
      advPreview.adSet?.targeting as {
        targeting_automation?: { advantage_audience?: number };
      }
    )?.targeting_automation?.advantage_audience === 1,
    "ADVANTAGE_AUDIENCE → advantage_audience=1 in targeting",
  );
  assert(
    advPreview.adSet?.bid_strategy === "LOWEST_COST_WITHOUT_CAP",
    "bid strategy remains LOWEST_COST_WITHOUT_CAP",
  );
  assert(advPreview.adSet?.bid_amount == null, "bid_amount omitted");

  assert(
    read("src/lib/meta/write/execute.ts").includes("if (!metaCampaignId)"),
    "PARTIALLY_CREATED retry Campaign POST 0",
  );
  assert(
    !exists("src/lib/meta/m11a2k-audience-diag.ts"),
    "temporary audience diag module removed",
  );
}

{
  // M11A.2L — Advantage Audience age model
  const badMax = resolveWriteAgeFields({
    allyAudienceMode: "ADVANTAGE_AUDIENCE",
    etaMin: 18,
    etaMax: 55,
  });
  assert(badMax.ok === false, "Advantage Audience + hard age_max → blocked");

  const okMin = resolveWriteAgeFields({
    allyAudienceMode: "ADVANTAGE_AUDIENCE",
    etaMin: 18,
    etaMax: null,
  });
  assert(okMin.ok === true, "Advantage Audience + hard minimum → valid");
  if (okMin.ok) {
    assert(okMin.age_min === 18, "age_min=18");
    assert(okMin.age_max == null, "age_max omitted");
    assert(okMin.age_range == null, "no suggestion by default");
  }

  const withSuggestion = resolveWriteAgeFields({
    allyAudienceMode: "ADVANTAGE_AUDIENCE",
    etaMin: 18,
    etaMax: null,
    ageSuggestion: { min: 25, max: 45 },
  });
  assert(withSuggestion.ok === true, "Advantage + age suggestion → valid");
  if (withSuggestion.ok) {
    assert(
      Array.isArray(withSuggestion.age_range) &&
        withSuggestion.age_range[0] === 25,
      "age_range suggestion set",
    );
    assert(withSuggestion.individualSettingAge === 1, "individual_setting.age=1");
  }

  const manualAges = resolveWriteAgeFields({
    allyAudienceMode: "MANUAL_AUDIENCE",
    etaMin: 25,
    etaMax: 55,
  });
  assert(manualAges.ok === true, "Manual Audience + age_min/max → valid");
  if (manualAges.ok) {
    assert(manualAges.age_max === 55, "manual keeps hard age_max");
  }

  const advPreview = buildMetaWritePreview(
    basePlan({
      objectiveRaw: "OUTCOME_TRAFFIC",
      destination: "WEBSITE",
      destinationUrl: "https://affianco.vercel.app",
      pageId: null,
      formId: null,
      etaMin: 18,
      etaMax: null,
      allyAudienceMode: "ADVANTAGE_AUDIENCE",
      allyBidMode: "AUTOMATIC_NO_CAP",
    }),
  );
  assert(
    (advPreview.adSet?.targeting as { age_max?: number })?.age_max == null,
    "preview omits age_max under Advantage Audience",
  );
  assert(
    advPreview.adSet?.bid_strategy === "LOWEST_COST_WITHOUT_CAP",
    "bid strategy remains LOWEST_COST_WITHOUT_CAP",
  );
  assert(
    advPreview.summaryIt.adSetLines.some((l) => l.startsWith("Età minima:")),
    "age human copy minimum",
  );
  assert(
    advPreview.summaryIt.adSetLines.some((l) =>
      l.startsWith("Fascia d'età suggerita:"),
    ),
    "age human copy suggestion",
  );

  assert(
    !exists("src/lib/meta/m11a2l-age-diag.ts"),
    "temporary age diag module removed",
  );
}

{
  // M11A.2M — Partial recovery resume (Ad Set only)
  const resumePreview = buildMetaWritePreview(
    basePlan({
      campaignName: "Fixture Traffic Resume",
      objectiveRaw: "OUTCOME_TRAFFIC",
      destination: "WEBSITE",
      destinationUrl: "https://affianco.vercel.app",
      pageId: null,
      formId: null,
      budgetDailyMajor: 5,
      etaMin: 18,
      etaMax: null,
      geoLabel: "Roma, Lazio, Italia",
      allyAudienceMode: "ADVANTAGE_AUDIENCE",
      allyBidMode: "AUTOMATIC_NO_CAP",
      partialHierarchyPending: true,
      existingMetaCampaignId: "meta-campaign-already-exists",
      startAtIso: "2026-12-01T09:00:00.000Z",
      endAtIso: "2026-12-08T09:00:00.000Z",
    }),
  );
  assert(resumePreview.resumeMode === "RESUME_ADSET", "RESUME_ADSET mode");
  assert(
    resumePreview.canWrite === true,
    "PARTIALLY_CREATED resume canWrite when config ready",
  );
  assert(
    !resumePreview.readinessCodes.includes("ALREADY_LINKED_META"),
    "resume does not treat existing campaign as ALREADY_LINKED",
  );
  assert(
    resumePreview.summaryIt.campaignLines.some((l) =>
      l.includes("Già creata — Non attiva"),
    ),
    "recovery campaign already-created copy",
  );
  assert(
    resumePreview.summaryIt.campaignLines.some((l) =>
      l.includes("NON verrà creata di nuovo"),
    ),
    "recovery campaign will-not-recreate copy",
  );
  assert(
    resumePreview.summaryIt.adSetLines.some((l) =>
      l.includes("Da creare — Non attivo"),
    ),
    "recovery ad set to-create copy",
  );
  assert(
    resumePreview.summaryIt.adSetLines.some((l) =>
      l.includes("Età massima: Nessun limite rigido"),
    ),
    "recovery age max human copy",
  );
  assert(
    resumePreview.adSet?.bid_strategy === "LOWEST_COST_WITHOUT_CAP",
    "resume keeps LOWEST_COST_WITHOUT_CAP",
  );

  const ex = read("src/lib/meta/write/execute.ts");
  assert(ex.includes("if (!metaCampaignId)"), "PARTIALLY_CREATED resume → Campaign POST 0");
  assert(
    ex.includes('preview.resumeMode === "RESUME_ADSET"'),
    "RESUME_ADSET requires partial recovery row",
  );
  assert(
    ex.includes("existing?.meta_adset_id"),
    "meta_adset_id already present → no create",
  );
  assert(
    ex.includes("await validateMetaAdSetPaused") &&
      ex.includes("await createMetaAdSetPaused") &&
      ex.indexOf("await validateMetaAdSetPaused") <
        ex.indexOf("await createMetaAdSetPaused"),
    "RESUME_ADSET → final validate_only required before create",
  );
  assert(
    ex.includes('state: "COMPLETED"') &&
      ex.includes('state: "PARTIALLY_CREATED"'),
    "Ad Set success → COMPLETED; Ad Set error → PARTIALLY_CREATED",
  );
  assert(
    ex.includes("STALE_PREVIEW") ||
      read("src/lib/meta/write/preview.ts").includes("STALE_PREVIEW"),
    "stale fingerprint → block",
  );
  assert(
    read("src/components/campagne/MetaWritePreviewPanel.tsx").includes(
      "Completa creazione del gruppo su Meta",
    ),
    "recovery CTA copy",
  );
  assert(
    !exists("src/lib/meta/m11a2m-resume-diag.ts"),
    "temporary resume diag module removed",
  );
}

{
  // M11A.2 FINAL — COMPLETED preview must not re-offer create
  const done = buildMetaWritePreview(
    basePlan({
      campaignName: "Fixture Traffic Completed",
      objectiveRaw: "OUTCOME_TRAFFIC",
      destination: "WEBSITE",
      destinationUrl: "https://affianco.vercel.app",
      pageId: null,
      formId: null,
      budgetDailyMajor: 5,
      etaMin: 18,
      etaMax: null,
      allyAudienceMode: "ADVANTAGE_AUDIENCE",
      allyBidMode: "AUTOMATIC_NO_CAP",
      writeHierarchyCompleted: true,
      existingMetaCampaignId: "meta-campaign-done",
      partialHierarchyPending: false,
    }),
  );
  assert(done.writeAlreadyCompleted === true, "COMPLETED → writeAlreadyCompleted");
  assert(done.canWrite === false, "COMPLETED → canWrite false");
  assert(done.resumeMode == null, "COMPLETED → not RESUME_ADSET");
  assert(
    done.readinessCodes.includes("WRITE_ALREADY_COMPLETED"),
    "COMPLETED → WRITE_ALREADY_COMPLETED readiness",
  );
  assert(
    done.summaryIt.footnote.includes("Configurazione Meta già creata"),
    "COMPLETED human footnote",
  );
  assert(
    read("src/components/campagne/MetaWritePreviewPanel.tsx").includes(
      "Configurazione Meta già creata",
    ),
    "COMPLETED CTA hidden copy",
  );
  assert(
    read("src/lib/meta/write/operations.ts").includes('"COMPLETED"') &&
      read("src/lib/meta/write/operations.ts").includes(
        "never state / Meta IDs",
      ),
    "COMPLETED preview must not erase Meta IDs",
  );
  assert(
    !exists("src/lib/meta/m11a2n-closeout-diag.ts") &&
      !exists("src/app/api/internal/qa/m11a2a-v26/route.ts"),
    "temporary closeout QA modules removed",
  );
}

assert(META_WRITE_SAFE_STATUS === "PAUSED", "safe status constant");

if (falliti > 0) {
  console.error(`\n=== M11A.2 FAIL (${falliti}) ===\n`);
  process.exit(1);
}
console.log("\n=== M11A.2 PASS ===\n");
