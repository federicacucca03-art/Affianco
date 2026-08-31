"use client";

import { useMemo, useState } from "react";
import type { Campagna } from "@/types/campagne";
import { BottoneCopia } from "@/components/nuova-contatti/BottoneCopia";
import { ModaleGuidaImportMeta } from "@/components/nuova-contatti/ModaleGuidaImportMeta";
import {
  generaCodiceImportMeta,
  scaricaFileMetaCsv,
} from "@/data/meta-import-tsv";
import type { ConfigurazioneContatti } from "@/types/campagne";
import { assicuraVariantiCampagna } from "@/lib/assicura-varianti";
import { logCampagnaEsportata } from "@/lib/campaign-logs";
import { csvMetaHaCopyEsportabile } from "@/data/meta-import-tsv";
import { calculateLaunchReadiness, richiedeModuloContatti } from "@/lib/launch-readiness";
import { calculateStrategicScore } from "@/lib/strategic-score";
import { etichetteExportMeta, raccomandaLancio } from "@/lib/guidance";

type Props = {
  campagna: Campagna;
  onEsportata?: () => void;
};

function configDaCampagna(campagna: Campagna): ConfigurazioneContatti {
  const isBookings = campagna.objective === "BOOKINGS";
  const isEcommerce = campagna.objective === "ECOMMERCE";
  const isInStore = campagna.objective === "IN_STORE";
  const isRetargeting = campagna.objective === "RETARGETING";
  const isAwareness = campagna.objective === "AWARENESS";
  return {
    nomeCliente: campagna.nomeCliente,
    nomeCampagna:
      campagna.nomeCampagna ||
      (isEcommerce
        ? `${campagna.nomeCliente} - Vendite Online`
        : isAwareness
          ? `${campagna.nomeCliente} - Apertura / Lancio`
          : isRetargeting
            ? `${campagna.nomeCliente} - Retargeting / Recupero`
            : isInStore
              ? `${campagna.nomeCliente} - Traffico Negozio`
              : isBookings
                ? `${campagna.nomeCliente} - Prenotazioni`
                : `${campagna.nomeCliente} - Richieste Contatto`),
    budgetGiornaliero: campagna.budgetGiornaliero ?? 20,
    cboAttivo: true,
    raggioKm:
      campagna.awarenessRadiusKm ?? campagna.raggioKm ?? 20,
    etaMin: campagna.etaMin ?? 25,
    etaMax: campagna.etaMax ?? 65,
    genere: "Tutti",
    targetingBroad: true,
    posizionamentiAdvantage: true,
    varianteA: campagna.varianteA ?? "",
    varianteB: campagna.varianteB ?? "",
    varianteC: campagna.varianteC ?? "",
    titoloAnnuncio:
      campagna.titoloAnnuncio ||
      (isEcommerce
        ? "Acquista ora"
        : isAwareness
          ? "Scopri di più"
          : isRetargeting
            ? "Completa l'ordine"
            : isInStore
              ? "Ottieni indicazioni"
              : isBookings
                ? "Prenota subito"
                : "Richiedi informazioni"),
    scontrinoMedio:
      campagna.recoveryValue ??
      campagna.averageReceipt ??
      campagna.averageOrderValue ??
      campagna.bookingServiceValue ??
      campagna.scontrinoMedio ??
      0,
    tassoConversionePercent:
      campagna.showUpRate ??
      campagna.tassoConversionePercent ??
      (isBookings ? 75 : 10),
  };
}

function scaricaCsvMeta(campagna: Campagna) {
  const csv = generaCodiceImportMeta(
    configDaCampagna(campagna),
    campagna.citta,
    campagna.pageId ?? "",
    campagna.formId ?? "",
    campagna.objective ?? "LEADS",
    campagna.bookingChannel,
    campagna.creativitaMeta,
    campagna.objective === "BOOKINGS" &&
      campagna.bookingChannel === "BOOKING_LINK"
      ? campagna.website
      : undefined,
  );
  scaricaFileMetaCsv(csv);
}

const VARIANTI_LEAD = [
  {
    id: "A" as const,
    etichetta: "Variante A - Beneficio Diretto & Promo",
    chiave: "varianteA" as const,
  },
  {
    id: "B" as const,
    etichetta: "Variante B - Autorevolezza & Garanzia",
    chiave: "varianteB" as const,
  },
  {
    id: "C" as const,
    etichetta: "Variante C - Empatico & Risoluzione Problema",
    chiave: "varianteC" as const,
  },
];

const VARIANTI_BOOK = [
  {
    id: "A" as const,
    etichetta: "Variante A - Scarsità Agenda",
    chiave: "varianteA" as const,
  },
  {
    id: "B" as const,
    etichetta: "Variante B - Promo Primo Ingresso",
    chiave: "varianteB" as const,
  },
  {
    id: "C" as const,
    etichetta: "Variante C - Garanzia Zero Anticipo",
    chiave: "varianteC" as const,
  },
];

const VARIANTI_ECOM = [
  {
    id: "A" as const,
    etichetta: "Variante A - Offerta Lancio / Bundle",
    chiave: "varianteA" as const,
  },
  {
    id: "B" as const,
    etichetta: "Variante B - Urgenza & Scarsità",
    chiave: "varianteB" as const,
  },
  {
    id: "C" as const,
    etichetta: "Variante C - Social Proof & Testimonial",
    chiave: "varianteC" as const,
  },
];

const VARIANTI_STORE = [
  {
    id: "A" as const,
    etichetta: "Variante A - Coupon Cassa / Offerta Lampo",
    chiave: "varianteA" as const,
  },
  {
    id: "B" as const,
    etichetta: "Variante B - Evento / Nuovi Arrivi",
    chiave: "varianteB" as const,
  },
  {
    id: "C" as const,
    etichetta: "Variante C - Esclusività Locale / Scarsità",
    chiave: "varianteC" as const,
  },
];

const VARIANTI_RETARGET = [
  {
    id: "A" as const,
    etichetta: "Variante A - Incentivo Diretto",
    chiave: "varianteA" as const,
  },
  {
    id: "B" as const,
    etichetta: "Variante B - FAQ / Risoluzione Dubbi",
    chiave: "varianteB" as const,
  },
  {
    id: "C" as const,
    etichetta: "Variante C - Ultimo Avviso / Scarsità",
    chiave: "varianteC" as const,
  },
];

const VARIANTI_AWARE = [
  {
    id: "A" as const,
    etichetta: "Variante A - Grande Inaugurazione / Evento",
    chiave: "varianteA" as const,
  },
  {
    id: "B" as const,
    etichetta: "Variante B - Promo di Lancio",
    chiave: "varianteB" as const,
  },
  {
    id: "C" as const,
    etichetta: "Variante C - Invito Esclusivo / Open Day",
    chiave: "varianteC" as const,
  },
];

export function PannelloAssetStrategia({ campagna, onEsportata }: Props) {
  const [guidaAperta, setGuidaAperta] = useState(false);
  const campagnaConCopy = useMemo(
    () => assicuraVariantiCampagna(campagna, { persistiLocale: true }),
    [campagna],
  );
  const varianti =
    campagnaConCopy.objective === "ECOMMERCE"
      ? VARIANTI_ECOM
      : campagnaConCopy.objective === "AWARENESS"
        ? VARIANTI_AWARE
        : campagnaConCopy.objective === "RETARGETING"
          ? VARIANTI_RETARGET
          : campagnaConCopy.objective === "IN_STORE"
            ? VARIANTI_STORE
            : campagnaConCopy.objective === "BOOKINGS"
              ? VARIANTI_BOOK
              : VARIANTI_LEAD;

  const website = campagnaConCopy.website?.trim();
  const brief = campagnaConCopy.elevatorPitch?.trim();
  const raggio = campagnaConCopy.raggioKm ?? 20;
  const etaMin = campagnaConCopy.etaMin ?? 25;
  const etaMax = campagnaConCopy.etaMax ?? 65;
  const budget = campagnaConCopy.budgetGiornaliero ?? 20;
  const exportUi = useMemo(() => {
    const haCopy = csvMetaHaCopyEsportabile(campagnaConCopy);
    const launchReadiness = calculateLaunchReadiness({
      fotoCaricata: (campagnaConCopy.creativitaMeta?.length ?? 0) > 0,
      clienteHaApprovato:
        (campagnaConCopy.status ?? "").toUpperCase() === "APPROVED",
      paginaFacebookId: campagnaConCopy.pageId ?? "",
      moduloContattiId: campagnaConCopy.formId ?? "",
      destinationUrl: campagnaConCopy.website,
      objective: campagnaConCopy.objective,
      bookingChannel: campagnaConCopy.bookingChannel,
      haCopySelezionato: haCopy,
      haTitoloAnnuncio: Boolean((campagnaConCopy.titoloAnnuncio ?? "").trim()),
    });
    const ticket = Number(
      campagnaConCopy.averageOrderValue ??
        campagnaConCopy.averageReceipt ??
        campagnaConCopy.recoveryValue ??
        campagnaConCopy.bookingServiceValue ??
        campagnaConCopy.scontrinoMedio ??
        0,
    );
    const strategicScore = calculateStrategicScore({
      budgetGiornaliero: campagnaConCopy.budgetGiornaliero ?? 20,
      settore: campagnaConCopy.settore ?? "",
      citta: campagnaConCopy.citta ?? "",
      ticket: ticket > 0 ? ticket : null,
      conversionRate:
        campagnaConCopy.tassoConversionePercent ??
        campagnaConCopy.showUpRate ??
        null,
      conversionRateSource: campagnaConCopy.conversionRateSource,
      targetMargin:
        campagnaConCopy.targetMargin === 30 ||
        campagnaConCopy.targetMargin === 70
          ? campagnaConCopy.targetMargin
          : 50,
      maxSustainableCpl: campagnaConCopy.maxSustainableCpa ?? null,
      frontEndOffer: campagnaConCopy.frontEndOffer,
      elevatorPitch: campagnaConCopy.elevatorPitch,
      targetType: campagnaConCopy.targetType,
      targetAge: campagnaConCopy.targetAge,
      raggioKm: campagnaConCopy.raggioKm ?? campagnaConCopy.awarenessRadiusKm,
      haCopySelezionato: haCopy,
      copyVarianteA: campagnaConCopy.varianteA,
      titoloAnnuncio: campagnaConCopy.titoloAnnuncio,
      fotoCaricata: (campagnaConCopy.creativitaMeta?.length ?? 0) > 0,
      objective: campagnaConCopy.objective,
      bookingChannel: campagnaConCopy.bookingChannel,
      fase: "completa",
    });
    const raccomandazione = raccomandaLancio({
      strategicScore,
      launchReadiness,
      objective: campagnaConCopy.objective,
    });
    const formRichiesto = richiedeModuloContatti(
      campagnaConCopy.objective,
      campagnaConCopy.bookingChannel,
    );
    return etichetteExportMeta({
      statoLancio: raccomandazione.stato,
      haCopyExport: haCopy,
      pageIdMancante: !(campagnaConCopy.pageId ?? "").trim(),
      formIdMancante: formRichiesto && !(campagnaConCopy.formId ?? "").trim(),
    });
  }, [campagnaConCopy]);

  return (
    <div className="space-y-6">
      <section className="rounded-[var(--radius)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
        <h2 className="text-sm font-medium text-[var(--ink)]">
          Brief e sito web
        </h2>
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-xs font-medium text-[var(--ink-muted)]">
              Brief cliente
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink)]">
              {brief || "Nessun brief salvato per questa campagna."}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-[var(--ink-muted)]">
              Sito web
            </p>
            {website ? (
              <a
                href={
                  website.startsWith("http") ? website : `https://${website}`
                }
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 inline-block text-sm font-medium text-[var(--accent)] transition-opacity hover:opacity-80"
              >
                {website}
              </a>
            ) : (
              <p className="mt-1.5 text-sm text-[var(--ink-muted)]">
                Nessun sito web indicato.
              </p>
            )}
          </div>
          {(campagnaConCopy.pageId || campagnaConCopy.formId) && (
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-[var(--surface-hover)] px-4 py-3">
                <dt className="text-xs text-[var(--ink-muted)]">
                  ID Pagina Meta
                </dt>
                <dd className="mt-0.5 break-all text-sm font-medium text-[var(--ink)]">
                  {campagnaConCopy.pageId || "—"}
                </dd>
              </div>
              <div className="rounded-xl bg-[var(--surface-hover)] px-4 py-3">
                <dt className="text-xs text-[var(--ink-muted)]">
                  ID Modulo Contatti
                </dt>
                <dd className="mt-0.5 break-all text-sm font-medium text-[var(--ink)]">
                  {campagnaConCopy.formId || "—"}
                </dd>
              </div>
            </dl>
          )}
        </div>
      </section>

      <section className="rounded-[var(--radius)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
        <h2 className="text-sm font-medium text-[var(--ink)]">
          Testi annuncio
        </h2>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">
          Gli stessi copy generati in creazione. Tutte e tre le varianti
          finiscono nel CSV Meta (una riga ciascuna).
        </p>
        <div className="mt-4 space-y-3">
          {varianti.map((v, index) => {
            const testo = campagnaConCopy[v.chiave]?.trim() || "";
            return (
              <div
                key={v.id}
                className={`rounded-xl border p-4 ${
                  index === 0
                    ? "border-[var(--accent)]/30 bg-[var(--surface-hover)]"
                    : "border-[var(--border)] bg-white"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[var(--ink)]">
                    {v.etichetta}
                  </p>
                  {testo ? (
                    <BottoneCopia valore={testo} etichetta="Copia testo" />
                  ) : null}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink-muted)]">
                  {testo}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-[var(--radius)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
        <h2 className="text-sm font-medium text-[var(--ink)]">
          Riepilogo target
        </h2>
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-[var(--surface-hover)] px-4 py-3">
            <dt className="text-xs text-[var(--ink-muted)]">Raggio locale</dt>
            <dd className="mt-0.5 text-sm font-medium text-[var(--ink)]">
              {raggio} km
              {campagnaConCopy.citta
                ? ` intorno a ${campagnaConCopy.citta}`
                : ""}
            </dd>
          </div>
          <div className="rounded-xl bg-[var(--surface-hover)] px-4 py-3">
            <dt className="text-xs text-[var(--ink-muted)]">Età</dt>
            <dd className="mt-0.5 text-sm font-medium text-[var(--ink)]">
              {etaMin}–{etaMax} anni
            </dd>
          </div>
          <div className="rounded-xl bg-[var(--surface-hover)] px-4 py-3">
            <dt className="text-xs text-[var(--ink-muted)]">Budget</dt>
            <dd className="mt-0.5 text-sm font-medium text-[var(--ink)]">
              {budget}€/giorno
            </dd>
          </div>
        </dl>
      </section>

      <div className="pb-4">
        <button
          type="button"
          disabled={!exportUi.exportAbilitato}
          onClick={() => {
            if (!exportUi.exportAbilitato) return;
            scaricaCsvMeta(campagnaConCopy);
            setGuidaAperta(true);
            void logCampagnaEsportata(campagna.id).then(() => {
              onEsportata?.();
            });
          }}
          className="inline-flex w-full items-center justify-center rounded-full bg-[var(--ink)] px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
        >
          {exportUi.labelCta}
        </button>
        <p className="mt-2 max-w-xl text-xs leading-relaxed text-[var(--ink-muted)]">
          {exportUi.microcopy}
        </p>
      </div>

      <ModaleGuidaImportMeta
        aperta={guidaAperta}
        onChiudi={() => setGuidaAperta(false)}
      />
    </div>
  );
}
