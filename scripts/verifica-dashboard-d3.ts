/**
 * Verifica Dashboard D3 — chart Attività da campaign_checks.
 * Esegui: npx tsx scripts/verifica-dashboard-d3.ts
 */
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "test-anon-key";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CampaignCheck } from "@/lib/campaign-checks-db";
import {
  aggregaAttivitaSettimana,
  etichettaAriaBarraAttivita,
  quotaAltezzaBarraAttivita,
} from "@/lib/dashboard-home";

let falliti = 0;

function mark(ok: boolean, msg: string) {
  if (!ok) {
    falliti += 1;
    console.error(`FAIL  ${msg}`);
  } else {
    console.log(`PASS  ${msg}`);
  }
}

const ROOT = process.cwd();
const home = readFileSync(
  join(ROOT, "src/components/dashboard/DashboardHome.tsx"),
  "utf8",
);
const lib = readFileSync(join(ROOT, "src/lib/dashboard-home.ts"), "utf8");
const checksDb = readFileSync(
  join(ROOT, "src/lib/campaign-checks-db.ts"),
  "utf8",
);

const NOW = new Date(2026, 8, 1, 18, 0, 0); // mar 1 set 2026

function iso(y: number, mIndex: number, d: number, h = 12): string {
  return new Date(y, mIndex, d, h, 0, 0).toISOString();
}

function check(campaignId: string, createdAt: string): CampaignCheck {
  return {
    id: `${campaignId}-${createdAt}`,
    campaignId,
    userId: "u",
    createdAt,
    daysActive: 1,
    spend: 10,
    resultsCount: 1,
    primaryCost: 10,
    ctr: null,
    cpm: null,
    cpc: null,
    frequency: null,
    roas: null,
    clicks: null,
    impressions: null,
    healthStatus: "GREEN",
    signal: null,
    actions: [],
    note: null,
    objective: "LEADS",
    threshold: null,
    thresholdMode: null,
    source: "MANUAL",
  };
}

const vuoto = aggregaAttivitaSettimana([], NOW);
mark(vuoto.giorni.length === 7, "CASE A: 7 giorni nella finestra");
mark(vuoto.totaleCheck === 0 && vuoto.campagneControllate === 0, "CASE A: 0 controlli");
mark(
  vuoto.giorni.every((g) => g.count === 0),
  "CASE A: tutte le barre a 0",
);
mark(vuoto.giorni[6]?.isToday === true, "ultimo giorno = oggi");

const caseB = aggregaAttivitaSettimana(
  [check("c1", iso(2026, 7, 30))],
  NOW,
);
mark(
  JSON.stringify(caseB.giorni.map((g) => g.count)) ===
    JSON.stringify([0, 0, 0, 0, 1, 0, 0]),
  "CASE B: [0,0,0,0,1,0,0]",
);
mark(caseB.campagneControllate === 1 && caseB.totaleCheck === 1, "CASE B: N=1");

const caseCChecks: CampaignCheck[] = [
  check("a", iso(2026, 7, 26)),
  check("a", iso(2026, 7, 27)),
  check("b", iso(2026, 7, 27)),
  check("a", iso(2026, 7, 29)),
  check("b", iso(2026, 7, 29)),
  check("c", iso(2026, 7, 29)),
  check("a", iso(2026, 7, 30)),
  check("a", iso(2026, 8, 1)),
  check("b", iso(2026, 8, 1)),
];
const caseC = aggregaAttivitaSettimana(caseCChecks, NOW);
mark(
  JSON.stringify(caseC.giorni.map((g) => g.count)) ===
    JSON.stringify([1, 2, 0, 3, 1, 0, 2]),
  "CASE C: [1,2,0,3,1,0,2]",
);
const maxC = 3;
mark(
  quotaAltezzaBarraAttivita(3, maxC) === 1 &&
    quotaAltezzaBarraAttivita(1, maxC) === 1 / 3 &&
    quotaAltezzaBarraAttivita(2, maxC) === 2 / 3 &&
    quotaAltezzaBarraAttivita(0, maxC) === 0,
  "CASE C: scala proporzionale al max giornaliero",
);

const caseD = aggregaAttivitaSettimana(
  [
    check("same", iso(2026, 8, 1, 9)),
    check("same", iso(2026, 8, 1, 18)),
  ],
  NOW,
);
mark(
  caseD.giorni[6].count === 1 &&
    caseD.campagneControllate === 1 &&
    caseD.totaleCheck === 2,
  "CASE D: stessa campagna stesso giorno = 1 distinta",
);

const caseE = aggregaAttivitaSettimana(
  [check("x", iso(2026, 8, 1, 9)), check("y", iso(2026, 8, 1, 18))],
  NOW,
);
mark(caseE.giorni[6].count === 2 && caseE.campagneControllate === 2, "CASE E: 2 campagne = 2");

const fuori = aggregaAttivitaSettimana(
  [check("old", iso(2026, 7, 24))],
  NOW,
);
mark(fuori.totaleCheck === 0, "check fuori finestra 7 giorni ignorato");

const aria = etichettaAriaBarraAttivita(new Date(2026, 7, 31), 1);
mark(aria === "31 agosto: 1 campagna controllata", `aria 31 agosto: got "${aria}"`);

mark(home.includes("MiniChartAttivita"), "chart Attività presente");
const chartSrc = home.slice(
  home.indexOf("function MiniChartAttivita"),
  home.indexOf("function AvatarIniziali"),
);
mark(chartSrc.includes("etichettaAriaBarraAttivita"), "aria-label per barra");
mark(chartSrc.includes('role="img"'), "barre con role img");
mark(chartSrc.includes("giorno.lettera"), "7 label compatte sotto le barre");
mark(
  home.includes("I controlli compariranno qui man mano che aggiorni le"),
  "empty state secondario",
);
mark(home.includes("negli ultimi 7 giorni"), "microcopy 7 giorni");
mark(!/Math\.random|mock|faker/i.test(home), "nessun mock/random in Home");
mark(
  !home.includes("v === 0 ? 18") && !home.includes("Math.max(22"),
  "niente altezze fake 18/22",
);
mark(
  !classeBarreUsaSemaforo(home),
  "barre senza verde/giallo/rosso",
);
mark(lib.includes("idsPerGiorno[idx].add(check.campaignId)"), "distinct campaign_id per giorno");
mark(
  checksDb.includes("leggiChecksUtenteDal") &&
    home.includes("leggiChecksUtenteDal"),
  "fonte: campaign_checks via leggiChecksUtenteDal",
);
mark(!home.includes("MiniBars"), "vecchio MiniBars rimosso");

function classeBarreUsaSemaforo(src: string): boolean {
  return /classeBarraAttivita[\s\S]*green|classeBarraAttivita[\s\S]*yellow|#22c55e|#ef4444/.test(
    src,
  );
}

if (falliti > 0) {
  console.error(`\n${falliti} check falliti`);
  process.exit(1);
}
console.log("\nDASHBOARD D3 ACTIVITY CHECKS OK");
