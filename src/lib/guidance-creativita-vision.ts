/**
 * Guidance Step 4 da analisi vision + rischio-copy (non persistita).
 * Non tocca le regole P1A di formato.
 */

import { analizzaRischioCopy } from "@/lib/rischio-copy";
import type { CopyRiskFinding } from "@/lib/rischio-copy";
import type { CreativeVisionAnalysis } from "@/lib/analyze-creative";
import type { GuidanceItem } from "@/lib/guidance";

export const ID_CREATIVE_VISION_RISK_HARD = "creative-vision-risk-hard";
export const ID_CREATIVE_VISION_RISK_WARNING = "creative-vision-risk-warning";
export const ID_CREATIVE_VISION_RELEVANCE_LOW = "creative-vision-relevance-low";
export const ID_CREATIVE_VISION_RELEVANCE_HIGH = "creative-vision-relevance-high";
export const ID_CREATIVE_VISION_RELEVANCE_MEDIUM =
  "creative-vision-relevance-medium";
export const ID_CREATIVE_VISION_RELEVANCE_UNKNOWN =
  "creative-vision-relevance-unknown";

export type VisionAssetAnalisi = {
  assetId: string;
  /** 1-based, ordine lista creatività (Creatività 1 / 2 / 3). */
  indice: number;
  analysis: CreativeVisionAnalysis;
};

export function findingsRischioDaVisibleText(
  visibleText: string[],
  offerta: string,
  brief: string,
): CopyRiskFinding[] {
  return analizzaRischioCopy({
    testo: visibleText.join(" "),
    offerta,
    brief,
  });
}

function citaClaim(finding: CopyRiskFinding): string {
  const grezzo = (finding.matchedText ?? "").trim();
  if (!grezzo) return "un claim troppo assoluto";
  return `«${grezzo}»`;
}

function labelCreativita(indice: number): string {
  return `Creatività ${indice}`;
}

function idPerAsset(base: string, assetId: string, multi: boolean): string {
  return multi ? `${base}-${assetId}` : base;
}

export function pruneStatoVisionPerAsset<T>(
  stato: Record<string, T>,
  assetIds: string[],
): Record<string, T> {
  const keep = new Set(assetIds);
  const next: Record<string, T> = {};
  for (const [id, valore] of Object.entries(stato)) {
    if (keep.has(id)) next[id] = valore;
  }
  return next;
}

export function generaGuidanceVisionCreativita(input: {
  analysis: CreativeVisionAnalysis | null;
  haRischio?: boolean;
  indice?: number;
  multi?: boolean;
}): GuidanceItem[] {
  const analysis = input.analysis;
  if (!analysis) return [];

  const items: GuidanceItem[] = [];
  const haRischio = Boolean(input.haRischio);
  const multi = Boolean(input.multi);
  const indice = input.indice ?? 1;
  const label = labelCreativita(indice);

  if (analysis.relevance === "LOW") {
    items.push({
      id: idPerAsset(ID_CREATIVE_VISION_RELEVANCE_LOW, "x", false),
      level: "WARNING",
      title: multi
        ? `${label}: il visual sembra poco coerente con l'offerta.`
        : "Il visual sembra poco coerente con l'offerta.",
      description:
        analysis.relevanceReason?.trim() ||
        "Il contenuto visibile non sembra allineato al servizio descritto.",
      field: "creativita",
      step: 4,
    });
    return items;
  }

  if (haRischio) return items;

  if (analysis.relevance === "HIGH") {
    items.push({
      id: ID_CREATIVE_VISION_RELEVANCE_HIGH,
      level: "INFO",
      title: "Il visual è coerente con l'offerta.",
      description: "Non sono emersi elementi da rivedere.",
      field: "creativita",
      step: 4,
    });
  } else if (analysis.relevance === "MEDIUM") {
    items.push({
      id: ID_CREATIVE_VISION_RELEVANCE_MEDIUM,
      level: "SUGGESTION",
      title: "Il visual è coerente, ma piuttosto generico.",
      description:
        analysis.relevanceReason?.trim() ||
        "Il visual è correlato all'offerta, ma resta generico.",
      field: "creativita",
      step: 4,
    });
  } else if (analysis.relevance === "UNKNOWN") {
    items.push({
      id: ID_CREATIVE_VISION_RELEVANCE_UNKNOWN,
      level: "INFO",
      title: "Analisi completata.",
      description:
        "Non ho abbastanza elementi per valutare con sicurezza la coerenza del visual.",
      field: "creativita",
      step: 4,
    });
  }

  return items;
}

export function generaGuidanceRischioVisual(input: {
  findings: CopyRiskFinding[];
  indice?: number;
  multi?: boolean;
  assetId?: string;
}): GuidanceItem[] {
  const items: GuidanceItem[] = [];
  const hard = input.findings.find((f) => f.level === "HARD_FAIL");
  const warn = input.findings.find((f) => f.level === "WARNING");
  const multi = Boolean(input.multi);
  const indice = input.indice ?? 1;
  const label = labelCreativita(indice);
  const assetId = input.assetId ?? "unico";

  if (hard) {
    items.push({
      id: idPerAsset(ID_CREATIVE_VISION_RISK_HARD, assetId, multi),
      level: "WARNING",
      title: multi
        ? `${label}: da rivedere prima del lancio.`
        : "Da rivedere prima del lancio.",
      description: `Nel visual compare un claim troppo forte: ${citaClaim(hard)}.`,
      field: "creativita",
      step: 4,
    });
  }

  if (warn) {
    items.push({
      id: idPerAsset(ID_CREATIVE_VISION_RISK_WARNING, assetId, multi),
      level: "WARNING",
      title: multi
        ? `${label}: c'è un claim da verificare nel visual.`
        : "C'è un claim da verificare nel visual.",
      description:
        "Nel visual compare una promessa che non risulta esplicitamente supportata da offerta o brief.",
      field: "creativita",
      step: 4,
    });
  }

  return items;
}

function riepilogoPositivo(input: {
  analyses: VisionAssetAnalisi[];
  immaginiTotali: number;
}): GuidanceItem[] {
  const { analyses, immaginiTotali } = input;
  if (analyses.length === 0) return [];

  const parziale = analyses.length < immaginiTotali;
  const hasMedium = analyses.some((a) => a.analysis.relevance === "MEDIUM");
  const hasUnknown = analyses.some((a) => a.analysis.relevance === "UNKNOWN");
  const hasHigh = analyses.some((a) => a.analysis.relevance === "HIGH");
  const n = analyses.length;
  const tot = immaginiTotali;

  if (!parziale && tot <= 1) {
    return generaGuidanceVisionCreativita({
      analysis: analyses[0]!.analysis,
      haRischio: false,
      multi: false,
    });
  }

  if (hasUnknown && !hasHigh && !hasMedium) {
    return [
      {
        id: ID_CREATIVE_VISION_RELEVANCE_UNKNOWN,
        level: "INFO",
        title: parziale
          ? `${n} di ${tot} creatività analizzate.`
          : "Analisi completata.",
        description:
          "Non ho abbastanza elementi per valutare con sicurezza la coerenza del visual.",
        field: "creativita",
        step: 4,
      },
    ];
  }

  if (parziale && n === 1) {
    const a = analyses[0]!;
    const label = labelCreativita(a.indice);
    if (a.analysis.relevance === "MEDIUM") {
      return [
        {
          id: ID_CREATIVE_VISION_RELEVANCE_MEDIUM,
          level: "SUGGESTION",
          title: `${label} analizzata: il visual è coerente, ma piuttosto generico.`,
          description:
            a.analysis.relevanceReason?.trim() ||
            `${n} di ${tot} creatività analizzate.`,
          field: "creativita",
          step: 4,
        },
      ];
    }
    if (a.analysis.relevance === "UNKNOWN") {
      return [
        {
          id: ID_CREATIVE_VISION_RELEVANCE_UNKNOWN,
          level: "INFO",
          title: `${label} analizzata.`,
          description:
            "Non ho abbastanza elementi per valutare con sicurezza la coerenza del visual.",
          field: "creativita",
          step: 4,
        },
      ];
    }
    return [
      {
        id: ID_CREATIVE_VISION_RELEVANCE_HIGH,
        level: "INFO",
        title: `${label} analizzata: il visual è coerente con l'offerta.`,
        description: `${n} di ${tot} creatività analizzate.`,
        field: "creativita",
        step: 4,
      },
    ];
  }

  if (parziale) {
    if (hasMedium) {
      return [
        {
          id: ID_CREATIVE_VISION_RELEVANCE_MEDIUM,
          level: "SUGGESTION",
          title: `${n} di ${tot} creatività analizzate. Una è coerente ma più generica.`,
          description: "Il riscontro riguarda solo i visual già analizzati.",
          field: "creativita",
          step: 4,
        },
      ];
    }
    return [
      {
        id: ID_CREATIVE_VISION_RELEVANCE_HIGH,
        level: "INFO",
        title: `${n} di ${tot} creatività analizzate: i visual sono coerenti con l'offerta.`,
        description: "Il riscontro riguarda solo i visual già analizzati.",
        field: "creativita",
        step: 4,
      },
    ];
  }

  if (hasMedium) {
    return [
      {
        id: ID_CREATIVE_VISION_RELEVANCE_MEDIUM,
        level: "SUGGESTION",
        title: "Una creatività è coerente ma più generica.",
        description: "Non sono emersi elementi critici nei visual analizzati.",
        field: "creativita",
        step: 4,
      },
    ];
  }

  if (hasUnknown && hasHigh) {
    return [
      {
        id: ID_CREATIVE_VISION_RELEVANCE_UNKNOWN,
        level: "INFO",
        title: "Analisi completata.",
        description:
          "Su almeno un visual non ho abbastanza elementi per valutare la coerenza con sicurezza.",
        field: "creativita",
        step: 4,
      },
    ];
  }

  return [
    {
      id: ID_CREATIVE_VISION_RELEVANCE_HIGH,
      level: "INFO",
      title: "Le creatività analizzate sono coerenti con l'offerta.",
      description: "Non sono emersi elementi critici nei visual analizzati.",
      field: "creativita",
      step: 4,
    },
  ];
}

export function generaGuidanceP1bCreativita(input: {
  analysis?: CreativeVisionAnalysis | null;
  analyses?: VisionAssetAnalisi[] | null;
  immaginiTotali?: number;
  offerta: string;
  brief: string;
}): GuidanceItem[] {
  const analyses: VisionAssetAnalisi[] =
    input.analyses && input.analyses.length > 0
      ? [...input.analyses].sort((a, b) => a.indice - b.indice)
      : input.analysis
        ? [
            {
              assetId: "unico",
              indice: 1,
              analysis: input.analysis,
            },
          ]
        : [];

  if (analyses.length === 0) return [];

  const immaginiTotali = Math.max(
    input.immaginiTotali ?? analyses.length,
    analyses.length,
  );
  const multi = immaginiTotali > 1;

  const issueItems: GuidanceItem[] = [];
  for (const voce of analyses) {
    const findings = findingsRischioDaVisibleText(
      voce.analysis.visibleText,
      input.offerta,
      input.brief,
    );
    const riskItems = generaGuidanceRischioVisual({
      findings,
      indice: voce.indice,
      multi,
      assetId: voce.assetId,
    });
    issueItems.push(...riskItems);
    if (voce.analysis.relevance === "LOW") {
      const low = generaGuidanceVisionCreativita({
        analysis: voce.analysis,
        haRischio: false,
        indice: voce.indice,
        multi,
      }).map((item) => ({
        ...item,
        id: idPerAsset(
          ID_CREATIVE_VISION_RELEVANCE_LOW,
          voce.assetId,
          multi,
        ),
      }));
      issueItems.push(...low);
    }
  }

  if (issueItems.length > 0) return issueItems;

  return riepilogoPositivo({ analyses, immaginiTotali });
}
