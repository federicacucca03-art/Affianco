import { stripAccents } from "@/lib/validate-elevator-pitch";

const STOP_TAIL =
  /\s*(?:a|ad|in|di|da|per|con|su|presso)\s+[A-ZÀ-Ú][\wÀ-ú'’.-]*(?:\s+[A-ZÀ-Ú][\wÀ-ú'’.-]*){0,3}\s*$/u;

const PATTERN_SERVIZIO: RegExp[] = [
  /\bspecializzat[aeio]?\s+(?:in|nella|nelle|nei|nel|sulle?|sugli?)\s+(.+)$/i,
  /\bci\s+occupiamo\s+di\s+(.+)$/i,
  /\b(?:offriamo|forniamo|vendiamo|installiamo|applichiamo|realizziamo|eseguiamo|progettiamo|gestiamo|trattiamo)\s+(.+)$/i,
  /\bservizi?\s+(?:di|per)\s+(.+)$/i,
  /\bfocus\s+su\s+(.+)$/i,
  /\bespert[aeio]?\s+(?:in|di|di)\s+(.+)$/i,
  /\bleader\s+(?:in|di|nei|nelle)\s+(.+)$/i,
  /\bsoluzioni?\s+(?:di|per)\s+(.+)$/i,
];

const FALLBACK_SETTORE: Record<string, string> = {
  dentista: "visite odontoiatriche e cure dentali",
  palestra: "allenamento personalizzato e corsi fitness",
  estetista: "trattamenti estetici viso e corpo",
  ristorante: "cucina di qualità e tavoli riservati",
  artigiano: "lavori artigianali su misura",
  avvocato: "consulenza legale e assistenza",
  commercialista: "contabilità e consulenza fiscale",
  immobiliare: "compravendita e affitto immobili",
};

function pulisciFrammento(raw: string): string {
  let s = raw
    .replace(/["“”«»]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Taglia a prima frase / punto / trattino lungo
  s = s.split(/[.!?;|]/)[0]?.trim() ?? s;

  // Rimuove code tipo "a Roma", "per famiglie a Milano"
  s = s.replace(STOP_TAIL, "").trim();
  s = s.replace(/\s+per\s+(?:famiglie|aziende|privati|clienti)\b.*$/i, "").trim();
  s = s.replace(/^(?:la|le|il|lo|i|gli|un|una|dei|delle|degli)\s+/i, "").trim();

  // Evita code troppo lunghe
  const parole = s.split(/\s+/).filter(Boolean);
  if (parole.length > 12) {
    s = parole.slice(0, 12).join(" ");
  }

  return s.replace(/[,:]\s*$/, "").trim();
}

/**
 * Estrae il servizio principale dall'elevator pitch / brief cliente.
 * Esempio: "…pellicole di controllo solare e rivestimenti per vetrate…"
 */
export function estraiServizioPrincipale(
  elevatorPitch: string,
  settore?: string | null,
): string {
  const pitch = elevatorPitch.replace(/\s+/g, " ").trim();
  if (pitch) {
    for (const pattern of PATTERN_SERVIZIO) {
      const match = pitch.match(pattern);
      if (match?.[1]) {
        const servizio = pulisciFrammento(match[1]);
        if (servizio.length >= 8) return servizio;
      }
    }

    // Fallback: frase dopo la prima virgola (spesso contiene il servizio)
    const dopoVirgola = pitch.split(",").slice(1).join(",").trim();
    if (dopoVirgola.length >= 12) {
      const servizio = pulisciFrammento(dopoVirgola);
      if (servizio.length >= 8) return servizio;
    }

    // Ultimo tentativo: intero pitch pulito se abbastanza specifico
    const intero = pulisciFrammento(pitch);
    if (intero.split(/\s+/).length >= 4) return intero;
  }

  const chiave = stripAccents((settore ?? "").toLowerCase().trim());
  for (const [k, label] of Object.entries(FALLBACK_SETTORE)) {
    if (chiave.includes(k)) return label;
  }

  const settoreTrim = (settore ?? "").trim();
  if (settoreTrim) return settoreTrim;

  return "servizi locali";
}
