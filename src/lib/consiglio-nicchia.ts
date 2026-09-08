/**
 * Consiglio strategico di nicchia in base al settore digitato (Step 1 Wizard).
 * Per BOOKINGS / ECOMMERCE usa consigli dedicati.
 * Qualitative guidance only — no unsupported performance percentages.
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
      return "La leva più forte per i saloni è l'Offerta Benvenuto per i primi 20 nuovi clienti con prenotazione diretta via WhatsApp.";
    }
    if (/ristorant|pizzer|food|trattor|osteria|bar |caf[eè]|gastronom/.test(s)) {
      return "Usa campagne promozionali mirate a riempire le sere a bassa affluenza (dal Lunedì al Giovedì) con un tavolo riservato e benvenuto speciale.";
    }
    if (
      /palestr|fitness|personal.?trainer|pt |crossfit|yoga|pilates|allenator/.test(
        s,
      )
    ) {
      return "Offri una prima lezione di prova gratuita o una valutazione corporea guidata per portare il cliente fisicamente in struttura.";
    }
    return "Per le attività locali, WhatsApp Diretto riduce i no-show: conferma l'appuntamento entro pochi minuti dalla richiesta.";
  }

  if (objective === "ECOMMERCE") {
    if (
      /cosmetic|beauty|moda|fashion|abbigliamento|make.?up|skincare|viso|capell/.test(
        s,
      )
    ) {
      return "Nei settori Beauty e Fashion le vendite sono guidate dai contenuti User Generated Content (UGC) e dai video prova prodotto.";
    }
    if (/food|tipic|vino|gastronom|agroaliment|olio|dolci|caff[eè]/.test(s)) {
      return "I prodotti agroalimentari convertono meglio con box regalo o bundle da più pezzi per ammortizzare le spese di spedizione.";
    }
    return "Concentra l'annuncio su un prodotto Hero chiaro: offerta + spedizione/reso devono essere comprensibili in 3 secondi su mobile.";
  }

  if (objective === "AWARENESS") {
    return "Una campagna di apertura deve partire almeno 7-10 giorni prima dell'evento. L'obiettivo è saturare il raggio di 5-10 km con un'elevata frequenza visiva per riempire il locale il giorno dell'inaugurazione.";
  }

  if (
    /dentist|sanit|estetic|clinic|medico|odonto|dermat|chirurg|beauty|spa|wellness/.test(
      s,
    )
  ) {
    return "Per il settore sanitario/beauty, la fiducia è tutto. Nei lead form su Meta, una domanda di qualifica sull'urgenza aiuta a migliorare la qualità dei contatti.";
  }

  if (
    /serrament|ristruttur|casa|edil|impiant|infiss|condizion|fotovolta|idraulic|elettric/.test(
      s,
    )
  ) {
    return "Nelle ristrutturazioni l'ostacolo principale è il prezzo. L'offerta gancio deve fare leva su chiarezza dei tempi o incentivi fiscali.";
  }

  if (
    /industrial|b2b|consulenz|software|saas|agenzia|professionist|avvocat|commercialist|notar|distribuzion|manifattur|logistica|impiantistic|engineering|grossista|contract|noleggio/.test(
      s,
    )
  ) {
    if (
      /distribuzion\w*\s*tecnic|nastri|adesiv|materiali tecnic|dpi|3m|forniture industriali|tecnica industriale/.test(
        s,
      )
    ) {
      return "Nei mercati B2B tecnici funzionano meglio messaggi che partono da applicazione, problema operativo e specifica tecnica, non da claim generici.";
    }
    if (/noleggio|fleet|mobilita|lungo termine/.test(s)) {
      return "Per noleggio e mobilità, chiarisci subito il caso d'uso (privato, flotta o business) e il confronto tra soluzioni — evita claim generici sul prezzo.";
    }
    if (/contract|paviment|rivestiment|hospitality|hotel.*fornit/.test(s)) {
      return "Nel contract e nelle forniture per spazi, mostra ambienti reali e specifica il materiale: hotel, uffici o retail capiscono prima l'applicazione che il catalogo.";
    }
    return "Nel B2B il raggio locale deve essere più ampio (almeno 30-50 km). Evita offerte sconto e punta sulla risoluzione di un problema operativo.";
  }

  return "Assicurati che l'offerta d'ingresso sia facile da capire in meno di 3 secondi da uno smartphone.";
}
