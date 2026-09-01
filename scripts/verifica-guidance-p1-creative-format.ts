/**
 * Verifica Guidance P1A — formato / adattabilità creatività (Step 4).
 * Esegui: npx tsx scripts/verifica-guidance-p1-creative-format.ts
 */
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "test-anon-key";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { selezionaGuidanceDaMostrare } from "@/lib/guidance";
import {
  ID_CREATIVE_ASSET_ASSENTE,
  ID_CREATIVE_LANDSCAPE,
  ID_CREATIVE_MANCA_9_16,
  ID_CREATIVE_RATIO_NON_IDEALE,
  generaGuidanceCreativita,
  haFormatoOrizzontale,
  haRatioNonIdeale,
  type CreativeFormatSnapshot,
} from "@/lib/qualita-creativita";

let falliti = 0;
const esiti: Record<string, boolean> = {
  "DUPLICATE RATIO REMOVED": true,
  "9:16 GUIDANCE": true,
  LANDSCAPE: true,
  "ASSET MISSING": true,
  "SILENT GOOD CASE": true,
  REGRESSIONS: true,
};

function mark(sezione: keyof typeof esiti, ok: boolean, msg: string) {
  if (!ok) {
    falliti += 1;
    esiti[sezione] = false;
    console.error(`FAIL  [${sezione}] ${msg}`);
  } else {
    console.log(`PASS  [${sezione}] ${msg}`);
  }
}

const ROOT = process.cwd();
function src(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

const LINGUAGGIO_PERFORMANCE = [
  "alto ctr",
  "ctr più alto",
  "ctr piu alto",
  "cpl inferiore",
  "cpl più basso",
  "longevità >60",
  "longevita >60",
  "conversione diretta",
  "+35%",
  "+40%",
  "performerà meglio",
  "performera meglio",
  "performerà",
  "converte meglio",
  "più conversioni",
  "piu conversioni",
];

function asset(
  width: number,
  height: number,
  extra: Partial<CreativeFormatSnapshot> = {},
): CreativeFormatSnapshot {
  return { width, height, ...extra };
}

const QUADRATO = asset(1080, 1080);
const FEED_45 = asset(1080, 1350);
const STORIES = asset(1080, 1920);
const LANDSCAPE = asset(1920, 1080);
const RATIO_STRANO = asset(1080, 1500);

function testiGuidance(items: { title: string; description: string }[]): string {
  return items
    .map((i) => `${i.title} ${i.description}`)
    .join("\n")
    .toLowerCase();
}

function idsDi(items: { id: string }[]): string[] {
  return items.map((i) => i.id);
}

console.log("=== DUPLICATE RATIO REMOVED ===");
mark(
  "DUPLICATE RATIO REMOVED",
  haRatioNonIdeale([RATIO_STRANO]),
  "CASE 1: la diagnosi tecnica ratio resta vera",
);
const gRatio = generaGuidanceCreativita({
  creativita: [RATIO_STRANO],
  objective: "LEADS",
});
mark(
  "DUPLICATE RATIO REMOVED",
  gRatio.length === 1 &&
    gRatio[0]?.id === ID_CREATIVE_MANCA_9_16 &&
    gRatio[0].title === "Ti manca una versione verticale." &&
    !idsDi(gRatio).includes(ID_CREATIVE_RATIO_NON_IDEALE) &&
    !testiGuidance(gRatio).includes("può essere adattato meglio"),
  "CASE 1: Affianco mostra SOLO manca 9:16, non il ratio del checker",
);

console.log("\n=== 9:16 GUIDANCE ===");
const gSolo11 = generaGuidanceCreativita({
  creativita: [QUADRATO],
  objective: "LEADS",
});
mark(
  "9:16 GUIDANCE",
  gSolo11.length === 1 &&
    gSolo11[0]?.id === ID_CREATIVE_MANCA_9_16 &&
    gSolo11[0].title === "Ti manca una versione verticale." &&
    !idsDi(gSolo11).includes(ID_CREATIVE_RATIO_NON_IDEALE),
  "CASE 2: solo 1:1 → Ti manca una versione verticale.",
);

console.log("\n=== SILENT GOOD CASE ===");
const gBuono = generaGuidanceCreativita({
  creativita: [QUADRATO, STORIES],
  objective: "LEADS",
});
const gSolo916 = generaGuidanceCreativita({
  creativita: [STORIES],
  objective: "LEADS",
});
const g45e916 = generaGuidanceCreativita({
  creativita: [FEED_45, STORIES],
  objective: "LEADS",
});
mark(
  "SILENT GOOD CASE",
  gBuono.length === 0 && gSolo916.length === 0 && g45e916.length === 0,
  "CASE 3: 1:1+9:16, solo 9:16, 4:5+9:16 → silenzio",
);

console.log("\n=== ASSET MISSING ===");
const gVuoto = generaGuidanceCreativita({
  creativita: [],
  objective: "LEADS",
});
mark(
  "ASSET MISSING",
  gVuoto.length === 1 &&
    gVuoto[0]?.id === ID_CREATIVE_ASSET_ASSENTE &&
    gVuoto[0].level === "SUGGESTION" &&
    gVuoto[0].title === "Aggiungi una creatività." &&
    gVuoto[0].field === "creativita" &&
    gVuoto[0].step === 4,
  "CASE 4: LEADS senza asset → Aggiungi una creatività.",
);
mark(
  "ASSET MISSING",
  generaGuidanceCreativita({ creativita: [], objective: "ECOMMERCE" })
    .length === 0,
  "ECOMMERCE senza asset: nessuna guidance missing (solo LEADS)",
);

console.log("\n=== LANDSCAPE ===");
mark(
  "LANDSCAPE",
  haFormatoOrizzontale([LANDSCAPE]),
  "CASE 5: diagnosi tecnica landscape resta vera",
);
const gLandscape = generaGuidanceCreativita({
  creativita: [LANDSCAPE],
  objective: "LEADS",
});
mark(
  "LANDSCAPE",
  gLandscape.length === 1 &&
    gLandscape[0]?.id === ID_CREATIVE_MANCA_9_16 &&
    !idsDi(gLandscape).includes(ID_CREATIVE_LANDSCAPE) &&
    !idsDi(gLandscape).includes(ID_CREATIVE_RATIO_NON_IDEALE),
  "CASE 5: landscape → solo manca 9:16, niente duplicato orizzontale/ratio",
);
const gLandscapeCon916 = generaGuidanceCreativita({
  creativita: [LANDSCAPE, STORIES],
  objective: "LEADS",
});
mark(
  "LANDSCAPE",
  gLandscapeCon916.length === 0,
  "landscape + 9:16: checker copre l'orizzontale, Affianco tace",
);

console.log("\n=== REGRESSIONS ===");
const tuttiTesti = testiGuidance([
  ...gVuoto,
  ...gSolo11,
  ...gLandscape,
  ...gRatio,
]);
mark(
  "REGRESSIONS",
  LINGUAGGIO_PERFORMANCE.every((p) => !tuttiTesti.includes(p)),
  "nessun claim CTR/CPL/longevità/performance nei messaggi",
);
const helper = src("src/lib/qualita-creativita.ts");
const checker = src(
  "src/components/nuova-contatti/ControlloFormatoCreativita.tsx",
);
const dropzone = src("src/components/nuova-contatti/DropzoneCreativita.tsx");
mark(
  "REGRESSIONS",
  checker.includes("Un asset da ottimizzare") &&
    dropzone.includes("Formato da ottimizzare"),
  "checker tecnico invariato",
);
mark(
  "REGRESSIONS",
  !helper.includes('level: "BLOCKER"') &&
    gVuoto.every((i) => i.level === "SUGGESTION"),
  "nessun BLOCKER nuovo",
);
mark(
  "REGRESSIONS",
  helper.includes('from "@/lib/creativita"') &&
    !helper.includes("pre-lancio-check") &&
    !helper.includes("creativita-storage") &&
    !helper.includes("rischio-copy") &&
    !helper.includes("raccomanda-copy"),
  "non tocca storage/pre-lancio/copy risk",
);
const studio = src("src/components/nuova-contatti/StudioCreativo.tsx");
mark(
  "REGRESSIONS",
  (studio.match(/<AffiancoSuggerisce/g) ?? []).length === 1,
  "una sola card Affianco",
);
const videoComeStories = generaGuidanceCreativita({
  creativita: [asset(1080, 1080, { isVideo: true })],
  objective: "LEADS",
});
mark(
  "REGRESSIONS",
  videoComeStories.length === 0,
  "video conta come copertura 9:16 (allineato al pre-lancio)",
);
const visRatio = selezionaGuidanceDaMostrare(
  gRatio as Parameters<typeof selezionaGuidanceDaMostrare>[0],
);
mark(
  "REGRESSIONS",
  visRatio.principale?.id === ID_CREATIVE_MANCA_9_16 &&
    visRatio.secondari.length === 0,
  "card: 1 principale, nessun secondario duplicato",
);

console.log("\n=== ESITO ===");
for (const [nome, ok] of Object.entries(esiti)) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${nome}`);
}
if (falliti > 0) {
  console.error(`\n${falliti} asserzioni fallite.`);
  process.exit(1);
}
console.log("\nTutte le asserzioni sono passate.");
