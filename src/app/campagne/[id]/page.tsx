"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Campagna } from "@/types/campagne";
import { formatDataApprovazione } from "@/types/campagne";
import {
  completaRevisioneCampagnaSuSupabase,
  leggiCampagnaDaSupabase,
  assicuratiTokenApprovazione,
  urlApprovazioneDaToken,
} from "@/lib/campagne-db";
import { assicuraVariantiCampagna } from "@/lib/assicura-varianti";
import {
  logErroreSupabaseDev,
  messaggioErroreSupabase,
} from "@/lib/supabase-errori";
import { hrefModificaConfigurazione } from "@/data/percorsi-nuova-campagna";
import { PannelloAssetStrategia } from "@/components/campagne/PannelloAssetStrategia";
import { PannelloDiagnosiPerformance } from "@/components/campagne/PannelloDiagnosiPerformance";
import { DiarioBordo } from "@/components/campagne/DiarioBordo";
import { etichettaHealth } from "@/lib/control-room";
import { StatoChip, chipDaHealth } from "@/components/nuova-contatti/StatoChip";
import {
  leggiUltimoCheckCampagna,
  type CampaignCheck,
} from "@/lib/campaign-checks-db";
import {
  calculateMaxSustainableBookingCpa,
  calculateMaxSustainableCpl,
  calculateMaxSustainableInStoreCpa,
  calculateMaxSustainableRecoveryCpa,
} from "@/lib/benchmarks";

type TabDettaglio = "asset" | "diagnosi";

function BadgeHealth({ check }: { check: CampaignCheck | null }) {
  if (!check) {
    return <StatoChip kind="pending" label="Mai controllata" />;
  }
  return (
    <StatoChip
      kind={chipDaHealth(check.healthStatus)}
      label={etichettaHealth(check.healthStatus)}
    />
  );
}

function titoloCampagnaBreve(campagna: Campagna): string {
  const grezzo =
    campagna.nomeCampagna ||
    "Richieste Contatto";
  if (/richieste\s+contatto/i.test(grezzo)) return "Richieste Contatto";
  return grezzo;
}

export default function DettaglioCampagnaPage() {
  const params = useParams<{ id: string }>();
  const [campagna, setCampagna] = useState<Campagna | null | undefined>(
    undefined,
  );
  const [tabAttivo, setTabAttivo] = useState<TabDettaglio>("diagnosi");
  const [linkCopiato, setLinkCopiato] = useState(false);
  const [erroreLinkApprovazione, setErroreLinkApprovazione] = useState<
    string | null
  >(null);
  const [revisioneInChiusura, setRevisioneInChiusura] = useState(false);
  const [erroreRevisione, setErroreRevisione] = useState<string | null>(null);
  /** Errore rete/API distinto da record assente. */
  const [erroreCaricamento, setErroreCaricamento] = useState<string | null>(
    null,
  );
  const [diarioRefreshKey, setDiarioRefreshKey] = useState(0);
  const [ultimoCheck, setUltimoCheck] = useState<CampaignCheck | null>(null);

  useEffect(() => {
    let attivo = true;
    setCampagna(undefined);
    setErroreCaricamento(null);
    setUltimoCheck(null);
    setDiarioRefreshKey(0);

    (async () => {
      try {
        const trovata = await leggiCampagnaDaSupabase(params.id);
        if (!attivo) return;
        setErroreCaricamento(null);
        setCampagna(
          trovata
            ? assicuraVariantiCampagna(trovata, { persistiLocale: true })
            : null,
        );
      } catch (e) {
        if (!attivo) return;
        logErroreSupabaseDev("carica_dettaglio_campagna", e);
        setCampagna(null);
        setErroreCaricamento(messaggioErroreSupabase(e, "carica_dettaglio"));
      }
    })();

    return () => {
      attivo = false;
    };
  }, [params.id]);

  useEffect(() => {
    if (!campagna?.id) {
      setUltimoCheck(null);
      return;
    }
    let attivo = true;
    void (async () => {
      try {
        const check = await leggiUltimoCheckCampagna(campagna.id);
        if (attivo) setUltimoCheck(check);
      } catch (e) {
        logErroreSupabaseDev("dettaglio_ultimo_check", e);
        if (attivo) setUltimoCheck(null);
      }
    })();
    return () => {
      attivo = false;
    };
  }, [campagna?.id]);

  const maxCplHeader = useMemo(() => {
    if (!campagna) return 0;
    const objective = campagna.objective ?? "LEADS";
    const margine = campagna.targetMargin ?? 50;
    if (objective === "ECOMMERCE") {
      return campagna.maxSustainableCpa && campagna.maxSustainableCpa > 0
        ? campagna.maxSustainableCpa
        : 0;
    }
    if (objective === "IN_STORE") {
      const receipt =
        campagna.averageReceipt ?? campagna.scontrinoMedio ?? 40;
      const storeMargin = campagna.storeMargin ?? 40;
      return calculateMaxSustainableInStoreCpa(receipt, storeMargin, margine);
    }
    if (objective === "RETARGETING") {
      const valore =
        campagna.recoveryValue ?? campagna.scontrinoMedio ?? 100;
      const recoveryMargin = campagna.recoveryMargin ?? 50;
      const discount = campagna.recoveryDiscount ?? 0;
      return calculateMaxSustainableRecoveryCpa(
        valore,
        recoveryMargin,
        discount,
      );
    }
    if (objective === "AWARENESS") {
      return campagna.estimatedCpm ?? 7;
    }
    if (objective === "BOOKINGS") {
      const ticket =
        campagna.bookingServiceValue ?? campagna.scontrinoMedio ?? 60;
      const tasso =
        campagna.showUpRate ?? campagna.tassoConversionePercent ?? 75;
      return calculateMaxSustainableBookingCpa(ticket, tasso, margine);
    }
    return calculateMaxSustainableCpl(
      campagna.scontrinoMedio ?? 1500,
      campagna.tassoConversionePercent ?? 10,
      margine,
    );
  }, [campagna]);

  async function copiaLinkApprovazione() {
    if (!campagna) return;
    setErroreLinkApprovazione(null);
    try {
      const token = await assicuratiTokenApprovazione(campagna.id);
      const url = urlApprovazioneDaToken(token);
      if (token !== campagna.approvalToken) {
        setCampagna({ ...campagna, approvalToken: token });
      }
      await navigator.clipboard.writeText(url);
      setLinkCopiato(true);
      window.setTimeout(() => setLinkCopiato(false), 2200);
    } catch (e) {
      logErroreSupabaseDev("copia_link_approvazione", e);
      setErroreLinkApprovazione(
        messaggioErroreSupabase(e, "copia_link"),
      );
    }
  }

  async function segnaModificheCompletate() {
    if (!campagna || revisioneInChiusura) return;
    setRevisioneInChiusura(true);
    setErroreRevisione(null);
    try {
      await completaRevisioneCampagnaSuSupabase(campagna.id);
      setCampagna({
        ...campagna,
        status: "DRAFT",
        revisionNotes: undefined,
        stato: "In attesa di approvazione cliente",
      });
    } catch (e) {
      logErroreSupabaseDev("completa_revisione", e);
      setErroreRevisione(messaggioErroreSupabase(e, "azione_approvazione"));
    } finally {
      setRevisioneInChiusura(false);
    }
  }

  if (campagna === undefined) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm text-[var(--ink-muted)]">Caricamento…</p>
      </main>
    );
  }

  if (erroreCaricamento) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/campagne"
          className="text-sm font-medium text-[var(--accent)] transition-opacity hover:opacity-80"
        >
          Torna alle campagne
        </Link>
        <h1 className="mt-4 text-xl font-medium text-[var(--ink)]">
          Campagna non disponibile
        </h1>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">{erroreCaricamento}</p>
      </main>
    );
  }

  if (campagna === null) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/campagne"
          className="text-sm font-medium text-[var(--accent)] transition-opacity hover:opacity-80"
        >
          Torna alle campagne
        </Link>
        <h1 className="mt-4 text-xl font-medium text-[var(--ink)]">
          Campagna non trovata
        </h1>
      </main>
    );
  }

  const settore = campagna.settore || "Attività locale";
  const citta = campagna.citta || "—";
  const budgetGiornaliero = campagna.budgetGiornaliero ?? 20;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <Link
        href="/campagne"
        className="text-sm font-medium text-[var(--accent)] transition-opacity hover:opacity-80"
      >
        Torna alle campagne
      </Link>

      {/* 1. Header di Stato */}
      <header className="mt-5 rounded-[var(--radius)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
        {(campagna.status ?? "").toUpperCase() === "APPROVED" ? (
          <div className="mb-4 rounded-xl border border-[#E8D48A] bg-[#FFF8E7] px-4 py-3">
            <p className="text-sm font-medium text-[#9A7B0A]">
              Approvata dal cliente
              {campagna.approvedAt
                ? ` il ${formatDataApprovazione(campagna.approvedAt)}`
                : ""}
            </p>
          </div>
        ) : null}

        {(campagna.status ?? "").toUpperCase() === "REVISION_REQUESTED" ? (
          <div className="mb-4 rounded-xl border border-[#f5c9b8] bg-[#fff4f0] p-4 sm:p-5">
            <p className="text-sm font-bold text-[#C45C5C]">
              Il cliente ha richiesto una modifica
            </p>
            {campagna.revisionNotes?.trim() ? (
              <div className="mt-3 rounded-xl border border-[var(--border)] bg-white px-4 py-3">
                <p className="text-sm italic leading-relaxed text-[var(--ink)]">
                  Nota: &ldquo;{campagna.revisionNotes.trim()}&rdquo;
                </p>
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-[var(--border)] bg-white/70 px-4 py-3">
                <p className="text-sm text-[var(--ink-muted)]">
                  La richiesta è arrivata, ma la nota testuale non è disponibile.
                  Chiedi al cliente di reinviare il dettaglio.
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={() => void segnaModificheCompletate()}
              disabled={revisioneInChiusura}
              className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-[#3D8B57] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {revisioneInChiusura
                ? "Aggiornamento…"
                : "✅ Modifiche completate — Rimanda in approvazione"}
            </button>
            {erroreRevisione ? (
              <p className="mt-2 text-xs text-[#C45C5C]">{erroreRevisione}</p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
              Diagnosi post-lancio
            </p>
            <h1 className="mt-1 text-2xl font-medium tracking-tight text-[var(--ink)]">
              {campagna.nomeCliente}
              <span className="font-normal text-[var(--ink-muted)]">
                {" "}
                — {titoloCampagnaBreve(campagna)}
              </span>
            </h1>
          </div>
          <BadgeHealth check={ultimoCheck} />
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl bg-[var(--surface-hover)] px-4 py-3">
            <dt className="text-xs text-[var(--ink-muted)]">Settore</dt>
            <dd className="mt-0.5 text-sm font-medium text-[var(--ink)]">
              {settore}
            </dd>
          </div>
          <div className="rounded-xl bg-[var(--surface-hover)] px-4 py-3">
            <dt className="text-xs text-[var(--ink-muted)]">Città</dt>
            <dd className="mt-0.5 text-sm font-medium text-[var(--ink)]">
              {citta}
            </dd>
          </div>
          <div className="rounded-xl bg-[var(--surface-hover)] px-4 py-3">
            <dt className="text-xs text-[var(--ink-muted)]">Budget giornaliero</dt>
            <dd className="mt-0.5 text-sm font-medium text-[var(--ink)]">
              {budgetGiornaliero}€/giorno
            </dd>
          </div>
          <div className="rounded-xl bg-[var(--surface-hover)] px-4 py-3">
            <dt className="text-xs text-[var(--ink-muted)]">
              {campagna.objective === "ECOMMERCE"
                ? "CPA Max (Break-Even)"
                : campagna.objective === "AWARENESS"
                  ? "CPM stimato locale"
                  : campagna.objective === "RETARGETING"
                    ? "CPA recupero sostenibile"
                    : campagna.objective === "IN_STORE"
                      ? "CPA Max sostenibile"
                      : campagna.objective === "BOOKINGS"
                        ? "CPA massimo sostenibile"
                        : "CPL massimo sostenibile"}
            </dt>
            <dd className="mt-0.5 text-sm font-medium text-[var(--ink)]">
              {campagna.objective === "ECOMMERCE" && maxCplHeader <= 0
                ? "Dati economici incompleti"
                : maxCplHeader > 0
                  ? `${maxCplHeader}€`
                  : "—"}
            </dd>
          </div>
        </dl>
      </header>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          onClick={() => void copiaLinkApprovazione()}
          className={`inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${
            linkCopiato
              ? "bg-[#E8F5EE] text-[#3D8B57]"
              : "bg-[var(--accent)] text-white hover:opacity-90"
          }`}
        >
          {linkCopiato
            ? "Link copiato!"
            : "🔗 Copia Link Cliente per Approvazione"}
        </button>
        <Link
          href={hrefModificaConfigurazione(campagna.id, campagna.objective)}
          className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--ink)] transition-colors hover:bg-[var(--surface-hover)]"
        >
          Modifica configurazione
        </Link>
      </div>
      {erroreLinkApprovazione ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {erroreLinkApprovazione}
        </p>
      ) : null}

      <nav
        className="mt-4 flex gap-1 border-b border-[var(--border)]"
        aria-label="Sezioni campagna"
      >
        {(
          [
            { id: "asset" as const, label: "📋 Asset & Strategia" },
            { id: "diagnosi" as const, label: "📊 Diagnosi & Performance" },
          ] as const
        ).map((tab) => {
          const attivo = tabAttivo === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTabAttivo(tab.id)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                attivo
                  ? "border-[var(--accent)] text-[var(--ink)]"
                  : "border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {tabAttivo === "asset" ? (
        <div className="mt-6">
          <PannelloAssetStrategia
            campagna={campagna}
            onEsportata={() => setDiarioRefreshKey((k) => k + 1)}
          />
        </div>
      ) : (
        <PannelloDiagnosiPerformance campagna={campagna} />
      )}

      <DiarioBordo
        campaignId={campagna.id}
        nomeCliente={campagna.nomeCliente}
        nomeCampagna={titoloCampagnaBreve(campagna)}
        refreshKey={diarioRefreshKey}
      />
    </main>
  );
}
