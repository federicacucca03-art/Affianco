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
  ID_CREATIVE_VISION_RELEVANCE_HIGH,
  ID_CREATIVE_VISION_RELEVANCE_LOW,
  ID_CREATIVE_VISION_RELEVANCE_MEDIUM,
  ID_CREATIVE_VISION_RELEVANCE_UNKNOWN,
  ID_CREATIVE_VISION_RISK_HARD,
  ID_CREATIVE_VISION_RISK_WARNING,
  findingsRischioDaVisibleText,
  generaGuidanceP1bCreativita,
  pruneStatoVisionPerAsset,
} from "@/lib/guidance-creativita-vision";
import {
  ID_CREATIVE_MANCA_9_16,
  generaGuidanceCreativita,
} from "@/lib/qualita-creativita";
import { maxCreativitaPerContesto } from "@/lib/creativita";
import { GET, POST } from "@/app/api/analyze-creative/route";

let falliti = 0;
const esiti: Record<string, boolean> = {
  AUTH: true,
  "IMAGE VALIDATION": true,
  "VISION CONTRACT": true,
  RELEVANCE: true,
  "VISIBLE TEXT": true,
  "RISK REUSE": true,
  "HIGH FEEDBACK": true,
  "MEDIUM FEEDBACK": true,
  "UNKNOWN FEEDBACK": true,
  "P1A MERGE": true,
  "VIDEO DEFER": true,
  "ERROR NON-BLOCKING": true,
  SECURITY: true,
  "NO PERFORMANCE CLAIMS": true,
  "PER-ASSET STATE": true,
  "PER-ASSET BUTTON": true,
  "PARTIAL ANALYSIS": true,
  "LOW ON SECONDARY": true,
  "RISK ON SECONDARY": true,
  "POSITIVE SUMMARY": true,
  "REMOVE ASSET RESET": true,
  "COST CONTROL": true,
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
  "HIGH FEEDBACK",
  gHigh.p1b.length === 1 &&
    gHigh.p1b[0]?.id === ID_CREATIVE_VISION_RELEVANCE_HIGH &&
    gHigh.p1b[0]?.level === "INFO" &&
    gHigh.p1b[0]?.title === "Il visual è coerente con l'offerta." &&
    gHigh.p1b[0]?.description === "Non sono emersi elementi da rivedere.",
  "CASE B: HIGH → feedback positivo, no warning",
);

const medium: CreativeVisionAnalysis = {
  relevance: "MEDIUM",
  relevanceReason: "Visual correlato ma generico.",
  visibleText: [],
};
const gMed = mergeP1(medium);
mark(
  "MEDIUM FEEDBACK",
  gMed.p1b.length === 1 &&
    gMed.p1b[0]?.id === ID_CREATIVE_VISION_RELEVANCE_MEDIUM &&
    gMed.p1b[0]?.level !== "WARNING" &&
    gMed.p1b[0]?.title === "Il visual è coerente, ma piuttosto generico." &&
    gMed.p1b[0]?.description === "Visual correlato ma generico.",
  "CASE D: MEDIUM → feedback neutro, no warning forte",
);

const gLow = mergeP1(low);
mark(
  "RELEVANCE",
  gLow.p1b.length === 1 &&
    gLow.p1b[0]?.id === ID_CREATIVE_VISION_RELEVANCE_LOW &&
    gLow.p1b[0]?.title === "Il visual sembra poco coerente con l'offerta.",
  "CASE F: LOW: warning coerenza",
);

const gUnk = mergeP1(unknown);
mark(
  "UNKNOWN FEEDBACK",
  gUnk.p1b.length === 1 &&
    gUnk.p1b[0]?.id === ID_CREATIVE_VISION_RELEVANCE_UNKNOWN &&
    gUnk.p1b[0]?.level === "INFO" &&
    gUnk.p1b[0]?.title === "Analisi completata." &&
    (gUnk.p1b[0]?.description ?? "").includes(
      "Non ho abbastanza elementi per valutare con sicurezza",
    ),
  "CASE E: UNKNOWN → Analisi completata, no warning",
);

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
  gWarn.p1b[0]?.id === ID_CREATIVE_VISION_RISK_WARNING &&
    !idsDi(gWarn.p1b).includes(ID_CREATIVE_VISION_RELEVANCE_HIGH),
  "CASE G: HIGH + risk → warning, niente feedback positivo",
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
    !idsDi(gHard.p1b).includes(ID_CREATIVE_VISION_RELEVANCE_MEDIUM) &&
    1 + shownMix.secondari.length <= 3,
  "CASE G: risk HARD prioritario; max 3; no MEDIUM feedback con risk",
);

const gNull = mergeP1(null);
mark(
  "HIGH FEEDBACK",
  gNull.p1b.length === 0 &&
    !JSON.stringify(gNull.merged).includes("Il visual è coerente con l'offerta."),
  "CASE A: IDLE → nessun feedback positivo vision",
);
mark(
  "P1A MERGE",
  gNull.p1b.length === 0 &&
    gNull.p1a.some((i) => i.id === ID_CREATIVE_MANCA_9_16) &&
    gNull.merged.length === gNull.p1a.length,
  "senza analisi P1B: solo P1A",
);

const shownHigh = selezionaGuidanceDaMostrare(gHigh.merged);
mark(
  "P1A MERGE",
  shownHigh.principale?.id === ID_CREATIVE_VISION_RELEVANCE_HIGH &&
    shownHigh.secondari.some((s) => s.id === ID_CREATIVE_MANCA_9_16) &&
    1 + shownHigh.secondari.length <= 3,
  "CASE C: HIGH + manca 9:16 nella stessa card, max 3",
);

const shownLow = selezionaGuidanceDaMostrare(gLow.merged);
mark(
  "P1A MERGE",
  shownLow.principale?.id === ID_CREATIVE_VISION_RELEVANCE_LOW,
  "LOW vince su P1A SUGGESTION 9:16",
);

console.log("\n=== VIDEO / ERROR / SECURITY / COPY ===");
const studio = src("src/components/nuova-contatti/StudioCreativo.tsx");
const dropzoneSrc = src("src/components/nuova-contatti/DropzoneCreativita.tsx");
mark(
  "VIDEO DEFER",
  dropzoneSrc.includes(
    "Analisi visual disponibile per immagini in questa versione.",
  ) &&
    studio.includes("if (!asset || asset.isVideo) return") &&
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
const FORBIDDEN_UX = [
  "creatività perfetta",
  "creativita perfetta",
  "pronta a performare",
  "ottima creatività",
  "ottima creativita",
  "alta qualità",
  "alta qualita",
  "convertirà bene",
  "convertira bene",
  "score creativo",
];
mark(
  "NO PERFORMANCE CLAIMS",
  !haPerformance(testi) &&
    !FORBIDDEN_UX.some((p) => testi.toLowerCase().includes(p)) &&
    routeSrc.includes("Vietato: performance, CTR, CPL, estetica"),
  "no CTR/CPL/performance/hype copy in P1B UI/helper",
);

mark(
  "NO PERFORMANCE CLAIMS",
  dropzoneSrc.includes('"Analizza"') &&
    dropzoneSrc.includes("onAnalizzaCreativita") &&
    studio.includes("analizzaCreativitaAsset") &&
    studio.includes("visionById") &&
    !studio.includes("Analizza tutto") &&
    !studio.includes("Promise.all"),
  "trigger per asset, non auto-run, no batch",
);

const form = src("src/components/nuova-contatti/FormConfigurazione.tsx");
mark(
  "P1A MERGE",
  /\belevatorPitch=\{elevatorPitch\}/.test(form),
  "brief LEADS passato a StudioCreativo come prop",
);

console.log("\n=== MULTI-ASSET ===");
mark(
  "PER-ASSET STATE",
  studio.includes("visionById") &&
    studio.includes("pruneStatoVisionPerAsset") &&
    !studio.includes("const [visionAnalysis,"),
  "stato keyed per asset id, non globale",
);
mark(
  "PER-ASSET BUTTON",
  dropzoneSrc.includes("onAnalizzaCreativita(c.id)") &&
    dropzoneSrc.includes('{inCorso ? "Analisi…" : "Analizza"}'),
  "bottone Analizza per ogni card immagine",
);

const soloUno = generaGuidanceP1bCreativita({
  analyses: [{ assetId: "a1", indice: 1, analysis: high }],
  immaginiTotali: 2,
  offerta: AURORA_OFFERTA,
  brief: AURORA_BRIEF,
});
mark(
  "PARTIAL ANALYSIS",
  soloUno.length === 1 &&
    (soloUno[0]?.title ?? "").includes("Creatività 1 analizzata") &&
    !(soloUno[0]?.title ?? "").includes("Le creatività analizzate sono coerenti") &&
    (soloUno[0]?.description ?? "").includes("1 di 2"),
  "CASE A: un solo asset analizzato, no riepilogo globale",
);

const lowSecondario = generaGuidanceP1bCreativita({
  analyses: [
    { assetId: "a1", indice: 1, analysis: high },
    { assetId: "a2", indice: 2, analysis: low },
  ],
  immaginiTotali: 2,
  offerta: AURORA_OFFERTA,
  brief: AURORA_BRIEF,
});
mark(
  "LOW ON SECONDARY",
  lowSecondario.some(
    (i) =>
      i.id.startsWith(ID_CREATIVE_VISION_RELEVANCE_LOW) &&
      i.title === "Creatività 2: il visual sembra poco coerente con l'offerta.",
  ) && !lowSecondario.some((i) => i.id === ID_CREATIVE_VISION_RELEVANCE_HIGH),
  "CASE A2: LOW su creatività 2, niente positivo globale",
);

const hardSecondario = generaGuidanceP1bCreativita({
  analyses: [
    { assetId: "a1", indice: 1, analysis: high },
    { assetId: "a2", indice: 2, analysis: claimHard },
  ],
  immaginiTotali: 2,
  offerta: AURORA_OFFERTA,
  brief: AURORA_BRIEF,
});
const shownHard2 = selezionaGuidanceDaMostrare([
  ...hardSecondario,
  ...generaGuidanceCreativita({
    creativita: [
      { width: 1080, height: 1080 },
      { width: 1080, height: 1080 },
    ],
    objective: "LEADS",
  }),
]);
mark(
  "RISK ON SECONDARY",
  shownHard2.principale?.title ===
    "Creatività 2: da rivedere prima del lancio." &&
    shownHard2.principale!.id.startsWith(ID_CREATIVE_VISION_RISK_HARD) &&
    1 + shownHard2.secondari.length <= 3,
  "CASE C: HARD su creatività 2 prioritario, max 3",
);

const tuttiOk = generaGuidanceP1bCreativita({
  analyses: [
    { assetId: "a1", indice: 1, analysis: high },
    { assetId: "a2", indice: 2, analysis: high },
  ],
  immaginiTotali: 2,
  offerta: AURORA_OFFERTA,
  brief: AURORA_BRIEF,
});
mark(
  "POSITIVE SUMMARY",
  tuttiOk.length === 1 &&
    tuttiOk[0]?.title ===
      "Le creatività analizzate sono coerenti con l'offerta." &&
    tuttiOk[0]?.description ===
      "Non sono emersi elementi critici nei visual analizzati.",
  "CASE B: tutti analizzati ok → un solo riepilogo",
);

const dopoRemove = generaGuidanceP1bCreativita({
  analyses: [{ assetId: "a1", indice: 1, analysis: high }],
  immaginiTotali: 1,
  offerta: AURORA_OFFERTA,
  brief: AURORA_BRIEF,
});
const pruned = pruneStatoVisionPerAsset(
  { a1: high, a2: low },
  ["a1"],
);
mark(
  "REMOVE ASSET RESET",
  pruned.a1 === high &&
    pruned.a2 === undefined &&
    dopoRemove[0]?.title === "Il visual è coerente con l'offerta." &&
    !dopoRemove.some((i) => i.title.includes("Creatività 2")),
  "CASE D: asset rimosso → warning sparisce",
);

mark(
  "COST CONTROL",
  maxCreativitaPerContesto("LEADS") === 3 &&
    !studio.includes("retry") &&
    dropzoneSrc.includes("disabled={inCorso}"),
  "max 3 LEADS, 1 click = 1 chiamata, no retry/batch",
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
