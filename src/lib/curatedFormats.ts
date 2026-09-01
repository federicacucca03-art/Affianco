import { risolviSettoreIntel } from "@/lib/sector-intel";

export type FormatTag =
  | "Formato evergreen"
  | "Hook immediato"
  | "CTA diretta";

export type CuratedFormat = {
  id: string;
  titolo: string;
  descrizione: string;
  tag: FormatTag[];
  istruzioniRegistrazione: [string, string];
};

export type NicchiaFormatiKey =
  | "salute"
  | "ristorazione"
  | "ecommerce"
  | "artigiani"
  | "b2b"
  | "fitness";

const SALUTE: CuratedFormat[] = [
  {
    id: "salute-split-prima-dopo",
    titolo: "Split-Screen Prima/Dopo",
    descrizione:
      "Confronto visivo sobrio (senza claim medici aggressivi). Può essere riutilizzato come contenuto evergreen quando il before/after è soft e il testo è educativo.",
    tag: ["Formato evergreen", "Hook immediato"],
    istruzioniRegistrazione: [
      "Riprendi 2 clip verticali: situazione iniziale generica + risultato estetico/funzionale (senza sangue o claim garantiti).",
      "Montaggio split 50/50 con titolo in overlay: offerta + città. Max 15 secondi.",
    ],
  },
  {
    id: "salute-tour-studio",
    titolo: "Tour Studio 15 sec",
    descrizione:
      "Walkthrough della struttura con tecnologia visibile. Punta su una comunicazione diretta e rassicurante per un pubblico locale.",
    tag: ["Hook immediato", "CTA diretta"],
    istruzioniRegistrazione: [
      "Cammina lentamente in reception → sala trattamenti → strumentazione (luce naturale).",
      "Aggiungi voce off del titolare: 1 frase su chi siete + 1 frase sull'offerta.",
    ],
  },
  {
    id: "salute-dottore-camera",
    titolo: "Dottore/Titolare in Camera",
    descrizione:
      "Talking head autentico: formato evergreen in odontoiatria ed estetica medica. Orientato all'azione, con invito al modulo o a WhatsApp.",
    tag: ["Formato evergreen", "CTA diretta"],
    istruzioniRegistrazione: [
      "Ripresa frontale 9:16, petto in su, sfondo studio neutro. Script 3 blocchi: problema → soluzione → CTA.",
      "Sottotitoli burned-in consigliati: molti guardano senza audio.",
    ],
  },
];

const RISTORAZIONE: CuratedFormat[] = [
  {
    id: "risto-hero-piatto",
    titolo: "Hero Piatto Macro",
    descrizione:
      "Primo piano del piatto signature con steam/vapore. Formato evergreen per ristorazione locale se il piatto non cambia stagionalmente.",
    tag: ["Formato evergreen", "Hook immediato"],
    istruzioniRegistrazione: [
      "Riprendi il piatto appena servito vicino alla finestra (luce laterale). 3 secondi statici + 2 sec slow push-in.",
      "Overlay testo: nome piatto + promo reale (es. pranzo feriale), solo se esiste.",
    ],
  },
  {
    id: "risto-pov-sala",
    titolo: "Video POV Dietro le Quinte",
    descrizione:
      "POV dalla cucina o dal pass: humanizza il brand e si adatta a Stories e Reels.",
    tag: ["Hook immediato"],
    istruzioniRegistrazione: [
      "Clip POV mentre impiatti un ordine reale (15 sec max, audio cucina ok).",
      "Chiudi con piatto finito e CTA prenotazione.",
    ],
  },
  {
    id: "risto-evento-data",
    titolo: "Grafica Data Evento",
    descrizione:
      "Statica o motion leggero con data evento/menu degustazione. Orientato all'azione: invita a prenotare per telefono o WhatsApp.",
    tag: ["CTA diretta", "Formato evergreen"],
    istruzioniRegistrazione: [
      "Foto sala allestita + grafica con data leggibile anche su mobile.",
      "Evita menu illeggibile: max 8 parole in overlay.",
    ],
  },
];

const ECOMMERCE: CuratedFormat[] = [
  {
    id: "eco-ugc-unboxing",
    titolo: "UGC Unboxing 9:16",
    descrizione:
      "Mani reali che aprono pacco e applicano/usano prodotto nei primi 2 secondi. Formato frequente su skincare e beauty DTC.",
    tag: ["Hook immediato", "CTA diretta"],
    istruzioniRegistrazione: [
      "Registra apertura pacco + texture prodotto sulla pelle (luce naturale, no filtro).",
      "CTA vocale: 'Link in bio' o 'Acquista ora' con badge sconto.",
    ],
  },
  {
    id: "eco-before-after-soft",
    titolo: "Prima/Dopo Soft (Skincare)",
    descrizione:
      "Timeline 7/14 giorni senza claim miracolosi. Può essere riutilizzato come contenuto evergreen se coerente con la variante prodotto.",
    tag: ["Formato evergreen"],
    istruzioniRegistrazione: [
      "Stessa luce e stesso angolo per entrambe le clip (selfie neutro).",
      "Testo disclaimer piccolo: 'Risultati possono variare'.",
    ],
  },
  {
    id: "eco-carosello-benefici",
    titolo: "Carosello 3 Benefici",
    descrizione:
      "Slide 1 problema, 2 ingrediente/USP, 3 promo. Formato carosello per elencare i benefici in sequenza.",
    tag: ["Hook immediato", "CTA diretta"],
    istruzioniRegistrazione: [
      "3 foto prodotto su sfondo uniforme + 1 riga testo per slide.",
      "Ultima slide: prezzo barrato + spedizione gratuita se applicabile.",
    ],
  },
];

const ARTIGIANI: CuratedFormat[] = [
  {
    id: "art-prima-dopo-cantiere",
    titolo: "Prima/Dopo Cantiere",
    descrizione:
      "Split o swipe del lavoro finito. Prova sociale per ristrutturazioni, infissi, idraulici. Formato evergreen se la zona servita è stabile.",
    tag: ["Formato evergreen", "CTA diretta"],
    istruzioniRegistrazione: [
      "Foto wide stanza prima + stesso angolo dopo (stessa ora del giorno).",
      "Overlay: zona servita + preventivo gratuito.",
    ],
  },
  {
    id: "art-van-arrivo",
    titolo: "Van + Arrivo sul Posto",
    descrizione:
      "Furgone brandizzato che arriva al cliente: comunica presenza locale e rassicurazione.",
    tag: ["Hook immediato"],
    istruzioniRegistrazione: [
      "Clip 10 sec: van in strada → tecnico che saluta cliente → primo piano strumenti.",
      "Aggiungi nome attività su overlay.",
    ],
  },
  {
    id: "art-recensione-wa",
    titolo: "Screenshot Recensione WhatsApp",
    descrizione:
      "Statica con screenshot recensione reale (nome oscurato). Formato orientato all'azione, usato da artigiani per invitare al modulo.",
    tag: ["CTA diretta", "Formato evergreen"],
    istruzioniRegistrazione: [
      "Screenshot chat/recensione + cornice telefono minimal.",
      "Headline: 'Perché ci scelgono a [Città]' + CTA modulo.",
    ],
  },
];

const B2B: CuratedFormat[] = [
  {
    id: "b2b-case-study",
    titolo: "Case Study 1 Slide",
    descrizione:
      "Una metrica reale del caso (solo se documentabile) e logo cliente oscurato. Sobrio, adatto a consulenza e SaaS B2B.",
    tag: ["CTA diretta", "Formato evergreen"],
    istruzioniRegistrazione: [
      "Grafica 1:1 con 1 metrica grande + 2 bullet di contesto.",
      "CTA: 'Prenota audit gratuito' — tono professionale, no urgenza fake.",
    ],
  },
  {
    id: "b2b-talking-head-desk",
    titolo: "Talking Head da Scrivania",
    descrizione:
      "Founder/consulente spiega problema operativo in 20 sec. Apertura diretta, adatta a un pubblico B2B su Meta.",
    tag: ["Hook immediato"],
    istruzioniRegistrazione: [
      "Webcam o smartphone su treppiede, sfondo ufficio pulito.",
      "Script: dolore → metodo → invito call discovery.",
    ],
  },
  {
    id: "b2b-screen-demo",
    titolo: "Screen Demo Prodotto",
    descrizione:
      "Registrazione schermo con voce over che mostra 1 workflow risolto. Orientato all'azione, con invito a un contatto qualificato.",
    tag: ["CTA diretta"],
    istruzioniRegistrazione: [
      "Loom/OBS: 30 sec max, cursore lento, evidenziare 1 risultato.",
      "Chiusura con CTA unica verso landing o form.",
    ],
  },
];

const FITNESS: CuratedFormat[] = [
  {
    id: "fit-pov-allenamento",
    titolo: "POV Allenamento Reale",
    descrizione:
      "Allievi veri (non stock) in azione. Formato evergreen per palestre, utile con una prova gratuita stabile.",
    tag: ["Formato evergreen", "Hook immediato"],
    istruzioniRegistrazione: [
      "Clip POV 9:16 da sala pesi o corso (movimento dinamico, 12 sec).",
      "Overlay: prova gratuita + quartiere/città.",
    ],
  },
  {
    id: "fit-trainer-hook",
    titolo: "Trainer Hook 3 Secondi",
    descrizione:
      "Trainer guarda camera e fa domanda provocatoria ('Ancora niente risultati?'). Stop scroll immediato.",
    tag: ["Hook immediato", "CTA diretta"],
    istruzioniRegistrazione: [
      "Ripresa frontale trainer in sala, energia alta primi 3 sec.",
      "Transizione rapida a tour struttura + CTA prova.",
    ],
  },
  {
    id: "fit-trasformazione-soft",
    titolo: "Trasformazione Soft 30 Giorni",
    descrizione:
      "Before/after fitness senza fisici irrealistici. Formato sobrio, adatto a comunicazioni continuative.",
    tag: ["Formato evergreen"],
    istruzioniRegistrazione: [
      "Foto progresso allievo consensuato (stesso outfit/angolo).",
      "Didascalia: percorso + offerta prova, no claim medici.",
    ],
  },
];

export const FORMATI_CURATI: Record<NicchiaFormatiKey, CuratedFormat[]> = {
  salute: SALUTE,
  ristorazione: RISTORAZIONE,
  ecommerce: ECOMMERCE,
  artigiani: ARTIGIANI,
  b2b: B2B,
  fitness: FITNESS,
};

export const ETICHETTE_NICCHIA: Record<NicchiaFormatiKey, string> = {
  salute: "Odontoiatria & Salute",
  ristorazione: "Ristorazione & Eventi",
  ecommerce: "E-commerce & Skincare",
  artigiani: "Artigiani & Ristrutturazioni",
  b2b: "Servizi B2B & Consulenza",
  fitness: "Palestre & Fitness",
};

function daMacro(macro: string): NicchiaFormatiKey {
  if (macro.includes("Salute") || macro.includes("Dentale")) return "salute";
  if (macro.includes("Ristorazione") || macro.includes("Eventi")) {
    return "ristorazione";
  }
  if (macro.includes("E-commerce") || macro.includes("Beauty")) {
    return "ecommerce";
  }
  if (macro.includes("Artigiani") || macro.includes("Servizi Locali")) {
    return "artigiani";
  }
  if (macro.includes("B2B") || macro.includes("Professionisti")) return "b2b";
  if (macro.includes("Fitness") || macro.includes("Palestre")) return "fitness";
  return "artigiani";
}

/** Risolve la macro-nicchia formati dal settore Passo 1. */
export function nicchiaFormatiDaSettore(settore: string): NicchiaFormatiKey {
  const intel = risolviSettoreIntel(settore);
  if (intel) return daMacro(intel.macroCategoria);

  const q = (settore ?? "").toLowerCase();
  if (/dent|odonto|clinic|estet|medic|salut/.test(q)) return "salute";
  if (/ristor|pizzer|bar|food|event|hotel|wedding/.test(q)) {
    return "ristorazione";
  }
  if (/shop|ecommerce|e-commerce|skincare|beauty|moda|store/.test(q)) {
    return "ecommerce";
  }
  if (/palestr|fitness|crossfit|personal trainer/.test(q)) return "fitness";
  if (/b2b|consulenz|saas|agenzia|avvocat|commercialist/.test(q)) {
    return "b2b";
  }
  if (/idraul|edil|infiss|artig|ristruttur|impiant/.test(q)) return "artigiani";
  return "artigiani";
}

export function formatiPerSettore(settore: string): CuratedFormat[] {
  return FORMATI_CURATI[nicchiaFormatiDaSettore(settore)];
}

export function formatoPerId(
  settore: string,
  id: string | null | undefined,
): CuratedFormat | null {
  if (!id) return null;
  return formatiPerSettore(settore).find((f) => f.id === id) ?? null;
}

/** Suggerimento creativo per campagne BOOKINGS (ispirazione, non performance garantita). */
export type BookingSuggerimentoCreativo = {
  id: string;
  nome: string;
  quandoUsarlo: string;
  cosaMostrare: string;
  hookVisivo: string;
};

const BOOKING_SUGGERIMENTI_BASE: BookingSuggerimentoCreativo[] = [
  {
    id: "disponibilita-settimanale",
    nome: "Disponibilità settimanale",
    quandoUsarlo:
      "Se esiste una disponibilità reale da comunicare — senza inventare cifre.",
    cosaMostrare:
      "Agenda aperta, professionista in struttura o servizio in evidenza + CTA chiara a prenotare.",
    hookVisivo:
      "Overlay «Disponibilità questa settimana» o calendario visibile — nessun numero inventato.",
  },
  {
    id: "testimonial",
    nome: "Testimonial",
    quandoUsarlo:
      "Quando hai recensioni o feedback reali da clienti che hanno prenotato.",
    cosaMostrare:
      "Citazione breve, nome oscurato se serve, contesto del servizio prenotato.",
    hookVisivo:
      "Format consigliato: card con quote + stelle o screenshot recensione autentica.",
  },
  {
    id: "prima-dopo",
    nome: "Prima / dopo",
    quandoUsarlo:
      "Idea da testare se il servizio ha un risultato visibile e documentabile con consenso.",
    cosaMostrare:
      "Confronto sobrio dello stesso soggetto/ambiente — tono professionale, no promesse garantite.",
    hookVisivo:
      "Split o swipe soft con didascalia neutra (es. «Percorso personalizzato»).",
  },
  {
    id: "slot-liberi",
    nome: "Slot liberi",
    quandoUsarlo:
      "Quando vuoi invitare a prenotare evidenziando che ci sono posti — solo se reali.",
    cosaMostrare:
      "Calendario, agenda o messaggio di invito + CTA al canale scelto.",
    hookVisivo:
      "«Prenota il tuo slot» o agenda in primo piano — senza numeri fittizi.",
  },
  {
    id: "promo-limitata",
    nome: "Promo limitata",
    quandoUsarlo:
      "Se l'offerta d'ingresso ha una scadenza o condizione reale da comunicare.",
    cosaMostrare:
      "Offerta scritta nel brief + servizio + invito a prenotare entro la finestra indicata.",
    hookVisivo:
      "Badge promo sobrio (es. «Prima visita») — utile per richiamare l'attenzione, non per promettere conversioni.",
  },
  {
    id: "video-professionista",
    nome: "Video del professionista",
    quandoUsarlo:
      "Format consigliato per generare fiducia prima della prenotazione.",
    cosaMostrare:
      "Titolare o professionista che spiega servizio, modalità di prenotazione e cosa aspettarsi.",
    hookVisivo:
      "Talking head 9:16, primi 3 secondi con domanda o invito diretto a prenotare.",
  },
  {
    id: "reminder",
    nome: "Reminder / promemoria",
    quandoUsarlo:
      "Idea da testare per ricordare il valore del promemoria pre-appuntamento.",
    cosaMostrare:
      "Notifica WhatsApp, SMS o email di conferma — tono rassicurante, non allarmistico.",
    hookVisivo:
      "Mockup messaggio «Ti aspettiamo domani alle…» + logo struttura.",
  },
  {
    id: "flusso-prenotazione",
    nome: "Schermata / flusso di prenotazione",
    quandoUsarlo:
      "Utile per abbassare l'attrito: mostra quanto è semplice completare la prenotazione.",
    cosaMostrare:
      "Screen recording o screenshot del calendario WhatsApp / link / modulo — passaggi chiari.",
    hookVisivo:
      "«Prenota in pochi tap» con sequenza 1-2-3 visiva del percorso reale.",
  },
];

/**
 * Suggerimenti creativi BOOKINGS.
 * Se `postiDisponibiliSettimana` è valorizzato (solo cifre), personalizza gli esempi
 * di disponibilità/slot — mai numeri inventati.
 */
export function suggerimentiBookingCreativi(
  postiDisponibiliSettimana?: string,
): BookingSuggerimentoCreativo[] {
  const postiRaw = (postiDisponibiliSettimana ?? "").trim();
  const haPosti = postiRaw.length > 0 && /^\d+$/.test(postiRaw);

  return BOOKING_SUGGERIMENTI_BASE.map((s) => {
    if (s.id === "disponibilita-settimanale") {
      return {
        ...s,
        quandoUsarlo: haPosti
          ? "Hai indicato disponibilità reale al Passo 1: format consigliato per comunicarla in modo chiaro."
          : s.quandoUsarlo,
        hookVisivo: haPosti
          ? `Overlay «Disponibilità questa settimana» — puoi citare ${postiRaw} posti solo se coerente col dato inserito.`
          : s.hookVisivo,
      };
    }
    if (s.id === "slot-liberi") {
      return {
        ...s,
        nome: haPosti ? "Slot liberi" : "Agenda / slot disponibili",
        quandoUsarlo: haPosti
          ? "Hai indicato posti disponibili al Passo 1: idea da testare per invitare a prenotare."
          : "Quando vuoi invitare a prenotare senza indicare quantità specifica.",
        hookVisivo: haPosti
          ? `Idea da testare: «${postiRaw} posti questa settimana» in overlay — solo se corrisponde al dato reale.`
          : "«Prenota il tuo slot» o calendario in primo piano — nessun numero fittizio.",
      };
    }
    return s;
  });
}

/** Alias esportato per integrazione Studio Creativo BOOKINGS. */
export const BOOKING_SUGGERIMENTI = BOOKING_SUGGERIMENTI_BASE;

/** Suggerimento creativo per campagne ECOMMERCE (ispirazione, non performance). */
export type EcommerceSuggerimentoCreativo = {
  id: string;
  nome: string;
  quandoUsarlo: string;
  cosaMostrare: string;
  hookVisivo: string;
};

const ECOMMERCE_SUGGERIMENTI_BASE: EcommerceSuggerimentoCreativo[] = [
  {
    id: "prodotto-in-uso",
    nome: "Prodotto in uso",
    quandoUsarlo:
      "Quando puoi mostrare il prodotto nel contesto reale d'uso del cliente.",
    cosaMostrare:
      "Prodotto in mano o in scena quotidiana, beneficio principale leggibile nei primi secondi.",
    hookVisivo:
      "Primo piano del prodotto in azione — niente claim di performance.",
  },
  {
    id: "ugc-creator",
    nome: "UGC / creator",
    quandoUsarlo:
      "Format consigliato per video verticali semplici e autenticità.",
    cosaMostrare:
      "Persona che mostra prodotto, utilizzo e beneficio in tono naturale.",
    hookVisivo:
      "9:16 talking head o demo breve — prodotto e beneficio nei primi 3 secondi.",
  },
  {
    id: "recensione-cliente",
    nome: "Recensione cliente",
    quandoUsarlo:
      "Usalo quando hai recensioni, rating o testimonianze reali disponibili.",
    cosaMostrare:
      "Citazione o screenshot di una recensione autentica + prodotto in evidenza.",
    hookVisivo:
      "Card quote / stelle reali — senza inventare rating o nomi.",
  },
  {
    id: "demo-prodotto",
    nome: "Demo prodotto",
    quandoUsarlo:
      "Quando il prodotto ha un funzionamento o un differenziatore visibile in pochi secondi.",
    cosaMostrare:
      "Sequenza breve: problema → uso → risultato concreto (senza promesse garantite).",
    hookVisivo:
      "Clip 10–15 sec con gesti chiari e testo overlay minimo sul beneficio.",
  },
  {
    id: "unboxing",
    nome: "Unboxing",
    quandoUsarlo:
      "Utile per prodotti fisici dove packaging e prima esperienza contano.",
    cosaMostrare:
      "Apertura confezione, dettaglio prodotto, prima impressione autentica.",
    hookVisivo:
      "Mani che aprono il pacco nei primi 2 secondi — tono genuino, non teatrale.",
  },
  {
    id: "carousel-benefici",
    nome: "Carousel benefici",
    quandoUsarlo:
      "Quando hai più benefici o caratteristiche rilevanti da elencare.",
    cosaMostrare:
      "Una card per beneficio / feature — coerente con brief e offerta reale.",
    hookVisivo:
      "Carousel 1:1 o 4:5: prodotto hero → beneficio 1 → beneficio 2 → CTA.",
  },
  {
    id: "bundle-offerta",
    nome: "Bundle o offerta",
    quandoUsarlo:
      "Metti in evidenza l'offerta commerciale quando ne hai una realmente disponibile.",
    cosaMostrare:
      "Visual dedicato all'offerta del Passo 1 (condizioni reali) + prodotto.",
    hookVisivo:
      "Badge promo sobrio sull'offerta reale — nessun sconto inventato.",
  },
  {
    id: "social-proof",
    nome: "Social proof",
    quandoUsarlo:
      "Usalo quando hai recensioni, rating o testimonianze reali disponibili.",
    cosaMostrare:
      "Recensioni, rating o numeri di clienti effettivamente documentabili.",
    hookVisivo:
      "Overlay con prova sociale reale accanto al prodotto — niente cifre fittizie.",
  },
  {
    id: "confronto",
    nome: "Confronto",
    quandoUsarlo:
      "Confronta visivamente due condizioni quando il prodotto si presta realmente a questo formato.",
    cosaMostrare:
      "Confronto chiaro tra alternative o stati — solo se supportato e appropriato.",
    hookVisivo:
      "Split o swipe neutro — niente trasformazioni assolute o risultati garantiti.",
  },
  {
    id: "prodotto-hero",
    nome: "Prodotto hero",
    quandoUsarlo:
      "Quando serve un visual semplice e pulito con prodotto e beneficio principale.",
    cosaMostrare:
      "Prodotto in evidenza, beneficio chiaro, CTA all'acquisto.",
    hookVisivo:
      "Still o video corto su sfondo pulito — prodotto, beneficio, CTA leggibili.",
  },
];

/**
 * Suggerimenti creativi ECOMMERCE.
 * Personalizza solo con dati reali (offerta / prodotto) — mai numeri inventati.
 */
export function suggerimentiEcommerceCreativi(input?: {
  frontEndOffer?: string;
  heroProduct?: string;
  elevatorPitch?: string;
  nomeCliente?: string;
  formatoEcommerce?: string;
}): EcommerceSuggerimentoCreativo[] {
  const offerta = (input?.frontEndOffer ?? "").trim();
  const hero =
    (input?.heroProduct ?? "").trim() ||
    (() => {
      const pitch = (input?.elevatorPitch ?? "").trim();
      if (!pitch) return "";
      if (pitch.length <= 48) return pitch;
      const prima = pitch.split(/[.|;]/)[0]?.trim() || pitch;
      return prima.split(/\s+/).filter(Boolean).slice(0, 6).join(" ");
    })();
  const brand = (input?.nomeCliente ?? "").trim();
  const formato = (input?.formatoEcommerce ?? "").trim().toUpperCase();

  return ECOMMERCE_SUGGERIMENTI_BASE.map((s) => {
    if (s.id === "bundle-offerta") {
      return {
        ...s,
        quandoUsarlo: offerta
          ? "Hai un'offerta al Passo 1: format consigliato per comunicarla in modo chiaro."
          : s.quandoUsarlo,
        cosaMostrare: offerta
          ? `Metti in evidenza «${offerta}» insieme al prodotto — solo condizioni realmente disponibili.`
          : s.cosaMostrare,
        hookVisivo: offerta
          ? `Badge o overlay con «${offerta.slice(0, 80)}${offerta.length > 80 ? "…" : ""}» — senza aggiungere sconti non presenti.`
          : s.hookVisivo,
      };
    }
    if (s.id === "prodotto-in-uso" || s.id === "prodotto-hero") {
      if (!hero) return s;
      return {
        ...s,
        cosaMostrare: `${s.cosaMostrare} Riferimento prodotto: «${hero}».`,
        hookVisivo: brand
          ? `${s.hookVisivo} Brand: ${brand}.`
          : s.hookVisivo,
      };
    }
    if (s.id === "carousel-benefici" && formato === "CAROUSEL") {
      return {
        ...s,
        quandoUsarlo:
          "Hai selezionato Carousel: idea da testare per distribuire i benefici sulle card.",
      };
    }
    if (s.id === "ugc-creator" && formato === "VIDEO") {
      return {
        ...s,
        quandoUsarlo:
          "Hai selezionato Video: format consigliato per UGC / creator verticale.",
      };
    }
    if (s.id === "unboxing" && formato === "VIDEO") {
      return {
        ...s,
        quandoUsarlo:
          "Hai selezionato Video: unboxing funziona bene in clip verticali brevi.",
      };
    }
    return s;
  });
}

/** Alias esportato per integrazione Studio Creativo ECOMMERCE. */
export const ECOMMERCE_SUGGERIMENTI = ECOMMERCE_SUGGERIMENTI_BASE;

/** Suggerimento creativo per campagne INSTORE (drive-to-store, non performance). */
export type InstoreSuggerimentoCreativo = {
  id: string;
  nome: string;
  quandoUsarlo: string;
  cosaMostrare: string;
  hookVisivo: string;
};

const INSTORE_SUGGERIMENTI_BASE: InstoreSuggerimentoCreativo[] = [
  {
    id: "esterno-insegna",
    nome: "Esterno / insegna",
    quandoUsarlo:
      "Quando vuoi che chi vede l'annuncio riconosca subito il punto vendita.",
    cosaMostrare:
      "Facciata, insegna e ingresso in luce naturale — senza claim di performance.",
    hookVisivo:
      "Esterno leggibile nei primi secondi; insegna in primo piano se possibile.",
  },
  {
    id: "interno-pdv",
    nome: "Dentro il punto vendita",
    quandoUsarlo:
      "Quando vuoi comunicare atmosfera, qualità dello spazio o esperienza in sede.",
    cosaMostrare:
      "Ambiente reale, prodotti o servizio nel contesto del negozio — niente staging finto.",
    hookVisivo:
      "Interno ampio o dettaglio significativo; tono autentico, non brochure.",
  },
  {
    id: "prodotto-servizio",
    nome: "Prodotto o servizio protagonista",
    quandoUsarlo:
      "Quando c'è un motivo concreto per cui le persone dovrebbero venire in negozio.",
    cosaMostrare:
      "Ciò che offri in sede al centro del frame, coerente con brief e messaggio.",
    hookVisivo:
      "Prodotto/servizio in primo piano + contesto locale sobrio — senza numeri inventati.",
  },
  {
    id: "staff",
    nome: "Staff / persona reale",
    quandoUsarlo:
      "Quando vuoi umanizzare l'attività e mostrare chi accoglie il cliente.",
    cosaMostrare:
      "Persona dello staff in ambiente reale, tono accogliente e naturale.",
    hookVisivo:
      "Volto o gesto di accoglienza vicino all'ingresso o al bancone — niente attori generici.",
  },
  {
    id: "offerta-locale",
    nome: "Offerta locale",
    quandoUsarlo:
      "Metti in evidenza l'offerta commerciale quando ne hai una realmente disponibile.",
    cosaMostrare:
      "Visual dedicato all'offerta del Passo 1 (condizioni reali) e al punto vendita.",
    hookVisivo:
      "Overlay o badge con l'offerta reale — nessun sconto, percentuale o scadenza inventati.",
  },
  {
    id: "come-trovarci",
    nome: "Come trovarci",
    quandoUsarlo:
      "Utile in video o sequenze brevi per chiarire ingresso, zona o percorso.",
    cosaMostrare:
      "Arrivo all'ingresso, insegna, o punti di riferimento reali della zona.",
    hookVisivo:
      "Clip verticale «come arrivare» o frame sull'ingresso — senza distanze inventate.",
  },
  {
    id: "mappa-distanza",
    nome: "Mappa / distanza",
    quandoUsarlo:
      "Quando vuoi contestualizzare il punto vendita nell'area in cui stai facendo advertising.",
    cosaMostrare:
      "Mappa o vista zona allineata alla città e al raggio configurati — non alla posizione dell'utente.",
    hookVisivo:
      "Contestualizza visivamente il punto vendita nella zona pubblicitaria configurata.",
  },
  {
    id: "testimonianza-locale",
    nome: "Testimonianza locale",
    quandoUsarlo:
      "Usalo quando hai recensioni o testimonianze reali disponibili.",
    cosaMostrare:
      "Citazione o screenshot di una recensione autentica + contesto del punto vendita.",
    hookVisivo:
      "Card quote reale — senza inventare rating, nomi o numero di recensioni.",
  },
  {
    id: "esperienza-negozio",
    nome: "Esperienza in negozio",
    quandoUsarlo:
      "Quando vuoi mostrare cosa succede quando una persona entra o usa il servizio.",
    cosaMostrare:
      "Momento concreto in sede: prova, servizio, degustazione, consulenza — reale.",
    hookVisivo:
      "Sequenza breve dell'esperienza in negozio — tono documentaristico, non teaser vuoto.",
  },
  {
    id: "prima-dopo",
    nome: "Prima / dopo",
    quandoUsarlo:
      "Usalo solo quando il prodotto o servizio si presta realmente a un confronto visivo.",
    cosaMostrare:
      "Confronto onesto e documentabile — senza trasformazioni garantite o risultati assoluti.",
    hookVisivo:
      "Split o sequenza prima/dopo solo se supportata da casi reali — niente claim non supportati.",
  },
];

/**
 * Personalizza i suggerimenti INSTORE solo con dati realmente disponibili.
 * Nessun fallback inventato (sconti, distanze, recensioni, scarsità).
 */
export function suggerimentiInstoreCreativi(input?: {
  frontEndOffer?: string;
  nomeCliente?: string;
  elevatorPitch?: string;
  citta?: string;
  raggioKm?: number;
  formatoEcommerce?: string;
}): InstoreSuggerimentoCreativo[] {
  const offerta = (input?.frontEndOffer ?? "").trim();
  const brand = (input?.nomeCliente ?? "").trim();
  const pitch = (input?.elevatorPitch ?? "").trim();
  const hero = (() => {
    if (!pitch) return "";
    if (pitch.length <= 48) return pitch;
    const prima = pitch.split(/[.|;]/)[0]?.trim() || pitch;
    return prima.split(/\s+/).filter(Boolean).slice(0, 6).join(" ");
  })();
  const citta = (input?.citta ?? "").trim();
  const raggio = Number(input?.raggioKm) || 0;
  const zonaAdvertising =
    citta && raggio > 0 ? `Zona ${citta} · raggio ${raggio} km` : "";
  const formato = (input?.formatoEcommerce ?? "").trim().toUpperCase();

  return INSTORE_SUGGERIMENTI_BASE.map((s) => {
    if (s.id === "offerta-locale") {
      return {
        ...s,
        quandoUsarlo: offerta
          ? "Hai un'offerta al Passo 1: format consigliato per comunicarla in modo chiaro."
          : s.quandoUsarlo,
        cosaMostrare: offerta
          ? `Metti in evidenza «${offerta}» insieme al punto vendita — solo condizioni realmente disponibili.`
          : s.cosaMostrare,
        hookVisivo: offerta
          ? `Badge o overlay con «${offerta.slice(0, 80)}${offerta.length > 80 ? "…" : ""}» — senza aggiungere sconti non presenti.`
          : s.hookVisivo,
      };
    }
    if (s.id === "mappa-distanza") {
      if (!zonaAdvertising) return s;
      return {
        ...s,
        cosaMostrare: `${s.cosaMostrare} Area pubblicitaria configurata: ${zonaAdvertising}.`,
        hookVisivo: `Contestualizza il punto vendita in ${zonaAdvertising} — non inventare distanze dall'utente.`,
      };
    }
    if (s.id === "prodotto-servizio" && hero) {
      return {
        ...s,
        cosaMostrare: `${s.cosaMostrare} Riferimento: «${hero}».`,
        hookVisivo: brand
          ? `${s.hookVisivo} Attività: ${brand}.`
          : s.hookVisivo,
      };
    }
    if (s.id === "esterno-insegna" && brand) {
      return {
        ...s,
        hookVisivo: `${s.hookVisivo} Insegna / nome: ${brand}.`,
      };
    }
    if (s.id === "come-trovarci" && formato === "VIDEO") {
      return {
        ...s,
        quandoUsarlo:
          "Hai selezionato Video: utile per una clip breve su ingresso e zona.",
      };
    }
    if (s.id === "come-trovarci" && citta) {
      return {
        ...s,
        cosaMostrare: `${s.cosaMostrare} Contesto zona: ${citta}.`,
      };
    }
    return s;
  });
}

/** Alias esportato per integrazione Studio Creativo INSTORE. */
export const INSTORE_SUGGERIMENTI = INSTORE_SUGGERIMENTI_BASE;

/** Suggerimento creativo RETARGETING (recupero, non performance). */
export type RetargetingSuggerimentoCreativo = {
  id: string;
  nome: string;
  quandoUsarlo: string;
  cosaMostrare: string;
  hookVisivo: string;
};

const RETARGETING_SUGGERIMENTI_BASE: RetargetingSuggerimentoCreativo[] = [
  {
    id: "reminder-valore",
    nome: "Reminder del valore",
    quandoUsarlo:
      "Riporta in primo piano il valore principale dell'offerta senza fare riferimento al comportamento dell'utente.",
    cosaMostrare:
      "Il valore o beneficio principale, coerente con brief e messaggio — senza tracking o visite precedenti.",
    hookVisivo:
      "Messaggio chiaro nei primi secondi: valore al centro, tono neutro.",
  },
  {
    id: "beneficio-dimenticato",
    nome: "Beneficio dimenticato",
    quandoUsarlo:
      "Metti in evidenza un beneficio concreto già presente nella proposta.",
    cosaMostrare:
      "Un vantaggio reale dal brief — non inventare benefici, garanzie o risultati.",
    hookVisivo:
      "Beneficio leggibile in overlay o in scena — solo ciò che è documentabile.",
  },
  {
    id: "obiezione",
    nome: "Obiezione principale",
    quandoUsarlo:
      "Affronta un dubbio reale che il cliente può avere sul prodotto o servizio.",
    cosaMostrare:
      "Chiarimento onesto su un dubbio reale — senza inventare garanzie, resi, tempi o condizioni.",
    hookVisivo:
      "Frame che risponde al dubbio in modo sobrio — niente claim non supportati.",
  },
  {
    id: "faq",
    nome: "FAQ",
    quandoUsarlo:
      "Rispondi a una domanda reale sul prodotto o servizio.",
    cosaMostrare:
      "Una risposta chiara a una domanda reale del brand — non una FAQ fittizia «che ci fanno tutti».",
    hookVisivo:
      "Domanda → risposta in pochi secondi; testo overlay minimo e verificabile.",
  },
  {
    id: "demo",
    nome: "Demo / come funziona",
    quandoUsarlo:
      "Mostra in modo semplice come funziona il prodotto, servizio o processo.",
    cosaMostrare:
      "Sequenza breve di utilizzo o flusso reale — senza promettere risultati.",
    hookVisivo:
      "Clip o frame passo-passo: come funziona, non cosa «garantisce».",
  },
  {
    id: "testimonianza",
    nome: "Recensione o testimonianza",
    quandoUsarlo:
      "Usalo solo se hai recensioni o testimonianze reali disponibili.",
    cosaMostrare:
      "Citazione o screenshot autentico — senza inventare quote, stelle, rating, nomi o numeri di clienti.",
    hookVisivo:
      "Card o screenshot di prova reale — niente rating o risultati inventati.",
  },
  {
    id: "confronto",
    nome: "Confronto / differenza",
    quandoUsarlo:
      "Metti in evidenza una differenza reale o un punto di forza già presente nel brief.",
    cosaMostrare:
      "Un differenziatore documentabile — senza competitor, prezzi o performance inventati.",
    hookVisivo:
      "Confronto sobrio sul punto di forza reale — niente «migliore» o percentuali non supportate.",
  },
  {
    id: "offerta-reale",
    nome: "Offerta reale",
    quandoUsarlo:
      "Metti in evidenza l'offerta commerciale quando ne hai una realmente disponibile.",
    cosaMostrare:
      "Visual dedicato all'offerta del Passo 1 (condizioni reali) — senza inventare promozioni o scadenze.",
    hookVisivo:
      "Badge o overlay sull'offerta reale — senza scarsità o percentuali non dichiarate.",
  },
  {
    id: "motivo-tornare",
    nome: "Motivo per tornare",
    quandoUsarlo:
      "Mostra un motivo concreto per rivalutare l'offerta.",
    cosaMostrare:
      "Un motivo chiaro e non invasivo — senza riferimenti al comportamento o al tracking dell'utente.",
    hookVisivo:
      "Motivo concreto in primo piano; tono rispettoso, non creepy.",
  },
  {
    id: "ugc",
    nome: "UGC / persona reale",
    quandoUsarlo:
      "Quando puoi mostrare prodotto o servizio attraverso una persona reale.",
    cosaMostrare:
      "Mostra il prodotto o servizio attraverso una persona reale e un utilizzo concreto.",
    hookVisivo:
      "Persona in scena con utilizzo concreto — senza promettere risultati o metriche.",
  },
];

/**
 * Personalizza i suggerimenti RETARGETING solo con dati realmente disponibili.
 * Nessun fallback inventato (audience, sconti, creepy tracking, performance).
 */
export function suggerimentiRetargetingCreativi(input?: {
  frontEndOffer?: string;
  nomeCliente?: string;
  elevatorPitch?: string;
  targetType?: "B2C" | "B2B";
  sitoWeb?: string;
  formatoEcommerce?: string;
}): RetargetingSuggerimentoCreativo[] {
  const offerta = (input?.frontEndOffer ?? "").trim();
  const brand = (input?.nomeCliente ?? "").trim();
  const pitch = (input?.elevatorPitch ?? "").trim();
  const isB2B = (input?.targetType ?? "B2C") === "B2B";
  const sito = (input?.sitoWeb ?? "").trim();
  const formato = (input?.formatoEcommerce ?? "").trim().toUpperCase();
  const hero = (() => {
    if (!pitch) return "";
    if (pitch.length <= 48) return pitch;
    const prima = pitch.split(/[.|;]/)[0]?.trim() || pitch;
    return prima.split(/\s+/).filter(Boolean).slice(0, 6).join(" ");
  })();
  const haBeneficioAffidabile = Boolean(hero || offerta);

  return RETARGETING_SUGGERIMENTI_BASE.map((s) => {
    if (s.id === "offerta-reale") {
      return {
        ...s,
        quandoUsarlo: offerta
          ? "Hai un'offerta al Passo 1: format consigliato per comunicarla in modo chiaro."
          : "Usalo solo se hai un'offerta realmente disponibile da mostrare.",
        cosaMostrare: offerta
          ? `Metti in evidenza «${offerta}» — solo condizioni realmente disponibili.`
          : s.cosaMostrare,
        hookVisivo: offerta
          ? `Badge o overlay con «${offerta.slice(0, 80)}${offerta.length > 80 ? "…" : ""}» — senza aggiungere sconti non presenti.`
          : s.hookVisivo,
      };
    }

    if (s.id === "reminder-valore") {
      const base: RetargetingSuggerimentoCreativo = {
        ...s,
        quandoUsarlo: isB2B
          ? "Riporta l'attenzione sul valore principale senza presupporre un contatto già avvenuto."
          : s.quandoUsarlo,
        cosaMostrare: isB2B
          ? "Chiarezza del valore o del caso d'uso, coerente con brief e messaggio."
          : s.cosaMostrare,
      };
      if (offerta) {
        return {
          ...base,
          cosaMostrare: `${base.cosaMostrare} Offerta di riferimento: «${offerta}».`,
        };
      }
      if (hero) {
        return {
          ...base,
          cosaMostrare: `${base.cosaMostrare} Riferimento brief: «${hero}».`,
          hookVisivo: brand
            ? `${base.hookVisivo} Brand: ${brand}.`
            : base.hookVisivo,
        };
      }
      if (brand) {
        return {
          ...base,
          hookVisivo: `${base.hookVisivo} Brand: ${brand}.`,
        };
      }
      return base;
    }

    if (s.id === "beneficio-dimenticato") {
      if (haBeneficioAffidabile) {
        return {
          ...s,
          quandoUsarlo: isB2B
            ? "Metti in evidenza un vantaggio concreto già nel brief, con chiarezza."
            : s.quandoUsarlo,
          cosaMostrare: hero
            ? `Metti in evidenza «${hero}» — solo se è davvero nel brief.`
            : offerta
              ? `Collega il beneficio a «${offerta}» senza inventare vantaggi extra.`
              : s.cosaMostrare,
        };
      }
      return {
        ...s,
        quandoUsarlo:
          "Metti in evidenza un beneficio concreto già presente nella proposta.",
        cosaMostrare:
          "Un vantaggio reale già nella proposta — non inventare il beneficio.",
      };
    }

    if (s.id === "obiezione") {
      return {
        ...s,
        quandoUsarlo: isB2B
          ? "Chiarisci un dubbio reale sul valore o sul caso d'uso — senza inventare obiezioni."
          : s.quandoUsarlo,
        cosaMostrare: isB2B
          ? "Chiarimento sobrio su un dubbio reale — niente garanzie, tempi o condizioni inventate."
          : s.cosaMostrare,
      };
    }

    if (s.id === "faq") {
      return {
        ...s,
        quandoUsarlo: isB2B
          ? "Rispondi a una domanda reale sul servizio o sul caso d'uso."
          : s.quandoUsarlo,
      };
    }

    if (s.id === "demo") {
      return {
        ...s,
        quandoUsarlo: isB2B
          ? "Mostra in modo semplice il caso d'uso o come funziona il processo."
          : s.quandoUsarlo,
        cosaMostrare: isB2B
          ? "Sequenza breve del caso d'uso o del processo — senza promettere risultati."
          : s.cosaMostrare,
        hookVisivo:
          formato === "VIDEO"
            ? "Hai selezionato Video: utile per una demo breve passo-passo."
            : s.hookVisivo,
      };
    }

    if (s.id === "motivo-tornare") {
      return {
        ...s,
        quandoUsarlo: isB2B
          ? "Mostra perché vale la pena approfondire o rivalutare l'offerta."
          : s.quandoUsarlo,
        cosaMostrare: isB2B
          ? "Un motivo chiaro per riportare l'attenzione sul valore — senza presupporre un dialogo già aperto."
          : s.cosaMostrare,
        hookVisivo: sito
          ? `${s.hookVisivo} Destinazione indicata: sì (non inventare il percorso utente).`
          : s.hookVisivo,
      };
    }

    if (s.id === "ugc") {
      return {
        ...s,
        quandoUsarlo: isB2B
          ? "Quando puoi mostrare il servizio attraverso una persona reale e un caso d'uso concreto."
          : s.quandoUsarlo,
        cosaMostrare: isB2B
          ? "Persona reale e utilizzo concreto del servizio — senza promettere risultati o metriche."
          : s.cosaMostrare,
        hookVisivo:
          formato === "VIDEO"
            ? "Hai selezionato Video: adatto a una clip con persona reale e utilizzo concreto."
            : s.hookVisivo,
      };
    }

    if (s.id === "confronto" && hero) {
      return {
        ...s,
        cosaMostrare: `${s.cosaMostrare} Punto di forza dal brief: «${hero}».`,
      };
    }

    return s;
  });
}

/** Alias esportato per integrazione Studio Creativo RETARGETING. */
export const RETARGETING_SUGGERIMENTI = RETARGETING_SUGGERIMENTI_BASE;

/** Suggerimento creativo AWARENESS (apertura / lancio locale, non performance). */
export type AwarenessSuggerimentoCreativo = {
  id: string;
  nome: string;
  quandoUsarlo: string;
  cosaMostrare: string;
  hookVisivo: string;
};

const AWARENESS_SUGGERIMENTI_BASE: AwarenessSuggerimentoCreativo[] = [
  {
    id: "reveal-novita",
    nome: "Reveal / novità",
    quandoUsarlo:
      "Quando vuoi mostrare subito ciò che c'è di nuovo e renderlo riconoscibile.",
    cosaMostrare:
      "Ciò che è nuovo: spazio, attività o progetto — solo se hai materiale reale. Non inventare il tipo di sede.",
    hookVisivo:
      "Mostra subito ciò che c'è di nuovo e rendilo riconoscibile nei primi secondi.",
  },
  {
    id: "esterno-insegna",
    nome: "Esterno / insegna",
    quandoUsarlo:
      "Quando vuoi aiutare a riconoscere il luogo o il brand.",
    cosaMostrare:
      "Un elemento riconoscibile (insegna, facciata, logo in contesto) — senza inventare indirizzo o quartiere.",
    hookVisivo:
      "Mostra un elemento che aiuti a riconoscere il luogo o il brand.",
  },
  {
    id: "cosa-troverai",
    nome: "Cosa troverai",
    quandoUsarlo:
      "Quando vuoi anticipare cosa si può scoprire o trovare.",
    cosaMostrare:
      "Servizi, prodotti o vantaggi realmente descritti in messaggio, brief o settore — niente inventati.",
    hookVisivo:
      "Elenco o frame chiari su «cosa troverai» — solo contenuti documentabili.",
  },
  {
    id: "tour-rapido",
    nome: "Tour rapido",
    quandoUsarlo:
      "Utile in carosello o video per mostrare in pochi passaggi ciò che vuoi far conoscere.",
    cosaMostrare:
      "Sequenza breve dello spazio o dell'offerta — senza assumere metrature, stanze o reparti.",
    hookVisivo:
      "Mostra in pochi passaggi lo spazio o ciò che vuoi far conoscere.",
  },
  {
    id: "dettaglio-distintivo",
    nome: "Dettaglio distintivo",
    quandoUsarlo:
      "Quando un dettaglio reale rappresenta l'identità dell'attività.",
    cosaMostrare:
      "Un dettaglio documentabile dal brief o dal messaggio — senza inventare USP.",
    hookVisivo:
      "Metti in primo piano un dettaglio che rappresenti l'identità dell'attività.",
  },
  {
    id: "team-persone",
    nome: "Team / persone",
    quandoUsarlo:
      "Quando hai materiale reale e coerente con il brand.",
    cosaMostrare:
      "Persone dietro l'attività in contesto reale — nessuna testimonianza o risultato inventato.",
    hookVisivo:
      "Mostra le persone dietro l'attività, se hai materiale reale e coerente con il brand.",
  },
  {
    id: "servizio-evidenza",
    nome: "Servizio in evidenza",
    quandoUsarlo:
      "Quando vuoi mettere in evidenza un servizio o un'offerta solo se hai materiale reale.",
    cosaMostrare:
      "Metti in evidenza un servizio o un'offerta solo se hai materiale reale da mostrare.",
    hookVisivo:
      "Servizio o messaggio al centro del frame — senza prezzi, promo o «più richiesto» inventati.",
  },
  {
    id: "zona-trovarci",
    nome: "Zona / come trovarci",
    quandoUsarlo:
      "Quando vuoi contestualizzare dove scoprire l'attività.",
    cosaMostrare:
      "Zona o indicazioni solo con dati reali (città, link/mappa forniti) — niente indirizzi inventati.",
    hookVisivo:
      "Visual di zona o come trovarci — solo se hai materiale e destinazione reali.",
  },
  {
    id: "messaggio-apertura",
    nome: "Messaggio di apertura",
    quandoUsarlo:
      "Quando il messaggio di apertura è chiaro e va messo in evidenza nel visual.",
    cosaMostrare:
      "Il messaggio reale di apertura, oppure un visual informativo neutro se non hai un messaggio dichiarato.",
    hookVisivo:
      "Testo overlay sobrio con il messaggio reale — oppure «Una nuova apertura da conoscere.»",
  },
  {
    id: "dietro-quinte",
    nome: "Dietro le quinte",
    quandoUsarlo:
      "Quando hai materiale reale di preparazione, allestimento o processo.",
    cosaMostrare:
      "Preparazione, allestimento o processo solo se hai materiale reale — niente cantiere o pre-apertura inventati.",
    hookVisivo:
      "Mostra preparazione, allestimento o processo solo se hai materiale reale.",
  },
];

/**
 * Personalizza i suggerimenti AWARENESS solo con dati realmente disponibili.
 * Nessun fallback inventato (sconti, date, eventi, performance, visite).
 */
export function suggerimentiAwarenessCreativi(input?: {
  frontEndOffer?: string;
  nomeCliente?: string;
  elevatorPitch?: string;
  settore?: string;
  citta?: string;
  sitoWeb?: string;
  formatoEcommerce?: string;
}): AwarenessSuggerimentoCreativo[] {
  const offerta = (input?.frontEndOffer ?? "").trim();
  const brand = (input?.nomeCliente ?? "").trim();
  const pitch = (input?.elevatorPitch ?? "").trim();
  const settore = (input?.settore ?? "").trim();
  const citta = (input?.citta ?? "").trim();
  const sito = (input?.sitoWeb ?? "").trim();
  const formato = (input?.formatoEcommerce ?? "").trim().toUpperCase();
  const hero = (() => {
    if (!pitch) return "";
    if (pitch.length <= 48) return pitch;
    const prima = pitch.split(/[.|;]/)[0]?.trim() || pitch;
    return prima.split(/\s+/).filter(Boolean).slice(0, 6).join(" ");
  })();

  return AWARENESS_SUGGERIMENTI_BASE.map((s) => {
    if (s.id === "reveal-novita") {
      let base = { ...s };
      if (brand) {
        base = {
          ...base,
          hookVisivo: `${base.hookVisivo} Nome: ${brand}.`,
        };
      }
      if (hero) {
        base = {
          ...base,
          cosaMostrare: `${base.cosaMostrare} Riferimento brief: «${hero}».`,
        };
      }
      return base;
    }

    if (s.id === "esterno-insegna") {
      let base = { ...s };
      if (brand) {
        base = {
          ...base,
          hookVisivo: `${base.hookVisivo} Brand: ${brand}.`,
        };
      }
      if (citta) {
        base = {
          ...base,
          cosaMostrare: `${base.cosaMostrare} Contesto zona: ${citta}.`,
        };
      }
      return base;
    }

    if (s.id === "cosa-troverai") {
      if (offerta) {
        return {
          ...s,
          cosaMostrare: `Metti in evidenza «${offerta}» — solo informazioni realmente disponibili.`,
          hookVisivo: `Frame su «cosa troverai» con «${offerta.slice(0, 80)}${offerta.length > 80 ? "…" : ""}».`,
        };
      }
      if (hero) {
        return {
          ...s,
          cosaMostrare: `Riferimento brief: «${hero}». Non aggiungere servizi non presenti.`,
        };
      }
      if (settore) {
        return {
          ...s,
          cosaMostrare: `${s.cosaMostrare} Settore di riferimento: ${settore}.`,
        };
      }
      return s;
    }

    if (s.id === "tour-rapido") {
      if (formato === "CAROUSEL" || formato === "VIDEO") {
        return {
          ...s,
          quandoUsarlo:
            formato === "VIDEO"
              ? "Hai selezionato Video: utile per un tour breve di ciò che vuoi far conoscere."
              : "Hai selezionato Carosello: utile per mostrare più punti di vista in sequenza.",
        };
      }
      return s;
    }

    if (s.id === "dettaglio-distintivo") {
      if (hero || offerta) {
        const ref = hero || offerta;
        return {
          ...s,
          cosaMostrare: `Dettaglio dal materiale reale: «${ref}». Non inventare USP.`,
          hookVisivo: brand
            ? `Dettaglio distintivo in primo piano. Attività: ${brand}.`
            : s.hookVisivo,
        };
      }
      return s;
    }

    if (s.id === "servizio-evidenza") {
      if (offerta) {
        return {
          ...s,
          quandoUsarlo:
            "Hai un messaggio/offerta al Passo 1: format utile per metterlo in evidenza.",
          cosaMostrare: `Metti in evidenza «${offerta}» — solo se hai materiale reale da mostrare.`,
          hookVisivo: `Overlay o scena su «${offerta.slice(0, 80)}${offerta.length > 80 ? "…" : ""}» — senza aggiungere promo non presenti.`,
        };
      }
      if (hero || settore) {
        return {
          ...s,
          cosaMostrare: hero
            ? `Riferimento brief: «${hero}». Solo materiale reale — niente prezzi o best seller inventati.`
            : `Settore: ${settore}. Metti in evidenza un servizio solo se hai materiale reale da mostrare.`,
        };
      }
      return s;
    }

    if (s.id === "zona-trovarci") {
      if (citta && sito) {
        return {
          ...s,
          cosaMostrare: `Contesto zona: ${citta}. Puoi usare la destinazione/link già indicato per indicazioni o mappa reale.`,
          hookVisivo: `Visual di zona (${citta}) o indicazioni verso la destinazione fornita — senza inventare indirizzi.`,
        };
      }
      if (citta) {
        return {
          ...s,
          cosaMostrare: `Contesto zona: ${citta}. Non citare mappe o Maps se non hai una destinazione reale.`,
          hookVisivo: `Contestualizza la novità a ${citta} — senza indirizzi inventati.`,
        };
      }
      if (sito) {
        return {
          ...s,
          cosaMostrare:
            "Hai una destinazione/link: puoi suggerire un visual con indicazioni o mappa reale fornita.",
          hookVisivo:
            "Indicazioni o mappa verso la destinazione reale — niente indirizzi inventati.",
        };
      }
      return s;
    }

    if (s.id === "messaggio-apertura") {
      if (offerta) {
        return {
          ...s,
          cosaMostrare: `Messaggio di apertura: «${offerta}».`,
          hookVisivo: `Overlay con «${offerta.slice(0, 80)}${offerta.length > 80 ? "…" : ""}» — senza promo aggiunte.`,
        };
      }
      return {
        ...s,
        cosaMostrare:
          "Nessun messaggio dichiarato: usa un visual informativo neutro.",
        hookVisivo: "Una nuova apertura da conoscere.",
      };
    }

    return s;
  });
}

/** Alias esportato per integrazione Studio Creativo AWARENESS. */
export const AWARENESS_SUGGERIMENTI = AWARENESS_SUGGERIMENTI_BASE;

