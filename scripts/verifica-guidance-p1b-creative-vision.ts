/**
 * Verifica Guidance P1B — vision grounded minimale (Step 4).
 * Nessuna chiamata Anthropic reale.
 * Esegui: npx tsx scripts/verifica-guidance-p1b-creative-vision.ts
 */
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "test-anon-key";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { selezionaGuidanceDaMostrare } from "@/lib/guidance";
import {
  MAX_IMAGE_BYTES,
  parseCreativeVisionAnalysis,
  parseDataUrlImmagine,
  VISION_UNKNOWN,
  type CreativeVisionAnalysis,
} from "@/lib/analyze-creative";
import { tokenDaAuthorization } from "@/lib/api-auth";
import {
  ID_CREATIVE_VISION_RELEVANCE_LOW,
  ID_CREATIVE_VISION_RISK_HARD,
  ID_CREATIVE_VISION_RISK_WARNING,
  findingsRischioDaVisibleText,
  generaGuidanceP1bCreativita,
} from "@/lib/guidance-creativita-vision";
import {
  ID_CREATIVE_MANCA_9_16,
  generaGuidanceCreativita,
} from "@/lib/qualita-creativita";
import { GET, POST } from "@/app/api/analyze-creative/route";

let falliti = 0;
const esiti: Record<string, boolean> = {
  AUTH: true,
  "IMAGE VALIDATION": true,
  "VISION CONTRACT": true,
  RELEVANCE: true,
  "VISIBLE TEXT": true,
  "RISK REUSE": true,
  "P1A MERGE": true,
  "VIDEO DEFER": true,
  "ERROR NON-BLOCKING": true,
  SECURITY: true,
  "NO PERFORMANCE CLAIMS": true,
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

const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const DATA_PNG = `data:image/png;base64,${PNG_1X1}`;

const AURORA_OFFERTA =
  "Prima visita implantologica con valutazione del caso e piano di trattamento personalizzato";
const AURORA_BRIEF =
  "Studio dentistico a Roma che vuole aumentare le richieste di contatto per implantologia.";

const LINGUAGGIO_PERFORMANCE = [
  "alto ctr",
  "ctr più alto",
  "ctr piu alto",
  "cpl inferiore",
  "performerà meglio",
  "performera meglio",
  "questa creatività performerà",
  "questa creativita performerà",
  "prevedere ctr",
  "prevedere cpl",
];

function haPerformance(t: string): boolean {
  const lower = t.toLowerCase();
  return LINGUAGGIO_PERFORMANCE.some((p) => lower.includes(p));
}

function idsDi(items: { id: string }[]): string[] {
  return items.map((i) => i.id);
}

function mergeP1(analysis: CreativeVisionAnalysis | null) {
  const p1b = generaGuidanceP1bCreativita({
    analysis,
    offerta: AURORA_OFFERTA,
    brief: AURORA_BRIEF,
  });
  const p1a = generaGuidanceCreativita({
    creativita: [{ width: 1080, height: 1080 }],
    objective: "LEADS",
  });
  return { p1a, p1b, merged: [...p1b, ...p1a] };
}

console.log("=== AUTH ===");
mark(
  "AUTH",
  tokenDaAuthorization(null) === null &&
    tokenDaAuthorization("Bearer") === null &&
    tokenDaAuthorization("Bearer abc") === "abc",
  "token Bearer parsato; assenza token = null",
);

void (async () => {
const unauth = await POST(
  new Request("http://localhost/api/analyze-creative", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image: DATA_PNG,
      offerta: AURORA_OFFERTA,
      brief: AURORA_BRIEF,
      settore: "Dentista",
    }),
  }),
);
mark("AUTH", unauth.status === 401, `unauthenticated → 401 (got ${unauth.status})`);

const getRes = await GET();
mark("AUTH", getRes.status === 405, `GET → 405 (got ${getRes.status})`);

console.log("\n=== IMAGE VALIDATION ===");
const gif = parseDataUrlImmagine(`data:image/gif;base64,${PNG_1X1}`);
mark(
  "IMAGE VALIDATION",
  !gif.ok && gif.status === 400,
  "invalid MIME gif → 400",
);

const httpUrl = parseDataUrlImmagine("https://example.com/ad.jpg");
mark(
  "IMAGE VALIDATION",
  !httpUrl.ok && httpUrl.status === 400,
  "URL http → 400, non accettato",
);

const storagePath = parseDataUrlImmagine("campagne/xyz/principale.jpg");
mark(
  "IMAGE VALIDATION",
  !storagePath.ok && storagePath.status === 400,
  "storagePath / path → 400",
);

const oversizeB64 = "A".repeat(Math.ceil(((MAX_IMAGE_BYTES + 32) * 4) / 3));
const oversize = parseDataUrlImmagine(`data:image/jpeg;base64,${oversizeB64}`);
mark(
  "IMAGE VALIDATION",
  !oversize.ok && oversize.status === 400,
  "oversized image → 400",
);

const okPng = parseDataUrlImmagine(DATA_PNG);
mark("IMAGE VALIDATION", okPng.ok === true, "data URL png valida");

console.log("\n=== VISION CONTRACT ===");
const invalidJson = parseCreativeVisionAnalysis("non è json");
mark(
  "VISION CONTRACT",
  invalidJson.relevance === "UNKNOWN" &&
    invalidJson.relevanceReason === null &&
    invalidJson.visibleText.length === 0,
  "JSON invalido → UNKNOWN fallback, no crash",
);

const extraFields = parseCreativeVisionAnalysis(
  JSON.stringify({
    relevance: "HIGH",
    relevanceReason: "Trattamento visibile.",
    visibleText: ["ciao"],
    score: 99,
    ctr: 0.12,
    confidence: 0.9,
  }),
);
mark(
  "VISION CONTRACT",
  extraFields.relevance === "HIGH" &&
    !("score" in extraFields) &&
    !("ctr" in extraFields) &&
    !("confidence" in extraFields) &&
    Object.keys(extraFields).sort().join(",") ===
      "relevance,relevanceReason,visibleText",
  "solo i 3 campi del contract",
);

mark(
  "VISION CONTRACT",
  VISION_UNKNOWN.relevance === "UNKNOWN",
  "VISION_UNKNOWN costante",
);

console.log("\n=== RELEVANCE / VISIBLE TEXT / RISK / MERGE ===");
const high: CreativeVisionAnalysis = {
  relevance: "HIGH",
  relevanceReason: "Il visual mostra un trattamento odontoiatrico, coerente con l’offerta.",
  visibleText: [],
};
const low: CreativeVisionAnalysis = {
  relevance: "LOW",
  relevanceReason: "Il visual mostra un’automobile, non allineata all’offerta.",
  visibleText: [],
};
const unknown: CreativeVisionAnalysis = {
  relevance: "UNKNOWN",
  relevanceReason: null,
  visibleText: [],
};
const claimHard: CreativeVisionAnalysis = {
  relevance: "MEDIUM",
  relevanceReason: "Grafica del settore dentale.",
  visibleText: ["Risultato garantito.", "Torna a sorridere subito."],
};
const claimWarn: CreativeVisionAnalysis = {
  relevance: "HIGH",
  relevanceReason: "Visual clinico coerente.",
  visibleText: ["Torna a sorridere subito."],
};

const gHigh = mergeP1(high);
mark(
  "RELEVANCE",
  gHigh.p1b.length === 0,
  "HIGH: silenzio vision (nessun item P1B)",
);

const gLow = mergeP1(low);
mark(
  "RELEVANCE",
  gLow.p1b.length === 1 &&
    gLow.p1b[0]?.id === ID_CREATIVE_VISION_RELEVANCE_LOW &&
    gLow.p1b[0]?.title === "Il visual sembra poco coerente con l'offerta.",
  "LOW: warning coerenza",
);

const gUnk = mergeP1(unknown);
mark("RELEVANCE", gUnk.p1b.length === 0, "UNKNOWN: silenzio, no warning forte");

const findingsHard = findingsRischioDaVisibleText(
  claimHard.visibleText,
  AURORA_OFFERTA,
  AURORA_BRIEF,
);
mark(
  "VISIBLE TEXT",
  findingsHard.some((f) => f.id === "risultato-garantito"),
  "visibleText join → rischio-copy vede il claim hard",
);

const gHard = mergeP1(claimHard);
const shownHard = selezionaGuidanceDaMostrare(gHard.merged);
mark(
  "RISK REUSE",
  shownHard.principale?.id === ID_CREATIVE_VISION_RISK_HARD &&
    shownHard.principale?.title === "Da rivedere prima del lancio." &&
    (shownHard.principale?.description ?? "")
      .toLowerCase()
      .includes("claim troppo forte"),
  "HARD_FAIL → card principale risk",
);

const gWarn = mergeP1(claimWarn);
mark(
  "RISK REUSE",
  gWarn.p1b[0]?.id === ID_CREATIVE_VISION_RISK_WARNING,
  "contextual warning visivo (torna a sorridere, unsupported)",
);

const shownMix = selezionaGuidanceDaMostrare(gHard.merged);
const mixIds = [
  shownMix.principale?.id,
  ...shownMix.secondari.map((s) => s.id),
];
mark(
  "P1A MERGE",
  mixIds[0] === ID_CREATIVE_VISION_RISK_HARD &&
    mixIds.includes(ID_CREATIVE_VISION_RISK_WARNING) &&
    mixIds.indexOf(ID_CREATIVE_VISION_RISK_HARD) <
      mixIds.indexOf(ID_CREATIVE_VISION_RISK_WARNING) &&
    1 + shownMix.secondari.length <= 3,
  "priorità risk > relevance > P1A; max 3",
);

const gNull = mergeP1(null);
mark(
  "P1A MERGE",
  gNull.p1b.length === 0 &&
    gNull.p1a.some((i) => i.id === ID_CREATIVE_MANCA_9_16) &&
    gNull.merged.length === gNull.p1a.length,
  "senza analisi P1B: solo P1A",
);

const shownLow = selezionaGuidanceDaMostrare(gLow.merged);
mark(
  "P1A MERGE",
  shownLow.principale?.id === ID_CREATIVE_VISION_RELEVANCE_LOW,
  "LOW vince su P1A SUGGESTION 9:16",
);

console.log("\n=== VIDEO / ERROR / SECURITY / COPY ===");
const studio = src("src/components/nuova-contatti/StudioCreativo.tsx");
mark(
  "VIDEO DEFER",
  studio.includes("Analisi visual disponibile per immagini in questa versione.") &&
    studio.includes('if (!assetPrincipale || assetPrincipale.isVideo) return') &&
    !studio.includes("extractFrame") &&
    !studio.includes("html5 video currentTime"),
  "video: microcopy, no frame extract, no analyze",
);

mark(
  "ERROR NON-BLOCKING",
  studio.includes(
    "Non sono riuscito ad analizzare il visual. Puoi continuare comunque.",
  ) &&
    !studio.includes("BLOCKER") &&
    studio.includes('"IDLE" | "ANALYZING" | "SUCCESS" | "UNKNOWN" | "ERROR"'),
  "errore non bloccante, stati React",
);

const routeSrc = src("src/app/api/analyze-creative/route.ts");
const analyzeSrc = src("src/lib/analyze-creative.ts");
const loggaBase64 =
  /console\.(log|debug|info|warn|error)\([^)]*base64/i.test(routeSrc) ||
  /console\.(log|debug|info|warn|error)\([^)]*image/i.test(routeSrc) ||
  /console\.(log|debug|info|warn)\(/.test(routeSrc);
mark("SECURITY", !loggaBase64, "route: nessun console.log (no base64 leak)");
mark(
  "SECURITY",
  !routeSrc.includes("storagePath") &&
    analyzeSrc.includes("Invia l'immagine come data URL, non come link."),
  "nessun storagePath client; URL arbitrari rifiutati",
);
mark(
  "SECURITY",
  routeSrc.includes("requireRouteUserId") &&
    !analyzeSrc.includes("fetch("),
  "auth obbligatoria; parser non fetcha URL",
);

const visionLib = src("src/lib/guidance-creativita-vision.ts");
const testi = [
  visionLib,
  studio,
  JSON.stringify(gHigh.p1b),
  JSON.stringify(gLow.p1b),
  JSON.stringify(gHard.p1b),
].join("\n");
mark(
  "NO PERFORMANCE CLAIMS",
  !haPerformance(testi) &&
    routeSrc.includes("Vietato: performance, CTR, CPL, estetica"),
  "no CTR/CPL/performance copy in P1B UI/helper",
);

mark(
  "NO PERFORMANCE CLAIMS",
  studio.includes("Analizza creatività") &&
    studio.includes("Analisi in corso") &&
    !studio.includes("useEffect(() => {\n    void analizzaCreativitaPrincipale"),
  "trigger solo click, non auto-run",
);

const form = src("src/components/nuova-contatti/FormConfigurazione.tsx");
mark(
  "P1A MERGE",
  /\belevatorPitch=\{elevatorPitch\}/.test(form),
  "brief LEADS passato a StudioCreativo come prop",
);

console.log("\n=== ESITI ===");
for (const [k, v] of Object.entries(esiti)) {
  console.log(`${v ? "PASS" : "FAIL"}  ${k}`);
}
if (falliti > 0) {
  console.error(`\n${falliti} check falliti`);
  process.exit(1);
}
console.log("\nTutti i check P1B ok.");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
