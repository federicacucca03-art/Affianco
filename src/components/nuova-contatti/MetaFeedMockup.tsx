"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type {
  BookingChannel,
  CampagnaObjective,
  ConfigurazioneContatti,
} from "@/types/campagne";
import type { EcommerceCreativoFormato } from "@/lib/creativita";
import { ctaLabelDaObjective } from "@/data/meta-import-tsv";
import { isUrlMapsIndicazioni } from "@/lib/url-maps";

type Props = {
  config: ConfigurazioneContatti;
  selectedImage: string | null;
  /** URL di tutte le creatività (per carosello e-commerce). */
  immagini?: string[];
  /** Indici video (stesso ordine di `immagini`). */
  isVideoFlags?: boolean[];
  objective?: CampagnaObjective;
  bookingChannel?: BookingChannel;
  /** AWARENESS: CTA Maps → Ottieni indicazioni; altrimenti Scopri di più. */
  destinationUrl?: string;
  formatoEcommerce?: EcommerceCreativoFormato;
  indiceCarosello?: number;
  onCambiaIndiceCarosello?: (indice: number) => void;
};

type TabVariante = "A" | "B" | "C";

export function MetaFeedMockup({
  config,
  selectedImage,
  immagini = [],
  isVideoFlags = [],
  objective = "LEADS",
  bookingChannel,
  destinationUrl = "",
  formatoEcommerce = "SINGLE",
  indiceCarosello = 0,
  onCambiaIndiceCarosello,
}: Props) {
  const [tab, setTab] = useState<TabVariante>("A");
  const isMapsUrl =
    objective === "AWARENESS" && isUrlMapsIndicazioni(destinationUrl);
  const ctaLabel = ctaLabelDaObjective(objective, bookingChannel, {
    isMapsUrl,
  });
  const titoloFallback =
    objective === "ECOMMERCE"
      ? "Acquista ora"
      : objective === "RETARGETING"
        ? "Completa l'ordine"
        : objective === "AWARENESS"
          ? isMapsUrl
            ? "Ottieni indicazioni"
            : "Scopri di più"
          : objective === "IN_STORE"
            ? "Ottieni indicazioni"
            : objective === "BOOKINGS"
              ? "Prenota la tua visita"
              : "Richiedi informazioni";

  const testo =
    tab === "A"
      ? config.varianteA
      : tab === "B"
        ? config.varianteB
        : config.varianteC;

  const nome = config.nomeCliente.trim() || "Il tuo cliente";
  const iniziali = nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  const isCarosello =
    (objective === "ECOMMERCE" ||
      objective === "IN_STORE" ||
      objective === "RETARGETING" ||
      objective === "AWARENESS") &&
    formatoEcommerce === "CAROUSEL" &&
    immagini.length > 1;
  const slideCount = isCarosello ? immagini.length : 0;
  const slideIndex = Math.min(
    Math.max(0, indiceCarosello),
    Math.max(0, slideCount - 1),
  );
  const mediaUrl = isCarosello
    ? immagini[slideIndex] ?? selectedImage
    : selectedImage;
  const mediaIdx =
    mediaUrl && immagini.length > 0 ? immagini.indexOf(mediaUrl) : -1;
  const mediaIsVideo =
    mediaIdx >= 0
      ? Boolean(isVideoFlags[mediaIdx])
      : Boolean(isVideoFlags[0]);

  useEffect(() => {
    if (!isCarosello) return;
    if (indiceCarosello >= immagini.length) {
      onCambiaIndiceCarosello?.(Math.max(0, immagini.length - 1));
    }
  }, [isCarosello, immagini.length, indiceCarosello, onCambiaIndiceCarosello]);

  function vaiScheda(delta: number) {
    if (!isCarosello) return;
    const prossimo = Math.min(
      slideCount - 1,
      Math.max(0, slideIndex + delta),
    );
    onCambiaIndiceCarosello?.(prossimo);
  }

  return (
    <section className="rounded-[var(--radius)] bg-white p-5 shadow-[var(--shadow-soft)]">
      <h2 className="text-sm font-medium text-[var(--ink)]">
        Anteprima feed Meta
      </h2>
      <p className="mt-1 text-xs text-[var(--ink-muted)]">
        {isCarosello
          ? "Scorri le schede del carosello come sul telefono."
          : "Così apparirà l'annuncio sul telefono."}
      </p>

      <div className="mx-auto mt-4 w-full max-w-[320px] overflow-hidden rounded-[28px] border-[6px] border-[#1a1a1a] bg-white shadow-sm">
        <div className="mx-auto mt-2 h-1.5 w-20 rounded-full bg-[#1a1a1a]/40" />

        <div className="px-3 pt-4 pb-3">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e5e7eb] text-xs font-medium text-[var(--ink-muted)]"
            >
              {iniziali || "?"}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--ink)]">
                {nome}
              </p>
              <p className="text-[11px] text-[var(--ink-muted)]">
                Sponsorizzato
              </p>
            </div>
          </div>

          <div className="mt-3 flex gap-1">
            {(["A", "B", "C"] as TabVariante[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setTab(v)}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                  tab === v
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "bg-[var(--surface-hover)] text-[var(--ink-muted)]"
                }`}
              >
                Variante {v}
              </button>
            ))}
          </div>

          <p className="mt-2.5 line-clamp-4 text-[13px] leading-snug text-[var(--ink)]">
            {testo}
          </p>
        </div>

        <div className="relative aspect-[4/5] w-full bg-[#eef0f3]">
          {mediaUrl ? (
            mediaIsVideo ? (
              <video
                key={mediaUrl}
                src={mediaUrl}
                className="h-full w-full object-cover"
                controls
                playsInline
                muted
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={mediaUrl}
                src={mediaUrl}
                alt="Creatività annuncio"
                className="h-full w-full object-cover"
              />
            )
          ) : (
            <div className="flex h-full w-full items-center justify-center px-6 text-center">
              <p className="text-xs text-[var(--ink-muted)]">
                Anteprima immagine dell&apos;annuncio
              </p>
            </div>
          )}

          {isCarosello ? (
            <>
              <button
                type="button"
                onClick={() => vaiScheda(-1)}
                disabled={slideIndex <= 0}
                className="absolute top-1/2 left-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white disabled:opacity-30"
                aria-label="Scheda precedente"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => vaiScheda(1)}
                disabled={slideIndex >= slideCount - 1}
                className="absolute top-1/2 right-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white disabled:opacity-30"
                aria-label="Scheda successiva"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
                {immagini.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onCambiaIndiceCarosello?.(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      i === slideIndex
                        ? "w-4 bg-white"
                        : "w-1.5 bg-white/55"
                    }`}
                    aria-label={`Vai alla scheda ${i + 1}`}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 bg-[#f3f4f6] px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-[11px] uppercase tracking-wide text-[var(--ink-muted)]">
              {nome}
            </p>
            <p className="truncate text-sm font-medium text-[var(--ink)]">
              {config.titoloAnnuncio || titoloFallback}
            </p>
          </div>
          <span className="shrink-0 rounded-md bg-[var(--ink)] px-3 py-1.5 text-xs font-medium text-white">
            {ctaLabel}
          </span>
        </div>
      </div>

      {isCarosello ? (
        <p className="mt-3 text-center text-xs text-[var(--ink-muted)]">
          Scheda {slideIndex + 1} di {slideCount}
        </p>
      ) : null}
    </section>
  );
}
