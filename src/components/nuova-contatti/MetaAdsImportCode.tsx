"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, ClipboardCopy, Download } from "lucide-react";
import type {
  BookingChannel,
  CampagnaObjective,
  ConfigurazioneContatti,
  TargetType,
} from "@/types/campagne";
import type { CreativitaMeta } from "@/lib/creativita";
import {
  generaCodiceImportMeta,
  scaricaFileMetaCsv,
} from "@/data/meta-import-tsv";
import { ModaleGuidaImportMeta } from "@/components/nuova-contatti/ModaleGuidaImportMeta";
import { logCampagnaEsportata } from "@/lib/campaign-logs";
import type { StatoApprovazioneLeads } from "@/components/nuova-contatti/StatoApprovazioneLeads";

type Props = {
  config: ConfigurazioneContatti;
  citta?: string;
  pageId?: string;
  formId?: string;
  objective?: CampagnaObjective;
  bookingChannel?: BookingChannel;
  creativitaMeta?: CreativitaMeta[];
  destinationUrl?: string;
  whatsappNumber?: string;
  targetType?: TargetType;
  /** Se presente, registra l'export nel Diario di Bordo. */
  campaignId?: string;
  /** Layout step 6 LEADS: export prominente, dettagli CSV collassabili. */
  layoutLeads?: boolean;
  /** Layout step 6 campagna pronta (BOOKINGS e futuri percorsi). */
  layoutCampagnaPronta?: boolean;
  statoApprovazione?: StatoApprovazioneLeads;
};

function descrizioneCsvObjective(
  objective: CampagnaObjective,
  bookingChannel?: BookingChannel,
): string {
  const base =
    objective === "ECOMMERCE"
      ? "Ad Set nazionale (mercato + età)"
      : "Ad Set locale (raggio + età)";
  const suffix =
    objective === "ECOMMERCE"
      ? " · Sales/Purchase, CTA SHOP_NOW, Advantage+ off."
      : objective === "AWARENESS"
        ? " · Outcome Awareness, CTA LEARN_MORE o GET_DIRECTIONS (se sede/mappa), Advantage+ off."
        : objective === "RETARGETING"
          ? " · Retargeting Sales, CTA SHOP_NOW (LEARN_MORE se B2B), Advantage+ off."
          : objective === "IN_STORE"
            ? " · Traffic, CTA GET_DIRECTIONS, Advantage+ off."
            : objective === "BOOKINGS"
              ? ` · canale ${bookingChannel ?? "WHATSAPP"}, Advantage+ off.`
              : " (no auto-music, crop, text variations).";
  return `CSV con Campagna, ${base}, 3 varianti testo e Advantage+ Creative disattivato${suffix}`;
}

export function MetaAdsImportCode({
  config,
  citta,
  pageId = "",
  formId = "",
  objective = "LEADS",
  bookingChannel,
  creativitaMeta,
  destinationUrl,
  whatsappNumber,
  targetType,
  campaignId,
  layoutLeads = false,
  layoutCampagnaPronta = false,
  statoApprovazione,
}: Props) {
  const usaLayoutCampagnaPronta = layoutCampagnaPronta || layoutLeads;
  const [copiato, setCopiato] = useState(false);
  const [guidaAperta, setGuidaAperta] = useState(false);
  const csvContent = useMemo(
    () =>
      generaCodiceImportMeta(
        config,
        citta,
        pageId,
        formId,
        objective,
        bookingChannel,
        creativitaMeta,
        destinationUrl,
        whatsappNumber,
        targetType,
      ),
    [
      config,
      citta,
      pageId,
      formId,
      objective,
      bookingChannel,
      creativitaMeta,
      destinationUrl,
      whatsappNumber,
      targetType,
    ],
  );

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(csvContent);
      setCopiato(true);
      window.setTimeout(() => setCopiato(false), 2000);
    } catch {
      // Ignora se clipboard non disponibile.
    }
  }

  function scaricaFileCsv() {
    scaricaFileMetaCsv(csvContent);
    setGuidaAperta(true);
    if (campaignId) {
      void logCampagnaEsportata(campaignId);
    }
  }

  const approvata = statoApprovazione === "approvata";
  const mostraWarningApprovazione =
    usaLayoutCampagnaPronta &&
    statoApprovazione != null &&
    statoApprovazione !== "approvata";

  const bloccoDettagliTecnici = (
    <>
      <div className="mb-3">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
          {usaLayoutCampagnaPronta
            ? "Controlli importazione Meta"
            : "Importazione massiva · Anti-Fuffa"}
        </p>
        <h3 className="mt-1 text-sm font-medium text-[var(--ink)]">
          Meta Ads Import Code
        </h3>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">
          {usaLayoutCampagnaPronta
            ? "Verifica le impostazioni dopo l'importazione prima di pubblicare la campagna."
            : descrizioneCsvObjective(objective, bookingChannel)}
        </p>
      </div>

      <button
        type="button"
        onClick={() => void handleCopy()}
        className="mb-3 flex w-full items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--ink)] transition-colors hover:bg-[var(--surface-hover)]"
      >
        {copiato ? (
          <>
            <Check className="h-4 w-4" strokeWidth={2} />
            Codice copiato!
          </>
        ) : (
          <>
            <ClipboardCopy className="h-4 w-4" strokeWidth={1.75} />
            Copia codice negli appunti
          </>
        )}
      </button>

      <div className="w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
        <div className="border-b border-white/10 px-4 py-2">
          <p className="font-mono text-xs text-zinc-400">
            {usaLayoutCampagnaPronta
              ? "campagna_meta_import.csv"
              : "campagna_meta_antifuffa.csv"}
          </p>
        </div>
        <pre className="max-h-64 w-full overflow-x-auto whitespace-pre p-4 font-mono text-xs text-zinc-100">
          {csvContent}
        </pre>
      </div>
    </>
  );

  if (usaLayoutCampagnaPronta) {
    return (
      <>
        <section className="min-w-0 rounded-[var(--radius)] border border-[var(--ink)]/10 bg-white p-5 shadow-[var(--shadow-soft)]">
          {mostraWarningApprovazione ? (
            <div className="mb-4 rounded-xl border border-[#f5e0a8] bg-[#fff9e8] px-4 py-3.5">
              <p className="text-sm font-medium text-[var(--ink)]">
                La campagna non è ancora approvata dal cliente.
              </p>
            </div>
          ) : null}

          {approvata ? (
            <p className="mb-4 text-sm font-medium text-[#2D6A4A]">
              Campagna approvata dal cliente.
            </p>
          ) : null}

          <button
            type="button"
            onClick={scaricaFileCsv}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-5 py-3.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <Download className="h-4 w-4" strokeWidth={1.75} />
            Esporta Campagna Pronta per Meta
          </button>
          <p className="mt-2 text-center text-xs text-[var(--ink-muted)]">
            Al download si apre la guida passo-passo per Ads Manager.
          </p>
          {objective === "RETARGETING" ? (
            <p className="mt-3 text-center text-xs leading-relaxed text-[var(--ink-muted)]">
              L&apos;export prepara struttura, obiettivo, evento e impostazioni
              principali della campagna. La Custom Audience non viene collegata
              automaticamente.
            </p>
          ) : null}
          {objective === "AWARENESS" ? (
            <p className="mt-3 text-center text-xs leading-relaxed text-[var(--ink-muted)]">
              L&apos;export prepara struttura, obiettivo e impostazioni
              principali della campagna. Reach, click e frequenza effettivi
              dipenderanno dalla delivery Meta.
            </p>
          ) : null}

          <details className="group mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
              <span className="text-sm font-medium text-[var(--ink)]">
                Mostra dettagli tecnici
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-[var(--ink-muted)] transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-[var(--border)] px-4 pt-4 pb-4">
              {bloccoDettagliTecnici}
            </div>
          </details>
        </section>

        <ModaleGuidaImportMeta
          aperta={guidaAperta}
          onChiudi={() => setGuidaAperta(false)}
        />
      </>
    );
  }

  return (
    <>
      <section className="min-w-0 rounded-[var(--radius)] border border-[var(--ink)]/10 bg-white p-5 shadow-[var(--shadow-soft)]">
        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
            Importazione massiva · Anti-Fuffa
          </p>
          <h2 className="mt-1 text-base font-medium text-[var(--ink)]">
            Meta Ads Import Code
          </h2>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            {descrizioneCsvObjective(objective, bookingChannel)}
          </p>
        </div>

        <div className="mb-4 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={scaricaFileCsv}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-5 py-3.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <Download className="h-4 w-4" strokeWidth={1.75} />
            🚀 Esporta Campagna Pronta per Meta
          </button>

          <button
            type="button"
            onClick={() => void handleCopy()}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-white px-5 py-3 text-sm font-medium text-[var(--ink)] transition-colors hover:bg-[var(--surface-hover)]"
          >
            {copiato ? (
              <>
                <Check className="h-4 w-4" strokeWidth={2} />
                Codice copiato!
              </>
            ) : (
              <>
                <ClipboardCopy className="h-4 w-4" strokeWidth={1.75} />
                Copia codice negli appunti
              </>
            )}
          </button>
          <p className="text-center text-xs text-[var(--ink-muted)]">
            Al download si apre la guida passo-passo per Ads Manager.
          </p>
        </div>

        <div className="w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
          <div className="border-b border-white/10 px-4 py-2">
            <p className="font-mono text-xs text-zinc-400">
              campagna_meta_antifuffa.csv
            </p>
          </div>
          <pre className="max-h-64 w-full overflow-x-auto whitespace-pre p-4 font-mono text-xs text-zinc-100">
            {csvContent}
          </pre>
        </div>
      </section>

      <ModaleGuidaImportMeta
        aperta={guidaAperta}
        onChiudi={() => setGuidaAperta(false)}
      />
    </>
  );
}
