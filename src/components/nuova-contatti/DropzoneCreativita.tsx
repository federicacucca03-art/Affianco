"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, X } from "lucide-react";
import type { CampagnaObjective } from "@/types/campagne";
import type {
  CreativitaAsset,
  EcommerceCreativoFormato,
} from "@/lib/creativita";
import {
  analizzaFormatoImmagine,
  etichetteCreativitaPerObiettivo,
  leggiDimensioniImmagine,
  leggiDimensioniVideo,
  maxCreativitaPerContesto,
  minCreativitaPerContesto,
  prossimoRuolo,
  RUOLI_IN_ORDINE,
} from "@/lib/creativita";
import { StatoChip } from "@/components/nuova-contatti/StatoChip";

type Props = {
  creativita: CreativitaAsset[];
  indiceAnteprima: number;
  onCambiaCreativita: (lista: CreativitaAsset[]) => void;
  /** Stato analisi vision per asset.id. Opzionale (P1B). */
  analisiVision?: Record<
    string,
    { status: "IDLE" | "ANALYZING" | "SUCCESS" | "UNKNOWN" | "ERROR"; errore: string | null }
  >;
  onAnalizzaCreativita?: (assetId: string) => void;
  onCambiaIndiceAnteprima: (indice: number) => void;
  objective?: CampagnaObjective;
  formatoEcommerce?: EcommerceCreativoFormato;
  onCambiaFormatoEcommerce?: (formato: EcommerceCreativoFormato) => void;
  /** Testo linee guida visive dalla nicchia (Passo 4). */
  creativeGuidelines?: string | null;
  /** Titolo sezione upload (layout LEADS). */
  titoloSezione?: string;
  /** Rimuove card esterna quando annidato in StudioCreativo LEADS. */
  embedded?: boolean;
};

function nuovoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback compatibile con path Storage `{user_id}/{asset_uuid}.ext`
  const hex = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
  return hex;
}

const FORMATI_ECOMMERCE: {
  value: EcommerceCreativoFormato;
  label: string;
}[] = [
  {
    value: "SINGLE",
    label: "🖼️ Immagine Singola / Grafica Prodotto",
  },
  {
    value: "CAROUSEL",
    label: "🎠 Carosello Prodotti Multiplo (fino a 5 immagini)",
  },
  {
    value: "VIDEO",
    label: "🎥 Video Prova / UGC / Unboxing",
  },
];

const FORMATI_INSTORE: {
  value: EcommerceCreativoFormato;
  label: string;
}[] = [
  {
    value: "SINGLE",
    label:
      "🖼️ Immagine singola — Un singolo visual per comunicare il messaggio principale.",
  },
  {
    value: "CAROUSEL",
    label:
      "🎠 Carosello — Da 3 a 5 contenuti per mostrare più elementi, ambienti o punti di forza.",
  },
  {
    value: "VIDEO",
    label:
      "🎥 Video — Un video per mostrare attività, esperienza o punto vendita.",
  },
];

const FORMATI_RETARGETING: {
  value: EcommerceCreativoFormato;
  label: string;
}[] = [
  {
    value: "SINGLE",
    label:
      "🖼️ Immagine singola — Un visual per riportare l'attenzione sul messaggio principale.",
  },
  {
    value: "CAROUSEL",
    label:
      "🎠 Carosello — Da 3 a 5 contenuti per mostrare più benefici, passaggi o punti di vista.",
  },
  {
    value: "VIDEO",
    label:
      "🎥 Video — Un video per spiegare valore, utilizzo o motivo per tornare.",
  },
];

const FORMATI_AWARENESS: {
  value: EcommerceCreativoFormato;
  label: string;
}[] = [
  {
    value: "SINGLE",
    label:
      "🖼️ Immagine singola — Un visual per presentare subito la novità e il messaggio principale.",
  },
  {
    value: "CAROUSEL",
    label:
      "🎠 Carosello — Da 3 a 5 contenuti per mostrare spazio, servizi, dettagli o punti di vista diversi.",
  },
  {
    value: "VIDEO",
    label:
      "🎥 Video — Un video per raccontare il nuovo spazio, il servizio o ciò che vuoi far conoscere.",
  },
];

export function DropzoneCreativita({
  creativita,
  indiceAnteprima,
  onCambiaCreativita,
  onCambiaIndiceAnteprima,
  objective = "LEADS",
  formatoEcommerce = "SINGLE",
  onCambiaFormatoEcommerce,
  creativeGuidelines = null,
  titoloSezione,
  embedded = false,
  analisiVision,
  onAnalizzaCreativita,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [trascinando, setTrascinando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const isBookings = objective === "BOOKINGS";
  const isEcommerce = objective === "ECOMMERCE";
  const isInStore = objective === "IN_STORE";
  const isRetargeting = objective === "RETARGETING";
  const isAwareness = objective === "AWARENESS";
  const usaFormatiCreativi =
    isEcommerce || isInStore || isRetargeting || isAwareness;
  const maxAsset = maxCreativitaPerContesto(objective, formatoEcommerce);
  const minAsset = minCreativitaPerContesto(objective, formatoEcommerce);
  const etichette = etichetteCreativitaPerObiettivo(
    objective,
    usaFormatiCreativi ? formatoEcommerce : undefined,
  );
  const postiLiberi = maxAsset - creativita.length;
  const puoAggiungere = postiLiberi > 0;
  const isCarosello = usaFormatiCreativi && formatoEcommerce === "CAROUSEL";
  const isVideo = usaFormatiCreativi && formatoEcommerce === "VIDEO";
  const formatiSelettore = isAwareness
    ? FORMATI_AWARENESS
    : isRetargeting
      ? FORMATI_RETARGETING
      : isInStore
        ? FORMATI_INSTORE
        : FORMATI_ECOMMERCE;
  const accept = isVideo ? "video/*,image/*" : "image/*";

  function cambiaFormato(formato: EcommerceCreativoFormato) {
    if (formato === formatoEcommerce) return;
    // Reset asset quando cambia formato (evita mix immagine/video/carosello).
    for (const c of creativita) {
      if (c.url.startsWith("blob:")) URL.revokeObjectURL(c.url);
    }
    onCambiaCreativita([]);
    onCambiaIndiceAnteprima(0);
    setErrore(null);
    onCambiaFormatoEcommerce?.(formato);
  }

  async function aggiungiFile(files: FileList | File[] | null) {
    if (!files || files.length === 0) return;
    setErrore(null);

    const daAggiungere: CreativitaAsset[] = [];
    const listaCorrente = [...creativita];

    for (const file of Array.from(files)) {
      if (listaCorrente.length + daAggiungere.length >= maxAsset) break;

      const fileVideo = file.type.startsWith("video/");
      const fileImmagine = file.type.startsWith("image/");
      if (isVideo) {
        if (!fileVideo && !fileImmagine) continue;
      } else if (!fileImmagine) {
        continue;
      }

      const ruolo = prossimoRuolo(
        [...listaCorrente, ...daAggiungere],
        maxAsset,
      );
      if (!ruolo) break;

      try {
        if (fileVideo) {
          const { width, height, url } = await leggiDimensioniVideo(file);
          daAggiungere.push({
            id: nuovoId(),
            url,
            nomeFile: file.name,
            width,
            height,
            ruolo,
            avvisoFormato: false,
            formatoOrizzontale: width / Math.max(1, height) > 1.25,
            isVideo: true,
          });
        } else {
          const { width, height, url } = await leggiDimensioniImmagine(file);
          const { ok, orizzontale } = analizzaFormatoImmagine(width, height);
          daAggiungere.push({
            id: nuovoId(),
            url,
            nomeFile: file.name,
            width,
            height,
            ruolo,
            avvisoFormato: !ok,
            formatoOrizzontale: orizzontale,
            isVideo: false,
          });
        }
      } catch {
        setErrore(
          isVideo
            ? "Uno o più file non sono leggibili. Riprova."
            : "Una o più immagini non sono leggibili. Riprova.",
        );
      }
    }

    if (daAggiungere.length === 0) return;
    const prossima = [...listaCorrente, ...daAggiungere];
    onCambiaCreativita(prossima);
    onCambiaIndiceAnteprima(prossima.length - 1);
  }

  function rimuovi(id: string) {
    const rimossa = creativita.find((c) => c.id === id);
    if (rimossa?.url.startsWith("blob:")) {
      URL.revokeObjectURL(rimossa.url);
    }
    const prossima = creativita.filter((c) => c.id !== id);
    const rinominata = prossima.map((c, i) => ({
      ...c,
      ruolo: RUOLI_IN_ORDINE[i]!,
    }));
    onCambiaCreativita(rinominata);
    if (rinominata.length === 0) {
      onCambiaIndiceAnteprima(0);
    } else if (indiceAnteprima >= rinominata.length) {
      onCambiaIndiceAnteprima(rinominata.length - 1);
    }
  }

  const attiva = creativita[indiceAnteprima] ?? null;
  const mostraAvvisoOrizzontale = creativita.some((c) => c.formatoOrizzontale);
  const mostraAvvisoFormato = creativita.some(
    (c) => c.avvisoFormato && !c.formatoOrizzontale && !c.isVideo,
  );
  const caroselloIncompleto =
    isCarosello && creativita.length > 0 && creativita.length < minAsset;

  return (
    <section
      className={
        embedded
          ? "mt-4"
          : "rounded-[var(--radius)] bg-white p-5 shadow-[var(--shadow-soft)]"
      }
    >
      <h2 className="text-sm font-medium text-[var(--ink)]">
        {titoloSezione ?? "Creatività · Controllo qualità asset"}
      </h2>
      <p className="mt-1 text-xs text-[var(--ink-muted)]">
        {creativeGuidelines
          ? creativeGuidelines
          : isAwareness && usaFormatiCreativi
            ? isCarosello
              ? "Da 3 a 5 contenuti per mostrare spazio, servizi, dettagli o punti di vista diversi."
              : isVideo
                ? "Un video per raccontare il nuovo spazio, il servizio o ciò che vuoi far conoscere."
                : "Un visual per presentare subito la novità e il messaggio principale."
            : isRetargeting
            ? isCarosello
              ? "Carosello: carica da 3 a 5 contenuti (consigliato 1:1 o 4:5)."
              : isVideo
                ? "Carica 1 video (o un frame statico di fallback)."
                : "Immagine singola: fino a 3 varianti per A/B test. Consigliato 1:1 o 4:5."
            : isInStore
            ? isCarosello
              ? "Carosello: carica da 3 a 5 contenuti (consigliato 1:1 o 4:5)."
              : isVideo
                ? "Carica 1 video (o un frame statico di fallback)."
                : "Immagine singola: fino a 3 varianti per A/B test. Consigliato 1:1 o 4:5."
            : isEcommerce
          ? isCarosello
            ? "Carosello: carica da 3 a 5 schede prodotto (consigliato 1:1 o 4:5)."
            : isVideo
              ? "Carica 1 video UGC / unboxing (o un frame statico di fallback)."
              : "Immagine prodotto: fino a 3 varianti per A/B test. Consigliato 1:1 o 4:5."
          : isAwareness
            ? "Carica 3 immagini ad alto impatto per saturare il quartiere prima dell'inaugurazione. Consigliato: 1:1 (Feed) e 9:16 (Stories/Reels)."
            : isBookings
              ? "Fino a 3 foto per A/B test visivo (Principale, Staff, Struttura). Consigliato: 4:5 o 1:1 (1080×1080) per il Feed."
              : "Fino a 3 immagini per A/B test visivo. Consigliato: 1:1 (1080×1080) per Feed o 9:16 per Stories/Reels."}
      </p>

      {creativeGuidelines ? (
        <div className="mt-4 rounded-xl border border-[#c6d8f0] bg-[#f3f7fc] px-4 py-3">
          <p className="text-sm font-medium text-[var(--ink)]">
            Formato visivo consigliato per questa nicchia
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--ink)]">
            {creativeGuidelines}
          </p>
        </div>
      ) : null}

      {usaFormatiCreativi ? (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-[var(--ink-muted)]">
            Formato creativo
          </p>
          <div className="flex flex-col gap-2">
            {formatiSelettore.map((f) => {
              const attivo = formatoEcommerce === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => cambiaFormato(f.value)}
                  className={`rounded-xl border px-3.5 py-3 text-left text-sm font-medium transition-colors ${
                    attivo
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "border-[var(--border)] bg-white text-[var(--ink)] hover:border-[var(--accent-muted)]"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {isEcommerce ? (
        <div className="mt-4 rounded-xl border border-[#c6d8f0] bg-[#f3f7fc] px-4 py-3">
          <p className="text-sm font-medium text-[var(--ink)]">
            💡 Cosa genera più vendite in un E-commerce?
          </p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-[var(--ink)]">
            <li>
              Foto prodotto su sfondo pulito o ambientato reale (evita mockup
              3D finti).
            </li>
            <li>
              Badge grafico discreto con la promo (es. &apos;-15%&apos; o
              &apos;Spedizione Gratis&apos;).
            </li>
            <li>
              Nei video UGC, mostra il prodotto in azione nei primi 2 secondi.
            </li>
          </ol>
        </div>
      ) : null}

      {creativita.length > 0 ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {creativita.map((c, indice) => {
              const selezionata = indice === indiceAnteprima;
              const statoVision = analisiVision?.[c.id];
              const inCorso = statoVision?.status === "ANALYZING";
              return (
                <div key={c.id} className="flex w-16 flex-col items-stretch gap-1">
                  <button
                    type="button"
                    onClick={() => onCambiaIndiceAnteprima(indice)}
                    title={etichette[c.ruolo]}
                    className={`relative overflow-hidden rounded-xl border-2 transition-colors ${
                      selezionata
                        ? "border-[var(--accent)]"
                        : "border-[var(--border)] hover:border-[var(--accent-muted)]"
                    }`}
                  >
                    {c.isVideo ? (
                      <video
                        src={c.url}
                        className="h-16 w-16 object-cover"
                        muted
                        playsInline
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.url}
                        alt={etichette[c.ruolo]}
                        className="h-16 w-16 object-cover"
                      />
                    )}
                    <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5 text-center text-[9px] font-medium text-white">
                      {indice + 1}
                    </span>
                  </button>
                  {c.isVideo ? (
                    <p className="text-[8px] leading-tight text-[var(--ink-muted)]">
                      Solo immagini
                    </p>
                  ) : onAnalizzaCreativita ? (
                    <button
                      type="button"
                      disabled={inCorso}
                      onClick={() => onAnalizzaCreativita(c.id)}
                      className="rounded-md border border-[var(--border)] bg-white px-0.5 py-0.5 text-[9px] font-medium leading-tight text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {inCorso ? "Analisi…" : "Analizza"}
                    </button>
                  ) : null}
                </div>
              );
            })}
            {puoAggiungere ? (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex h-16 w-16 flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--border)] text-[var(--ink-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                <ImagePlus className="h-5 w-5" strokeWidth={1.75} />
                <span className="mt-0.5 text-[9px] font-medium">Aggiungi</span>
              </button>
            ) : null}
          </div>

          {isCarosello && creativita.length > 1 ? (
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() =>
                  onCambiaIndiceAnteprima(
                    Math.max(0, indiceAnteprima - 1),
                  )
                }
                disabled={indiceAnteprima <= 0}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--ink)] disabled:opacity-40"
                aria-label="Scheda precedente"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p className="text-xs text-[var(--ink-muted)]">
                Scheda {indiceAnteprima + 1} di {creativita.length}
              </p>
              <button
                type="button"
                onClick={() =>
                  onCambiaIndiceAnteprima(
                    Math.min(creativita.length - 1, indiceAnteprima + 1),
                  )
                }
                disabled={indiceAnteprima >= creativita.length - 1}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--ink)] disabled:opacity-40"
                aria-label="Scheda successiva"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          {attiva ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] p-3">
              <div className="flex items-start gap-3">
                {attiva.isVideo ? (
                  <video
                    src={attiva.url}
                    className="h-24 w-24 shrink-0 rounded-lg object-cover"
                    controls
                    playsInline
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={attiva.url}
                    alt="Anteprima creatività selezionata"
                    className="h-24 w-24 shrink-0 rounded-lg object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--ink)]">
                    {etichette[attiva.ruolo]}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
                    {attiva.nomeFile}
                  </p>
                  <p className="mt-1 text-xs text-[var(--ink-muted)]">
                    {attiva.isVideo
                      ? `Video · ${attiva.width}×${attiva.height} px`
                      : `${attiva.width}×${attiva.height} px · ratio ${(
                          attiva.width / Math.max(1, attiva.height)
                        ).toFixed(2)}`}
                  </p>
                  {attiva.isVideo ? (
                    <>
                      <p className="mt-2 text-xs font-medium text-[#3D8B57]">
                        Mostra il prodotto in azione nei primi 2 secondi.
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-[var(--ink-muted)]">
                        Analisi visual disponibile per immagini in questa versione.
                      </p>
                    </>
                  ) : attiva.formatoOrizzontale ? (
                    <p className="mt-2 text-xs font-medium text-[#C26A0A]">
                      Formato orizzontale: occupa meno spazio nel feed mobile.
                    </p>
                  ) : attiva.avvisoFormato ? (
                    <p className="mt-2 text-xs font-medium text-[#C26A0A]">
                      Formato da ottimizzare: preferisci 4:5 o 1:1.
                    </p>
                  ) : (
                    <p className="mt-2 text-xs font-medium text-[#3D8B57]">
                      Formato ok per Feed (4:5, 1:1) o Stories (9:16).
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => rimuovi(attiva.id)}
                    className="mt-2 inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--ink)]"
                  >
                    <X className="h-3 w-3" strokeWidth={2} />
                    Rimuovi
                  </button>
                  {!attiva.isVideo &&
                  analisiVision?.[attiva.id]?.status === "ERROR" &&
                  analisiVision[attiva.id]?.errore ? (
                    <p className="mt-2 text-xs leading-relaxed text-[var(--ink-muted)]">
                      {analisiVision[attiva.id]!.errore}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setTrascinando(true);
          }}
          onDragLeave={() => setTrascinando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setTrascinando(false);
            void aggiungiFile(e.dataTransfer.files);
          }}
          className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-[var(--radius)] border-2 border-dashed px-6 py-10 text-center transition-colors ${
            trascinando
              ? "border-[var(--accent)] bg-[var(--accent-soft)]"
              : "border-[var(--border)] bg-[var(--surface-hover)] hover:border-[var(--accent-muted)]"
          }`}
        >
          <ImagePlus
            className="h-8 w-8 text-[var(--accent)]"
            strokeWidth={1.5}
            aria-hidden
          />
          <p className="mt-3 max-w-sm text-sm font-medium text-[var(--ink)]">
            {isRetargeting
              ? isCarosello
                ? "Trascina 3–5 contenuti o clicca per sfogliare"
                : isVideo
                  ? "Trascina un video o clicca per sfogliare"
                  : "Trascina fino a 3 immagini o clicca per sfogliare"
              : isInStore
              ? isCarosello
                ? "Trascina 3–5 contenuti o clicca per sfogliare"
                : isVideo
                  ? "Trascina un video o clicca per sfogliare"
                  : "Trascina fino a 3 immagini o clicca per sfogliare"
              : isEcommerce
              ? isCarosello
                ? "Trascina 3–5 foto prodotto o clicca per sfogliare"
                : isVideo
                  ? "Trascina un video UGC / unboxing o clicca per sfogliare"
                  : "Trascina fino a 3 foto prodotto o clicca per sfogliare"
              : isBookings
                ? "Trascina fino a 3 foto (Principale, Staff, Struttura) o clicca per sfogliare"
                : "Trascina fino a 3 foto o clicca per sfogliare (1080×1080 consigliato)"}
          </p>
        </div>
      )}

      {caroselloIncompleto ? (
        <div className="mt-4 flex flex-wrap items-start gap-2 rounded-[16px] bg-white px-4 py-3 shadow-[var(--shadow-card)]">
          <StatoChip kind="watch" label="Da verificare" />
          <p className="min-w-0 flex-1 text-sm leading-relaxed text-[var(--ink)]">
          Carosello incompleto: carica almeno {minAsset}{" "}
          {isInStore || isRetargeting || isAwareness
            ? "contenuti"
            : "schede prodotto"}{" "}
          (ora ne hai {creativita.length}). Massimo {maxAsset}.
          </p>
        </div>
      ) : null}

      {isRetargeting && isCarosello ? (
        <div className="mt-4 rounded-xl border border-[#c6d8f0] bg-[#f3f7fc] px-4 py-3">
          <p className="text-sm leading-relaxed text-[var(--ink)]">
            Carica da 3 a 5 contenuti per il carosello.
          </p>
        </div>
      ) : isRetargeting && !isCarosello && !isVideo ? (
        <div className="mt-4 rounded-xl border border-[#c6d8f0] bg-[#f3f7fc] px-4 py-3">
          <p className="text-sm leading-relaxed text-[var(--ink)]">
            Carica fino a 3 immagini per la creatività.
          </p>
        </div>
      ) : null}

      {isInStore && isCarosello ? (
        <div className="mt-4 rounded-xl border border-[#c6d8f0] bg-[#f3f7fc] px-4 py-3">
          <p className="text-sm leading-relaxed text-[var(--ink)]">
            Carica da 3 a 5 contenuti per il carosello.
          </p>
        </div>
      ) : isInStore && !isCarosello && !isVideo ? (
        <div className="mt-4 rounded-xl border border-[#c6d8f0] bg-[#f3f7fc] px-4 py-3">
          <p className="text-sm leading-relaxed text-[var(--ink)]">
            Carica fino a 3 immagini per la creatività.
          </p>
        </div>
      ) : null}

      {isAwareness && usaFormatiCreativi && isCarosello ? (
        <div className="mt-4 rounded-xl border border-[#c6d8f0] bg-[#f3f7fc] px-4 py-3">
          <p className="text-sm leading-relaxed text-[var(--ink)]">
            Carica da 3 a 5 contenuti per il carosello.
          </p>
        </div>
      ) : isAwareness && usaFormatiCreativi && !isCarosello && !isVideo ? (
        <div className="mt-4 rounded-xl border border-[#c6d8f0] bg-[#f3f7fc] px-4 py-3">
          <p className="text-sm leading-relaxed text-[var(--ink)]">
            Carica fino a 3 immagini per la creatività.
          </p>
        </div>
      ) : null}

      {/* Tip legacy RETARGETING (carrello / sconti / creepy) rimossi sul ramo formati avanzati. */}

      {isAwareness && !usaFormatiCreativi ? (
        <div className="mt-4 rounded-xl border border-[#c6d8f0] bg-[#f3f7fc] px-4 py-3">
          <p className="text-sm leading-relaxed text-[var(--ink)]">
            📸 Formati consigliati: 1:1 (Feed) e 9:16 (Stories/Reels). Per i
            lanci locali, le Stories mostrano un tasso di memorizzazione del
            brand del 35% superiore nel quartiere.
          </p>
        </div>
      ) : null}

      {mostraAvvisoOrizzontale ? (
        <div className="mt-4 flex flex-wrap items-start gap-2 rounded-[16px] bg-white px-4 py-3 shadow-[var(--shadow-card)]">
          <StatoChip kind="watch" label="Da ottimizzare" />
          <p className="min-w-0 flex-1 text-sm leading-relaxed text-[var(--ink)]">
          Formato orizzontale rilevato: Sui telefoni occupa meno spazio nel
          feed. Consigliamo di usare ritagli verticali (4:5 o 1:1).
          </p>
        </div>
      ) : null}

      {mostraAvvisoFormato ? (
        <div className="mt-4 flex flex-wrap items-start gap-2 rounded-[16px] bg-white px-4 py-3 shadow-[var(--shadow-card)]">
          <StatoChip kind="watch" label="Da ottimizzare" />
          <p className="min-w-0 flex-1 text-sm leading-relaxed text-[var(--ink)]">
          Formato non ottimizzato: L&apos;immagine caricata rischia di essere
          ritagliata male su mobile. Ti consigliamo immagini in formato 4:5 o
          1:1 (1080×1080 px).
          </p>
        </div>
      ) : null}

      {isEcommerce || isRetargeting || (isAwareness && usaFormatiCreativi) ? null : isAwareness ? (
        <div className="mt-4 rounded-xl border border-[#fff0c2] bg-[#fff6e5] px-4 py-3">
          <p className="text-sm font-medium text-[var(--ink)]">
            💡 Regola d&apos;oro per l&apos;Apertura: Per riempire il locale il
            giorno dell&apos;inaugurazione, carica 3 immagini ad alto impatto:
          </p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-[var(--ink)]">
            <li>
              Grafica con la data dell&apos;evento ben visibile
              (&quot;Inaugurazione [Data]&quot;).
            </li>
            <li>
              Foto della vetrina/locale o del piatto/prodotto principale.
            </li>
            <li>
              Foto del titolare o del team con invito caloroso (&quot;Vi
              aspettiamo!&quot;).
            </li>
          </ol>
        </div>
      ) : isInStore ? (
        <div className="mt-4 rounded-xl border border-[#c6d8f0] bg-[#f3f7fc] px-4 py-3">
          <p className="text-sm leading-relaxed text-[var(--ink)]">
            💡 Regola d&apos;oro per il Business Locale: Le foto reali della
            vetrina/ingresso, del titolare, del team o dei prodotti/piatti
            puntano su autenticità e credibilità rispetto a grafiche generiche.
          </p>
        </div>
      ) : isBookings ? (
        <div className="mt-4 rounded-xl border border-[#c6d8f0] bg-[#f3f7fc] px-4 py-3">
          <p className="text-sm font-medium text-[var(--ink)]">
            💡 Cosa converte di più per le prenotazioni?
          </p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-[var(--ink)]">
            <li>
              Foto reali della struttura o del team (costruisce fiducia
              immediata).
            </li>
            <li>
              Risultati prima/dopo (se applicabile a estetica o cliniche).
            </li>
            <li>
              Evita volantini o grafiche con troppo testo scritto: Meta riduce
              la copertura degli annunci con troppa grafica.
            </li>
          </ol>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-[#c6d8f0] bg-[#f3f7fc] px-4 py-3">
          <p className="text-sm leading-relaxed text-[var(--ink)]">
            💡 Regola d&apos;oro per il Business Locale: Le foto reali del
            titolare, del team, della sede o dei lavori finiti (prima/dopo)
            possono risultare più credibili rispetto a immagini generiche.
          </p>
        </div>
      )}

      {errore ? (
        <p className="mt-3 text-xs text-[#C45C5C]">{errore}</p>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={!isVideo}
        className="hidden"
        onChange={(e) => {
          void aggiungiFile(e.target.files);
          e.target.value = "";
        }}
      />
    </section>
  );
}

/** Re-export per compatibilità con import legacy. */
export { useRevocaObjectUrl } from "@/hooks/useRevocaObjectUrl";
