"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ExternalLink,
  ImagePlus,
  Loader2,
  ScanLine,
  Sparkles,
  Wand2,
} from "lucide-react";
import type { CampagnaObjective, TargetType } from "@/types/campagne";
import type { DeconstructAdResult } from "@/types/deconstruct-ad";
import { messaggioAiUserFacing } from "@/lib/anthropic-messaggi";
import type {
  CreativitaAsset,
  EcommerceCreativoFormato,
} from "@/lib/creativita";
import {
  ETICHETTE_NICCHIA,
  formatiPerSettore,
  formatoPerId,
  nicchiaFormatiDaSettore,
  suggerimentiBookingCreativi,
  suggerimentiEcommerceCreativi,
  suggerimentiInstoreCreativi,
  suggerimentiRetargetingCreativi,
  suggerimentiAwarenessCreativi,
  type BookingSuggerimentoCreativo,
  type EcommerceSuggerimentoCreativo,
  type InstoreSuggerimentoCreativo,
  type RetargetingSuggerimentoCreativo,
  type AwarenessSuggerimentoCreativo,
  type CuratedFormat,
} from "@/lib/curatedFormats";
import {
  keywordAdLibraryDaSettore,
  urlMetaAdLibraryDaSettore,
} from "@/lib/adLibraryKeywords";
import { DropzoneCreativita } from "@/components/nuova-contatti/DropzoneCreativita";
import { ControlloFormatoCreativita } from "@/components/nuova-contatti/ControlloFormatoCreativita";
import { AffiancoSuggerisce } from "@/components/nuova-contatti/AffiancoSuggerisce";
import { BottoneCopia } from "@/components/nuova-contatti/BottoneCopia";
import type { GuidanceItem } from "@/lib/guidance";
import { generaGuidanceCreativita } from "@/lib/qualita-creativita";
import type { CreativeVisionAnalysis } from "@/lib/analyze-creative";
import { dataUrlDaBytesImmagine } from "@/lib/analyze-creative";
import { generaGuidanceP1bCreativita } from "@/lib/guidance-creativita-vision";
import { supabase } from "@/lib/supabase";

const PASSI_SCANSIONE = [
  "Lettura hook visivo e angolo psicologico…",
  "Adattamento copy al tuo cliente…",
  "Generazione istruzioni smartphone…",
];

type Props = {
  settore?: string;
  nomeAzienda?: string;
  offerta?: string;
  targetCpl?: number;
  formatoCuratoId?: string | null;
  onSelezionaFormato?: (id: string | null) => void;
  deconstructResult?: DeconstructAdResult | null;
  onDeconstructResult?: (risultato: DeconstructAdResult | null) => void;
  creativita: CreativitaAsset[];
  indiceAnteprima: number;
  onCambiaCreativita: (lista: CreativitaAsset[]) => void;
  onCambiaIndiceAnteprima: (indice: number) => void;
  objective?: CampagnaObjective;
  formatoEcommerce?: EcommerceCreativoFormato;
  onCambiaFormatoEcommerce?: (formato: EcommerceCreativoFormato) => void;
  creativeGuidelines?: string | null;
  /** Layout LEADS/BOOKINGS: creatività campagna prima, ispirazione collassata. */
  prioritaCampagna?: boolean;
  /** Percorso prenotazioni: suggerimenti booking e copy Step 4 dedicati. */
  percorsoBookings?: boolean;
  /** Percorso vendite-online: layout A→B→C ecommerce. */
  percorsoEcommerce?: boolean;
  /** Percorso instore: layout A→B→C drive-to-store. */
  percorsoInstore?: boolean;
  /** Percorso retargeting: layout A→B→C recupero. */
  percorsoRetargeting?: boolean;
  /** Percorso apertura: layout A→B→C awareness / lancio locale. */
  percorsoAwareness?: boolean;
  /** ECOMMERCE: prodotto hero / brief per esempi reali nei suggerimenti. */
  heroProduct?: string;
  elevatorPitch?: string;
  /** RETARGETING: fork copy suggerimenti B2C/B2B. */
  targetType?: TargetType;
  /** RETARGETING: destinazione (solo contesto, non claim). */
  sitoWeb?: string;
  /** INSTORE: zona e raggio per suggerimenti (solo se dati reali). */
  citta?: string;
  raggioKm?: number;
  /** BOOKINGS: posti settimana (solo UI) per esempi coerenti negli suggerimenti. */
  postiDisponibiliSettimana?: string;
  haCopy?: boolean;
};

function badgeClass(tag: CuratedFormat["tag"][number]): string {
  if (tag === "Formato evergreen") {
    return "bg-[#E8F5EE] text-[#2D6A4A] border-[#B7E4C7]";
  }
  if (tag === "Hook immediato") {
    return "bg-[var(--accent-soft)] text-[var(--accent)] border-[#c6d8f0]";
  }
  return "bg-[#FFF6E5] text-[#9A6700] border-[#F5D78E]";
}

export function StudioCreativo({
  settore = "",
  nomeAzienda = "",
  offerta = "",
  targetCpl = 45,
  formatoCuratoId = null,
  onSelezionaFormato,
  deconstructResult = null,
  onDeconstructResult,
  creativita,
  indiceAnteprima,
  onCambiaCreativita,
  onCambiaIndiceAnteprima,
  objective = "LEADS",
  formatoEcommerce = "SINGLE",
  onCambiaFormatoEcommerce,
  creativeGuidelines = null,
  prioritaCampagna = false,
  percorsoBookings = false,
  percorsoEcommerce = false,
  percorsoInstore = false,
  percorsoRetargeting = false,
  percorsoAwareness = false,
  heroProduct = "",
  elevatorPitch = "",
  targetType = "B2C",
  sitoWeb = "",
  citta = "",
  raggioKm = 0,
  postiDisponibiliSettimana = "",
  haCopy = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [anteprimaCompetitor, setAnteprimaCompetitor] = useState<string | null>(
    null,
  );
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [trascinando, setTrascinando] = useState(false);
  const [caricamento, setCaricamento] = useState(false);
  const [passoScansione, setPassoScansione] = useState(0);
  const [errore, setErrore] = useState<string | null>(null);
  const [mockInfo, setMockInfo] = useState<string | null>(null);
  const [visionStatus, setVisionStatus] = useState<
    "IDLE" | "ANALYZING" | "SUCCESS" | "UNKNOWN" | "ERROR"
  >("IDLE");
  const [visionErrore, setVisionErrore] = useState<string | null>(null);
  const [visionAnalysis, setVisionAnalysis] =
    useState<CreativeVisionAnalysis | null>(null);

  const assetPrincipale =
    creativita.find((c) => c.ruolo === "principale") ?? creativita[0] ?? null;
  const assetPrincipaleId = assetPrincipale?.id ?? null;

  useEffect(() => {
    setVisionStatus("IDLE");
    setVisionErrore(null);
    setVisionAnalysis(null);
  }, [assetPrincipaleId]);

  const guidanceP1a = useMemo(
    () => generaGuidanceCreativita({ creativita, objective }),
    [creativita, objective],
  );
  const guidanceP1b = useMemo(
    () =>
      generaGuidanceP1bCreativita({
        analysis: visionAnalysis,
        offerta,
        brief: elevatorPitch,
      }),
    [visionAnalysis, offerta, elevatorPitch],
  );
  const guidanceCreativita = useMemo(
    () => [...guidanceP1b, ...guidanceP1a],
    [guidanceP1b, guidanceP1a],
  );

  async function blobUrlToDataUrl(url: string): Promise<string> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error("Impossibile leggere l'immagine.");
    }
    const blob = await res.blob();
    if (blob.type.startsWith("video/")) {
      throw new Error(
        "Analisi visual disponibile per immagini in questa versione.",
      );
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const dataUrl = dataUrlDaBytesImmagine(bytes, blob.type);
    if (!dataUrl) {
      throw new Error("Formato immagine non supportato.");
    }
    return dataUrl;
  }

  async function analizzaCreativitaPrincipale() {
    if (!assetPrincipale || assetPrincipale.isVideo) return;
    setVisionStatus("ANALYZING");
    setVisionErrore(null);
    try {
      const dataUrl = await blobUrlToDataUrl(assetPrincipale.url);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setVisionStatus("ERROR");
        setVisionErrore(
          "Non sono riuscito ad analizzare il visual. Puoi continuare comunque.",
        );
        return;
      }
      const res = await fetch("/api/analyze-creative", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          image: dataUrl,
          offerta,
          brief: elevatorPitch,
          settore,
        }),
      });
      const data = (await res.json()) as CreativeVisionAnalysis & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "analisi fallita");
      }
      const analysis: CreativeVisionAnalysis = {
        relevance: data.relevance ?? "UNKNOWN",
        relevanceReason: data.relevanceReason ?? null,
        visibleText: Array.isArray(data.visibleText) ? data.visibleText : [],
      };
      setVisionAnalysis(analysis);
      setVisionStatus(analysis.relevance === "UNKNOWN" ? "UNKNOWN" : "SUCCESS");
    } catch {
      setVisionAnalysis(null);
      setVisionStatus("ERROR");
      setVisionErrore(
        "Non sono riuscito ad analizzare il visual. Puoi continuare comunque.",
      );
    }
  }

  const nicchia = nicchiaFormatiDaSettore(settore);
  const formati = formatiPerSettore(settore);
  const formatoSelezionato = formatoPerId(settore, formatoCuratoId);
  const keywordAdLibrary = keywordAdLibraryDaSettore(settore);
  const urlAdLibrary = urlMetaAdLibraryDaSettore(settore);
  const suggerimentiBooking = percorsoBookings
    ? suggerimentiBookingCreativi(postiDisponibiliSettimana)
    : [];
  const suggerimentiEcommerce = percorsoEcommerce
    ? suggerimentiEcommerceCreativi({
        frontEndOffer: offerta,
        heroProduct,
        elevatorPitch,
        nomeCliente: nomeAzienda,
        formatoEcommerce,
      })
    : [];
  const suggerimentiInstore = percorsoInstore
    ? suggerimentiInstoreCreativi({
        frontEndOffer: offerta,
        nomeCliente: nomeAzienda,
        elevatorPitch,
        citta,
        raggioKm,
        formatoEcommerce,
      })
    : [];
  const suggerimentiRetargeting = percorsoRetargeting
    ? suggerimentiRetargetingCreativi({
        frontEndOffer: offerta,
        nomeCliente: nomeAzienda,
        elevatorPitch,
        targetType,
        sitoWeb,
        formatoEcommerce,
      })
    : [];
  const suggerimentiAwareness = percorsoAwareness
    ? suggerimentiAwarenessCreativi({
        frontEndOffer: offerta,
        nomeCliente: nomeAzienda,
        elevatorPitch,
        settore,
        citta,
        sitoWeb,
        formatoEcommerce,
      })
    : [];

  function gestisciFile(file: File | undefined) {
    if (!file) return;
    const ok =
      file.type === "image/jpeg" ||
      file.type === "image/png" ||
      file.type === "image/webp";
    if (!ok) {
      setErrore("Carica un JPG, PNG o WebP.");
      return;
    }
    setErrore(null);
    setMockInfo(null);
    onDeconstructResult?.(null);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      setAnteprimaCompetitor(dataUrl);
      setImageBase64(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  async function analizzaCompetitor() {
    if (!imageBase64) {
      setErrore("Carica lo screenshot dell'inserzione competitor.");
      return;
    }
    setCaricamento(true);
    setErrore(null);
    setMockInfo(null);
    onDeconstructResult?.(null);
    setPassoScansione(0);

    const timer = window.setInterval(() => {
      setPassoScansione((p) => Math.min(p + 1, PASSI_SCANSIONE.length - 1));
    }, 850);

    try {
      const res = await fetch("/api/deconstruct-ad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: imageBase64,
          nomeAzienda,
          settore,
          offerta,
          targetCpl,
        }),
      });

      const data = (await res.json()) as DeconstructAdResult & {
        error?: string;
        _mock?: boolean;
        _motivo?: string;
      };

      if (!res.ok) {
        throw new Error(
          messaggioAiUserFacing(
            data.error,
            "Non siamo riusciti a generare il contenuto. Riprova.",
          ),
        );
      }

      const { _mock, _motivo, error: _err, ...pulito } = data;
      onDeconstructResult?.(pulito as DeconstructAdResult);
      if (_mock && _motivo) setMockInfo(_motivo);
    } catch (e) {
      setErrore(
        messaggioAiUserFacing(
          e instanceof Error ? e.message : null,
          "Analisi non riuscita. Riprova.",
        ),
      );
    } finally {
      window.clearInterval(timer);
      setCaricamento(false);
      setPassoScansione(0);
    }
  }

  const testoIstruzioniCliente = deconstructResult
    ? `${deconstructResult.copioneAdattato.istruzioniPerCliente}\n\n— Titolo visual: ${deconstructResult.copioneAdattato.titoloVisual}\n— Script:\n${deconstructResult.copioneAdattato.scriptVideo}`
    : "";

  const sezioneSuggerimentiBooking = (
    <section className="rounded-[var(--radius)] bg-white p-5 shadow-[var(--shadow-soft)]">
      <h3 className="text-sm font-medium text-[var(--ink)]">
        Format consigliati per prenotazioni
      </h3>
      <p className="mt-2 text-xs leading-relaxed text-[var(--ink-muted)]">
        Idee da testare — non sono promesse di performance. Usa solo dati reali
        (disponibilità, offerte, recensioni) e adatta al cliente.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {suggerimentiBooking.map((suggerimento) => (
          <SuggerimentoCreativoCard
            key={suggerimento.id}
            suggerimento={suggerimento}
          />
        ))}
      </div>
    </section>
  );

  const sezioneSuggerimentiEcommerce = (
    <section className="rounded-[var(--radius)] bg-white p-5 shadow-[var(--shadow-soft)]">
      <h3 className="text-sm font-medium text-[var(--ink)]">
        Idee da cui partire
      </h3>
      <p className="mt-2 text-xs leading-relaxed text-[var(--ink-muted)]">
        Idee da testare — non sono promesse di performance. Usa solo prodotto,
        offerta e prove sociali realmente disponibili.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {suggerimentiEcommerce.map((suggerimento) => (
          <SuggerimentoCreativoCard
            key={suggerimento.id}
            suggerimento={suggerimento}
          />
        ))}
      </div>
    </section>
  );

  const sezioneSuggerimentiInstore = (
    <section className="rounded-[var(--radius)] bg-white p-5 shadow-[var(--shadow-soft)]">
      <h3 className="text-sm font-medium text-[var(--ink)]">
        Idee da cui partire
      </h3>
      <p className="mt-2 text-xs leading-relaxed text-[var(--ink-muted)]">
        Idee da testare — non sono promesse di performance né di visite.
        Usa solo attività, zona, offerta e prove reali disponibili.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {suggerimentiInstore.map((suggerimento) => (
          <SuggerimentoCreativoCard
            key={suggerimento.id}
            suggerimento={suggerimento}
          />
        ))}
      </div>
    </section>
  );

  const sezioneSuggerimentiRetargeting = (
    <section className="rounded-[var(--radius)] bg-white p-5 shadow-[var(--shadow-soft)]">
      <h3 className="text-sm font-medium text-[var(--ink)]">
        Idee da cui partire
      </h3>
      <p className="mt-2 text-xs leading-relaxed text-[var(--ink-muted)]">
        Idee da testare — non sono promesse di performance né di recuperi.
        Usa solo brief, offerta e prove reali disponibili. Niente tracking o
        promo inventate.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {suggerimentiRetargeting.map((suggerimento) => (
          <SuggerimentoCreativoCard
            key={suggerimento.id}
            suggerimento={suggerimento}
          />
        ))}
      </div>
    </section>
  );

  const sezioneSuggerimentiAwareness = (
    <section className="rounded-[var(--radius)] bg-white p-5 shadow-[var(--shadow-soft)]">
      <h3 className="text-sm font-medium text-[var(--ink)]">
        Idee da cui partire
      </h3>
      <p className="mt-2 text-xs leading-relaxed text-[var(--ink-muted)]">
        Idee da testare — non sono promesse di performance, visite o reach.
        Usa solo messaggio, brief e materiale reale. Niente promo o date
        inventate.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {suggerimentiAwareness.map((suggerimento) => (
          <SuggerimentoCreativoCard
            key={suggerimento.id}
            suggerimento={suggerimento}
          />
        ))}
      </div>
    </section>
  );

  const sezioneFormatCurati = (
    <section className="rounded-[var(--radius)] bg-white p-5 shadow-[var(--shadow-soft)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-medium text-[var(--ink)]">
          Format consigliati di settore
        </h3>
        <span className="inline-flex w-fit rounded-full border border-[#2D6A4A]/30 bg-[#E8F5EE] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#2D6A4A]">
          Format di riferimento
        </span>
      </div>
      <p className="mt-2 text-xs text-[var(--ink-muted)]">
        Opzionale: seleziona un format come riferimento creativo.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {formati.map((formato) => {
          const attivo = formatoCuratoId === formato.id;
          return (
            <button
              key={formato.id}
              type="button"
              onClick={() =>
                onSelezionaFormato?.(attivo ? null : formato.id)
              }
              className={`flex flex-col rounded-xl border p-4 text-left transition-all ${
                attivo
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[0_0_0_1px_var(--accent)]"
                  : "border-[var(--border)] bg-white hover:border-[var(--accent-muted)] hover:shadow-[var(--shadow-soft)]"
              }`}
            >
              <p className="text-sm font-medium text-[var(--ink)]">
                {formato.titolo}
              </p>
              <p className="mt-2 flex-1 text-xs leading-relaxed text-[var(--ink-muted)]">
                {formato.descrizione}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {formato.tag.map((tag) => (
                  <span
                    key={tag}
                    className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${badgeClass(tag)}`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {formatoSelezionato ? (
        <div className="mt-4 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent-soft)] px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
            Guida selezionata · {formatoSelezionato.titolo}
          </p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-[var(--ink)]">
            {formatoSelezionato.istruzioniRegistrazione.map((riga) => (
              <li key={riga}>{riga}</li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );

  const sezioneAdLibrary = (
    <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-hover)] p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-medium text-[var(--ink)]">
            Meta Ad Library
          </h3>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            Annunci attivi in Italia con keyword{" "}
            <span className="font-medium">{keywordAdLibrary}</span>.
          </p>
        </div>
        <a
          href={urlAdLibrary}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--ink)] transition-colors hover:border-[var(--accent-muted)]"
        >
          <Sparkles className="h-4 w-4" strokeWidth={1.75} />
          Apri Ad Library
          <ExternalLink className="h-3.5 w-3.5 opacity-80" />
        </a>
      </div>
    </section>
  );

  const sezioneDeconstruct = (
    <section className="rounded-[var(--radius)] bg-white p-5 shadow-[var(--shadow-soft)]">
      <h3 className="text-sm font-medium text-[var(--ink)]">
        Reverse-engineering competitor
      </h3>
      <p className="mt-1 text-xs text-[var(--ink-muted)]">
        Carica uno screenshot da Ad Library per estrarre hook e angolo visivo
        (opzionale).
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
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
            gestisciFile(e.dataTransfer.files[0]);
          }}
          className={`relative flex min-h-[180px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
            trascinando
              ? "border-[var(--accent)] bg-[var(--accent-soft)]"
              : "border-[var(--border)] bg-[var(--surface-hover)] hover:border-[var(--accent-muted)]"
          } ${caricamento ? "studio-scan-pulse" : ""}`}
        >
          {caricamento ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/85 backdrop-blur-[2px]">
              <ScanLine className="h-8 w-8 animate-pulse text-[var(--accent)]" />
              <p className="mt-2 text-sm font-medium text-[var(--accent)]">
                {PASSI_SCANSIONE[passoScansione]}
              </p>
              <div className="mt-3 flex w-full max-w-xs gap-1 px-6">
                {PASSI_SCANSIONE.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      i <= passoScansione
                        ? "bg-[var(--accent)]"
                        : "bg-[var(--accent)]/20"
                    }`}
                  />
                ))}
              </div>
            </div>
          ) : null}
          {anteprimaCompetitor ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={anteprimaCompetitor}
              alt="Screenshot inserzione competitor"
              className="max-h-48 w-full rounded-lg object-contain"
            />
          ) : (
            <>
              <ImagePlus
                className="h-8 w-8 text-[var(--accent)]"
                strokeWidth={1.5}
              />
              <p className="mt-2 text-sm font-medium text-[var(--ink)]">
                Trascina screenshot competitor (JPG/PNG)
              </p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              gestisciFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>

        <div className="flex flex-col justify-center gap-3">
          <button
            type="button"
            disabled={caricamento || !imageBase64}
            onClick={() => void analizzaCompetitor()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {caricamento ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" strokeWidth={1.75} />
            )}
            Analizza screenshot
          </button>
          {errore ? (
            <p className="text-xs text-[#C45C5C]">{errore}</p>
          ) : null}
          {mockInfo ? (
            <p className="text-xs text-[var(--ink-muted)]">
              Modalità demo: {mockInfo}
            </p>
          ) : null}
        </div>
      </div>

      {deconstructResult ? (
        <div className="mt-6 space-y-3">
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
                Hook &amp; Angolo Visivo
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">
                {deconstructResult.hookVisivo}
              </p>
              <p className="mt-3 border-t border-[var(--border)] pt-3 text-xs font-medium text-[var(--ink-muted)]">
                Angolo: {deconstructResult.angoloPsicologico}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--ink-muted)]">
                {deconstructResult.strutturaCopy}
              </p>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] p-4 lg:col-span-1">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
                Copione Video 9:16 Adattato
              </p>
              <p className="mt-2 text-sm font-medium text-[var(--ink)]">
                {deconstructResult.copioneAdattato.titoloVisual}
              </p>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-sans text-xs leading-relaxed text-[var(--ink)]">
                {deconstructResult.copioneAdattato.scriptVideo}
              </pre>
            </div>

            <div className="rounded-xl border border-[#c6e7c8] bg-[#f0faf1] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[#3D8B57]">
                Istruzioni Smartphone da Inviare al Cliente
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--ink)]">
                {deconstructResult.copioneAdattato.istruzioniPerCliente}
              </p>
              <div className="mt-3">
                <BottoneCopia
                  valore={testoIstruzioniCliente}
                  etichetta="Copia Istruzioni per il Cliente"
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );

  const dropzone = (
    <DropzoneCreativita
      creativita={creativita}
      indiceAnteprima={indiceAnteprima}
      onCambiaCreativita={onCambiaCreativita}
      onCambiaIndiceAnteprima={onCambiaIndiceAnteprima}
      objective={objective}
      formatoEcommerce={formatoEcommerce}
      onCambiaFormatoEcommerce={onCambiaFormatoEcommerce}
      creativeGuidelines={creativeGuidelines}
      titoloSezione={
        prioritaCampagna ||
        percorsoEcommerce ||
        percorsoInstore ||
        percorsoRetargeting ||
        percorsoAwareness
          ? "Creatività della campagna"
          : undefined
      }
      embedded={
        prioritaCampagna ||
        percorsoEcommerce ||
        percorsoInstore ||
        percorsoRetargeting ||
        percorsoAwareness
      }
    />
  );

  const dropzoneConGuidance = (
    <>
      {dropzone}
      {assetPrincipale?.isVideo ? (
        <p className="text-xs leading-relaxed text-[var(--ink-muted)]">
          Analisi visual disponibile per immagini in questa versione.
        </p>
      ) : assetPrincipale ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={visionStatus === "ANALYZING"}
            onClick={() => void analizzaCreativitaPrincipale()}
            className="inline-flex w-fit items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--ink)] transition-colors hover:border-[var(--accent-muted)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {visionStatus === "ANALYZING"
              ? "Analisi in corso…"
              : "Analizza creatività"}
          </button>
          {visionStatus === "ERROR" && visionErrore ? (
            <p className="text-xs leading-relaxed text-[var(--ink-muted)]">
              {visionErrore}
            </p>
          ) : null}
        </div>
      ) : null}
      <AffiancoSuggerisce items={guidanceCreativita as GuidanceItem[]} />
    </>
  );

  if (percorsoAwareness) {
    return (
      <div className="space-y-6">
        <section className="rounded-[var(--radius)] border border-[var(--accent)]/25 bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-medium text-[var(--ink)]">
                Prepariamo la creatività di apertura
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--ink-muted)]">
                Carica gli asset della campagna e costruisci un visual che
                faccia capire cosa c&apos;è di nuovo e dove scoprirlo.
              </p>
            </div>
            <span className="rounded-full border border-[#B7E4C7] bg-[#E8F5EE] px-3 py-1 text-[11px] font-medium text-[#2D6A4A]">
              Creatività di apertura
            </span>
          </div>

          <div className="mt-5 space-y-4">
            <ControlloFormatoCreativita
              creativita={creativita}
              haCopy={haCopy}
              indiceAnteprima={indiceAnteprima}
            />
            {dropzoneConGuidance}
          </div>
        </section>

        {sezioneSuggerimentiAwareness}

        <details className="group rounded-[var(--radius)] border border-[var(--border)] bg-white shadow-[var(--shadow-soft)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-medium text-[var(--ink)] [&::-webkit-details-marker]:hidden">
            <span>Ispirazione e competitor</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-[var(--ink-muted)] transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-4 border-t border-[var(--border)] p-4 sm:p-5">
            <p className="text-xs leading-relaxed text-[var(--ink-muted)]">
              Ispirazione opzionale: Ad Library e analisi screenshot competitor.
              Non sostituisce il caricamento degli asset finali sopra.
            </p>
            {sezioneAdLibrary}
            {sezioneDeconstruct}
          </div>
        </details>
      </div>
    );
  }

  if (percorsoRetargeting) {
    return (
      <div className="space-y-6">
        <section className="rounded-[var(--radius)] border border-[var(--accent)]/25 bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-medium text-[var(--ink)]">
                Prepariamo la creatività di recupero
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--ink-muted)]">
                Carica l&apos;asset della campagna e costruisci un messaggio
                visivo che dia un motivo concreto per tornare.
              </p>
            </div>
            <span className="rounded-full border border-[#B7E4C7] bg-[#E8F5EE] px-3 py-1 text-[11px] font-medium text-[#2D6A4A]">
              Creatività di recupero
            </span>
          </div>

          <div className="mt-5 space-y-4">
            <ControlloFormatoCreativita
              creativita={creativita}
              haCopy={haCopy}
              indiceAnteprima={indiceAnteprima}
            />
            {dropzoneConGuidance}
          </div>
        </section>

        {sezioneSuggerimentiRetargeting}

        <details className="group rounded-[var(--radius)] border border-[var(--border)] bg-white shadow-[var(--shadow-soft)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-medium text-[var(--ink)] [&::-webkit-details-marker]:hidden">
            <span>Ispirazione e competitor</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-[var(--ink-muted)] transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-4 border-t border-[var(--border)] p-4 sm:p-5">
            <p className="text-xs leading-relaxed text-[var(--ink-muted)]">
              Ispirazione opzionale: Ad Library e analisi screenshot competitor.
              Non sostituisce il caricamento degli asset finali sopra.
            </p>
            {sezioneAdLibrary}
            {sezioneDeconstruct}
          </div>
        </details>
      </div>
    );
  }

  if (percorsoInstore) {
    return (
      <div className="space-y-6">
        <section className="rounded-[var(--radius)] border border-[var(--accent)]/25 bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-medium text-[var(--ink)]">
                Prepariamo la creatività locale
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--ink-muted)]">
                Carica l&apos;asset della campagna e assicurati che faccia
                capire subito attività, zona e motivo per venire.
              </p>
            </div>
            <span className="rounded-full border border-[#B7E4C7] bg-[#E8F5EE] px-3 py-1 text-[11px] font-medium text-[#2D6A4A]">
              Traffico in negozio
            </span>
          </div>

          <div className="mt-5 space-y-4">
            <ControlloFormatoCreativita
              creativita={creativita}
              haCopy={haCopy}
              indiceAnteprima={indiceAnteprima}
            />
            {dropzoneConGuidance}
          </div>
        </section>

        {sezioneSuggerimentiInstore}

        <details className="group rounded-[var(--radius)] border border-[var(--border)] bg-white shadow-[var(--shadow-soft)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-medium text-[var(--ink)] [&::-webkit-details-marker]:hidden">
            <span>Ispirazione e competitor</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-[var(--ink-muted)] transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-4 border-t border-[var(--border)] p-4 sm:p-5">
            <p className="text-xs leading-relaxed text-[var(--ink-muted)]">
              Ispirazione opzionale: Ad Library e analisi screenshot competitor.
              Non sostituisce il caricamento degli asset finali sopra.
            </p>
            {sezioneAdLibrary}
            {sezioneDeconstruct}
          </div>
        </details>
      </div>
    );
  }

  if (percorsoEcommerce) {
    return (
      <div className="space-y-6">
        <section className="rounded-[var(--radius)] border border-[var(--accent)]/25 bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-medium text-[var(--ink)]">
                Prepariamo la creatività prodotto
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--ink-muted)]">
                Carica l&apos;asset che userai nella campagna e controlla che
                presenti prodotto, beneficio e offerta in modo chiaro.
              </p>
            </div>
            <span className="rounded-full border border-[#B7E4C7] bg-[#E8F5EE] px-3 py-1 text-[11px] font-medium text-[#2D6A4A]">
              Vendite online
            </span>
          </div>

          <div className="mt-5 space-y-4">
            <ControlloFormatoCreativita
              creativita={creativita}
              haCopy={haCopy}
              indiceAnteprima={indiceAnteprima}
            />
            {dropzoneConGuidance}
          </div>
        </section>

        {sezioneSuggerimentiEcommerce}

        <details className="group rounded-[var(--radius)] border border-[var(--border)] bg-white shadow-[var(--shadow-soft)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-medium text-[var(--ink)] [&::-webkit-details-marker]:hidden">
            <span>Ispirazione e competitor</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-[var(--ink-muted)] transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-4 border-t border-[var(--border)] p-4 sm:p-5">
            <p className="text-xs leading-relaxed text-[var(--ink-muted)]">
              Ispirazione opzionale: Ad Library e analisi screenshot competitor.
              Non sostituisce il caricamento degli asset finali sopra.
            </p>
            {sezioneAdLibrary}
            {sezioneDeconstruct}
          </div>
        </details>
      </div>
    );
  }

  if (prioritaCampagna) {
    const titoloStep = percorsoBookings
      ? "Prepariamo la creatività"
      : "Prepara le creatività";
    const sottotitoloStep = percorsoBookings
      ? "Carica ciò che vuoi usare nella campagna. Affianco ti aiuta a controllare formato e coerenza con una campagna di prenotazione."
      : "Carica gli asset finali, verifica formato e controlla l'anteprima mobile prima dell'export.";
    const badgeNicchia = percorsoBookings
      ? "Prenotazioni"
      : ETICHETTE_NICCHIA[nicchia];

    return (
      <div className="space-y-6">
        <section className="rounded-[var(--radius)] border border-[var(--accent)]/25 bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-medium text-[var(--ink)]">
                {titoloStep}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--ink-muted)]">
                {sottotitoloStep}
              </p>
            </div>
            <span className="rounded-full border border-[#B7E4C7] bg-[#E8F5EE] px-3 py-1 text-[11px] font-medium text-[#2D6A4A]">
              {badgeNicchia}
            </span>
          </div>

          <div className="mt-5 space-y-4">
            <ControlloFormatoCreativita
              creativita={creativita}
              haCopy={haCopy}
              indiceAnteprima={indiceAnteprima}
            />
            {dropzoneConGuidance}
          </div>
        </section>

        <details className="group rounded-[var(--radius)] border border-[var(--border)] bg-white shadow-[var(--shadow-soft)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-medium text-[var(--ink)] [&::-webkit-details-marker]:hidden">
            <span>
              {percorsoBookings
                ? "Esplora ispirazione per prenotazioni"
                : "Esplora idee e competitor"}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-[var(--ink-muted)] transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-4 border-t border-[var(--border)] p-4 sm:p-5">
            <p className="text-xs leading-relaxed text-[var(--ink-muted)]">
              {percorsoBookings
                ? "Ispirazione opzionale: format per prenotazioni, Ad Library e analisi screenshot competitor. Non sostituisce il caricamento degli asset finali sopra."
                : "Ispirazione opzionale: format di settore, Ad Library e analisi screenshot competitor. Non sostituisce il caricamento degli asset finali sopra."}
            </p>
            {percorsoBookings ? sezioneSuggerimentiBooking : sezioneFormatCurati}
            {sezioneAdLibrary}
            {sezioneDeconstruct}
          </div>
        </details>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[var(--radius)] bg-white p-5 shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-[var(--ink)]">
              🎬 Studio Creativo Interattivo
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[var(--ink-muted)]">
              Format di riferimento, Ad Library e analisi competitor — poi
              carichi gli asset finali per Ads Manager.
            </p>
          </div>
          <span className="rounded-full border border-[#B7E4C7] bg-[#E8F5EE] px-3 py-1 text-[11px] font-medium text-[#2D6A4A]">
            {ETICHETTE_NICCHIA[nicchia]}
          </span>
        </div>
      </section>

      {sezioneFormatCurati}
      <section className="rounded-[var(--radius)] border border-[var(--accent)]/20 bg-gradient-to-r from-[var(--accent-soft)] to-white p-4 shadow-[var(--shadow-soft)] sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-medium text-[var(--ink)]">
              Libreria Inserzioni Meta Ufficiale (Spy Tool Gratuito)
            </h3>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">
              Cerca annunci attivi in Italia con la keyword commerciale{" "}
              {keywordAdLibrary} (nicchia «{settore.trim() || "servizi locali"}
              »).
            </p>
          </div>
          <a
            href={urlAdLibrary}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <Sparkles className="h-4 w-4" strokeWidth={1.75} />
            ✦ Cerca annunci attivi dei competitor su Meta Ad Library
            <ExternalLink className="h-3.5 w-3.5 opacity-80" />
          </a>
        </div>
      </section>

      {sezioneDeconstruct}

      {dropzoneConGuidance}
    </div>
  );
}

function SuggerimentoCreativoCard({
  suggerimento,
}: {
  suggerimento:
    | BookingSuggerimentoCreativo
    | EcommerceSuggerimentoCreativo
    | InstoreSuggerimentoCreativo
    | RetargetingSuggerimentoCreativo
    | AwarenessSuggerimentoCreativo;
}) {
  return (
    <article className="flex flex-col rounded-xl border border-[var(--border)] bg-white p-4 text-left">
      <p className="text-sm font-medium text-[var(--ink)]">
        {suggerimento.nome}
      </p>
      <dl className="mt-3 space-y-2.5 text-xs leading-relaxed">
        <div>
          <dt className="font-medium text-[var(--ink-muted)]">Quando usarlo</dt>
          <dd className="mt-0.5 text-[var(--ink)]">
            {suggerimento.quandoUsarlo}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-[var(--ink-muted)]">Cosa mostrare</dt>
          <dd className="mt-0.5 text-[var(--ink)]">
            {suggerimento.cosaMostrare}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-[var(--ink-muted)]">
            Idea hook visivo
          </dt>
          <dd className="mt-0.5 text-[var(--ink)]">
            {suggerimento.hookVisivo}
          </dd>
        </div>
      </dl>
    </article>
  );
}
