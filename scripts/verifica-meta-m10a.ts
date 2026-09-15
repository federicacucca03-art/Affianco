/**
 * M10A — Meta hierarchy read-only (pure + static asserts).
 * Esegui: npx tsx scripts/verifica-meta-m10a.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  applyHierarchyToNextAction,
  buildHierarchyDiagnosisLines,
  etichettaDataSufficiency,
  etichettaHierarchyState,
  evaluateEntityVsTarget,
  evaluateSampleSufficiency,
  pickFirstAdFocus,
  pickFirstAdSetFocus,
  specificNextActionTitle,
} from "@/lib/meta/hierarchy-evaluate";

let falliti = 0;
function assert(cond: unknown, msg: string): boolean {
  if (!cond) {
    falliti += 1;
    console.error(`FAIL  ${msg}`);
    return false;
  }
  console.log(`PASS  ${msg}`);
  return true;
}

function test(name: string, fn: () => void) {
  try {
    fn();
  } catch (e) {
    falliti += 1;
    console.error(`FAIL  ${name}: ${e instanceof Error ? e.message : e}`);
  }
}

const root = join(import.meta.dirname, "..");
function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

console.log("\n=== M10A A–J matrix ===");

test("A: campaign with two ad sets (focus linkage)", () => {
  const focus = pickFirstAdSetFocus([
    {
      name: "Prospecting",
      metaAdSetId: "as1",
      spend: 100,
      results: 10,
      costPerResult: 10,
      state: "STABLE",
      sufficiency: "SUFFICIENT",
    },
    {
      name: "Retargeting",
      metaAdSetId: "as2",
      spend: 200,
      results: 5,
      costPerResult: 40,
      state: "NEEDS_ATTENTION",
      sufficiency: "SUFFICIENT",
    },
  ]);
  assert(focus?.metaAdSetId === "as2", "A two ad sets — focus as2");
  assert(focus?.name === "Retargeting", "A linked name");
});

test("B: ad set with three ads — distinct picks", () => {
  const ads = [
    {
      name: "A1",
      metaAdId: "ad1",
      spend: 50,
      results: 5,
      costPerResult: 10,
      state: "STABLE" as const,
      sufficiency: "SUFFICIENT" as const,
    },
    {
      name: "A2",
      metaAdId: "ad2",
      spend: 80,
      results: 2,
      costPerResult: 40,
      state: "NEEDS_ATTENTION" as const,
      sufficiency: "SUFFICIENT" as const,
    },
    {
      name: "A3",
      metaAdId: "ad3",
      spend: 10,
      results: 1,
      costPerResult: null,
      state: "INSUFFICIENT_DATA" as const,
      sufficiency: "INSUFFICIENT_DATA" as const,
    },
  ];
  assert(ads.length === 3, "B three ads");
  assert(pickFirstAdFocus(ads)?.metaAdId === "ad2", "B focus ad2");
});

test("C: ad small sample 1 result / 7 days → INSUFFICIENT_DATA", () => {
  const s = evaluateSampleSufficiency({ daysActive: 7, resultsCount: 1 });
  assert(s === "INSUFFICIENT_DATA", "C insufficient");
  const st = evaluateEntityVsTarget({
    sufficiency: s,
    costPerResult: 99,
    targetValue: 25,
    primaryKpi: "CPL",
  });
  assert(st === "INSUFFICIENT_DATA", "C state");
});

test("D: ad set small sample 10 results / 1 day → INSUFFICIENT_DATA", () => {
  const s = evaluateSampleSufficiency({ daysActive: 1, resultsCount: 10 });
  assert(s === "INSUFFICIENT_DATA", "D insufficient");
});

test("E: sufficient ad eligible for target comparison", () => {
  const s = evaluateSampleSufficiency({ daysActive: 5, resultsCount: 4 });
  assert(s === "SUFFICIENT", "E sufficient");
  const st = evaluateEntityVsTarget({
    sufficiency: s,
    costPerResult: 20,
    targetValue: 25,
    primaryKpi: "CPL",
  });
  assert(st === "STABLE", "E stable under target");
});

test("F: mixed performance — focus B without blaming A", () => {
  const focus = pickFirstAdSetFocus([
    {
      name: "A",
      metaAdSetId: "asA",
      spend: 420,
      results: 20,
      costPerResult: 21,
      state: "STABLE",
      sufficiency: "SUFFICIENT",
    },
    {
      name: "B",
      metaAdSetId: "asB",
      spend: 260,
      results: 6,
      costPerResult: 43,
      state: "NEEDS_ATTENTION",
      sufficiency: "SUFFICIENT",
    },
  ]);
  assert(focus?.name === "B", "F focus B");
  const lines = buildHierarchyDiagnosisLines({
    campaignNeedsAttention: true,
    focusAdSet: { name: "B" },
    focusAd: null,
  });
  assert(
    lines.some((l) => l.includes("B") && l.includes("primo controllo")),
    "F diagnosis B",
  );
  assert(!lines.some((l) => /causat/i.test(l)), "F no causation");
});

test("G: mixed ads three interpretations", () => {
  const ads = [
    {
      name: "Ad1",
      metaAdId: "1",
      spend: 130,
      results: 2,
      costPerResult: 65,
      state: "NEEDS_ATTENTION" as const,
      sufficiency: "SUFFICIENT" as const,
    },
    {
      name: "Ad2",
      metaAdId: "2",
      spend: 90,
      results: 4,
      costPerResult: 22.5,
      state: "STABLE" as const,
      sufficiency: "SUFFICIENT" as const,
    },
    {
      name: "Ad3",
      metaAdId: "3",
      spend: 40,
      results: 0,
      costPerResult: null,
      state: "INSUFFICIENT_DATA" as const,
      sufficiency: "INSUFFICIENT_DATA" as const,
    },
  ];
  assert(ads[0].state === "NEEDS_ATTENTION", "G1 attention");
  assert(ads[1].state === "STABLE", "G2 stable");
  assert(ads[2].state === "INSUFFICIENT_DATA", "G3 insufficient");
  const focus = pickFirstAdFocus(ads);
  assert(focus?.name === "Ad1", "G focus Ad1 highest spend above target");
});

test("H: Meta PAUSED ≠ health failure", () => {
  const st = evaluateEntityVsTarget({
    sufficiency: "SUFFICIENT",
    costPerResult: 20,
    targetValue: 25,
    primaryKpi: "CPL",
  });
  assert(st === "STABLE", "H paused status orthogonal — STABLE vs target");
  const adsSrc = read("src/lib/meta/ads.ts");
  assert(adsSrc.includes("effective_status"), "H preserves Meta status fields");
  assert(
    !/PAUSED.*NEEDS_ATTENTION|PAUSED.*health/i.test(
      read("src/lib/meta/hierarchy-evaluate.ts"),
    ),
    "H evaluate ignores PAUSED mapping",
  );
});

test("I: missing target → NEUTRAL", () => {
  const st = evaluateEntityVsTarget({
    sufficiency: "SUFFICIENT",
    costPerResult: 40,
    targetValue: null,
    primaryKpi: "CPL",
  });
  assert(st === "NEUTRAL", "I neutral");
  const none = evaluateEntityVsTarget({
    sufficiency: "SUFFICIENT",
    costPerResult: 40,
    targetValue: 25,
    primaryKpi: "NONE",
  });
  assert(none === "NEUTRAL", "I NONE kpi");
});

test("J: partial creative — no fabrication in normalize", () => {
  const adsSrc = read("src/lib/meta/ads.ts");
  assert(adsSrc.includes("extractCreative"), "J extractCreative");
  assert(adsSrc.includes("return empty"), "J empty creative fallback");
  assert(!adsSrc.includes("placeholder"), "J no placeholder creative");
});

test("thresholds: MONITOR vs NEEDS_ATTENTION", () => {
  const monitor = evaluateEntityVsTarget({
    sufficiency: "SUFFICIENT",
    costPerResult: 26,
    targetValue: 25,
    primaryKpi: "CPL",
  });
  assert(monitor === "MONITOR", "MONITOR above target");
  const needs = evaluateEntityVsTarget({
    sufficiency: "SUFFICIENT",
    costPerResult: 31,
    targetValue: 25,
    primaryKpi: "CPL",
  });
  assert(needs === "NEEDS_ATTENTION", "NEEDS_ATTENTION > 1.2x");
});

test("Italian labels", () => {
  assert(etichettaDataSufficiency("SUFFICIENT") === "Sufficienti", "labels sufficienti");
  assert(
    etichettaDataSufficiency("INSUFFICIENT_DATA") === "Insufficienti",
    "labels insufficienti",
  );
  assert(etichettaHierarchyState("STABLE") === "Stabile", "stabile");
  assert(
    etichettaHierarchyState("NEEDS_ATTENTION") === "Richiede attenzione",
    "attenzione",
  );
});

test("next action specificity", () => {
  const title = specificNextActionTitle({
    adSetName: "Retargeting",
    adName: "Prima visita",
  });
  assert(
    title ===
      "Controlla l'inserzione 'Prima visita' nel gruppo Retargeting.",
    "specific title",
  );
  const groupOnly = specificNextActionTitle({
    adSetName: "Retargeting",
    adName: null,
  });
  assert(
    groupOnly === "Controlla il gruppo di inserzioni 'Retargeting'.",
    "group title",
  );
  const refined = applyHierarchyToNextAction(
    {
      actionType: "REVIEW_CREATIVE",
      title: "Controlla la creatività.",
      rationale: "Creatività debole.",
    },
    { adSetName: "Retargeting", adName: "Prima visita" },
  );
  assert(refined.title.includes("Prima visita"), "refine creative");
  const wait = applyHierarchyToNextAction(
    {
      actionType: "WAIT_FOR_MORE_DATA",
      title: "Raccogli altri dati.",
      rationale: "Sample piccolo.",
    },
    { adSetName: "X", adName: "Y" },
  );
  assert(wait.title === "Raccogli altri dati.", "never refine WAIT");
});

console.log("\n=== M10A static architecture ===");

test("migration exists", () => {
  assert(
    existsSync(join(root, "supabase/migrations/20260913_meta_hierarchy_m10a.sql")),
    "migration file",
  );
  const mig = read("supabase/migrations/20260913_meta_hierarchy_m10a.sql");
  assert(mig.includes("meta_ad_sets"), "meta_ad_sets");
  assert(mig.includes("meta_ads"), "meta_ads");
  assert(mig.includes("meta_ad_set_insights_daily"), "adset insights");
  assert(mig.includes("meta_ad_insights_daily"), "ad insights");
});

test("campaigns.ts has no /adsets or /ads", () => {
  const camp = read("src/lib/meta/campaigns.ts");
  assert(!camp.includes("/adsets"), "no /adsets in campaigns");
  assert(!camp.includes("/ads"), "no /ads in campaigns");
});

test("hierarchy modules GET-only / no ads_management", () => {
  const files = [
    "src/lib/meta/adsets.ts",
    "src/lib/meta/ads.ts",
    "src/lib/meta/hierarchy-import.ts",
    "src/lib/meta/hierarchy-insights.ts",
    "src/lib/meta/hierarchy-sync.ts",
    "src/lib/meta/hierarchy-load.ts",
  ];
  for (const f of files) {
    const src = read(f);
    assert(!src.includes("ads_management"), `${f} no ads_management`);
    assert(
      !/method:\s*["']POST["']/.test(src),
      `${f} no POST graph mutations`,
    );
  }
});

test("insight-import calls hierarchy sync", () => {
  const src = read("src/lib/meta/insight-import.ts");
  assert(src.includes("syncClientCampaignHierarchy"), "hooks hierarchy sync");
  assert(src.includes("hierarchy-sync"), "imports hierarchy-sync");
});

test("MetaHierarchyPanel Italian + no Anthropic", () => {
  const ui = read("src/components/risultati/MetaHierarchyPanel.tsx");
  assert(ui.includes("Struttura della campagna Meta"), "section header");
  assert(ui.includes("Gruppo di inserzioni"), "IT gruppo");
  assert(ui.includes("Inserzione"), "IT inserzione");
  assert(
    ui.includes("Definisce pubblico, distribuzione e impostazioni"),
    "ad set explanation",
  );
  assert(
    ui.includes("Nessun gruppo di inserzioni disponibile."),
    "empty state",
  );
  assert(
    ui.includes("Non riesco a caricare la struttura Meta."),
    "error state",
  );
  assert(ui.includes("Riprova"), "retry action");
  assert(ui.includes("In pausa su Meta") || ui.includes("etichettaMetaDeliveryStatus"), "meta status labels");
  assert(ui.includes("non determinabili"), "ambiguous results copy");
  const labelsSrc = read("src/lib/meta/objective-performance/labels.ts");
  assert(
    ui.includes("etichetteHierarchyOutcome") &&
      labelsSrc.includes("Costo per risultato"),
    "cost label full",
  );
  assert(!ui.includes("Costo/ris."), "no abbreviated cost");
  assert(ui.includes("Dati insufficienti"), "single insufficient label");
  assert(ui.includes("Anteprima non disponibile"), "creative placeholder");
  assert(
    ui.includes("getBearerToken") || ui.includes("Bearer ${token}"),
    "sends Bearer auth",
  );
  assert(ui.includes("getSession"), "reads supabase session");
  assert(!ui.includes("OUTCOME_LEADS"), "no raw outcome in panel");
  assert(!/anthropic|Anthropic|claude/i.test(ui), "no Anthropic");
  assert(!ui.includes("openai"), "no openai");
});

test("Meta objective user label", () => {
  const src = read("src/lib/meta/meta-ui-labels.ts");
  assert(src.includes("etichettaMetaObjectiveUtente"), "objective mapper");
  assert(src.includes('"Contatti"'), "leads → Contatti");
});

test("Meta delivery status labels", () => {
  const src = read("src/lib/meta/hierarchy-evaluate.ts");
  assert(src.includes("etichettaMetaDeliveryStatus"), "delivery mapper");
  assert(src.includes("In pausa su Meta"), "paused IT");
  assert(src.includes("Attiva su Meta"), "active IT");
});

test("MetaCampagneSection wires panel", () => {
  const ui = read("src/components/risultati/MetaCampagneSection.tsx");
  assert(ui.includes("MetaHierarchyPanel"), "wired panel");
  assert(ui.includes("etichettaMetaObjectiveUtente"), "objective translated");
  assert(ui.includes("Obiettivo Meta:"), "objective label");
});

test("API route exists", () => {
  assert(
    existsSync(join(root, "src/app/api/meta/campaign-hierarchy/route.ts")),
    "API route",
  );
  const route = read("src/app/api/meta/campaign-hierarchy/route.ts");
  assert(route.includes("loadCampaignHierarchyView"), "loads view");
  assert(route.includes("requireRouteUserId"), "auth");
});

test("Ally hierarchy context", () => {
  const types = read("src/lib/ally-copilot/types.ts");
  assert(types.includes("AllyCopilotHierarchy"), "hierarchy type");
  const load = read("src/lib/ally-copilot/load-context.ts");
  assert(load.includes("loadCampaignHierarchyView"), "loads hierarchy");
  assert(load.includes("applyHierarchyToNextAction"), "refines next action");
});

test("evaluate pure module has no server-only", () => {
  const src = read("src/lib/meta/hierarchy-evaluate.ts");
  assert(!src.includes("server-only"), "pure evaluate");
});

test("efficient API shape documented in code", () => {
  const ads = read("src/lib/meta/ads.ts");
  const insights = read("src/lib/meta/hierarchy-insights.ts");
  assert(ads.includes("graphAccountAdsEdge"), "account-level ads");
  const adsets = read("src/lib/meta/adsets.ts");
  assert(adsets.includes("graphAccountAdSetsEdge"), "account-level adsets");
  assert(ads.includes("campaign.id"), "ads filtered by campaign");
  assert(insights.includes('level: "adset"'), "insights level adset");
  assert(insights.includes('level: "ad"'), "insights level ad");
  assert(insights.includes("graphAccountInsightsEdge"), "account insights");
});

console.log(`\n=== M10A done: ${falliti === 0 ? "ALL PASS" : `${falliti} FAIL`} ===\n`);
process.exit(falliti > 0 ? 1 : 0);
