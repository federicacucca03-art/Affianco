import type { DeconstructAdBody, DeconstructAdResult } from "@/types/deconstruct-ad";

export function mockDeconstructAd(body: DeconstructAdBody): DeconstructAdResult {
  const nome = (body.nomeAzienda ?? "Il tuo cliente").trim() || "Il tuo cliente";
  const settore = (body.settore ?? "servizi locali").trim() || "servizi locali";
  const offerta =
    (body.offerta ?? "prima consulenza gratuita").trim() ||
    "prima consulenza gratuita";
  const target = Math.max(Number(body.targetCpl) || 45, 1);

  return {
    hookVisivo:
      "Primo piano del volto del titolare che guarda in camera + overlay testuale con l'offerta in alto a sinistra. Contrasto forte tra sfondo neutro e badge promo.",
    angoloPsicologico:
      "Prova sociale + riduzione del rischio: l'annuncio mostra persone reali e un incentivo a basso impegno (prova/consulenza) per abbattere l'esitazione.",
    strutturaCopy:
      "Hook visivo immediato → problema implicito del target → soluzione con offerta concreta → CTA singola e ripetuta in overlay.",
    copioneAdattato: {
      titoloVisual: `${offerta} · ${nome}`,
      scriptVideo: `GANCIO (0-3s): "Se cerchi ${settore} in zona, ferma lo scroll." Mostra inquadratura verticale su ingresso/servizio.\n\nSVILUPPO (3-12s): Spiega in 1 frase il beneficio principale e mostra prova visiva (cliente, risultato, prodotto). Menziona che resti sotto ${target}€ di costo sostenibile per acquisizione.\n\nCTA (12-15s): "Prenota ${offerta} — link in bio / modulo qui sotto." Testo overlay grande e leggibile.`,
      istruzioniPerCliente: `1) Registra 3 clip verticali (9:16) con lo smartphone: ingresso/struttura, tu che parli alla camera (15 sec), dettaglio del servizio/offerta "${offerta}".\n2) Invia i file grezzi su WhatsApp: no filtri pesanti, luce naturale, audio pulito. ${nome} userà queste clip per l'annuncio Meta.`,
    },
  };
}
