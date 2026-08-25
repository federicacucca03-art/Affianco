import type { Campagna, Giudizio } from "@/types/campagne";

export type MetricheAnalisi = {
  spesaTotale: number;
  risultati: number;
  etichettaRisultati: string;
  costoPerRisultato: number;
  giorniAttivita: number;
};

export type VerdettoAnalisi = {
  spiegazione: string;
  fraseCliente: string;
};

/** Dati demo usati finché non colleghiamo il parser CSV reale. */
export function metricheDemoDaCampagna(campagna: Campagna): MetricheAnalisi {
  const demo: Record<string, MetricheAnalisi> = {
    rossi: {
      spesaTotale: 80,
      risultati: 14,
      etichettaRisultati: "contatti",
      costoPerRisultato: 5.71,
      giorniAttivita: 4,
    },
    "bio-verde": {
      spesaTotale: 40,
      risultati: 0,
      etichettaRisultati: "vendite",
      costoPerRisultato: 0,
      giorniAttivita: 2,
    },
    kinesis: {
      spesaTotale: 240,
      risultati: 6,
      etichettaRisultati: "contatti",
      costoPerRisultato: 40,
      giorniAttivita: 12,
    },
  };

  return (
    demo[campagna.id] ?? {
      spesaTotale: 120,
      risultati: 3,
      etichettaRisultati: "contatti",
      costoPerRisultato: 40,
      giorniAttivita: 7,
    }
  );
}

export function verdettoDaCampagna(
  campagna: Campagna,
  metriche: MetricheAnalisi,
): VerdettoAnalisi {
  const verdetti: Record<Giudizio, VerdettoAnalisi> = {
    "Va bene": {
      spiegazione: `Con ${formatEuro(metriche.spesaTotale)} di spesa hai ottenuto ${metriche.risultati} ${metriche.etichettaRisultati} in ${metriche.giorniAttivita} giorni. Il costo per risultato (${formatEuro(metriche.costoPerRisultato)}) è dentro un intervallo sano per questo tipo di attività. Non serve toccare nulla: lascia correre e controlla di nuovo tra qualche giorno.`,
      fraseCliente: `Ciao! Aggiornamento veloce sulla campagna: in ${metriche.giorniAttivita} giorni abbiamo speso ${formatEuro(metriche.spesaTotale)} e ottenuto ${metriche.risultati} ${metriche.etichettaRisultati}. Sta andando bene, continuo a monitorare senza cambiare nulla per ora.`,
    },
    "Ancora presto": {
      spiegazione: `La campagna è attiva da soli ${metriche.giorniAttivita} giorni. ${metriche.risultati === 0 ? "Non ci sono ancora risultati: è normale nei primi giorni di apprendimento." : `Hai già ${metriche.risultati} ${metriche.etichettaRisultati}, ma è presto per giudicare.`} Non cambiare budget, pubblico o creatività fino ad almeno il quarto giorno: l'algoritmo sta ancora imparando.`,
      fraseCliente: `Ciao! La campagna è partita da ${metriche.giorniAttivita} giorni. Siamo ancora in fase di avvio, quindi è presto per trarre conclusioni. Ti aggiorno a inizio settimana prossima con i primi numeri utili.`,
    },
    "Da monitorare": {
      spiegazione: `Il costo per risultato è a ${formatEuro(metriche.costoPerRisultato)}: nella fascia alta ma ancora gestibile. Con ${formatEuro(metriche.spesaTotale)} di spesa e ${metriche.risultati} ${metriche.etichettaRisultati} in ${metriche.giorniAttivita} giorni, la campagna funziona ma merita attenzione. Lascia correre qualche giorno: se non migliora, prepara una creatività alternativa.`,
      fraseCliente: `Ciao! Aggiornamento sulla campagna: in ${metriche.giorniAttivita} giorni abbiamo speso ${formatEuro(metriche.spesaTotale)} e ottenuto ${metriche.risultati} ${metriche.etichettaRisultati}. I costi sono un po' sopra la media, li sto monitorando da vicino e ti aggiorno a breve.`,
    },
    "Da controllare": {
      spiegazione: `Il costo per contatto è a ${formatEuro(metriche.costoPerRisultato)} dopo ${metriche.giorniAttivita} giorni, sopra il riferimento tipico per questa categoria (circa 25–35€). Con ${formatEuro(metriche.spesaTotale)} di spesa e ${metriche.risultati} ${metriche.etichettaRisultati}, l'algoritmo sta probabilmente sprecando budget sul pubblico troppo ampio. È il momento di intervenire: cambia la creatività o restringi leggermente il raggio.`,
      fraseCliente: `Ciao! Ti aggiorno sulla campagna: in ${metriche.giorniAttivita} giorni abbiamo speso ${formatEuro(metriche.spesaTotale)} e ottenuto ${metriche.risultati} ${metriche.etichettaRisultati}. Il costo è un po' alto rispetto a quanto ci aspettavamo, quindi sto già preparando una modifica (nuova creatività) per migliorare i risultati nei prossimi giorni.`,
    },
  };

  return verdetti[campagna.giudizio];
}

export function formatEuro(valore: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(valore);
}
