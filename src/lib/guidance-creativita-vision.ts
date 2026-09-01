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

export function generaGuidanceVisionCreativita(input: {
  analysis: CreativeVisionAnalysis | null;
}): GuidanceItem[] {
  const analysis = input.analysis;
  if (!analysis) return [];

  const items: GuidanceItem[] = [];

  if (analysis.relevance === "LOW") {
    items.push({
      id: ID_CREATIVE_VISION_RELEVANCE_LOW,
      level: "WARNING",
      title: "Il visual sembra poco coerente con l'offerta.",
      description:
        analysis.relevanceReason?.trim() ||
        "Il contenuto visibile non sembra allineato al servizio descritto.",
      field: "creativita",
      step: 4,
    });
  }

  return items;
}

export function generaGuidanceRischioVisual(input: {
  findings: CopyRiskFinding[];
}): GuidanceItem[] {
  const items: GuidanceItem[] = [];
  const hard = input.findings.find((f) => f.level === "HARD_FAIL");
  const warn = input.findings.find((f) => f.level === "WARNING");

  if (hard) {
    items.push({
      id: ID_CREATIVE_VISION_RISK_HARD,
      level: "WARNING",
      title: "Da rivedere prima del lancio.",
      description: `Nel visual compare un claim troppo forte: ${citaClaim(hard)}.`,
      field: "creativita",
      step: 4,
    });
  }

  if (warn) {
    items.push({
      id: ID_CREATIVE_VISION_RISK_WARNING,
      level: "WARNING",
      title: "C'è un claim da verificare nel visual.",
      description:
        "Nel visual compare una promessa che non risulta esplicitamente supportata da offerta o brief.",
      field: "creativita",
      step: 4,
    });
  }

  return items;
}

export function generaGuidanceP1bCreativita(input: {
  analysis: CreativeVisionAnalysis | null;
  offerta: string;
  brief: string;
}): GuidanceItem[] {
  if (!input.analysis) return [];
  const findings = findingsRischioDaVisibleText(
    input.analysis.visibleText,
    input.offerta,
    input.brief,
  );
  return [
    ...generaGuidanceRischioVisual({ findings }),
    ...generaGuidanceVisionCreativita({ analysis: input.analysis }),
  ];
}
