/**
 * Ally beta hardening — focused regressions for the 6 IMPORTANT QA fixes.
 * Deterministic. Esegui: npx tsx scripts/verifica-ally-beta-hardening.ts
 */
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "test-anon-key";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calculateMaxSustainableCpl } from "../src/lib/benchmarks";
import { raccomandaLancio } from "../src/lib/guidance";
import { calculateStrategicScore } from "../src/lib/strategic-score";
import type { StrategicScoreInput } from "../src/lib/strategic-score";
import { calculateLaunchReadiness } from "../src/lib/launch-readiness";
import {
  daysInclusiveYmd,
  metaInsightsToControlRoomInput,
} from "../src/lib/meta/insights-control-room";
import type { AggregatedMetaInsights } from "../src/lib/meta/insight-aggregate";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}: ${e instanceof Error ? e.message : e}`);
    failed++;
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const ROOT = process.cwd();
function src(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function auroraScore(
  extra: Partial<StrategicScoreInput> = {},
): StrategicScoreInput {
  return {
    budgetGiornaliero: 20,
    settore: "Studio dentistico",
    citta: "Roma",
    ticket: 1500,
    conversionRate: 15,
    conversionRateSource: "REAL",
    targetMargin: 50,
    maxSustainableCpl: calculateMaxSustainableCpl(1500, 15, 50),
    frontEndOffer: "Prima visita",
    elevatorPitch: "Brief studio",
    targetType: "B2C",
    targetAge: "25-50",
    raggioKm: 15,
    haCopySelezionato: true,
    copyVarianteA: "Copy coerente per Roma.",
    titoloAnnuncio: "Prima visita a Roma",
    fotoCaricata: true,
    objective: "LEADS",
    fase: "completa",
    ...extra,
  };
}

function readinessCompleta(
  extra?: Partial<Parameters<typeof calculateLaunchReadiness>[0]>,
) {
  return calculateLaunchReadiness({
    fotoCaricata: true,
    clienteHaApprovato: true,
    paginaFacebookId: "123",
    moduloContattiId: "456",
    haCopySelezionato: true,
    haTitoloAnnuncio: true,
    objective: "LEADS",
    ...extra,
  });
}

function makeConfidentLeadAggregate(
  spend: number,
  results: number,
): AggregatedMetaInsights {
  return {
    spend,
    impressions: 10000,
    clicks: 200,
    linkClicks: 180,
    periodReach: 5000,
    periodFrequency: 2,
    ctr: 2,
    cpc: 0.5,
    cpm: 10,
    primaryResultType: "lead",
    primaryResults: results,
    primaryResultValue: null,
    resultMappingConfidence: "CONFIDENT",
    cpl: Math.round((spend / results) * 100) / 100,
    roas: null,
    dayCount: 14,
  };
}

function main() {
  console.log("\nAlly beta hardening — 6 IMPORTANT fixes\n");

  test("1. Home Importa da Meta uses chooseMeta / startMetaImportFlow", () => {
    const home = src("src/components/dashboard/DashboardHome.tsx");
    assert(home.includes("chooseMeta()"), "chooseMeta wired");
    assert(home.includes("startMetaImportFlow"), "canonical import helper");
    assert(
      !home.includes('href="/impostazioni/integrazioni"'),
      "no settings misroute on Import chip",
    );
    assert(home.includes("Importa da Meta"), "label");
  });

  test("2. sector-intel AI path: benchmarkKnown false, no invented CPL", () => {
    const route = src("src/app/api/sector-intel/route.ts");
    assert(route.includes("benchmarkKnown: false"), "known false");
    assert(!route.includes("benchmarkKnown: true"), "no true for AI");
    assert(
      !route.includes("range(parsed.benchmarkCPL, 12, 40)"),
      "no 12–40 fallback",
    );
    assert(route.includes("NON inventare numeri di mercato"), "prompt guard");
    assert(route.includes("benchmarkCPL: { min: 0, max: 0 }"), "zero CPL");
  });

  test("3. CPA/economy missing → not technical Non lancerei ancora", () => {
    const scoreMissing = calculateStrategicScore(
      auroraScore({
        conversionRateSource: "UNKNOWN",
        conversionRate: 0,
      }),
    );
    const lr = readinessCompleta();
    assert(lr.isReady, "technically ready");
    const rec = raccomandaLancio({
      strategicScore: scoreMissing,
      launchReadiness: lr,
      haErroriBloccantiPreLancio: false,
      objective: "LEADS",
    });
    assert(rec.stato !== "NOT_READY", `stato ${rec.stato}`);
    assert(rec.title !== "Non lancerei ancora.", rec.title);
    assert(
      rec.stato === "READY_WITH_CAUTION",
      `expected caution got ${rec.stato}`,
    );
    assert(
      rec.title.includes("Puoi procedere") ||
        rec.description.toLowerCase().includes("monitor"),
      `${rec.title} | ${rec.description}`,
    );

    const technical = raccomandaLancio({
      strategicScore: calculateStrategicScore(auroraScore()),
      launchReadiness: readinessCompleta({
        paginaFacebookId: "",
        moduloContattiId: "",
      }),
      haErroriBloccantiPreLancio: false,
      objective: "LEADS",
    });
    assert(technical.stato === "NOT_READY", "page/form still NOT_READY");
    assert(technical.title === "Non lancerei ancora.", "technical title");
  });

  test("4. PercorsoContatti: no localStorage approval fallback", () => {
    const p = src("src/components/nuova-contatti/PercorsoContatti.tsx");
    assert(!p.includes("getCampaigns()"), "no getCampaigns");
    assert(
      p.includes("no localStorage approval-status authority") ||
        p.includes("Supabase is canonical"),
      "canonical comment",
    );
    assert(
      p.includes("setStatusApprovazioneGrezzo(null)"),
      "null on failure",
    );
  });

  test("5. Meta small-sample → INSUFFICIENT_DATA / INSUFFICIENT health", () => {
    assert(daysInclusiveYmd("2026-08-01", "2026-08-07") === 7, "7 days");
    assert(daysInclusiveYmd("2026-08-01", "2026-08-01") === 1, "1 day");

    const oneResult = metaInsightsToControlRoomInput({
      aggregate: makeConfidentLeadAggregate(50, 1),
      since: "2026-08-01",
      until: "2026-08-07",
      target: { primaryKpi: "CPL", targetValue: 20 },
      effectiveStatus: "ACTIVE",
    });
    assert(
      oneResult.healthAvailability === "INSUFFICIENT_DATA",
      String(oneResult.healthAvailability),
    );
    assert(
      oneResult.health?.status === "INSUFFICIENT",
      String(oneResult.health?.status),
    );

    const oneDay = metaInsightsToControlRoomInput({
      aggregate: makeConfidentLeadAggregate(200, 10),
      since: "2026-08-01",
      until: "2026-08-01",
      target: { primaryKpi: "CPL", targetValue: 20 },
      effectiveStatus: "ACTIVE",
    });
    assert(
      oneDay.healthAvailability === "INSUFFICIENT_DATA",
      String(oneDay.healthAvailability),
    );
    assert(
      oneDay.health?.status === "INSUFFICIENT",
      String(oneDay.health?.status),
    );

    const eligible = metaInsightsToControlRoomInput({
      aggregate: makeConfidentLeadAggregate(100, 10),
      since: "2026-08-01",
      until: "2026-08-31",
      target: { primaryKpi: "CPL", targetValue: 20 },
      effectiveStatus: "ACTIVE",
    });
    assert(
      eligible.healthAvailability === "AVAILABLE",
      String(eligible.healthAvailability),
    );
    assert(eligible.health?.status === "GREEN", String(eligible.health?.status));
  });

  test("6. error.tsx Ally-branded, no stack, recovery", () => {
    const err = src("src/app/error.tsx");
    assert(err.includes('"use client"') || err.includes("'use client'"), "client");
    assert(err.includes("Ally"), "brand");
    assert(!err.includes("Affianco"), "no Affianco");
    assert(err.includes("unstable_retry") || err.includes("Riprova"), "retry");
    assert(err.includes('href="/home"'), "home nav");
    assert(!err.includes("error.stack"), "no stack");
    assert(!err.includes("error.message"), "no raw message");
    assert(!err.includes("JSON.stringify(error)"), "no json dump");
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log("Ally beta hardening checks ok.");
}

main();
