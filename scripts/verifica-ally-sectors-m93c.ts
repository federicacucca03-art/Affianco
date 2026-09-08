/**
 * M9.3C — Canonical B2B/industrial sector taxonomy verification.
 * Deterministic — no live network / Anthropic.
 */

import {
  SETTORI_PRESETS,
  SETTORE_ALTRO_LABEL,
  MACRO_CATEGORIE,
} from "../src/data/settoriPresets";
import {
  matchCanonicalSettore,
  canonicalizeAllyBriefSettore,
  listCanonicalSettoreOptions,
  legacySettoreStillRenderable,
} from "../src/lib/settore-canonico";
import { risolviSettoreIntel, overlayBenchmarkDaIntel } from "../src/lib/sector-intel";
import { parseAllyBriefProposal, assertNoInventedEconomics } from "../src/lib/ally-brief/parse";
import { ALLY_BRIEF_SYSTEM_PROMPT } from "../src/lib/ally-brief/prompt";
import { consiglioStrategicoNicchia } from "../src/lib/consiglio-nicchia";
import { nicchiaFormatiDaSettore } from "../src/lib/curatedFormats";
import { provenanceLabelIt } from "../src/lib/ally-brief/types";
import type { NicheBenchmark } from "../src/lib/benchmarks";
import { getBenchmarkForNiche } from "../src/lib/benchmarks";
import { normalizzaSettore, stimaBenchmark } from "../src/data/benchmarks";
import { resolveSettoreLabelForNewWrite } from "../src/lib/settore-canonico";
import { SETTORI } from "../src/types/clienti";

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

function field(
  id: string,
  value: unknown,
  provenance: string,
  confidence = "HIGH",
) {
  return { value, provenance, confidence, note: null };
}

function baseBenchmark(): NicheBenchmark {
  return {
    key: "x",
    label: "x",
    category: "Altro",
    ticketLevel: "medium",
    cplMin: 10,
    cplOptimal: 20,
    cplMax: 40,
    recommendedRadiusKm: 15,
    recommendedDailyBudgetMin: 20,
    recommendedDailyBudgetOptimal: 32,
    explanationText: "base",
    targetCtrMin: 1,
    leadFormType: "balanced",
  };
}

function main() {
  console.log("\nM9.3C — Canonical sector taxonomy (B2B / industrial)\n");

  const niches = SETTORI_PRESETS.filter((p) => !p.id.startsWith("macro-"));
  const newIds = [
    "manifattura-industriale",
    "distribuzione-tecnica",
    "contract-materiali",
    "software-b2b",
    "agenzia-marketing",
    "logistica-b2b",
    "noleggio-auto",
    "forniture-hospitality",
    "energia-impianti",
    "engineering-industriale",
    "grossista-b2b",
  ];

  test("catalog size manageable and includes Industria macro", () => {
    assert(MACRO_CATEGORIE.includes("Industria/Distribuzione"), "macro");
    assert(niches.length >= 40 && niches.length <= 55, `niches=${niches.length}`);
    assert(listCanonicalSettoreOptions().length === niches.length, "options");
  });

  test("A Technon industrial distributor → distribuzione-tecnica not Altro", () => {
    const text =
      "Technon è un distributore B2B di soluzioni tecniche per industria: nastri 3M VHB, adesivi, pellicole protettive, DPI e floor marking.";
    const m = matchCanonicalSettore(text);
    assert(m.matched, "matched");
    assert(m.id === "distribuzione-tecnica", `id=${m.id}`);
    assert(m.label === "Distribuzione tecnica industriale", m.label);
  });

  test("B Abatecs contract/interiors → contract-materiali not Altro", () => {
    const text =
      "Abatecs fornisce soluzioni per hotel, uffici e spazi: pavimenti, moquette, linoleum, pellicole vetri, rivestimenti e segnaletica.";
    const m = matchCanonicalSettore(text);
    assert(m.matched, "matched");
    assert(m.id === "contract-materiali", m.id);
    assert(m.label !== SETTORE_ALTRO_LABEL, "not altro");
  });

  test("C E-Noleggio automotive rental → noleggio-auto canonical", () => {
    const m = matchCanonicalSettore("Broker noleggio auto a lungo termine");
    assert(m.matched && m.id === "noleggio-auto", m.id);
    const website = canonicalizeAllyBriefSettore(
      "Broker noleggio auto a lungo termine",
      "WEBSITE",
    );
    assert(website.value === "Noleggio / mobilità", String(website.value));
  });

  test("D Studio dentistico preserved", () => {
    const m = matchCanonicalSettore("studio dentistico");
    assert(m.id === "dentista", m.id);
    assert(m.label === "Studio dentistico", m.label);
  });

  test("E Palestra preserved", () => {
    const m = matchCanonicalSettore("palestra");
    assert(m.id === "palestra", m.id);
  });

  test("F SaaS B2B → software-b2b", () => {
    const m = matchCanonicalSettore("SaaS B2B per PMI");
    assert(m.id === "software-b2b", m.id);
  });

  test("G Industrial manufacturer → manifattura", () => {
    const m = matchCanonicalSettore("manifattura industriale componentistica");
    assert(m.id === "manifattura-industriale", m.id);
  });

  test("H Logistics → logistica-b2b", () => {
    const m = matchCanonicalSettore("azienda di logistica e supply chain");
    assert(m.id === "logistica-b2b", m.id);
  });

  test("I Marketing agency → agenzia-marketing", () => {
    const m = matchCanonicalSettore("agenzia di comunicazione e marketing");
    assert(m.id === "agenzia-marketing", m.id);
  });

  test("J Unknown niche → Altro for WEBSITE/INFERRED", () => {
    const m = matchCanonicalSettore("XYZ Niche Completely Unknown 123");
    assert(!m.matched, "unmatched");
    const web = canonicalizeAllyBriefSettore(
      "XYZ Niche Completely Unknown 123",
      "WEBSITE",
    );
    assert(web.value === SETTORE_ALTRO_LABEL, String(web.value));
  });

  test("K Explicit free-form brief → Altro; description preserved separately", () => {
    const dental = canonicalizeAllyBriefSettore("Dentista", "EXPLICIT");
    assert(dental.value === "Studio dentistico", String(dental.value));
    const unknown = canonicalizeAllyBriefSettore("UnknownNicheXYZ", "EXPLICIT");
    assert(unknown.value === SETTORE_ALTRO_LABEL, String(unknown.value));
    assert(unknown.discardedFreeForm === "UnknownNicheXYZ", "kept aside");

    const aero =
      "azienda che produce componenti aerospaziali custom";
    const aeroCanon = canonicalizeAllyBriefSettore(aero, "EXPLICIT");
    assert(aeroCanon.value === SETTORE_ALTRO_LABEL, String(aeroCanon.value));

    const p = parseAllyBriefProposal(
      JSON.stringify({
        summary: "Aero custom",
        fields: {
          settore: field("settore", aero, "EXPLICIT"),
          elevatorPitch: field("elevatorPitch", null, "MISSING"),
        },
        missing_information: [],
        assumptions: [],
      }),
      null,
    );
    const settore = p.fields.find((f) => f.id === "settore");
    const pitch = p.fields.find((f) => f.id === "elevatorPitch");
    assert(settore?.value === SETTORE_ALTRO_LABEL, String(settore?.value));
    assert(String(pitch?.value ?? "").includes("aerospaziali"), String(pitch?.value));
  });

  test("K2 Explicit user catalog selection stays authoritative", () => {
    const selected = canonicalizeAllyBriefSettore(
      "Distribuzione tecnica industriale",
      "EXPLICIT",
    );
    assert(selected.value === "Distribuzione tecnica industriale", String(selected.value));
  });

  test("L2 Website free-form 3M adhesives → distribuzione-tecnica not free-form", () => {
    const text =
      "Specialisti in sistemi adesivi, film e nastri 3M per industria";
    const c = canonicalizeAllyBriefSettore(text, "WEBSITE");
    assert(c.value === "Distribuzione tecnica industriale", String(c.value));
    assert(!String(c.value).includes("Specialisti"), "not free-form");
  });

  test("L Website-derived sector Dal sito + canonical", () => {
    const p = parseAllyBriefProposal(
      JSON.stringify({
        summary: "Technon B2B",
        fields: {
          nomeCliente: field("nomeCliente", "Technon", "WEBSITE"),
          settore: field(
            "settore",
            "Distributore di nastri 3M e adesivi industriali",
            "WEBSITE",
          ),
          elevatorPitch: field(
            "elevatorPitch",
            "Nastri 3M VHB, adesivi e DPI per industria",
            "WEBSITE",
          ),
          targetType: field("targetType", "B2B", "INFERRED"),
        },
        missing_information: [],
        assumptions: [],
      }),
      null,
    );
    const settore = p.fields.find((f) => f.id === "settore");
    assert(settore?.value === "Distribuzione tecnica industriale", String(settore?.value));
    assert(settore?.provenance === "WEBSITE", "prov");
    assert(provenanceLabelIt("WEBSITE") === "Dal sito", "label");
    assert(assertNoInventedEconomics(p.fields), "no econ");
  });

  test("M AI-inferred sector uses Proposto da Ally label path", () => {
    assert(provenanceLabelIt("INFERRED") === "Proposto da Ally", "inferred");
    const canon = canonicalizeAllyBriefSettore("software saas b2b", "INFERRED");
    assert(canon.value === "Software / SaaS B2B", String(canon.value));
  });

  test("N No economics invented for new sectors (benchmarkKnown false)", () => {
    const intel = risolviSettoreIntel("distribuzione tecnica industriale");
    assert(intel, "intel");
    assert(intel!.benchmarkKnown === false, "unknown bench");
    const over = overlayBenchmarkDaIntel(baseBenchmark(), intel!);
    assert(
      /non disponibile/i.test(over.explanationText),
      over.explanationText,
    );
    assert(over.cplMin === 10, "base cpl preserved, not overwritten with zeros");
  });

  test("N2 unknown/Altro never inherit dental benchmarks", () => {
    assert(normalizzaSettore("XYZ Unknown Niche") === null, "null map");
    assert(normalizzaSettore("Altro") === null, "altro null");
    assert(normalizzaSettore("Studio dentistico") === "dentista", "dental");
    const stima = stimaBenchmark(25, "esperienze immersive per musei");
    assert(stima.available === false, "stima unavailable");
    const niche = getBenchmarkForNiche("Distribuzione tecnica industriale", "");
    assert(niche.key === "unavailable", niche.key);
    assert(niche.cplMin === 0, "no fake cpl");
    const dental = getBenchmarkForNiche("Studio dentistico", "");
    assert(dental.cplMin > 0 && dental.key !== "unavailable", dental.key);
    const legacy = getBenchmarkForNiche("VecchioFreeTextLegacy", "");
    assert(legacy.key === "unavailable", "legacy unavailable");
    const contract = getBenchmarkForNiche("Contract / materiali per spazi", "");
    assert(contract.key === "unavailable", "contract unavailable");
  });

  test("N3 manual wizard resolve alias → canonical / unknown → Altro", () => {
    assert(
      resolveSettoreLabelForNewWrite("nastri industriali") ===
        "Distribuzione tecnica industriale",
      "technon alias",
    );
    assert(
      resolveSettoreLabelForNewWrite("esperienze immersive per musei") ===
        "Altro",
      "unknown altro",
    );
  });

  test("N4 clienti SETTORI derived from catalog (no independent 6-list)", () => {
    assert(SETTORI.includes("Studio dentistico"), "dental label");
    assert(SETTORI.includes("Distribuzione tecnica industriale"), "technon");
    assert(SETTORI.includes("Altro"), "altro");
    assert(!SETTORI.includes("Dentista"), "old label gone");
    assert(SETTORI.length > 40, `len=${SETTORI.length}`);
  });

  test("O Legacy persisted sector key still renders", () => {
    assert(legacySettoreStillRenderable("Dentista"), "legacy label");
    assert(legacySettoreStillRenderable("UnknownNicheXYZ"), "free legacy");
    const existing = canonicalizeAllyBriefSettore("VecchioSettoreLibero", "EXISTING");
    assert(existing.value === "VecchioSettoreLibero", "existing untouched");
  });

  test("prompt forbids free-form settore and lists catalog", () => {
    assert(/OBBLIGO ENUM/i.test(ALLY_BRIEF_SYSTEM_PROMPT), "enum rule");
    assert(
      /Distribuzione tecnica industriale/i.test(ALLY_BRIEF_SYSTEM_PROMPT),
      "technon label in prompt",
    );
    assert(/Noleggio \/ mobilità/i.test(ALLY_BRIEF_SYSTEM_PROMPT), "noleggio");
  });

  test("advice safe qualitative for industrial; no fake %", () => {
    const tip = consiglioStrategicoNicchia(
      "Distribuzione tecnica industriale",
      "LEADS",
    );
    assert(/applicazione|specifica tecnica/i.test(tip), tip);
    assert(!/\d+\s*%/.test(tip), "no percent");
    assert(!/CPL\s*\d+/i.test(tip), "no cpl number");
  });

  test("creative guidance resolves industrial → b2b formats", () => {
    assert(nicchiaFormatiDaSettore("Distribuzione tecnica industriale") === "b2b", "formats");
  });

  test("dental / palestra presets unchanged ids", () => {
    assert(SETTORI_PRESETS.some((p) => p.id === "dentista"), "dentista");
    assert(SETTORI_PRESETS.some((p) => p.id === "palestra"), "palestra");
    assert(SETTORI_PRESETS.some((p) => p.id === "estetista"), "estetista");
  });

  for (const id of newIds) {
    test(`new sector present: ${id}`, () => {
      const p = SETTORI_PRESETS.find((x) => x.id === id);
      assert(p, "missing");
      assert(p!.benchmarkKnown === false, "no invented bench");
    });
  }

  console.log(`\nM9.3C result: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main();
