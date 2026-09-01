/**
 * Rilevazione rischi copy LEADS (claim assoluti e warning contestuali).
 * Deterministico, nessuna AI, nessun DB.
 *
 * Limite: le promesse di risultato non coperte da questi pattern
 * non influenzano il ranking. "subito" da solo non è un rischio.
 */

import { stripAccents } from "@/lib/validate-elevator-pitch";

export type CopyRiskLevel = "NONE" | "WARNING" | "HARD_FAIL";

export type CopyRiskFinding = {
  id: string;
  level: Exclude<CopyRiskLevel, "NONE">;
  title: string;
  description: string;
  matchedText?: string;
};

export type AnalizzaRischioCopyInput = {
  testo?: string | null;
  offerta?: string | null;
  brief?: string | null;
};

function normalizza(testo: string): string {
  return stripAccents(testo)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

type PatternRischio = {
  id: string;
  level: Exclude<CopyRiskLevel, "NONE">;
  pattern: RegExp;
  title: string;
  description: string;
  richiedeSupporto: boolean;
};

const HARD_CLAIMS: PatternRischio[] = [
  {
    id: "risultato-garantito",
    level: "HARD_FAIL",
    pattern: /risultat[oi]?\s+garantit/,
    title: "Claim troppo assoluto",
    description: "Il testo promette un risultato garantito.",
    richiedeSupporto: false,
  },
  {
    id: "successo-garantito",
    level: "HARD_FAIL",
    pattern: /successo\s+garantit/,
    title: "Claim troppo assoluto",
    description: "Il testo promette un successo garantito.",
    richiedeSupporto: false,
  },
  {
    id: "garantiamo-risultato",
    level: "HARD_FAIL",
    pattern: /garantiamo\s+(?:il\s+|i\s+)?risultat/,
    title: "Claim troppo assoluto",
    description: "Il testo garantisce un risultato.",
    richiedeSupporto: false,
  },
  {
    id: "risultato-assicurato",
    level: "HARD_FAIL",
    pattern: /risultat[oi]?\s+assicurat/,
    title: "Claim troppo assoluto",
    description: "Il testo presenta un risultato come assicurato.",
    richiedeSupporto: false,
  },
  {
    id: "zero-rischi",
    level: "HARD_FAIL",
    pattern: /zero\s+rischi/,
    title: "Claim troppo assoluto",
    description: "Il testo afferma che non ci sono rischi.",
    richiedeSupporto: false,
  },
  {
    id: "cento-sicuro",
    level: "HARD_FAIL",
    pattern: /100\s*%\s*sicur[oaie]?/,
    title: "Claim troppo assoluto",
    description: "Il testo usa una garanzia di sicurezza assoluta.",
    richiedeSupporto: false,
  },
  {
    id: "elimina-definitivamente",
    level: "HARD_FAIL",
    pattern: /elimina(?:re)?\s+definitivament/,
    title: "Claim troppo assoluto",
    description: "Il testo promette di eliminare definitivamente un problema.",
    richiedeSupporto: false,
  },
];

const WARNING_CONTESTUALI: PatternRischio[] = [
  {
    id: "senza-dolore",
    level: "WARNING",
    pattern: /senza\s+dolore/,
    title: "Claim da verificare.",
    description:
      "Il testo introduce una promessa che non risulta esplicitamente supportata da offerta o brief.",
    richiedeSupporto: true,
  },
  {
    id: "soluzione-definitiva",
    level: "WARNING",
    pattern: /soluzione\s+definitiv/,
    title: "Claim da verificare.",
    description:
      "Il testo introduce una promessa che non risulta esplicitamente supportata da offerta o brief.",
    richiedeSupporto: true,
  },
  {
    id: "torna-a-sorridere",
    level: "WARNING",
    pattern: /torna(?:re)?\s+a\s+sorrid/,
    title: "Claim da verificare.",
    description:
      "Il testo introduce una promessa che non risulta esplicitamente supportata da offerta o brief.",
    richiedeSupporto: true,
  },
];

function primoMatch(normalizzato: string, pattern: RegExp): string | undefined {
  const trovato = pattern.exec(normalizzato);
  if (!trovato?.[0]) return undefined;
  return trovato[0].trim();
}

function fonteSupporta(fonte: string, pattern: RegExp): boolean {
  return pattern.test(fonte);
}

/**
 * Analisi deterministica del copy. Solo pattern espliciti, nessuna inferenza.
 */
export function analizzaRischioCopy(
  input: AnalizzaRischioCopyInput,
): CopyRiskFinding[] {
  const testo = normalizza(input.testo ?? "");
  if (!testo) return [];

  const fonte = normalizza(`${input.offerta ?? ""} ${input.brief ?? ""}`);
  const findings: CopyRiskFinding[] = [];

  for (const regola of [...HARD_CLAIMS, ...WARNING_CONTESTUALI]) {
    const matchedText = primoMatch(testo, regola.pattern);
    if (!matchedText) continue;
    if (regola.richiedeSupporto && fonteSupporta(fonte, regola.pattern)) {
      continue;
    }
    findings.push({
      id: regola.id,
      level: regola.level,
      title: regola.title,
      description: regola.description,
      matchedText,
    });
  }

  return findings;
}

export function livelloRischioCopy(
  findings: CopyRiskFinding[],
): CopyRiskLevel {
  if (findings.some((f) => f.level === "HARD_FAIL")) return "HARD_FAIL";
  if (findings.some((f) => f.level === "WARNING")) return "WARNING";
  return "NONE";
}
