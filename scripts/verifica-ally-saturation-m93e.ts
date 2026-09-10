/**
 * M9.3E — Local audience saturation eligibility (no invented B2B density).
 * Deterministic. Esegui: npx tsx scripts/verifica-ally-saturation-m93e.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  calcolaDiagnosiPreLancioLeads,
  isLocalAudienceSaturationModelSupported,
  stimaSaturazionePubblico,
} from "../src/lib/pre-lancio-check";
import { matchCanonicalSettore } from "../src/lib/settore-canonico";

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

const technonBase = {
  raggioKm: 15,
  budgetGiornaliero: 19.2,
  cpmStimato: 7,
  settore: "Distribuzione tecnica industriale",
  targetType: "B2B" as const,
};

function main() {
  console.log("\nM9.3E — Audience saturation eligibility\n");

  test("A. Technon B2B industrial → unsupported / null", () => {
    assert(
      !isLocalAudienceSaturationModelSupported(technonBase),
      "gate",
    );
    assert(stimaSaturazionePubblico(technonBase) === null, "estimate null");
    const d = calcolaDiagnosiPreLancioLeads({
      raggioKm: 15,
      titoloAnnuncio: "Nastri tecnici",
      budgetGiornaliero: 19.2,
      settore: "Distribuzione tecnica industriale",
      citta: "Roma",
      haCopy: true,
      haCreativita: true,
      cpmStimato: 7,
      targetType: "B2B",
      varianteA: "Offerta tecnica per officine",
      frontEndOffer: "Campione 3M VHB",
      creativita: [
        {
          avvisoFormato: false,
          formatoOrizzontale: false,
          width: 1080,
          height: 1080,
        },
      ],
    });
    assert(d.saturazione === null, "diagnosi.saturazione null");
    assert(
      !d.checks.some((c) => c.id === "saturazione"),
      "no saturazione check",
    );
  });

  test("B. Manifattura B2B → unavailable", () => {
    assert(
      !isLocalAudienceSaturationModelSupported({
        settore: "Manifattura industriale",
        targetType: "B2B",
      }),
      "gate",
    );
    assert(
      stimaSaturazionePubblico({
        raggioKm: 20,
        budgetGiornaliero: 30,
        settore: "Manifattura industriale",
        targetType: "B2B",
      }) === null,
      "null",
    );
  });

  test("C. Software B2B → unavailable", () => {
    assert(
      matchCanonicalSettore("Software B2B").id === "software-b2b" ||
        matchCanonicalSettore("software-b2b").id === "software-b2b",
      "canonical",
    );
    assert(
      !isLocalAudienceSaturationModelSupported({
        settore: "software-b2b",
        targetType: "B2B",
      }),
      "gate",
    );
  });

  test("D. Contract B2B → unavailable", () => {
    assert(
      !isLocalAudienceSaturationModelSupported({
        settore: "contract-materiali",
        targetType: "B2B",
      }),
      "gate",
    );
  });

  test("E. Dental local B2C → preserved numeric estimate", () => {
    assert(
      isLocalAudienceSaturationModelSupported({
        settore: "Dentista",
        targetType: "B2C",
      }),
      "gate supported",
    );
    const est = stimaSaturazionePubblico({
      raggioKm: 15,
      budgetGiornaliero: 19.2,
      cpmStimato: 7,
      settore: "Dentista",
      targetType: "B2C",
    });
    assert(est !== null, "estimate present");
    assert(est!.cpmUsato === 7, `cpm ${est!.cpmUsato}`);
    assert(est!.giorniSaturazione > 0, "days");
    // Same math as legacy: π·15²·900 / ((19.2/7)*1000)
    const pop = Math.round(Math.PI * 15 * 15 * 900);
    const impr = Math.round((19.2 / 7) * 1000);
    assert(est!.popolazioneUnica === pop, `pop ${est!.popolazioneUnica}`);
    assert(
      est!.giorniSaturazione === Math.max(1, Math.round(pop / impr)),
      `days ${est!.giorniSaturazione}`,
    );
  });

  test("F. Palestra local B2C → preserved", () => {
    assert(
      isLocalAudienceSaturationModelSupported({
        settore: "Palestra",
        targetType: "B2C",
      }),
      "gate",
    );
    assert(
      stimaSaturazionePubblico({
        raggioKm: 10,
        budgetGiornaliero: 20,
        settore: "Palestra",
        targetType: "B2C",
      }) !== null,
      "estimate",
    );
  });

  test("G. Unknown / Altro → unavailable", () => {
    assert(
      !isLocalAudienceSaturationModelSupported({
        settore: "Altro",
        targetType: "B2C",
      }),
      "altro",
    );
    assert(
      !isLocalAudienceSaturationModelSupported({
        settore: "Nicchia inventata XYZ",
        targetType: "B2C",
      }),
      "unknown",
    );
  });

  test("H. Noleggio mixed → unavailable (no forced consumer estimate)", () => {
    assert(
      !isLocalAudienceSaturationModelSupported({
        settore: "Noleggio / mobilità",
        targetType: "B2C",
      }),
      "mixed B2C still blocked",
    );
    assert(
      !isLocalAudienceSaturationModelSupported({
        settore: "noleggio-auto",
        targetType: "B2B",
      }),
      "mixed B2B",
    );
  });

  test("I. B2B target blocks even dental sector", () => {
    assert(
      !isLocalAudienceSaturationModelSupported({
        settore: "Dentista",
        targetType: "B2B",
      }),
      "dental B2B blocked",
    );
  });

  test("J. Score / readiness invariants — saturazione does not mutate score", () => {
    const shared = {
      raggioKm: 15,
      titoloAnnuncio: "Offerta locale",
      budgetGiornaliero: 19.2,
      settore: "Dentista",
      citta: "Roma",
      haCopy: true,
      haCreativita: true,
      cpmStimato: 7,
      varianteA: "Prenota una visita oggi",
      frontEndOffer: "Prima visita",
      creativita: [
        {
          avvisoFormato: false,
          formatoOrizzontale: false,
          width: 1080,
          height: 1080,
        },
      ],
    };
    const withSat = calcolaDiagnosiPreLancioLeads({
      ...shared,
      targetType: "B2C",
    });
    const withoutSat = calcolaDiagnosiPreLancioLeads({
      ...shared,
      targetType: "B2B",
    });
    assert(withSat.saturazione !== null, "B2C dental has estimate");
    assert(withoutSat.saturazione === null, "B2B dental no estimate");
    assert(
      withSat.score === withoutSat.score,
      `score unchanged by saturation card: ${withSat.score} vs ${withoutSat.score}`,
    );
    assert(
      withSat.haErroriBloccanti === withoutSat.haErroriBloccanti,
      "blockers unchanged",
    );
  });

  test("K. Architecture: gate in estimator; UI still hides null; no M9.3D touch", () => {
    const pre = src("src/lib/pre-lancio-check.ts");
    assert(
      pre.includes("isLocalAudienceSaturationModelSupported"),
      "gate export",
    );
    assert(pre.includes("matchCanonicalSettore"), "uses M9.3C");
    assert(pre.includes("LOCAL_CONSUMER_SATURATION_MACROS"), "allowlist macros");
    const ui = src("src/components/nuova-contatti/DiagnosiPreLancio.tsx");
    assert(ui.includes("diagnosi.saturazione ?"), "hide when null");
    const m93d = src("src/lib/creative-semantic-fit.ts");
    assert(
      !m93d.includes("isLocalAudienceSaturationModelSupported"),
      "M9.3D untouched by saturation gate",
    );
  });

  test("L. City+radius+budget alone insufficient without sector", () => {
    assert(
      stimaSaturazionePubblico({
        raggioKm: 15,
        budgetGiornaliero: 19.2,
        cpmStimato: 7,
      }) === null,
      "no sector → null",
    );
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log("M9.3E audience saturation checks ok.");
}

main();
