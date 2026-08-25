/**
 * Catalogo Settori Intelligenti — macro-categorie e sotto-nicchie
 * per Passo 1 (ganci) e Passo 2 (AOV, margine, CPL/CPA di mercato).
 */

export type MacroCategoria =
  | "Salute/Dentale"
  | "E-commerce Beauty/Fashion"
  | "Ristorazione"
  | "Servizi Locali/Artigiani"
  | "Fitness/Palestre"
  | "B2B/Professionisti"
  | "Real Estate"
  | "Formazione"
  | "Automotive"
  | "Eventi/Turismo";

export type BenchmarkRange = {
  min: number;
  max: number;
};

export type SettorePreset = {
  id: string;
  nome: string;
  macroCategoria: MacroCategoria;
  aliases: string[];
  aovDefault: number;
  margineDefault: number;
  benchmarkCPL: BenchmarkRange;
  benchmarkCPA: BenchmarkRange;
  ganciConsigliati: string[];
  formatoVisualConsigliato: string;
  policyAlert: string;
  raggioKmConsigliato: number;
  budgetGiornalieroMin: number;
};

export const MACRO_CATEGORIE: MacroCategoria[] = [
  "Salute/Dentale",
  "E-commerce Beauty/Fashion",
  "Ristorazione",
  "Servizi Locali/Artigiani",
  "Fitness/Palestre",
  "B2B/Professionisti",
  "Real Estate",
  "Formazione",
  "Automotive",
  "Eventi/Turismo",
];

const FORMATO_VISUAL: Record<MacroCategoria, string> = {
  "Salute/Dentale":
    "1:1 e 4:5 — foto reale di studio, staff e tecnologia. Volti rassicuranti, niente stock medicale né before/after estremi.",
  "E-commerce Beauty/Fashion":
    "1:1, 4:5 e 9:16 — prodotto in uso (UGC) o still su sfondo pulito, badge promo discreto. Il prodotto nei primi 2 secondi di video.",
  Ristorazione:
    "1:1, 4:5 e 9:16 — piatto hero ambientato, sala piena, luce calda. Evita menu testuale illeggibile.",
  "Servizi Locali/Artigiani":
    "1:1 e 4:5 — prima/dopo del lavoro, van e squadra sul posto. Testo in overlay minimo (offerta o zona).",
  "Fitness/Palestre":
    "4:5 e 9:16 — allievi veri in sala, trainer, struttura. Evita fisici irreali; overlay sulla prova gratuita.",
  "B2B/Professionisti":
    "1:1 e 4:5 — ufficio, team, caso studio visivo. Tono sobrio, niente stock da handshake.",
  "Real Estate":
    "1:1, 4:5 e 9:16 — interni luminosi e tour verticale del quartiere. Niente watermark di portali.",
  Formazione:
    "1:1 e 4:5 — docente, aula o lezione online, testimonial. Niente claim di reddito.",
  Automotive:
    "1:1 e 4:5 — veicolo in evidenza, officina pulita, dettaglio intervento. Luce naturale.",
  "Eventi/Turismo":
    "4:5 e 9:16 — camere, location, ospiti reali, palette calda. Tour della struttura, niente stock datato.",
};

const POLICY: Record<MacroCategoria, string> = {
  "Salute/Dentale":
    "Meta limita claim medici, prima/dopo aggressivi e 'risultato garantito'. Niente diagnosi, farmaci da prescrizione o targeting su condizioni di salute.",
  "E-commerce Beauty/Fashion":
    "Sconti e urgenza ok; evita claim miracolosi su pelle, integratori o dimagrimento.",
  Ristorazione:
    "Alcol: no targeting a minori e no incentivo all'abuso. Happy hour ok se sobrio.",
  "Servizi Locali/Artigiani":
    "Niente before/after fuorvianti su lavori edili o estetici. Prezzi chiari se in overlay.",
  "Fitness/Palestre":
    "Dimagrimento e body image: no 'perdi X kg in Y giorni', no before/after estremi.",
  "B2B/Professionisti":
    "Servizi finanziari/credito possono cadere in Special Ad Categories (Credit).",
  "Real Estate":
    "Obbligo Special Ad Category Housing: niente targeting su età, sesso, CAP o interessi demografici.",
  Formazione:
    "Niente promesse di reddito, 'lavoro garantito' o risultati finanziari.",
  Automotive:
    "Noleggio/finanziamento auto: attenzione a Credit se parli di rate o prestito.",
  "Eventi/Turismo":
    "Alloggi: se l'annuncio promuove un immobile in affitto, può scattare Housing.",
};

type Draft = {
  key: string;
  label: string;
  aliases?: string[];
  macro: MacroCategoria;
  defaultAov: number;
  defaultMargin: number;
  typicalOffers: [string, string, string];
  cpl: [number, number, number];
  cpa: [number, number, number];
  radiusKm: number;
  budgetMin: number;
  policyExtra?: string[];
  visualExtra?: string;
};

function preset(d: Draft): SettorePreset {
  const policy = [POLICY[d.macro], ...(d.policyExtra ?? [])]
    .filter(Boolean)
    .join(" ");
  return {
    id: d.key,
    nome: d.label,
    macroCategoria: d.macro,
    aliases: [d.label, d.key, ...(d.aliases ?? [])],
    aovDefault: d.defaultAov,
    margineDefault: d.defaultMargin,
    benchmarkCPL: { min: d.cpl[0], max: d.cpl[2] },
    benchmarkCPA: { min: d.cpa[0], max: d.cpa[2] },
    ganciConsigliati: [...d.typicalOffers],
    formatoVisualConsigliato: d.visualExtra
      ? `${FORMATO_VISUAL[d.macro]} ${d.visualExtra}`
      : FORMATO_VISUAL[d.macro],
    policyAlert: policy,
    raggioKmConsigliato: d.radiusKm,
    budgetGiornalieroMin: d.budgetMin,
  };
}

/** Default di macro-categoria (quando la nicchia non è più specifica). */
const MACRO_PRESETS: Draft[] = [
  {
    key: "macro-medicale",
    label: "Medicale / Sanitario",
    aliases: ["salute", "clinica", "sanitario", "medico"],
    macro: "Salute/Dentale",
    defaultAov: 1200,
    defaultMargin: 55,
    typicalOffers: [
      "Prima visita di valutazione gratuita",
      "Check-up + piano di cura in 48 ore",
      "Rate a tasso zero sulla prima cura",
    ],
    cpl: [35, 55, 90],
    cpa: [80, 140, 220],
    radiusKm: 18,
    budgetMin: 22,
  },
  {
    key: "macro-ecommerce",
    label: "E-commerce",
    aliases: ["shop online", "store", "vendita online", "ecommerce"],
    macro: "E-commerce Beauty/Fashion",
    defaultAov: 65,
    defaultMargin: 55,
    typicalOffers: [
      "Sconto 15% sul primo ordine + spedizione gratis",
      "Bundle 2+1 sul prodotto hero",
      "Codice BENVENUTO10 valido 48 ore",
    ],
    cpl: [8, 14, 28],
    cpa: [12, 22, 40],
    radiusKm: 80,
    budgetMin: 25,
  },
  {
    key: "macro-ristorazione",
    label: "Ristorazione",
    aliases: ["food", "locale", "ristorazione"],
    macro: "Ristorazione",
    defaultAov: 35,
    defaultMargin: 65,
    typicalOffers: [
      "Menu pranzo a 12€ per i nuovi clienti",
      "Drink di benvenuto mostrando l'annuncio",
      "Tavolo riservato + dessert omaggio feriali",
    ],
    cpl: [6, 12, 22],
    cpa: [8, 15, 28],
    radiusKm: 8,
    budgetMin: 15,
  },
  {
    key: "macro-servizi-locali",
    label: "Servizi Locali",
    aliases: ["artigiano", "servizi casa", "professioni locali"],
    macro: "Servizi Locali/Artigiani",
    defaultAov: 450,
    defaultMargin: 45,
    typicalOffers: [
      "Sopralluogo gratuito in 24 ore",
      "Preventivo fisso senza sorprese",
      "10% extra sconto prenotando questa settimana",
    ],
    cpl: [18, 32, 55],
    cpa: [40, 80, 140],
    radiusKm: 18,
    budgetMin: 18,
  },
  {
    key: "macro-fitness",
    label: "Fitness / Wellness",
    aliases: ["palestra", "wellness", "sport"],
    macro: "Fitness/Palestre",
    defaultAov: 70,
    defaultMargin: 60,
    typicalOffers: [
      "Prova gratuita + valutazione corporea",
      "Primo mese a 29€ per i nuovi iscritti",
      "3 sessioni di prova con trainer",
    ],
    cpl: [10, 18, 32],
    cpa: [18, 35, 60],
    radiusKm: 12,
    budgetMin: 16,
  },
  {
    key: "macro-b2b",
    label: "B2B / Professionisti",
    aliases: ["b2b", "studio professionale", "consulenza"],
    macro: "B2B/Professionisti",
    defaultAov: 1800,
    defaultMargin: 70,
    typicalOffers: [
      "Audit gratuito di 30 minuti",
      "Check-up fiscale / legale senza impegno",
      "Call diagnostica con report in 48 ore",
    ],
    cpl: [40, 70, 120],
    cpa: [120, 250, 450],
    radiusKm: 40,
    budgetMin: 28,
  },
  {
    key: "macro-real-estate",
    label: "Real Estate",
    aliases: ["immobiliare", "case", "immobili"],
    macro: "Real Estate",
    defaultAov: 3500,
    defaultMargin: 50,
    typicalOffers: [
      "Valutazione immobile gratuita in 24 ore",
      "Tour privato del weekend",
      "Dossier di mercato del quartiere in omaggio",
    ],
    cpl: [25, 45, 80],
    cpa: [150, 350, 700],
    radiusKm: 20,
    budgetMin: 25,
  },
  {
    key: "macro-formazione",
    label: "Formazione",
    aliases: ["corsi", "scuola", "academy", "training"],
    macro: "Formazione",
    defaultAov: 490,
    defaultMargin: 75,
    typicalOffers: [
      "Lezione di prova gratuita",
      "Webinar + sconto early bird sul corso",
      "Assessment gratuito e piano di studio",
    ],
    cpl: [12, 22, 40],
    cpa: [35, 70, 130],
    radiusKm: 25,
    budgetMin: 18,
  },
  {
    key: "macro-automotive",
    label: "Automotive",
    aliases: ["auto", "officina", "concessionaria"],
    macro: "Automotive",
    defaultAov: 280,
    defaultMargin: 40,
    typicalOffers: [
      "Tagliando in promozione + check 20 punti",
      "Preventivo carrozzeria in 24 ore",
      "Test drive senza impegno questo weekend",
    ],
    cpl: [15, 28, 50],
    cpa: [40, 90, 180],
    radiusKm: 20,
    budgetMin: 20,
  },
  {
    key: "macro-hospitality",
    label: "Hospitality",
    aliases: ["hotel", "ospitalità", "struttura ricettiva"],
    macro: "Eventi/Turismo",
    defaultAov: 140,
    defaultMargin: 55,
    typicalOffers: [
      "Prima notte scontata 20% per prenotazione diretta",
      "Colazione inclusa prenotando da questo annuncio",
      "Pacchetto weekend con late check-out",
    ],
    cpl: [10, 18, 35],
    cpa: [18, 32, 55],
    radiusKm: 30,
    budgetMin: 18,
  },
];

const NICCHIE: Draft[] = [
  {
    key: "dentista",
    label: "Studio dentistico",
    aliases: ["dentista", "odontoiatra", "studio dentistico"],
    macro: "Salute/Dentale",
    defaultAov: 1500,
    defaultMargin: 55,
    typicalOffers: [
      "Check-up + igiene a 39€",
      "Scansione 3D gratuita e piano allineatori",
      "Prima visita con preventivo chiaro in giornata",
    ],
    cpl: [40, 60, 90],
    cpa: [90, 160, 260],
    radiusKm: 15,
    budgetMin: 20,
  },
  {
    key: "implantologia",
    label: "Implantologia",
    aliases: ["impianto dentale", "impianti"],
    macro: "Salute/Dentale",
    defaultAov: 2800,
    defaultMargin: 50,
    typicalOffers: [
      "Consulenza implantare gratuita con CBCT",
      "Secondo parere sul preventivo in 48 ore",
      "Piano rateale a tasso zero sull'impianto",
    ],
    cpl: [50, 80, 120],
    cpa: [180, 350, 600],
    radiusKm: 25,
    budgetMin: 30,
  },
  {
    key: "ortodontista",
    label: "Ortodonzia / Allineatori",
    aliases: ["ortodontista", "allineatori", "invisalign", "mascherine"],
    macro: "Salute/Dentale",
    defaultAov: 2200,
    defaultMargin: 55,
    typicalOffers: [
      "Scansione 3D + simulazione sorriso in omaggio",
      "Check-up ortodontico a 29€",
      "Promo allineatori invisibili con tasso zero",
    ],
    cpl: [45, 70, 110],
    cpa: [150, 280, 480],
    radiusKm: 20,
    budgetMin: 28,
  },
  {
    key: "dermatologia",
    label: "Dermatologia / Estetica medica",
    aliases: ["dermatologo", "medicina estetica", "filler"],
    macro: "Salute/Dentale",
    defaultAov: 280,
    defaultMargin: 60,
    typicalOffers: [
      "Visita dermatologica di mappatura nei",
      "Consulenza viso + protocollo personalizzato",
      "Prima seduta di bio-stimolazione in promo",
    ],
    cpl: [25, 45, 75],
    cpa: [50, 90, 160],
    radiusKm: 15,
    budgetMin: 22,
    policyExtra: [
      "Procedure estetiche: niente before/after fuorvianti e niente targeting su 'difetti' percepiti.",
    ],
  },
  {
    key: "fisioterapista",
    label: "Fisioterapia",
    aliases: ["fisioterapista", "osteopata", "riabilitazione"],
    macro: "Salute/Dentale",
    defaultAov: 80,
    defaultMargin: 55,
    typicalOffers: [
      "Prima valutazione posturale gratuita",
      "Pacchetto 5 sedute in promo nuovi pazienti",
      "Check dolore schiena/ginocchio in 24 ore",
    ],
    cpl: [20, 35, 55],
    cpa: [28, 50, 85],
    radiusKm: 12,
    budgetMin: 18,
  },
  {
    key: "veterinario",
    label: "Clinica veterinaria",
    aliases: ["veterinario", "vet", "clinica veterinaria"],
    macro: "Salute/Dentale",
    defaultAov: 90,
    defaultMargin: 50,
    typicalOffers: [
      "Prima visita cane/gatto a 29€",
      "Check-up + sverminazione in pacchetto",
      "Vaccino annuale con sconto nuovi clienti",
    ],
    cpl: [12, 22, 40],
    cpa: [18, 32, 55],
    radiusKm: 12,
    budgetMin: 16,
  },
  {
    key: "ottica",
    label: "Ottica",
    aliases: ["ottico", "occhiali", "lenti"],
    macro: "Salute/Dentale",
    defaultAov: 180,
    defaultMargin: 55,
    typicalOffers: [
      "Controllo vista gratuito",
      "Secondo paio di occhiali in omaggio",
      "Lenti progressive in promo questa settimana",
    ],
    cpl: [10, 18, 32],
    cpa: [22, 40, 70],
    radiusKm: 12,
    budgetMin: 16,
  },
  {
    key: "skincare",
    label: "Skincare / Cosmetica",
    aliases: ["cosmetica", "siero", "beauty e-commerce", "skincare"],
    macro: "E-commerce Beauty/Fashion",
    defaultAov: 55,
    defaultMargin: 65,
    typicalOffers: [
      "20% sul primo ordine + spedizione gratis",
      "Kit prova 3 prodotti a prezzo lancio",
      "Siero hero + omaggio mini size",
    ],
    cpl: [6, 12, 22],
    cpa: [10, 18, 32],
    radiusKm: 80,
    budgetMin: 22,
  },
  {
    key: "fashion",
    label: "Abbigliamento / Fashion",
    aliases: ["moda", "abbigliamento", "fashion", "boutique"],
    macro: "E-commerce Beauty/Fashion",
    defaultAov: 75,
    defaultMargin: 50,
    typicalOffers: [
      "Sconto 15% sul primo ordine",
      "Reso gratuito 30 giorni + spedizione 24h",
      "2 capi, il secondo al 50%",
    ],
    cpl: [7, 14, 26],
    cpa: [12, 22, 40],
    radiusKm: 80,
    budgetMin: 25,
  },
  {
    key: "integratori",
    label: "Integratori / Nutraceutica",
    aliases: ["integratori", "nutraceutica", "supplement"],
    macro: "E-commerce Beauty/Fashion",
    defaultAov: 49,
    defaultMargin: 60,
    typicalOffers: [
      "Primo mese in prova a 19€",
      "Abbonamento 3 mesi con 1 omaggio",
      "Spedizione gratis sopra 39€",
    ],
    cpl: [8, 15, 28],
    cpa: [12, 20, 35],
    radiusKm: 80,
    budgetMin: 22,
    policyExtra: [
      "Integratori: niente claim terapeutici, 'cura', o targeting su patologie.",
    ],
  },
  {
    key: "food-gourmet",
    label: "Food gourmet / Agroalimentare",
    aliases: ["gastronomia", "olio", "vino e-commerce", "box cibo"],
    macro: "E-commerce Beauty/Fashion",
    defaultAov: 68,
    defaultMargin: 45,
    typicalOffers: [
      "Box degustazione con spedizione inclusa",
      "Sconto 10% sul primo ordine + omaggio",
      "Abbonamento mensile con il primo box a metà prezzo",
    ],
    cpl: [7, 13, 24],
    cpa: [11, 20, 36],
    radiusKm: 80,
    budgetMin: 20,
  },
  {
    key: "ristorante",
    label: "Ristorante",
    aliases: ["ristorante", "trattoria", "osteria"],
    macro: "Ristorazione",
    defaultAov: 42,
    defaultMargin: 65,
    typicalOffers: [
      "Menu degustazione feriale a prezzo speciale",
      "Dessert omaggio mostrando l'annuncio",
      "Tavolo riservato + calice di benvenuto",
    ],
    cpl: [6, 12, 22],
    cpa: [8, 16, 28],
    radiusKm: 8,
    budgetMin: 15,
  },
  {
    key: "pizzeria",
    label: "Pizzeria",
    aliases: ["pizzeria", "pizza"],
    macro: "Ristorazione",
    defaultAov: 22,
    defaultMargin: 70,
    typicalOffers: [
      "2 pizze al prezzo di 1 il lunedì e martedì",
      "Bibita omaggio asporto con questo annuncio",
      "Menu famiglia weekend a prezzo fisso",
    ],
    cpl: [4, 8, 16],
    cpa: [5, 10, 18],
    radiusKm: 6,
    budgetMin: 12,
  },
  {
    key: "bar-caffe",
    label: "Bar / Caffetteria",
    aliases: ["bar", "caffetteria", "coffee", "pasticceria"],
    macro: "Ristorazione",
    defaultAov: 8,
    defaultMargin: 70,
    typicalOffers: [
      "Colazione completa a 4,90€ nuovi clienti",
      "Secondo caffè omaggio mostrando l'annuncio",
      "Brunch del weekend prenota il tavolo",
    ],
    cpl: [3, 6, 12],
    cpa: [4, 8, 14],
    radiusKm: 5,
    budgetMin: 10,
  },
  {
    key: "catering",
    label: "Catering / Eventi",
    aliases: ["catering", "banqueting", "wedding catering"],
    macro: "Ristorazione",
    defaultAov: 1200,
    defaultMargin: 40,
    typicalOffers: [
      "Degustazione menu eventi in omaggio",
      "Sopralluogo + preventivo in 48 ore",
      "Open bar incluso su pacchetti sopra X coperti",
    ],
    cpl: [18, 32, 55],
    cpa: [60, 120, 220],
    radiusKm: 25,
    budgetMin: 20,
  },
  {
    key: "idraulico",
    label: "Idraulico",
    aliases: ["idraulico", "perdite", "caldaia"],
    macro: "Servizi Locali/Artigiani",
    defaultAov: 180,
    defaultMargin: 50,
    typicalOffers: [
      "Uscita e diagnosi a 29€ entro 2 ore",
      "Manutenzione caldaia in promozione",
      "Preventivo fisso prima di iniziare",
    ],
    cpl: [15, 28, 48],
    cpa: [25, 50, 90],
    radiusKm: 15,
    budgetMin: 16,
  },
  {
    key: "elettricista",
    label: "Elettricista",
    aliases: ["elettricista", "impianto elettrico"],
    macro: "Servizi Locali/Artigiani",
    defaultAov: 220,
    defaultMargin: 50,
    typicalOffers: [
      "Check impianto + preventivo in giornata",
      "Sostituzione quadro in promozione",
      "Uscita urgente senza maggiorazione serale",
    ],
    cpl: [16, 30, 50],
    cpa: [28, 55, 95],
    radiusKm: 15,
    budgetMin: 16,
  },
  {
    key: "serramenti",
    label: "Serramenti / Infissi",
    aliases: ["serramenti", "infissi", "finestre"],
    macro: "Servizi Locali/Artigiani",
    defaultAov: 3500,
    defaultMargin: 35,
    typicalOffers: [
      "Sopralluogo e rilievo gratuiti",
      "Preventivo con detrazione fiscale inclusa",
      "Showroom: 3 infissi in prova tattile",
    ],
    cpl: [30, 50, 80],
    cpa: [120, 250, 450],
    radiusKm: 25,
    budgetMin: 22,
  },
  {
    key: "ristrutturazioni",
    label: "Ristrutturazioni / Edilizia",
    aliases: ["ristrutturazione", "impresa edile", "ristrutturazioni"],
    macro: "Servizi Locali/Artigiani",
    defaultAov: 18000,
    defaultMargin: 25,
    typicalOffers: [
      "Sopralluogo + computo metrico gratuito",
      "Chiavi in mano con tempi scritti",
      "Consulenza bonus edilizi in 48 ore",
    ],
    cpl: [35, 60, 95],
    cpa: [200, 450, 800],
    radiusKm: 25,
    budgetMin: 25,
  },
  {
    key: "parrucchiere",
    label: "Parrucchiere / Salone",
    aliases: ["parrucchiere", "salone", "hair stylist"],
    macro: "Servizi Locali/Artigiani",
    defaultAov: 45,
    defaultMargin: 65,
    typicalOffers: [
      "Taglio + piega a 29€ per i nuovi clienti",
      "Colore + trattamento in pacchetto benvenuto",
      "Consulenza capello + prova schiariture",
    ],
    cpl: [8, 15, 28],
    cpa: [12, 22, 38],
    radiusKm: 8,
    budgetMin: 12,
  },
  {
    key: "estetista",
    label: "Estetista / Centro estetico",
    aliases: ["estetista", "centro estetico", "beauty salon"],
    macro: "Servizi Locali/Artigiani",
    defaultAov: 55,
    defaultMargin: 60,
    typicalOffers: [
      "Trattamento viso prova a 19€",
      "Pacchetto 3 sedute corpo in promo",
      "Mani + piedi + tea di benvenuto",
    ],
    cpl: [8, 16, 28],
    cpa: [12, 24, 40],
    radiusKm: 10,
    budgetMin: 14,
  },
  {
    key: "pulizie",
    label: "Pulizie / Impresa di pulizia",
    aliases: ["pulizie", "colf", "impresa pulizie"],
    macro: "Servizi Locali/Artigiani",
    defaultAov: 120,
    defaultMargin: 40,
    typicalOffers: [
      "Prima pulizia straordinaria a tariffa fissa",
      "Preventivo in 2 ore, senza sopralluogo",
      "Abbonamento settimanale con la prima omaggio",
    ],
    cpl: [10, 18, 32],
    cpa: [18, 35, 60],
    radiusKm: 12,
    budgetMin: 14,
  },
  {
    key: "palestra",
    label: "Palestra",
    aliases: ["palestra", "gym", "centro fitness"],
    macro: "Fitness/Palestre",
    defaultAov: 49,
    defaultMargin: 60,
    typicalOffers: [
      "7 giorni di prova + scheda starter",
      "Primo mese a 19,90€ senza vincoli",
      "Valutazione corporea e 2 PT in omaggio",
    ],
    cpl: [8, 14, 26],
    cpa: [15, 28, 48],
    radiusKm: 10,
    budgetMin: 16,
  },
  {
    key: "personal-trainer",
    label: "Personal trainer",
    aliases: ["personal trainer", "pt", "allenatore"],
    macro: "Fitness/Palestre",
    defaultAov: 80,
    defaultMargin: 70,
    typicalOffers: [
      "Prima seduta + check corporeo gratis",
      "Pacchetto 4 sessioni a prezzo lancio",
      "Piano 30 giorni con follow-up WhatsApp",
    ],
    cpl: [10, 18, 32],
    cpa: [20, 40, 70],
    radiusKm: 12,
    budgetMin: 14,
  },
  {
    key: "yoga",
    label: "Yoga / Pilates",
    aliases: ["yoga", "pilates", "reformer"],
    macro: "Fitness/Palestre",
    defaultAov: 60,
    defaultMargin: 65,
    typicalOffers: [
      "Prova lezione + mat in omaggio",
      "Pacchetto 8 lezioni newcomer",
      "Open day: 3 classi in un weekend",
    ],
    cpl: [7, 13, 24],
    cpa: [14, 26, 45],
    radiusKm: 10,
    budgetMin: 12,
  },
  {
    key: "avvocato",
    label: "Studio legale",
    aliases: ["avvocato", "studio legale", "legale"],
    macro: "B2B/Professionisti",
    defaultAov: 900,
    defaultMargin: 75,
    typicalOffers: [
      "Prima consulenza di 30 minuti",
      "Check del caso e strategia in 48 ore",
      "Preventivo a tappe, senza sorprese",
    ],
    cpl: [35, 60, 100],
    cpa: [80, 180, 320],
    radiusKm: 30,
    budgetMin: 25,
  },
  {
    key: "commercialista",
    label: "Commercialista",
    aliases: ["commercialista", "fiscalista", "caf"],
    macro: "B2B/Professionisti",
    defaultAov: 650,
    defaultMargin: 70,
    typicalOffers: [
      "Check-up fiscale gratuito per P.IVA",
      "Prima dichiarazione + call di onboarding",
      "Audit partita IVA in 5 giorni",
    ],
    cpl: [30, 50, 85],
    cpa: [70, 140, 250],
    radiusKm: 25,
    budgetMin: 22,
  },
  {
    key: "consulenza-b2b",
    label: "Consulenza / Agenzia",
    aliases: ["consulenza", "agenzia marketing", "saas", "software b2b"],
    macro: "B2B/Professionisti",
    defaultAov: 2500,
    defaultMargin: 70,
    typicalOffers: [
      "Audit gratuito del processo / funnel",
      "Workshop di 45 minuti con report",
      "Pilot 14 giorni a prezzo di ingresso",
    ],
    cpl: [45, 80, 140],
    cpa: [150, 320, 600],
    radiusKm: 50,
    budgetMin: 30,
  },
  {
    key: "agenzia-immobiliare",
    label: "Agenzia immobiliare",
    aliases: ["agenzia immobiliare", "immobiliare", "agente immobiliare"],
    macro: "Real Estate",
    defaultAov: 4000,
    defaultMargin: 50,
    typicalOffers: [
      "Valutazione casa gratuita in 24 ore",
      "Tour del weekend su 3 immobili selezionati",
      "Piano di vendita con home staging incluso",
    ],
    cpl: [25, 45, 80],
    cpa: [180, 400, 750],
    radiusKm: 15,
    budgetMin: 25,
  },
  {
    key: "geometra",
    label: "Geometra / Architetto",
    aliases: ["geometra", "architetto", "progettazione"],
    macro: "Real Estate",
    defaultAov: 1800,
    defaultMargin: 55,
    typicalOffers: [
      "Sopralluogo e fattibilità gratuiti",
      "Bozza di progetto in 7 giorni",
      "Pratica edilizia chiavi in mano, primo incontro free",
    ],
    cpl: [22, 40, 70],
    cpa: [80, 180, 320],
    radiusKm: 20,
    budgetMin: 20,
  },
  {
    key: "scuola-lingua",
    label: "Scuola di lingue",
    aliases: ["inglese", "scuola lingue", "corso inglese"],
    macro: "Formazione",
    defaultAov: 390,
    defaultMargin: 70,
    typicalOffers: [
      "Lezione di prova + test di livello gratis",
      "Corso intensivo early bird -20%",
      "Conversation club in omaggio al primo mese",
    ],
    cpl: [10, 18, 32],
    cpa: [28, 55, 95],
    radiusKm: 15,
    budgetMin: 16,
  },
  {
    key: "corsi-online",
    label: "Corsi online / Master",
    aliases: ["corso online", "master", "academy", "e-learning"],
    macro: "Formazione",
    defaultAov: 690,
    defaultMargin: 80,
    typicalOffers: [
      "Webinar gratuito + sconto 48 ore",
      "Modulo 1 in prova a 1€",
      "Early bird: rata zero sul primo mese",
    ],
    cpl: [12, 22, 40],
    cpa: [40, 80, 150],
    radiusKm: 80,
    budgetMin: 22,
  },
  {
    key: "scuola-guida",
    label: "Scuola guida",
    aliases: ["scuola guida", "patente", "autoscuola"],
    macro: "Formazione",
    defaultAov: 850,
    defaultMargin: 45,
    typicalOffers: [
      "Iscrizione + 2 guide in promo",
      "Pacchetto patente B a rata fissa",
      "Prima guida di valutazione gratuita",
    ],
    cpl: [12, 22, 38],
    cpa: [35, 70, 120],
    radiusKm: 12,
    budgetMin: 16,
  },
  {
    key: "meccanico",
    label: "Officina meccanica",
    aliases: ["meccanico", "officina", "tagliando"],
    macro: "Automotive",
    defaultAov: 220,
    defaultMargin: 40,
    typicalOffers: [
      "Tagliando in promozione + check 20 punti",
      "Diagnosi elettronica a 19€",
      "Sostituzione pastiglie a prezzo fisso",
    ],
    cpl: [12, 22, 40],
    cpa: [25, 50, 90],
    radiusKm: 12,
    budgetMin: 16,
  },
  {
    key: "carrozzeria",
    label: "Carrozzeria",
    aliases: ["carrozzeria", "ritocco auto"],
    macro: "Automotive",
    defaultAov: 450,
    defaultMargin: 40,
    typicalOffers: [
      "Preventivo foto in 2 ore, anche da WhatsApp",
      "Lucidatura + ritocco in pacchetto",
      "Auto sostitutiva inclusa sopra una soglia",
    ],
    cpl: [14, 26, 45],
    cpa: [35, 70, 130],
    radiusKm: 15,
    budgetMin: 16,
  },
  {
    key: "concessionaria",
    label: "Concessionaria auto",
    aliases: ["concessionaria", "auto usate", "dealer"],
    macro: "Automotive",
    defaultAov: 18000,
    defaultMargin: 8,
    typicalOffers: [
      "Test drive questo weekend, posto riservato",
      "Valutazione permuta in 30 minuti",
      "Promo finanziamento / noleggio a rata chiara",
    ],
    cpl: [20, 40, 70],
    cpa: [80, 180, 350],
    radiusKm: 30,
    budgetMin: 28,
  },
  {
    key: "hotel",
    label: "Hotel / B&B",
    aliases: ["hotel", "b&b", "bed and breakfast", "albergo"],
    macro: "Eventi/Turismo",
    defaultAov: 160,
    defaultMargin: 55,
    typicalOffers: [
      "Prenota diretto: 15% vs OTA + colazione",
      "Notte extra omaggio su soggiorni 3 notti",
      "Late check-out e welcome drink",
    ],
    cpl: [10, 18, 32],
    cpa: [16, 28, 50],
    radiusKm: 40,
    budgetMin: 18,
  },
  {
    key: "agriturismo",
    label: "Agriturismo",
    aliases: ["agriturismo", "country house", "dimora"],
    macro: "Eventi/Turismo",
    defaultAov: 190,
    defaultMargin: 55,
    typicalOffers: [
      "Weekend in fattoria con colazione km 0",
      "Cena della casa inclusa sulla prima notte",
      "Sconto midweek per soggiorni 2+ notti",
    ],
    cpl: [9, 16, 30],
    cpa: [15, 28, 48],
    radiusKm: 45,
    budgetMin: 16,
  },
  {
    key: "wedding",
    label: "Wedding / Location eventi",
    aliases: ["matrimoni", "wedding", "location matrimonio", "villa eventi"],
    macro: "Eventi/Turismo",
    defaultAov: 8000,
    defaultMargin: 35,
    typicalOffers: [
      "Sopralluogo + tasting per coppie 2026/27",
      "Open day con allestimento reale",
      "Pacchetto weekday a tariffa dedicata",
    ],
    cpl: [25, 45, 80],
    cpa: [120, 280, 500],
    radiusKm: 40,
    budgetMin: 22,
  },
];

export const SETTORI_PRESETS: SettorePreset[] = [
  ...MACRO_PRESETS,
  ...NICCHIE,
].map(preset);

export const SETTORI_POPOLARI: string[] = [
  "dentista",
  "skincare",
  "ristorante",
  "palestra",
  "agenzia-immobiliare",
  "parrucchiere",
  "idraulico",
  "hotel",
];
