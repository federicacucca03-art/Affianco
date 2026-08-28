"use client";

import { useEffect, useState } from "react";
import type { Campagna } from "@/types/campagne";
import { ctaLabelDaObjective } from "@/data/meta-import-tsv";
import { isUrlMapsIndicazioni } from "@/lib/url-maps";

type TabVariante = "A" | "B" | "C";

type Props = {
  campagna: Campagna;
  approvalToken: string;
};

const ETICHETTE_LEAD: Record<TabVariante, string> = {
  A: "Variante A — Beneficio & Promo",
  B: "Variante B — Autorevolezza",
  C: "Variante C — Empatico",
};

const ETICHETTE_BOOK: Record<TabVariante, string> = {
  A: "Variante A — Primo Ingresso",
  B: "Variante B — Scarsità",
  C: "Variante C — Social Proof",
};

const ETICHETTE_ECOM: Record<TabVariante, string> = {
  A: "Variante A — Bundle",
  B: "Variante B — Urgenza",
  C: "Variante C — Testimonial",
};

const ETICHETTE_STORE: Record<TabVariante, string> = {
  A: "Variante A — Coupon Cassa",
  B: "Variante B — Evento / Nuovi Arrivi",
  C: "Variante C — Esclusività Locale",
};

const ETICHETTE_RETARGET: Record<TabVariante, string> = {
  A: "Variante A — Incentivo Diretto",
  B: "Variante B — FAQ / Dubbi",
  C: "Variante C — Ultimo Avviso",
};

const ETICHETTE_AWARE: Record<TabVariante, string> = {
  A: "Variante A — Apertura",
  B: "Variante B — Teaser",
  C: "Variante C — Benvenuto",
};

export function AnteprimaFeedApprovazione({
  campagna,
  approvalToken,
}: Props) {
  const [tab, setTab] = useState<TabVariante>("A");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaErrore, setMediaErrore] = useState(false);

  const objective = campagna.objective ?? "LEADS";
  const etichette =
    objective === "ECOMMERCE"
      ? ETICHETTE_ECOM
      : objective === "AWARENESS"
        ? ETICHETTE_AWARE
        : objective === "RETARGETING"
          ? ETICHETTE_RETARGET
          : objective === "IN_STORE"
            ? ETICHETTE_STORE
            : objective === "BOOKINGS"
              ? ETICHETTE_BOOK
              : ETICHETTE_LEAD;
  const isMapsUrl =
    objective === "AWARENESS" && isUrlMapsIndicazioni(campagna.website);
  const ctaLabel = ctaLabelDaObjective(objective, campagna.bookingChannel, {
    isMapsUrl,
  });
  const titoloFallback =
    objective === "ECOMMERCE"
      ? "Acquista ora"
      : objective === "AWARENESS"
        ? isMapsUrl
          ? "Ottieni indicazioni"
          : "Scopri di più"
        : objective === "RETARGETING"
          ? "Completa l'ordine"
          : objective === "IN_STORE"
            ? "Ottieni indicazioni"
            : objective === "BOOKINGS"
              ? "Prenota la tua visita"
              : "Richiedi informazioni";

  const testo =
    tab === "A"
      ? campagna.varianteA
      : tab === "B"
        ? campagna.varianteB
        : campagna.varianteC;

  const creativitaPrincipale =
    campagna.creativitaMeta?.find((c) => c.ruolo === "principale") ??
    campagna.creativitaMeta?.[0];
  const storagePath = creativitaPrincipale?.storagePath?.trim() || "";

  useEffect(() => {
    let attivo = true;
    setMediaUrl(null);
    setMediaErrore(false);

    if (!storagePath || !approvalToken.trim()) {
      return () => {
        attivo = false;
      };
    }

    void (async () => {
      try {
        const res = await fetch("/api/approval/creative-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            approvalToken: approvalToken.trim(),
            storagePath,
          }),
        });
        const data = (await res.json()) as {
          signedUrl?: string;
          error?: string;
        };
        if (!attivo) return;
        if (!res.ok || !data.signedUrl) {
          setMediaErrore(true);
          return;
        }
        setMediaUrl(data.signedUrl);
      } catch {
        if (attivo) setMediaErrore(true);
      }
    })();

    return () => {
      attivo = false;
    };
  }, [approvalToken, storagePath]);

  const nome = campagna.nomeCliente.trim() || "Brand";
  const iniziali = nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <section className="rounded-[var(--radius)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
      <h2 className="text-sm font-medium text-[var(--ink)]">
        Anteprima inserzione Meta
      </h2>
      <p className="mt-1 text-xs text-[var(--ink-muted)]">
        Così apparirà l&apos;annuncio nel feed. Scorri le tre varianti di testo.
      </p>

      <div className="mx-auto mt-5 w-full max-w-[340px] overflow-hidden rounded-[28px] border-[6px] border-[#1a1a1a] bg-white shadow-sm">
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

          <div className="mt-3 flex flex-wrap gap-1">
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
                {etichette[v].split("—")[0].trim()}
              </button>
            ))}
          </div>

          <p className="mt-2.5 text-[13px] leading-snug text-[var(--ink)]">
            {testo || "Testo annuncio in preparazione."}
          </p>
        </div>

        <div className="relative aspect-[4/5] w-full bg-[#eef0f3]">
          {mediaUrl ? (
            creativitaPrincipale?.isVideo ? (
              <video
                src={mediaUrl}
                className="h-full w-full object-cover"
                controls
                playsInline
                muted
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaUrl}
                alt="Creatività campagna"
                className="h-full w-full object-cover"
              />
            )
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center">
              <div className="h-16 w-16 rounded-2xl bg-white/80 shadow-sm" />
              <p className="text-xs text-[var(--ink-muted)]">
                {mediaErrore
                  ? "Anteprima creatività non disponibile"
                  : storagePath
                    ? "Caricamento anteprima…"
                    : "Anteprima creatività"}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 bg-[#f3f4f6] px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-[11px] uppercase tracking-wide text-[var(--ink-muted)]">
              {nome}
            </p>
            <p className="truncate text-sm font-medium text-[var(--ink)]">
              {campagna.titoloAnnuncio || titoloFallback}
            </p>
          </div>
          <span className="shrink-0 rounded-md bg-[var(--ink)] px-2.5 py-1.5 text-center text-[10px] leading-tight font-medium text-white sm:text-xs">
            {ctaLabel}
          </span>
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-[var(--ink-muted)]">
        Stai guardando: {etichette[tab]}
      </p>
    </section>
  );
}
