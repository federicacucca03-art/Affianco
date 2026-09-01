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
  type CreativeFormatSnapshot,
} from "@/lib/qualita-creativita";

let falliti = 0;
const esiti: Record<string, boolean> = {
  "ASSET MISSING GUIDANCE": true,
  "9:16 GUIDANCE": true,
  "LANDSCAPE GUIDANCE": true,
  "RATIO GUIDANCE": true,
  "SILENT GOOD CASE": true,
  "UI CARD": true,
  "NO PERFORMANCE CLAIMS": true,
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

console.log("=== ASSET MISSING GUIDANCE ===");
const gVuoto = generaGuidanceCreativita({
  creativita: [],
  objective: "LEADS",
});
mark(
  "ASSET MISSING GUIDANCE",
  gVuoto.length === 1 &&
    gVuoto[0]?.id === ID_CREATIVE_ASSET_ASSENTE &&
    gVuoto[0].level === "SUGGESTION" &&
    gVuoto[0].title === "Aggiungi una creatività." &&
    gVuoto[0].field === "creativita" &&
    gVuoto[0].step === 4,
  "TEST 1: LEADS senza asset → SUGGESTION, non BLOCKER",
);
mark(
  "ASSET MISSING GUIDANCE",
  generaGuidanceCreativita({ creativita: [], objective: "ECOMMERCE" })
    .length === 0,
  "ECOMMERCE senza asset: nessuna guidance missing (solo LEADS)",
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
    !/ctr|conversion|perform/i.test(testiGuidance(gSolo11)),
  "TEST 2: solo 1:1 → manca 9:16, nessun claim performance",
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
  "TEST 3: 1:1+9:16, solo 9:16, 4:5+9:16 → silenzio",
);

console.log("\n=== LANDSCAPE GUIDANCE ===");
const gLandscape = generaGuidanceCreativita({
  creativita: [LANDSCAPE],
  objective: "LEADS",
});
const idsLandscape = gLandscape.map((i) => i.id);
mark(
  "LANDSCAPE GUIDANCE",
  idsLandscape.includes(ID_CREATIVE_LANDSCAPE) &&
    gLandscape.find((i) => i.id === ID_CREATIVE_LANDSCAPE)?.title ===
      "Il formato è molto orizzontale." &&
    !idsLandscape.includes(ID_CREATIVE_RATIO_NON_IDEALE),
  "TEST 4: landscape → suggestion orizzontale, senza duplicare ratio",
);
mark(
  "LANDSCAPE GUIDANCE",
  idsLandscape.includes(ID_CREATIVE_MANCA_9_16),
  "Aurora C: landscape include anche manca 9:16",
);
const visLandscape = selezionaGuidanceDaMostrare(
  gLandscape as Parameters<typeof selezionaGuidanceDaMostrare>[0],
);
mark(
  "LANDSCAPE GUIDANCE",
  visLandscape.principale?.id === ID_CREATIVE_LANDSCAPE &&
    visLandscape.secondari.length <= 2,
  "landscape è principale; max 2 secondari",
);

console.log("\n=== RATIO GUIDANCE ===");
const gRatio = generaGuidanceCreativita({
  creativita: [RATIO_STRANO],
  objective: "LEADS",
});
mark(
  "RATIO GUIDANCE",
  gRatio.some(
    (i) =>
      i.id === ID_CREATIVE_RATIO_NON_IDEALE &&
      i.title === "Il formato può essere adattato meglio.",
  ) && !gRatio.some((i) => i.id === ID_CREATIVE_LANDSCAPE),
  "TEST 5: ratio non Meta (non landscape) → adattamento",
);

console.log("\n=== NO PERFORMANCE CLAIMS ===");
const tuttiTesti = testiGuidance([
  ...gVuoto,
  ...gSolo11,
  ...gLandscape,
  ...gRatio,
]);
mark(
  "NO PERFORMANCE CLAIMS",
  LINGUAGGIO_PERFORMANCE.every((p) => !tuttiTesti.includes(p)),
  "TEST 6: nessun claim CTR/CPL/longevità/performance nei messaggi",
);
const helperSrc = src("src/lib/qualita-creativita.ts");
mark(
  "NO PERFORMANCE CLAIMS",
  !helperSrc.includes('level: "BLOCKER"') &&
    !helperSrc.includes('level: "WARNING"'),
  "helper P1A: solo SUGGESTION/INFO, nessun BLOCKER",
);

console.log("\n=== UI CARD ===");
const studio = src("src/components/nuova-contatti/StudioCreativo.tsx");
mark(
  "UI CARD",
  studio.includes("AffiancoSuggerisce") &&
    studio.includes("generaGuidanceCreativita") &&
    studio.includes("dropzoneConGuidance"),
  "card Affianco nello Step 4, vicino all'upload",
);
mark(
  "UI CARD",
  (studio.match(/<AffiancoSuggerisce/g) ?? []).length === 1 &&
    studio.includes("dropzoneConGuidance"),
  "una sola card guidance, non un box per asset",
);

console.log("\n=== REGRESSIONS ===");
const helper = src("src/lib/qualita-creativita.ts");
mark(
  "REGRESSIONS",
  helper.includes('from "@/lib/creativita"') &&
    helper.includes("aspectRatioMetaOk") &&
    helper.includes("aspectRatioStoriesOk") &&
    helper.includes("aspectRatioOrizzontale") &&
    !helper.includes("pre-lancio-check") &&
    !helper.includes("creativita-storage") &&
    !helper.includes("rischio-copy") &&
    !helper.includes("raccomanda-copy"),
  "riusa soglie creativita.ts; non tocca storage/pre-lancio/copy risk",
);
mark(
  "REGRESSIONS",
  gVuoto.every((i) => i.level !== "WARNING") &&
    !gVuoto.some((i) => (i as { level: string }).level === "BLOCKER"),
  "TEST 7: missing asset non blocca upload/export",
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

console.log("\n=== ESITO ===");
for (const [nome, ok] of Object.entries(esiti)) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${nome}`);
}
if (falliti > 0) {
  console.error(`\n${falliti} asserzioni fallite.`);
  process.exit(1);
}
console.log("\nTutte le asserzioni sono passate.");
