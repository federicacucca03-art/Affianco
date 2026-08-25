import type { Situazione, SituazioneId } from "@/types/campagne";

export type StatoSchedaObiettivo = "active" | "coming_soon";

/** Configurazione unica delle schede obiettivo su /campagne. */
export type SchedaObiettivoConfig = {
  id: SituazioneId;
  titolo: string;
  esempio: string;
  status: StatoSchedaObiettivo;
  /** Testo badge (reso uppercase in UI). */
  badge: "ATTIVO" | "IN ARRIVO";
  disabled: boolean;
  href: string | null;
};

export const SCHEDE_OBIETTIVO: SchedaObiettivoConfig[] = [
  {
    id: "contatti",
    titolo: "Più richieste di contatto",
    esempio: "Dentisti, avvocati, artigiani",
    status: "active",
    badge: "ATTIVO",
    disabled: false,
    href: "/campagne/nuova/richieste-contatto",
  },
  {
    id: "prenotazioni",
    titolo: "Più prenotazioni",
    esempio: "Estetiste, ristoranti, palestre",
    status: "active",
    badge: "ATTIVO",
    disabled: false,
    href: "/campagne/nuova/prenotazioni",
  },
  {
    id: "vendite",
    titolo: "Più vendite online",
    esempio: "E-commerce con catalogo",
    status: "active",
    badge: "ATTIVO",
    disabled: false,
    href: "/campagne/nuova/vendite",
  },
  {
    id: "negozio",
    titolo: "Più gente in negozio",
    esempio: "Attività con una sede fisica",
    status: "active",
    badge: "ATTIVO",
    disabled: false,
    href: "/campagne/nuova/instore",
  },
  {
    id: "recupero",
    titolo: "Recuperare chi non ha comprato",
    esempio: "Serve chi ti conosce già",
    status: "active",
    badge: "ATTIVO",
    disabled: false,
    href: "/campagne/nuova/retargeting",
  },
  {
    id: "apertura",
    titolo: "Far conoscere un'apertura",
    esempio: "Nuova sede, evento, lancio",
    status: "active",
    badge: "ATTIVO",
    disabled: false,
    href: "/campagne/nuova/apertura",
  },
];

/** Lista situazioni derivata dalla config schede (compatibilità tipi). */
export const situazioni: Situazione[] = SCHEDE_OBIETTIVO.map(
  ({ id, titolo, esempio }) => ({ id, titolo, esempio }),
);

export function configSchedaObiettivo(
  id: SituazioneId,
): SchedaObiettivoConfig {
  const trovata = SCHEDE_OBIETTIVO.find((s) => s.id === id);
  if (trovata) return trovata;
  return {
    id,
    titolo: id,
    esempio: "",
    status: "coming_soon",
    badge: "IN ARRIVO",
    disabled: true,
    href: null,
  };
}
