/**
 * Raccomandazione copy A/B/C (LEADS).
 * Riusa il checker esistente + rischio copy. Nessuno score visibile, nessuna AI.
 *
 * Limite: il tono non entra nel ranking.
 * Le promesse di risultato non coperte dai pattern di rischio
 * non influenzano il ranking.
 */

import { analizzaControlloMessaggioLeads } from "@/lib/controllo-messaggio";
import {
  analizzaRischioCopy,
  livelloRischioCopy,
} from "@/lib/rischio-copy";
import type { CampagnaObjective } from "@/types/campagne";

export type CopyVariantId = "A" | "B" | "C";
export type CopyRecommendationStatus =
  | "RECOMMENDED"
  | "ALTERNATIVE"
  | "REVIEW";
export type CopySignalLevel = "green" | "yellow" | "missing";

export type CopyVariantProfile = {
  variant: CopyVariantId;
  status: CopyRecommendationStatus;
  hardFail: boolean;
  coherence: CopySignalLevel;
  cta: CopySignalLevel;
  hook: CopySignalLevel;
  length: CopySignalLevel;
  riskWarning: boolean;
  reasons: string[];
};

export type CopyRecommendation = {
  recommendedVariants: CopyVariantId[];
  profiles: CopyVariantProfile[];
  title: string;
  description: string;
  reasons: string[];
};

export type RaccomandaCopyInput = {
  varianteA?: string | null;
  varianteB?: string | null;
  varianteC?: string | null;
  titoloAnnuncio?: string | null;
  offerta?: string | null;
  brief?: string | null;
  citta?: string | null;
  settore?: string | null;
  objective?: CampagnaObjective | null;
};

const VARIANTI: CopyVariantId[] = ["A", "B", "C"];

function livelloDaEmoji(
  emoji: "🟢" | "🟡" | "⚪" | "ℹ️" | undefined,
): CopySignalLevel {
  if (emoji === "🟢") return "green";
  if (emoji === "🟡") return "yellow";
  return "missing";
}

function punti(livello: CopySignalLevel): number {
  if (livello === "green") return 2;
  if (livello === "yellow") return 1;
  return 0;
}

function puntiRischio(warning: boolean): number {
  return warning ? 0 : 1;
}

function confrontaRanking(
  a: CopyVariantProfile,
  b: CopyVariantProfile,
): number {
  const coppie: [number, number][] = [
    [punti(a.coherence), punti(b.coherence)],
    [punti(a.cta), punti(b.cta)],
    [puntiRischio(a.riskWarning), puntiRischio(b.riskWarning)],
    [punti(a.hook), punti(b.hook)],
    [punti(a.length), punti(b.length)],
  ];
  for (const [sx, dx] of coppie) {
    const diff = dx - sx;
    if (diff !== 0) return diff;
  }
  return 0;
}

function etichettaElenco(ids: CopyVariantId[]): string {
  if (ids.length === 1) return `Variante ${ids[0]}`;
  if (ids.length === 2) return `Varianti ${ids[0]} e ${ids[1]}`;
  return "Varianti A, B e C";
}

function motiviConsiglio(profilo: CopyVariantProfile): string[] {
  const motivi: string[] = [];
  if (profilo.coherence === "green") {
    motivi.push("Offerta coerente");
  }
  if (profilo.cta === "green") {
    motivi.push("CTA chiara");
  }
  if (profilo.riskWarning) {
    motivi.push("Claim da verificare");
  } else {
    motivi.push("Meno rischiosa");
  }
  if (profilo.coherence !== "yellow") {
    motivi.push("Nessun contenuto incoerente rilevato");
  }
  if (profilo.hook === "green") {
    motivi.push("Apertura specifica");
  }
  if (profilo.length === "green") {
    motivi.push("Struttura più leggibile");
  }
  return motivi.slice(0, 3);
}

function profiloDaTesto(
  variant: CopyVariantId,
  testo: string,
  input: RaccomandaCopyInput,
): CopyVariantProfile {
  const esito = analizzaControlloMessaggioLeads({
    testoVarianteA: testo,
    headline: input.titoloAnnuncio ?? "",
    citta: input.citta ?? "",
    frontEndOffer: input.offerta ?? "",
    brief: input.brief ?? "",
    settore: input.settore ?? "",
  });
  const rischi = analizzaRischioCopy({
    testo,
    offerta: input.offerta,
    brief: input.brief,
  });
  const livelloRischio = livelloRischioCopy(rischi);
  const voce = (id: string) => esito.voci.find((v) => v.id === id);
  const coherence = livelloDaEmoji(voce("coerenza")?.emoji);
  const cta = livelloDaEmoji(voce("cta")?.emoji);
  const hook = livelloDaEmoji(voce("hook")?.emoji);
  const length = livelloDaEmoji(voce("lunghezza")?.emoji);
  const vuoto = !testo.trim();
  const hardRisk = livelloRischio === "HARD_FAIL";
  const riskWarning = livelloRischio === "WARNING";
  const hardFail =
    vuoto || coherence === "yellow" || cta === "missing" || hardRisk;

  const reasons: string[] = [];
  if (vuoto) reasons.push("Testo vuoto");
  if (hardRisk) reasons.push("Claim troppo assoluto");
  if (riskWarning) reasons.push("Claim da verificare");
  if (!vuoto && !hardRisk && coherence === "yellow") {
    reasons.push(voce("coerenza")?.messaggio ?? "Coerenza da rivedere");
  } else if (!vuoto && !hardRisk && !riskWarning && cta === "missing") {
    reasons.push("CTA assente");
  }

  return {
    variant,
    status: "REVIEW",
    hardFail,
    coherence,
    cta,
    hook,
    length,
    riskWarning,
    reasons,
  };
}

function descrizioneSingola(profilo: CopyVariantProfile): string {
  const pezzi: string[] = [];
  if (profilo.coherence === "green") {
    pezzi.push("più coerente con l'offerta");
  }
  if (profilo.cta === "green") {
    pezzi.push("usa una CTA più chiara");
  }
  if (!profilo.riskWarning && pezzi.length < 2) {
    pezzi.push("è meno rischiosa");
  }
  if (profilo.hook === "green" && pezzi.length < 2) {
    pezzi.push("ha un'apertura più specifica");
  }
  if (pezzi.length === 0) {
    return "È la più allineata ai criteri disponibili.";
  }
  if (pezzi.length === 1) {
    return `È la variante ${pezzi[0]}.`;
  }
  return `È la variante ${pezzi[0]} e ${pezzi[1]}.`;
}

/**
 * Solo LEADS. Altri objective: null (nessuna card).
 */
export function raccomandaCopy(
  input: RaccomandaCopyInput,
): CopyRecommendation | null {
  if (input.objective !== "LEADS") return null;

  const testi: Record<CopyVariantId, string> = {
    A: input.varianteA ?? "",
    B: input.varianteB ?? "",
    C: input.varianteC ?? "",
  };

  const grezzi = VARIANTI.map((id) => profiloDaTesto(id, testi[id], input));
  const valide = grezzi.filter((p) => !p.hardFail);

  if (valide.length === 0) {
    const profiles = grezzi.map((p) => ({ ...p, status: "REVIEW" as const }));
    return {
      recommendedVariants: [],
      profiles,
      title: "Nessuna variante è ancora pronta.",
      description:
        "Rivedi i testi segnalati prima di scegliere quale usare.",
      reasons: [],
    };
  }

  let migliori = [valide[0]];
  for (const candidato of valide.slice(1)) {
    const confronto = confrontaRanking(migliori[0], candidato);
    if (confronto > 0) {
      migliori = [candidato];
    } else if (confronto === 0) {
      migliori = [...migliori, candidato];
    }
  }

  const ordine: Record<CopyVariantId, number> = { A: 0, B: 1, C: 2 };
  const recommendedIds = [...migliori]
    .map((p) => p.variant)
    .sort((a, b) => ordine[a] - ordine[b]);
  const profiles: CopyVariantProfile[] = grezzi.map((p) => {
    if (p.hardFail) return { ...p, status: "REVIEW" };
    if (recommendedIds.includes(p.variant)) {
      return { ...p, status: "RECOMMENDED", reasons: motiviConsiglio(p) };
    }
    return {
      ...p,
      status: "ALTERNATIVE",
      reasons: p.riskWarning ? ["Claim da verificare"] : [],
    };
  });

  if (recommendedIds.length === 1) {
    const vincente = profiles.find((p) => p.variant === recommendedIds[0]);
    return {
      recommendedVariants: recommendedIds,
      profiles,
      title: etichettaElenco(recommendedIds),
      description: vincente
        ? descrizioneSingola(vincente)
        : "È la più allineata ai criteri disponibili.",
      reasons: vincente ? vincente.reasons : [],
    };
  }

  const descrizionePareggio =
    recommendedIds.length === 3
      ? "Varianti A, B e C sono tutte solide."
      : `Varianti ${recommendedIds[0]} e ${recommendedIds[1]} sono entrambe solide.`;

  return {
    recommendedVariants: recommendedIds,
    profiles,
    title: etichettaElenco(recommendedIds),
    description: descrizionePareggio,
    reasons:
      recommendedIds.length === 3
        ? ["Risultano solide sui criteri disponibili."]
        : ["Entrambe risultano solide sui criteri disponibili."],
  };
}

export function statusCopyVariant(
  rec: CopyRecommendation | null,
  variant: CopyVariantId,
): CopyRecommendationStatus | null {
  if (!rec) return null;
  return rec.profiles.find((p) => p.variant === variant)?.status ?? null;
}

export type TestiVariantiCopy = {
  varianteA: string;
  varianteB: string;
  varianteC: string;
};

/**
 * Imposta B o C come slot A (primaria). Swap reale, nessun testo perso.
 * Headline e creatività non sono in questo oggetto.
 */
export function scambiaVariantePrimaria(
  testi: TestiVariantiCopy,
  scelta: Exclude<CopyVariantId, "A">,
): TestiVariantiCopy {
  if (scelta === "B") {
    return {
      varianteA: testi.varianteB,
      varianteB: testi.varianteA,
      varianteC: testi.varianteC,
    };
  }
  return {
    varianteA: testi.varianteC,
    varianteB: testi.varianteB,
    varianteC: testi.varianteA,
  };
}

/**
 * CTA "Usa …" solo per B/C consigliate. Mai A (già primaria).
 * Tie a tre: nessuna CTA (A è già allineata).
 */
export function ctaUsaVariantePrimaria(
  rec: CopyRecommendation | null,
): Exclude<CopyVariantId, "A">[] {
  if (!rec || rec.recommendedVariants.length === 0) return [];
  if (rec.recommendedVariants.length === 3) return [];
  return rec.recommendedVariants.filter(
    (id): id is Exclude<CopyVariantId, "A"> => id === "B" || id === "C",
  );
}
