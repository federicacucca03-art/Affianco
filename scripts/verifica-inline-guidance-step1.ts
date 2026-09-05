/**
 * Verifica inline guidance Step 1 (UX, non regole qualità).
 * Esegui: npx tsx scripts/verifica-inline-guidance-step1.ts
 */
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "test-anon-key";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  guidanceInlineBrief,
  guidanceInlineEta,
  guidanceInlineOfferta,
  guidanceStep1NonInline,
} from "@/components/nuova-contatti/InlineGuidance";
import { generaGuidanceStep1 } from "@/lib/guidance";

let falliti = 0;
const esiti: Record<string, boolean> = {
  "OFFER INLINE": true,
  "BRIEF INLINE": true,
  "MISMATCH INLINE": true,
  "AGE INLINE": true,
  "NO DUPLICATES": true,
  "AURORA SILENT": true,
  MOBILE: true,
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

const AURORA_OFFERTA =
  "Prima visita implantologica con valutazione del caso e piano di trattamento personalizzato";
const AURORA_BRIEF =
  "Studio dentistico a Roma che vuole aumentare le richieste di contatto per implantologia. Il target principale sono adulti che hanno perso uno o più denti o stanno valutando una soluzione fissa. L’obiettivo è generare richieste di prima visita qualificate, con una comunicazione rassicurante e professionale, evitando promesse di risultato o toni troppo aggressivi.";

const srcForm = readFileSync(
  join(process.cwd(), "src/components/nuova-contatti/FormConfigurazione.tsx"),
  "utf8",
);
const srcInline = readFileSync(
  join(process.cwd(), "src/components/nuova-contatti/InlineGuidance.tsx"),
  "utf8",
);

function indiceDopo(haystack: string, needle: string, after: string): number {
  const start = haystack.indexOf(after);
  if (start < 0) return -1;
  return haystack.indexOf(needle, start);
}

console.log("=== OFFER INLINE ===");
const itemsA = generaGuidanceStep1({
  frontEndOffer: "Servizi di qualità",
  elevatorPitch: AURORA_BRIEF,
  targetAge: "25-50",
});
const offertaA = guidanceInlineOfferta(itemsA);
mark(
  "OFFER INLINE",
  offertaA?.id === "step1-offerta-generica" &&
    offertaA.title === "Rendi l'offerta più specifica.",
  "Servizi di qualità → item offerta GENERIC",
);
mark(
  "OFFER INLINE",
  srcForm.includes("<InlineGuidance item={guidanceOfferta} />") &&
    srcForm.includes("key={`offerta-${objectiveEffettivo}`}") &&
    indiceDopo(
      srcForm,
      "<InlineGuidance item={guidanceOfferta} />",
      "key={`offerta-${objectiveEffettivo}`}",
    ) > 0,
  "InlineGuidance sotto textarea Offerta",
);

console.log("\n=== BRIEF INLINE ===");
const itemsB = generaGuidanceStep1({
  frontEndOffer: AURORA_OFFERTA,
  elevatorPitch: "Voglio più clienti",
  targetAge: "25-50",
});
const briefB = guidanceInlineBrief(itemsB);
mark(
  "BRIEF INLINE",
  briefB?.id === "step1-brief-corto" &&
    briefB.title === "Il brief può guidare meglio Ally.",
  "brief corto → item sotto Brief",
);
const occorrenzeBriefInline = srcForm.split(
  "<InlineGuidance item={guidanceBrief} />",
).length - 1;
mark(
  "BRIEF INLINE",
  occorrenzeBriefInline === 2,
  "InlineGuidance sotto entrambi i textarea Brief",
);

console.log("\n=== MISMATCH INLINE ===");
const itemsD = generaGuidanceStep1({
  frontEndOffer: "Prima visita implantologica",
  elevatorPitch: "Campagna per sbiancamento dentale",
  targetAge: "25-50",
});
const briefD = guidanceInlineBrief(itemsD);
mark(
  "MISMATCH INLINE",
  briefD?.id === "step1-mismatch" &&
    briefD.level === "WARNING" &&
    briefD.title === "Offerta e brief non sembrano allineati.",
  "mismatch → WARNING sotto Brief, priorità sul brief corto",
);
mark(
  "MISMATCH INLINE",
  guidanceInlineOfferta(itemsD) == null,
  "mismatch con offerta GOOD non sposta warning sull'offerta",
);

console.log("\n=== AGE INLINE ===");
const itemsEta = generaGuidanceStep1({
  frontEndOffer: AURORA_OFFERTA,
  elevatorPitch: AURORA_BRIEF,
  targetAge: "all",
});
mark(
  "AGE INLINE",
  guidanceInlineEta(itemsEta)?.id === "step1-eta-ampia",
  "età universale → item età",
);
mark(
  "AGE INLINE",
  srcForm.includes("<InlineGuidance item={guidanceEta} />") &&
    indiceDopo(
      srcForm,
      "<InlineGuidance item={guidanceEta} />",
      "Fascia d&apos;Età prevalente",
    ) > 0,
  "InlineGuidance sotto selettore età",
);

console.log("\n=== NO DUPLICATES ===");
mark(
  "NO DUPLICATES",
  srcForm.includes(
    "<AffiancoSuggerisce items={guidanceStep1Residua} />",
  ) && !srcForm.includes("<AffiancoSuggerisce items={guidanceStep1} />"),
  "card generale Step 1 non riceve più offerta/brief/mismatch/età",
);
mark(
  "NO DUPLICATES",
  guidanceStep1NonInline(itemsA).length === 0 &&
    guidanceStep1NonInline(itemsD).length === 0 &&
    guidanceStep1NonInline(itemsEta).length === 0,
  "item inline esclusi dalla card residua",
);
mark(
  "NO DUPLICATES",
  srcForm.includes("generaGuidanceEconomica") &&
    srcForm.includes("<AffiancoSuggerisce items={guidanceEconomica} />"),
  "Step 2 mantiene la card generale economica",
);

console.log("\n=== AURORA SILENT ===");
const aurora = generaGuidanceStep1({
  frontEndOffer: AURORA_OFFERTA,
  elevatorPitch: AURORA_BRIEF,
  targetAge: "25-50",
});
mark(
  "AURORA SILENT",
  aurora.length === 0 &&
    guidanceInlineOfferta(aurora) == null &&
    guidanceInlineBrief(aurora) == null &&
    guidanceInlineEta(aurora) == null,
  "Aurora GOOD: nessuna inline guidance",
);

console.log("\n=== MOBILE ===");
mark(
  "MOBILE",
  srcInline.includes("w-full min-w-0") &&
    !srcInline.includes("sidebar") &&
    !srcInline.includes("md:absolute") &&
    !srcInline.includes("aside"),
  "inline full-width, non in sidebar",
);
mark(
  "MOBILE",
  srcForm.includes("function Passo1Sezione") &&
    srcForm.includes('className="space-y-4"') &&
    srcForm.includes("<InlineGuidance item={guidanceOfferta} />") &&
    srcForm.includes("<InlineGuidance item={guidanceBrief} />") &&
    srcForm.includes("<InlineGuidance item={guidanceEta} />"),
  "flusso verticale: campo → guidance → campo successivo",
);

if (falliti > 0) {
  console.error(`\n${falliti} asserzioni fallite`);
  process.exit(1);
}
console.log("\nTutti i test inline guidance Step 1 sono passati.");
