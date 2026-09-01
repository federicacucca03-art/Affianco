/**
 * Verifica Guidance P1.1A — rilevazione rischio copy LEADS.
 * Esegui: npx tsx scripts/verifica-guidance-p1-risk.ts
 */
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "test-anon-key";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { raccomandaCopy } from "@/lib/raccomanda-copy";
import {
  analizzaRischioCopy,
  livelloRischioCopy,
} from "@/lib/rischio-copy";

let falliti = 0;
const esiti: Record<string, boolean> = {
  "HARD CLAIMS": true,
  "NON HARD": true,
  WARNING: true,
  "CONTEXT SUPPORT": true,
  AURORA: true,
  RANKING: true,
  "NO PERFORMANCE": true,
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

const AURORA_OFFERTA =
  "Prima visita implantologica con valutazione del caso e piano di trattamento personalizzato";
const AURORA_BRIEF =
  "Studio dentistico a Roma che vuole aumentare le richieste di contatto per implantologia. Il target principale sono adulti che hanno perso uno o più denti o stanno valutando una soluzione fissa. L’obiettivo è generare richieste di prima visita qualificate, con una comunicazione rassicurante e professionale, evitando promesse di risultato o toni troppo aggressivi.";

const BASE = {
  titoloAnnuncio: "Prima visita implantologica a Roma",
  offerta: AURORA_OFFERTA,
  brief: AURORA_BRIEF,
  citta: "Roma",
  settore: "Dentista",
  objective: "LEADS" as const,
};

const TESTO_SOLIDO =
  "Stai valutando una soluzione per uno o più denti mancanti a Roma? Richiedi una prima visita implantologica con valutazione del caso e piano di trattamento personalizzato.";
const TESTO_C_CLAIM =
  "Risultato garantito. Torna a sorridere subito.";
const TESTO_CON_WARNING = `${TESTO_SOLIDO} Soluzione definitiva.`;

const LINGUAGGIO_PERFORMANCE = [
  "ctr",
  "cpl",
  "conversione",
  "performance",
  "performerà",
  "performera",
  "più efficace",
  "abbasserà",
  "abbassera",
];

function testoHaPerformance(t: string): boolean {
  const lower = t.toLowerCase();
  return LINGUAGGIO_PERFORMANCE.some((p) => lower.includes(p));
}

function haHard(testo: string): boolean {
  return livelloRischioCopy(analizzaRischioCopy({ testo })) === "HARD_FAIL";
}

function haWarning(testo: string, extra?: { offerta?: string; brief?: string }): boolean {
  return (
    livelloRischioCopy(
      analizzaRischioCopy({
        testo,
        offerta: extra?.offerta,
        brief: extra?.brief,
      }),
    ) === "WARNING"
  );
}

function eNessuno(testo: string, extra?: { offerta?: string; brief?: string }): boolean {
  return (
    livelloRischioCopy(
      analizzaRischioCopy({
        testo,
        offerta: extra?.offerta,
        brief: extra?.brief,
      }),
    ) === "NONE"
  );
}

console.log("=== HARD CLAIMS ===");
mark("HARD CLAIMS", haHard("Risultato garantito."), "A Risultato garantito.");
mark("HARD CLAIMS", haHard("Risultati garantiti."), "B Risultati garantiti.");
mark(
  "HARD CLAIMS",
  haHard("Garantiamo il risultato."),
  "C Garantiamo il risultato.",
);
mark("HARD CLAIMS", haHard("Successo garantito."), "D Successo garantito.");
mark("HARD CLAIMS", haHard("Zero rischi."), "E Zero rischi.");
mark("HARD CLAIMS", haHard("100% sicuro."), "F 100% sicuro.");
mark(
  "HARD CLAIMS",
  haHard("Elimina definitivamente il problema."),
  "G Elimina definitivamente il problema.",
);
mark(
  "HARD CLAIMS",
  haHard("100% sicura") && haHard("100% sicuri"),
  "100% sicura / sicuri",
);
mark(
  "HARD CLAIMS",
  haHard("Risultato assicurato.") && haHard("Garantiamo risultati."),
  "risultato assicurato / garantiamo risultati",
);

console.log("\n=== NON HARD / FALSE POSITIVE ===");
mark("NON HARD", eNessuno("Qualità garantita."), "Qualità garantita → NONE");
mark("NON HARD", eNessuno("Prenota subito."), "Prenota subito → NONE");
mark(
  "NON HARD",
  eNessuno("Approccio definitivo alla configurazione."),
  "Approccio definitivo → NONE",
);
mark("NON HARD", eNessuno("100% del budget."), "100% del budget → NONE");
mark("NON HARD", eNessuno(""), "testo vuoto → nessun finding");

console.log("\n=== WARNING ===");
mark(
  "WARNING",
  haWarning("Soluzione definitiva."),
  "Soluzione definitiva senza supporto → WARNING",
);
mark(
  "WARNING",
  haWarning("Torna a sorridere subito."),
  "Torna a sorridere subito → WARNING (non per subito)",
);
mark(
  "WARNING",
  haWarning("Senza dolore."),
  "Senza dolore senza supporto → WARNING",
);
mark(
  "WARNING",
  !haHard("Torna a sorridere subito.") &&
    analizzaRischioCopy({ testo: "Torna a sorridere subito." }).length === 1 &&
    analizzaRischioCopy({ testo: "Torna a sorridere subito." })[0]?.id ===
      "torna-a-sorridere",
  "subito da solo non aggiunge finding",
);

console.log("\n=== CONTEXT SUPPORT ===");
mark(
  "CONTEXT SUPPORT",
  haWarning("Senza dolore.", {
    brief: "trattamento pensato per ridurre il dolore",
  }),
  "ridurre il dolore NON supporta senza dolore",
);
mark(
  "CONTEXT SUPPORT",
  eNessuno("Senza dolore.", { offerta: "visita senza dolore" }),
  "senza dolore in offerta → nessun warning",
);
mark(
  "CONTEXT SUPPORT",
  eNessuno("Soluzione definitiva.", {
    brief: "proponiamo una soluzione definitiva al caso",
  }),
  "soluzione definitiva nel brief → nessun warning",
);
mark(
  "CONTEXT SUPPORT",
  eNessuno("Torna a sorridere.", { brief: "aiutarti a tornare a sorridere" }),
  "tornare a sorridere nel brief → nessun warning",
);

console.log("\n=== AURORA ===");
const aurora = raccomandaCopy({
  ...BASE,
  varianteA: TESTO_SOLIDO,
  varianteB: TESTO_SOLIDO,
  varianteC: TESTO_C_CLAIM,
});
const profiloC = aurora?.profiles.find((p) => p.variant === "C");
mark(
  "AURORA",
  profiloC?.hardFail === true && profiloC.status === "REVIEW",
  "C hardFail REVIEW",
);
mark(
  "AURORA",
  (profiloC?.reasons ?? []).includes("Claim troppo assoluto"),
  `C reason Claim troppo assoluto (got ${profiloC?.reasons.join(" | ")})`,
);
mark(
  "AURORA",
  JSON.stringify(aurora?.recommendedVariants) === JSON.stringify(["A", "B"]),
  `A/B tie (got ${JSON.stringify(aurora?.recommendedVariants)})`,
);
mark(
  "AURORA",
  aurora?.description === "Varianti A e B sono entrambe solide.",
  "nessun tone matching, pareggio A/B",
);
mark(
  "AURORA",
  !testoHaPerformance(
    `${aurora?.title} ${aurora?.description} ${(aurora?.reasons ?? []).join(" ")} ${(profiloC?.reasons ?? []).join(" ")}`,
  ),
  "nessun claim performance in Aurora",
);

console.log("\n=== RANKING WARNING ===");
const ranking = raccomandaCopy({
  ...BASE,
  varianteA: TESTO_SOLIDO,
  varianteB: TESTO_CON_WARNING,
  varianteC: TESTO_C_CLAIM,
});
mark(
  "RANKING",
  JSON.stringify(ranking?.recommendedVariants) === JSON.stringify(["A"]),
  `senza warning vince a parità (got ${JSON.stringify(ranking?.recommendedVariants)})`,
);
mark(
  "RANKING",
  ranking?.profiles.find((p) => p.variant === "B")?.hardFail === false &&
    ranking?.profiles.find((p) => p.variant === "B")?.riskWarning === true &&
    ranking?.profiles.find((p) => p.variant === "B")?.status === "ALTERNATIVE",
  "B resta valida con warning, non consigliata",
);
mark(
  "RANKING",
  (ranking?.profiles.find((p) => p.variant === "B")?.reasons ?? []).includes(
    "Claim da verificare",
  ),
  "warning entra nei reasons di B",
);

console.log("\n=== NO PERFORMANCE / ISOLAMENTO ===");
const srcRischio = src("src/lib/rischio-copy.ts");
const srcHelper = src("src/lib/raccomanda-copy.ts");
const srcChecker = src("src/lib/controllo-messaggio.ts");
const srcGenerate = src("src/app/api/generate-copy/route.ts");
mark(
  "NO PERFORMANCE",
  !testoHaPerformance(srcRischio) && !testoHaPerformance(srcHelper),
  "rischio e ranking senza CTR/CPL/performance",
);
mark(
  "NO PERFORMANCE",
  !srcChecker.includes("rischio-copy") &&
    !srcGenerate.includes("rischio-copy") &&
    !srcGenerate.includes("analizzaRischioCopy"),
  "checker e generate-copy non toccati dal rischio",
);
mark(
  "NO PERFORMANCE",
  !srcRischio.includes("TonoVoce") &&
    !srcHelper.includes("Usa questa variante") &&
    !srcHelper.includes("primary_variant"),
  "niente tone ranking, swap o primary_variant",
);

const srcForm = src("src/components/nuova-contatti/FormConfigurazione.tsx");
mark(
  "NO PERFORMANCE",
  srcForm.includes("testoVarianteA: valoriVarianti[0]") &&
    srcForm.includes("Usata per il lancio"),
  "checker A e badge lancio invariati",
);

if (falliti > 0) {
  console.error(`\n${falliti} asserzioni fallite`);
  process.exit(1);
}
console.log("\nTutti i test Guidance P1.1A risk sono passati.");
