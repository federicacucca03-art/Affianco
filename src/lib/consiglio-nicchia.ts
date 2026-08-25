/**
 * Consiglio strategico di nicchia in base al settore digitato (Step 1 Wizard).
 * Per BOOKINGS / ECOMMERCE usa consigli dedicati.
 */
export function consiglioStrategicoNicchia(
  settore: string | undefined,
  objective?: string,
): string {
  const s = (settore ?? "").toLowerCase();

  if (objective === "BOOKINGS") {
    if (
      /estetic|salone|parrucch|spa|barber|nail|unghie|beauty|centro estet/.test(
        s,
      )
    ) {
      return "💡 Consiglio Agenda: La leva più forte per i saloni è l'Offerta Benvenuto per i primi 20 nuovi clienti con prenotazione diretta via WhatsApp.";
    }
    if (/ristorant|pizzer|food|trattor|osteria|bar |caf[eè]|gastronom/.test(s)) {
      return "💡 Consiglio Agenda: Usa campagne promozionali mirate a riempire le sere a bassa affluenza (dal Lunedì al Giovedì) con un tavolo riservato e benvenuto speciale.";
    }
    if (
      /palestr|fitness|personal.?trainer|pt |crossfit|yoga|pilates|allenator/.test(
        s,
      )
    ) {
      return "💡 Consiglio Agenda: Offri una prima lezione di prova gratuita o una valutazione corporea guidata per portare il cliente fisicamente in struttura.";
    }
    return "💡 Consiglio Agenda: Per le attività locali, WhatsApp Diretto riduce i no-show: conferma l'appuntamento entro pochi minuti dalla richiesta.";
  }

  if (objective === "ECOMMERCE") {
    if (
      /cosmetic|beauty|moda|fashion|abbigliamento|make.?up|skincare|viso|capell/.test(
        s,
      )
    ) {
      return "💡 Consiglio E-commerce: Nei settori Beauty e Fashion le vendite sono guidate dai contenuti User Generated Content (UGC) e dai video prova prodotto.";
    }
    if (/food|tipic|vino|gastronom|agroaliment|olio|dolci|caff[eè]/.test(s)) {
      return "💡 Consiglio E-commerce: I prodotti agroalimentari convertono meglio con box regalo o bundle da più pezzi per ammortizzare le spese di spedizione.";
    }
    return "💡 Consiglio E-commerce: Concentra l'annuncio su un prodotto Hero chiaro: offerta + spedizione/reso devono essere comprensibili in 3 secondi su mobile.";
  }

  if (objective === "AWARENESS") {
    return "💡 Regola per il Lancio: Una campagna di apertura deve partire almeno 7-10 giorni prima dell'evento. L'obiettivo è saturare il raggio di 5-10 km con un'elevata frequenza visiva per riempire il locale il giorno dell'inaugurazione.";
  }

  if (
    /dentist|sanit|estetic|clinic|medico|odonto|dermat|chirurg|beauty|spa|wellness/.test(
      s,
    )
  ) {
    return "💡 Consiglio di Nicchia: Per il settore sanitario/beauty, la fiducia è tutto. I lead form su Meta con domanda di qualifica sull'urgenza convertono il 35% in più.";
  }

  if (
    /serrament|ristruttur|casa|edil|impiant|infiss|condizion|fotovolta|idraulic|elettric/.test(
      s,
    )
  ) {
    return "💡 Consiglio di Nicchia: Nelle ristrutturazioni l'ostacolo principale è il prezzo. L'offerta gancio deve fare leva su chiarezza dei tempi o incentivi fiscali.";
  }

  if (
    /industrial|b2b|consulenz|software|saas|agenzia|professionist|avvocat|commercialist|notar/.test(
      s,
    )
  ) {
    return "💡 Consiglio di Nicchia: Nel B2B il raggio locale deve essere più ampio (almeno 30-50 km). Evita offerte sconto e punta sulla risoluzione di un problema operativo.";
  }

  return "💡 Consiglio di Nicchia: Assicurati che l'offerta d'ingresso sia facile da capire in meno di 3 secondi da uno smartphone.";
}
