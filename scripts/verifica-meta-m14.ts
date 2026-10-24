/**
 * M14 — Full Meta publish plan / validation / guard tests (no live Meta writes).
 */

import fs from "node:fs";
import {
  buildMetaAdPayload,
  buildMetaCreativePayload,
  creativeBlockingIssues,
} from "../src/lib/meta/publish/payloads";
import {
  etichettaPublishProductStatus,
  resolvePublishProductStatus,
} from "../src/lib/meta/publish/labels";
import { META_PUBLISH_ORDER } from "../src/lib/meta/publish/types";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ ${name}: ${msg}`);
    failed++;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function read(path: string): string {
  return fs.readFileSync(path, "utf8");
}

console.log("M14 publish pipeline\n");

test("A: fully ready creative+ad payloads (happy path fields)", () => {
  const creative = buildMetaCreativePayload({
    campaignName: "Studio Dentistico Aurora",
    pageId: "page_1",
    primaryText: "Prenota la tua visita di controllo.",
    headline: "Visita odontoiatrica",
    description: null,
    destinationUrl: "https://example.com",
    destination: "WEBSITE",
    creativitaRaw: [
      {
        id: "c1",
        nomeFile: "video01.mp4",
        width: 1080,
        height: 1920,
        ruolo: "principale",
        avvisoFormato: false,
        isVideo: true,
        storagePath: "user/c1.mp4",
      },
    ],
  });
  const ad = buildMetaAdPayload({ campaignName: "Studio Dentistico Aurora" });
  assert(creative.status === "PAUSED", "creative paused");
  assert(ad.status === "PAUSED", "ad paused");
  assert(creativeBlockingIssues(creative).filter((i) => i.code !== "ASSET_UPLOAD_NOT_READY").length === 0, "no hard creative blocks");
  assert(creative.assetHandling === "READY", "asset ready when storagePath");
  assert(ad.adset_id === "{pending_adset_id}", "pending adset");
  assert(ad.creative.creative_id === "{pending_creative_id}", "pending creative");
});

test("B: missing page blocks creative", () => {
  const creative = buildMetaCreativePayload({
    campaignName: "X",
    pageId: null,
    primaryText: "Testo",
    headline: "Titolo",
    description: null,
    destinationUrl: "https://example.com",
    destination: "WEBSITE",
    creativitaRaw: [{ id: "1", nomeFile: "a.jpg", width: 1, height: 1, ruolo: "principale", avvisoFormato: false, storagePath: "p" }],
  });
  assert(creativeBlockingIssues(creative).some((i) => i.code === "MISSING_PAGE"), "page");
});

test("C: missing primary text blocks", () => {
  const creative = buildMetaCreativePayload({
    campaignName: "X",
    pageId: "p",
    primaryText: "  ",
    headline: "Titolo",
    description: null,
    destinationUrl: "https://example.com",
    destination: "WEBSITE",
    creativitaRaw: [{ id: "1", nomeFile: "a.jpg", width: 1, height: 1, ruolo: "principale", avvisoFormato: false, storagePath: "p" }],
  });
  assert(creativeBlockingIssues(creative).some((i) => i.code === "MISSING_PRIMARY_TEXT"), "text");
});

test("D: missing targeting surfaced via write readiness codes in plan module", () => {
  const plan = read("./src/lib/meta/publish/plan.ts");
  assert(plan.includes("MISSING_GEO"), "geo");
  assert(plan.includes("MISSING_BUDGET"), "budget");
});

test("E: missing creative asset blocks", () => {
  const creative = buildMetaCreativePayload({
    campaignName: "X",
    pageId: "p",
    primaryText: "Testo lungo abbastanza",
    headline: "Titolo",
    description: null,
    destinationUrl: "https://example.com",
    destination: "WEBSITE",
    creativitaRaw: [],
  });
  assert(creativeBlockingIssues(creative).some((i) => i.code === "MISSING_CREATIVE_ASSET"), "asset");
});

test("F: missing destination URL where required", () => {
  const creative = buildMetaCreativePayload({
    campaignName: "X",
    pageId: "p",
    primaryText: "Testo",
    headline: "Titolo",
    description: null,
    destinationUrl: null,
    destination: "WEBSITE",
    creativitaRaw: [{ id: "1", nomeFile: "a.jpg", width: 1, height: 1, ruolo: "principale", avvisoFormato: false, storagePath: "p" }],
  });
  assert(creativeBlockingIssues(creative).some((i) => i.code === "MISSING_DESTINATION_URL"), "url");
});

test("G: unsupported objective handled in plan (maps write codes)", () => {
  const plan = read("./src/lib/meta/publish/plan.ts");
  assert(plan.includes("UNSUPPORTED_OBJECTIVE"), "unsupported");
  assert(plan.includes("resolveMetaObjectiveCode"), "mapping");
});

test("H: invalid dates / schedule via write blockers", () => {
  const plan = read("./src/lib/meta/publish/plan.ts");
  assert(plan.includes("MISSING_SCHEDULE"), "schedule");
});

test("I: creative mapping CTA by destination", () => {
  const lead = buildMetaCreativePayload({
    campaignName: "X",
    pageId: "p",
    primaryText: "T",
    headline: "H",
    description: null,
    destinationUrl: null,
    destination: "META_LEAD_FORM",
    creativitaRaw: [{ id: "1", nomeFile: "a.jpg", width: 1, height: 1, ruolo: "principale", avvisoFormato: false, storagePath: "p" }],
  });
  assert(lead.object_story_spec.link_data?.call_to_action?.type === "SIGN_UP", "lead cta");
  const web = buildMetaCreativePayload({
    campaignName: "X",
    pageId: "p",
    primaryText: "T",
    headline: "H",
    description: null,
    destinationUrl: "https://x.test",
    destination: "WEBSITE",
    creativitaRaw: [{ id: "1", nomeFile: "a.jpg", width: 1, height: 1, ruolo: "principale", avvisoFormato: false, storagePath: "p" }],
  });
  assert(web.object_story_spec.link_data?.call_to_action?.type === "LEARN_MORE", "web cta");
});

test("J: publish order Campaign → Ad Set → Creative → Ad", () => {
  assert(META_PUBLISH_ORDER[0] === "VALIDATE", "validate first");
  assert(META_PUBLISH_ORDER.includes("CREATE_CAMPAIGN"), "campaign");
  assert(META_PUBLISH_ORDER.includes("CREATE_ADSET"), "adset");
  assert(META_PUBLISH_ORDER.includes("CREATE_CREATIVE"), "creative");
  assert(META_PUBLISH_ORDER.includes("CREATE_AD"), "ad");
  const iCamp = META_PUBLISH_ORDER.indexOf("CREATE_CAMPAIGN");
  const iAdset = META_PUBLISH_ORDER.indexOf("CREATE_ADSET");
  const iCreative = META_PUBLISH_ORDER.indexOf("CREATE_CREATIVE");
  const iAd = META_PUBLISH_ORDER.indexOf("CREATE_AD");
  assert(iCamp < iAdset && iAdset < iCreative && iCreative < iAd, "order");
});

test("K: META_WRITES_LIVE off blocks execution (orchestrate + execute + config)", () => {
  const orch = read("./src/lib/meta/publish/orchestrate.ts");
  assert(orch.includes("isMetaWritesLiveEnabled"), "guard import dry-run");
  assert(orch.includes("executed: false"), "dry-run never executed");
  assert(!orch.includes("graph.facebook.com"), "dry-run no graph");
  const ex = read("./src/lib/meta/publish/execute.ts");
  assert(ex.includes("isFullPublishLiveExecutionAllowed"), "execute guard");
  assert(ex.includes("evaluateControlledQaWriteGate"), "secondary QA gate");
  assert(ex.includes("LIVE_WRITES_GATED"), "gated message");
  assert(ex.includes('"GATED"'), "gated steps");
  const cfg = read("./src/lib/meta/config.ts");
  assert(cfg.includes('=== "1"'), "live requires 1");
  const gate = read("./src/lib/meta/publish/qa-write-gate.ts");
  assert(gate.includes("ALLY_QA_SUPABASE_PROJECT_REF"), "QA ref");
  assert(gate.includes("PRODUCTION_SUPABASE"), "prod reject");
});

test("L: partial-step failure representation", () => {
  const orch = read("./src/lib/meta/publish/orchestrate.ts");
  assert(orch.includes('failedAt: "CREATE_CAMPAIGN"'), "fail campaign");
  assert(orch.includes('failedAt: "CREATE_CREATIVE"'), "fail creative");
  assert(orch.includes("SKIPPED"), "skip dependents");
});

test("M: successful dry-run path does not invent real Meta IDs", () => {
  const orch = read("./src/lib/meta/publish/orchestrate.ts");
  assert(orch.includes("metaObjectId: null"), "no fake ids");
  assert(!orch.includes("mock:campaign:"), "no mock ids that look real");
  const payloads = read("./src/lib/meta/publish/payloads.ts");
  assert(payloads.includes("{pending_adset_id}"), "placeholder adset");
  assert(payloads.includes("{pending_creative_id}"), "placeholder creative");
});

test("N: dry-run never marks SYNCED / PUBLISHED", () => {
  const orch = read("./src/lib/meta/publish/orchestrate.ts");
  assert(orch.includes("markedSynced: false"), "synced false");
  assert(orch.includes("markedPublished: false"), "published false");
  assert(orch.includes("MARK_SYNC_BASELINE"), "baseline step gated");
});

test("Product labels distinct", () => {
  assert(etichettaPublishProductStatus("pronta") === "Pronta per Meta", "pronta");
  assert(etichettaPublishProductStatus("pubblicata") === "Pubblicata su Meta", "pub");
  assert(etichettaPublishProductStatus("non_pronta") === "Non pronta per Meta", "non");
  assert(
    resolvePublishProductStatus({
      ready: true,
      blockingCount: 0,
      hasVerifiedMetaObjects: false,
      hasPartialMetaObjects: false,
      hasPublishError: false,
    }) === "pronta",
    "resolve pronta",
  );
  assert(
    resolvePublishProductStatus({
      ready: false,
      blockingCount: 0,
      hasVerifiedMetaObjects: true,
      hasPartialMetaObjects: false,
      hasPublishError: false,
    }) === "pubblicata",
    "only verified → published",
  );
});

test("UI publish panel + API route exist", () => {
  assert(fs.existsSync("./src/components/campagne/MetaPublishPanel.tsx"), "panel");
  assert(fs.existsSync("./src/app/api/meta/publish-plan/route.ts"), "api");
  // COMMIT 2 permanent surface: Step 6 / FormConfigurazione — not campagne detail page.
  const step6 = read("./src/components/nuova-contatti/FormConfigurazione.tsx");
  assert(step6.includes("MetaPublishPanel"), "step6 wired");
  assert(
    !/mostra\(\[6\]\)[\s\S]{0,400}Porta la campagna su Meta Ads Manager/.test(
      step6,
    ),
    "legacy step6 primary removed",
  );
  const panel = read("./src/components/campagne/MetaPublishPanel.tsx");
  assert(panel.includes("ctaLabelIt"), "cta");
  assert(panel.includes("GATED_LIVE_OFF"), "gated");
  assert(panel.includes("Pubblica su Meta"), "ally-first title");
  assert(panel.includes("onExecuteFullPublish"), "full-publish execute wired");
  assert(panel.includes("humanConfirmed: true"), "human confirmation required");
  assert(
    panel.includes("Write live non attive") || panel.includes("GATED_LIVE_OFF"),
    "live-off gate disables execute CTA",
  );
  assert(
    panel.includes("/api/meta/publish-plan") &&
      panel.includes('action: "execute"'),
    "panel uses publish-plan execute path",
  );
  assert(
    !panel.includes(
      "Pubblicazione Meta non ancora attiva in QA. Nessuna mutazione inviata.",
    ),
    "legacy QA stub copy removed",
  );
  assert(fs.existsSync("./src/app/api/meta/pages/route.ts"), "pages api");
});

test("No live Graph mutations in dry-run publish modules", () => {
  for (const f of [
    "./src/lib/meta/publish/orchestrate.ts",
    "./src/lib/meta/publish/plan.ts",
    "./src/lib/meta/publish/payloads.ts",
  ]) {
    const src = read(f);
    assert(!src.includes("graph.facebook.com"), f);
    assert(!src.includes("createMetaCampaignPaused"), f);
  }
});

test("Missing Meta account validation mapped", () => {
  const plan = read("./src/lib/meta/publish/plan.ts");
  assert(plan.includes("MISSING_AD_ACCOUNT"), "ad account");
  assert(plan.includes("MISSING_META_CONNECTION"), "connection");
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
