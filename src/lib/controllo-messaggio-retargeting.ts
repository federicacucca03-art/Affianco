import { HOOK_MOBILE_CHARS } from "@/data/varianti-copy";
import type {
  ControlloMessaggioRisultato,
  ControlloMessaggioVoce,
} from "@/lib/controllo-messaggio";
import type { TargetType } from "@/types/campagne";

const CTA_B2C =
  /\b(?:acquista(?:\s+ora)?|completa(?:\s+(?:l['']ordine|l['']acquisto|ora))?|torna(?:\s+(?:al\s+prodotto|sul\s+sito|a\s+(?:noi|vedere)))?|scopri(?:\s+(?:di\s+più|ora))?|ordina(?:\s+ora)?|compra(?:\s+ora)?)\b/i;

const CTA_B2B =
  /\b(?:scopri(?:\s+(?:di\s+più|ora))?|richiedi(?:\s+(?:informazioni|info|un\s+contatto))?|riprendi(?:\s+(?:il\s+)?contatto)?|contatt(?:a|aci|ami)|maggiori\s+info)\b/i;

const MOTIVO_TORNARE =
  /\b(?:torn(?:a|are)|riprend(?:i|ere)|rived(?:i|ere)|complet(?:a|are)|scopri|valut(?:a|are)|interess(?:a|ava)|beneficio|vantaggi[oa]?|offerta|promo|garanz|dubbi[oa]?|sicur|chiar|valore|perché|soluzione)\w*\b/i;

const CREEPY_TRACKING =
  /ti\s+abbiamo\s+visto|sappiamo\s+che\s+hai|abbiamo\s+notato(?:\s+che)?|stavi\s+guardando|ti\s+stiamo\s+seguendo|abbiamo\s+visto\s+che|ti\s+abbiamo\s+notato|monitoriamo\s+(?:le\s+tue|i\s+tuoi)|sappiamo\s+cosa\s+(?:stai|hai)/i;

const CARRELLO_ESPLICITO =
  /(?:il\s+)?tuo\s+carrello\s+(?:ti\s+)?sta(?:\s+ancora)?\s+aspettando|carrello\s+(?:abbandonato|in\s+sospeso)|ti\s+sei\s+dimenticat[oa]\s+qualcosa/i;

const SCARSITA_CLAIM =
  /ultim[ieo]\s+(?:ore|pezzi?|unit|disponibil)|sta\s+per\s+scadere|scade(?:\s+presto)?|solo\s+oggi|solo\s+per\s+oggi|affrettati|quasi\s+esaurit|esaurit|scorte\s+(?:limitat|in\s+esaurimento|finisc)|pochi\s+pezzi|disponibilit[àa]\s+limitat|offerta\s+a\s+tempo|non\s+perdere|prima\s+che\s+(?:l['']offerta\s+)?scad|prima\s+che\s+le\s+scorte/i;

const TOKEN_PROMO =
  /\d+\s*%|\d+[.,]\d+\s*€|\d+\s*€|€\s*\d+|sconto\s+\d+|-\s*\d+\s*%|gratis|gratuit[oaie]|bonus|spedizion[ei]\s+gratis|spedizione\s+gratuita|\bcodice\b/gi;

const INVITO_DESTINAZIONE =
  /\b(?:complet(?:a|are)\s+(?:l['']ordine|l['']acquisto)|torn(?:a|are)\s+(?:al\s+prodotto|sul\s+sito|a\s+(?:noi|vedere))|ved(?:i|ere)\s+(?:l['']offerta|l['']annuncio)|acquista|ordina|clicca|tocca|scopri\s+di\s+più)\b/i;

function testoCombinato(varianteA: string, headline: string): string {
  return `${headline}\n${varianteA}`.trim();
}

function snippetPresente(haystack: string, termine: string): boolean {
  const t = termine.trim().toLowerCase();
  if (!t || t.length < 3) return false;
  const h = haystack.toLowerCase();
  if (t.length <= 12) return h.includes(t);
  if (h.includes(t.slice(0, Math.min(40, t.length)))) return true;
  const parole = t
    .split(/[^a-zàèéìòù0-9-]+/i)
    .map((p) => p.trim())
    .filter((p) => p.length >= 4);
  if (parole.length === 0) return h.includes(t.slice(0, 12));
  const presenti = parole.filter((p) => h.includes(p)).length;
  return presenti >= Math.min(2, parole.length);
}

function tokenPromoNelTesto(testo: string): string[] {
  const matches = testo.match(TOKEN_PROMO) ?? [];
  return [...new Set(matches.map((m) => m.toLowerCase().trim()))];
}

function promoSupportataDaOfferta(
  token: string,
  frontEndOffer: string,
): boolean {
  const o = frontEndOffer.trim().toLowerCase();
  if (!o) return false;
  const t = token.toLowerCase();
  if (o.includes(t)) return true;
  if (/%/.test(t) && /%|sconto|percent/.test(o)) {
    const numT = t.replace(/[^\d.,]/g, "");
    if (numT && o.includes(numT)) return true;
  }
  if (/€/.test(t) && /€|euro/.test(o)) return true;
  if (/gratis|gratuit/.test(t) && /gratis|gratuit|spedizion/.test(o)) {
    return true;
  }
  if (/bonus/.test(t) && /bonus/.test(o)) return true;
  if (/spedizion/.test(t) && /spedizion|gratis|gratuit/.test(o)) return true;
  if (/codice/.test(t) && /codice|[A-Z]{3,}\d{1,4}/i.test(frontEndOffer)) {
    return true;
  }
  return snippetPresente(o, t);
}

function scarsitaSupportataDaOfferta(frontEndOffer: string): boolean {
  const o = frontEndOffer.trim().toLowerCase();
  if (!o) return false;
  return /scad|fino\s+a|solo\s+(?:oggi|per)|limitat|ultim|esaur|ore\s+\d|entro\s+/i.test(
    o,
  );
}

function analizzaCopyPresente(testo: string): ControlloMessaggioVoce {
  if (!testo.trim()) {
    return {
      id: "copy",
      label: "Testo annuncio",
      emoji: "ℹ️",
      messaggio: "Da verificare — inserisci la Variante A",
    };
  }
  return {
    id: "copy",
    label: "Testo annuncio",
    emoji: "🟢",
    messaggio: "Copy presente",
  };
}

function analizzaMotivoTornare(
  testo: string,
  headline: string,
  frontEndOffer: string,
): ControlloMessaggioVoce {
  const combined = testoCombinato(testo, headline);
  if (!combined.trim()) {
    return {
      id: "motivo",
      label: "Motivo per tornare",
      emoji: "ℹ️",
      messaggio: "Da verificare — testo ancora vuoto",
    };
  }

  const offerta = frontEndOffer.trim();
  const offertaOk = offerta ? snippetPresente(combined, offerta) : false;
  if (MOTIVO_TORNARE.test(combined) || offertaOk) {
    return {
      id: "motivo",
      label: "Motivo per tornare",
      emoji: "🟢",
      messaggio: "C'è un motivo riconoscibile per tornare",
    };
  }

  return {
    id: "motivo",
    label: "Motivo per tornare",
    emoji: "ℹ️",
    messaggio: "Da verificare — chiarisci perché vale la pena tornare",
  };
}

function analizzaOffertaReale(
  testo: string,
  headline: string,
  frontEndOffer: string,
): ControlloMessaggioVoce {
  const offerta = frontEndOffer.trim();
  const combined = testoCombinato(testo, headline);

  if (!combined.trim()) {
    return {
      id: "offerta",
      label: "Offerta reale",
      emoji: "ℹ️",
      messaggio: offerta
        ? "Da verificare — testo ancora vuoto"
        : "Nessuna offerta dichiarata al Passo 1",
    };
  }

  const tokenNelCopy = tokenPromoNelTesto(combined);
  const tokenNonSupportati = tokenNelCopy.filter(
    (t) => !promoSupportataDaOfferta(t, offerta),
  );

  if (tokenNonSupportati.length > 0) {
    return {
      id: "offerta",
      label: "Offerta reale",
      emoji: "🟡",
      messaggio:
        "Il copy contiene promo/%/codice non dichiarati nell'offerta di recupero",
    };
  }

  if (!offerta) {
    return {
      id: "offerta",
      label: "Offerta reale",
      emoji: "🟢",
      messaggio: "Nessuna promo inventata nel copy",
    };
  }

  if (snippetPresente(combined, offerta)) {
    return {
      id: "offerta",
      label: "Offerta reale",
      emoji: "🟢",
      messaggio: "Offerta di recupero richiamata nel copy",
    };
  }

  return {
    id: "offerta",
    label: "Offerta reale",
    emoji: "🟡",
    messaggio: "L'offerta del Passo 1 non compare nel copy",
  };
}

function analizzaCta(
  testo: string,
  headline: string,
  targetType: TargetType,
): ControlloMessaggioVoce {
  const combined = testoCombinato(testo, headline);
  if (!combined.trim()) {
    return {
      id: "cta",
      label: "CTA",
      emoji: "ℹ️",
      messaggio: "Da verificare — testo ancora vuoto",
    };
  }

  const isB2b = targetType === "B2B";
  const ok = isB2b ? CTA_B2B.test(combined) : CTA_B2C.test(combined);
  // B2B può accettare anche CTA soft B2C “scopri”; B2C già coperto.
  const softOk =
    isB2b &&
    /\b(?:scopri(?:\s+di\s+più)?|maggiori\s+info|richiedi|riprendi|contatt)\b/i.test(
      combined,
    );

  if (ok || softOk) {
    return {
      id: "cta",
      label: "CTA",
      emoji: "🟢",
      messaggio: isB2b
        ? "Invito a riprendere contatto o approfondire riconoscibile"
        : "Invito all'azione riconoscibile",
    };
  }

  return {
    id: "cta",
    label: "CTA",
    emoji: "🟡",
    messaggio: isB2b
      ? "Manca un invito chiaro (scopri, richiedi, riprendi, contatta)"
      : "Manca un invito chiaro (acquista, completa, torna, scopri, ordina)",
  };
}

function analizzaTonoRetargeting(
  testo: string,
  headline: string,
): ControlloMessaggioVoce {
  const combined = testoCombinato(testo, headline);
  if (!combined.trim()) {
    return {
      id: "tono",
      label: "Tono del retargeting",
      emoji: "ℹ️",
      messaggio: "Da verificare — testo ancora vuoto",
    };
  }

  if (CREEPY_TRACKING.test(combined)) {
    return {
      id: "tono",
      label: "Tono del retargeting",
      emoji: "🟡",
      messaggio:
        "Formulazione troppo esplicita sul tracking — ammorbidisci il tono",
    };
  }

  if (CARRELLO_ESPLICITO.test(combined)) {
    return {
      id: "tono",
      label: "Tono del retargeting",
      emoji: "ℹ️",
      messaggio:
        "Tono esplicito sul carrello — da rivedere se risulta troppo invasivo",
    };
  }

  return {
    id: "tono",
    label: "Tono del retargeting",
    emoji: "🟢",
    messaggio: "Nessuna formulazione tracking-esplicita rilevata",
  };
}

function analizzaUrgenzaScarsita(
  testo: string,
  headline: string,
  frontEndOffer: string,
): ControlloMessaggioVoce {
  const combined = testoCombinato(testo, headline);
  if (!combined.trim()) {
    return {
      id: "urgenza",
      label: "Urgenza / scarsità",
      emoji: "ℹ️",
      messaggio: "Da verificare — testo ancora vuoto",
    };
  }

  if (!SCARSITA_CLAIM.test(combined)) {
    return {
      id: "urgenza",
      label: "Urgenza / scarsità",
      emoji: "🟢",
      messaggio: "Nessuna scarsità non supportata",
    };
  }

  if (scarsitaSupportataDaOfferta(frontEndOffer)) {
    return {
      id: "urgenza",
      label: "Urgenza / scarsità",
      emoji: "🟢",
      messaggio: "Urgenza allineata all'offerta dichiarata",
    };
  }

  return {
    id: "urgenza",
    label: "Urgenza / scarsità",
    emoji: "🟡",
    messaggio:
      "Urgenza o scarsità nel copy non supportate dall'offerta di recupero",
  };
}

function analizzaHookMobile(
  testo: string,
  frontEndOffer: string,
  targetType: TargetType,
): ControlloMessaggioVoce {
  const t = testo.trim();
  if (!t) {
    return {
      id: "hook",
      label: "Hook mobile",
      emoji: "ℹ️",
      messaggio: "Da verificare — testo ancora vuoto",
    };
  }

  const hook = t.slice(0, HOOK_MOBILE_CHARS);
  const offerta = frontEndOffer.trim();
  const offertaOk = offerta ? snippetPresente(hook, offerta) : false;
  const motivoOk = MOTIVO_TORNARE.test(hook);
  const ctaOk =
    targetType === "B2B" ? CTA_B2B.test(hook) : CTA_B2C.test(hook);

  if (offertaOk || motivoOk || ctaOk) {
    return {
      id: "hook",
      label: "Hook mobile",
      emoji: "🟢",
      messaggio: `Motivo, offerta o CTA nelle prime ${HOOK_MOBILE_CHARS} battute`,
    };
  }

  if (offerta && !offertaOk) {
    return {
      id: "hook",
      label: "Hook mobile",
      emoji: "🟡",
      messaggio: "Offerta poco visibile prima del «Mostra altro»",
    };
  }

  return {
    id: "hook",
    label: "Hook mobile",
    emoji: "ℹ️",
    messaggio: "Da verificare — metti il motivo per tornare in apertura",
  };
}

function analizzaDestinazione(
  testo: string,
  headline: string,
  sitoWeb: string,
): ControlloMessaggioVoce {
  const combined = testoCombinato(testo, headline);
  if (!combined.trim()) {
    return {
      id: "destinazione",
      label: "Destinazione",
      emoji: "ℹ️",
      messaggio: "Da verificare — testo ancora vuoto",
    };
  }

  const sito = sitoWeb.trim();
  if (sito) {
    return {
      id: "destinazione",
      label: "Destinazione",
      emoji: "🟢",
      messaggio: "Pagina di destinazione indicata",
    };
  }

  if (INVITO_DESTINAZIONE.test(combined)) {
    return {
      id: "destinazione",
      label: "Destinazione",
      emoji: "🟡",
      messaggio:
        "Il copy invita a tornare/cliccare ma manca la pagina di destinazione",
    };
  }

  return {
    id: "destinazione",
    label: "Destinazione",
    emoji: "🟢",
    messaggio: "Nessun invito esplicito a una destinazione mancante",
  };
}

/**
 * Controlli deterministici sul copy RETARGETING (Variante A).
 * Nessun score, nessun 🔴, nessuna audience UI-only.
 * recoveryDiscount non autorizza promo nel copy: fonte canonica = frontEndOffer.
 */
export function analizzaControlloMessaggioRetargeting(input: {
  testoVarianteA: string;
  headline?: string;
  frontEndOffer: string;
  sitoWeb?: string;
  targetType?: TargetType;
  nomeCliente?: string;
  elevatorPitch?: string;
}): ControlloMessaggioRisultato {
  const testo = input.testoVarianteA ?? "";
  const headline = input.headline ?? "";
  const offerta = input.frontEndOffer ?? "";
  const sito = input.sitoWeb ?? "";
  const targetType = input.targetType ?? "B2C";

  const voci: ControlloMessaggioVoce[] = [
    analizzaCopyPresente(testo),
    analizzaMotivoTornare(testo, headline, offerta),
    analizzaOffertaReale(testo, headline, offerta),
    analizzaCta(testo, headline, targetType),
    analizzaTonoRetargeting(testo, headline),
    analizzaUrgenzaScarsita(testo, headline, offerta),
    analizzaHookMobile(testo, offerta, targetType),
    analizzaDestinazione(testo, headline, sito),
  ];

  return { voci };
}
