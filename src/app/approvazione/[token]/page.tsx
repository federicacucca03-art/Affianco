"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import type { Campagna } from "@/types/campagne";
import {
  approvaCampagnaPubblica,
  leggiCampagnaPerApprovazionePubblica,
  richiediRevisioneCampagnaPubblica,
} from "@/lib/campagne-db";
import { assicuraVariantiCampagna } from "@/lib/assicura-varianti";
import {
  logErroreSupabaseDev,
  messaggioErroreSupabase,
} from "@/lib/supabase-errori";
import {
  calculateEcommerceBreakEvenRoas,
  calculateEcommerceTargetRoas,
  calculateImpressionsAwareness,
  calculateMaxSustainableBookingCpa,
  calculateMaxSustainableCpl,
  calculateMaxSustainableInStoreCpa,
  calculateMaxSustainableRecoveryCpa,
  calculatePersoneUnicheAwareness,
  calculateUtilePerScontrino,
} from "@/lib/benchmarks";
import { AnteprimaFeedApprovazione } from "@/components/campagne/AnteprimaFeedApprovazione";
import {
  etichettaMetricaPrimaria,
  etichettaSogliaEconomica,
} from "@/lib/control-room";

export default function ApprovazioneCampagnaPage() {
  const params = useParams<{ token: string }>();
  const approvalCapability = params.token;
  const [campagna, setCampagna] = useState<Campagna | null | undefined>(
    undefined,
  );
  /** Errore di caricamento (rete/config) distinto da record assente. */
  const [erroreCaricamento, setErroreCaricamento] = useState<string | null>(
    null,
  );
  const [azioneInCorso, setAzioneInCorso] = useState(false);
  const [approvata, setApprovata] = useState(false);
  const [revisioneInviata, setRevisioneInviata] = useState(false);
  const [mostraModifica, setMostraModifica] = useState(false);
  const [noteModifica, setNoteModifica] = useState("");
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    let attivo = true;
    setCampagna(undefined);
    setErroreCaricamento(null);
    setApprovata(false);
    setRevisioneInviata(false);
    setMostraModifica(false);
    setNoteModifica("");
    setErrore(null);

    (async () => {
      try {
        const trovata = await leggiCampagnaPerApprovazionePubblica(
          approvalCapability,
        );
        if (!attivo) return;
        if (!trovata) {
          setCampagna(null);
          setErroreCaricamento(null);
          return;
        }
        const conCopy = assicuraVariantiCampagna(trovata, {
          persistiLocale: true,
        });
        setCampagna(conCopy);
        setErroreCaricamento(null);
        const status = (trovata.status ?? "").toUpperCase();
        if (status === "APPROVED") setApprovata(true);
        if (status === "REVISION_REQUESTED") setRevisioneInviata(true);
      } catch (e) {
        if (!attivo) return;
        logErroreSupabaseDev("carica_approvazione", e);
        setCampagna(null);
        setErroreCaricamento(
          messaggioErroreSupabase(e, "carica_approvazione"),
        );
      }
    })();

    return () => {
      attivo = false;
    };
  }, [approvalCapability]);

  const budget = useMemo(
    () => campagna?.budgetGiornaliero ?? 20,
    [campagna],
  );

  const economia = useMemo(() => {
    const empty = {
      cpa: 0,
      roasTarget: 0,
      roasBreakEven: 0,
      utile: 0,
      impressions: 0,
      personeUniche: 0,
      raggioKm: 0,
      haCpaMax: false,
      roasDisponibili: false,
    };
    if (!campagna) return empty;
    const objective = campagna.objective ?? "LEADS";
    const margine = campagna.targetMargin ?? 50;

    if (objective === "ECOMMERCE") {
      const aov =
        campagna.averageOrderValue ?? campagna.scontrinoMedio ?? 0;
      const cpaMax =
        campagna.maxSustainableCpa && campagna.maxSustainableCpa > 0
          ? campagna.maxSustainableCpa
          : 0;
      const haCpaMax = cpaMax > 0;
      const haAov = aov > 0;
      const roasDisponibili = haCpaMax && haAov;
      return {
        ...empty,
        cpa: cpaMax,
        roasBreakEven: roasDisponibili
          ? calculateEcommerceBreakEvenRoas(aov, cpaMax)
          : 0,
        roasTarget: roasDisponibili
          ? calculateEcommerceTargetRoas(aov, cpaMax)
          : 0,
        haCpaMax,
        roasDisponibili,
      };
    }

    if (objective === "IN_STORE") {
      const receipt =
        campagna.averageReceipt ?? campagna.scontrinoMedio ?? 0;
      const storeMargin = campagna.storeMargin ?? 40;
      return {
        ...empty,
        cpa: calculateMaxSustainableInStoreCpa(receipt, storeMargin, margine),
        utile: calculateUtilePerScontrino(receipt, storeMargin),
      };
    }

    if (objective === "RETARGETING") {
      const valore =
        campagna.recoveryValue ?? campagna.scontrinoMedio ?? 0;
      const recoveryMargin = campagna.recoveryMargin ?? 50;
      const discount = campagna.recoveryDiscount ?? 0;
      return {
        ...empty,
        cpa: calculateMaxSustainableRecoveryCpa(
          valore,
          recoveryMargin,
          discount,
        ),
      };
    }

    if (objective === "AWARENESS") {
      const budgetLancio =
        campagna.launchBudget ?? campagna.budgetGiornaliero ?? 0;
      const cpm = campagna.estimatedCpm ?? 7;
      const raggio =
        campagna.awarenessRadiusKm ?? campagna.raggioKm ?? 10;
      return {
        ...empty,
        cpa: cpm,
        impressions: calculateImpressionsAwareness(budgetLancio, cpm),
        personeUniche: calculatePersoneUnicheAwareness(budgetLancio, cpm),
        raggioKm: raggio,
      };
    }

    if (objective === "BOOKINGS") {
      const ticket =
        campagna.bookingServiceValue ?? campagna.scontrinoMedio ?? 0;
      const tasso =
        campagna.showUpRate ?? campagna.tassoConversionePercent ?? 75;
      return {
        ...empty,
        cpa: calculateMaxSustainableBookingCpa(ticket, tasso, margine),
      };
    }

    return {
      ...empty,
      cpa: calculateMaxSustainableCpl(
        campagna.scontrinoMedio ?? 0,
        campagna.tassoConversionePercent ?? 10,
        margine,
      ),
    };
  }, [campagna]);

  const isBookings = campagna?.objective === "BOOKINGS";
  const isEcommerce = campagna?.objective === "ECOMMERCE";
  const isInStore = campagna?.objective === "IN_STORE";
  const isRetargeting = campagna?.objective === "RETARGETING";
  const isAwareness = campagna?.objective === "AWARENESS";
  const cplSostenibile = economia.cpa;

  const bloccata = approvata || revisioneInviata;

  async function approva() {
    if (!campagna || azioneInCorso || bloccata) return;
    setAzioneInCorso(true);
    setErrore(null);
    try {
      const approvedAt = await approvaCampagnaPubblica(approvalCapability);
      setApprovata(true);
      setMostraModifica(false);
      setCampagna((c) =>
        c
          ? {
              ...c,
              status: "APPROVED",
              approvedAt,
              stato: "Approvata dal cliente · pronta al lancio",
            }
          : c,
      );
    } catch (e) {
      logErroreSupabaseDev("approva_campagna", e);
      setErrore(messaggioErroreSupabase(e, "azione_approvazione"));
    } finally {
      setAzioneInCorso(false);
    }
  }

  async function inviaModifica() {
    if (!campagna || azioneInCorso || bloccata) return;
    const notesText = noteModifica.trim();
    if (!notesText) {
      setErrore("Scrivi cosa vorresti modificare prima di inviare.");
      return;
    }
    // Non inviare mai il placeholder UI come nota reale.
    if (notesText === "Nessuna nota aggiuntiva fornita.") {
      setErrore("Scrivi una nota di modifica concreta.");
      return;
    }

    setAzioneInCorso(true);
    setErrore(null);
    try {
      const salvata = await richiediRevisioneCampagnaPubblica(
        approvalCapability,
        notesText,
      );
      setRevisioneInviata(true);
      setMostraModifica(false);
      setNoteModifica("");
      setCampagna((c) =>
        c
          ? {
              ...c,
              status: "REVISION_REQUESTED",
              revisionNotes: salvata,
              stato: "Il cliente ha richiesto modifiche",
            }
          : c,
      );
    } catch (e) {
      logErroreSupabaseDev("richiedi_revisione", e);
      setErrore(messaggioErroreSupabase(e, "azione_approvazione"));
    } finally {
      setAzioneInCorso(false);
    }
  }

  if (campagna === undefined) {
    return (
      <main className="mx-auto flex min-h-full max-w-2xl items-center justify-center px-4 py-16">
        <p className="text-sm text-[var(--ink-muted)]">Caricamento proposta…</p>
      </main>
    );
  }

  if (erroreCaricamento) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-xl font-medium text-[var(--ink)]">
          Proposta non disponibile
        </h1>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">{erroreCaricamento}</p>
      </main>
    );
  }

  if (campagna === null) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-xl font-medium text-[var(--ink)]">
          Proposta non trovata
        </h1>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">
          Il link non è valido oppure la campagna non è più disponibile.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-[var(--background)]">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
          Approvazione campagna
        </p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight text-[var(--ink)]">
          {campagna.nomeCliente}
        </h1>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">
          Rivedi brief e anteprima annuncio, poi autorizza il lancio o chiedi
          una modifica.
        </p>

        <section className="mt-8 rounded-[var(--radius)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-[var(--ink-muted)]">
                Budget giornaliero
              </dt>
              <dd className="mt-1 text-lg font-medium text-[var(--ink)]">
                {budget}€/giorno
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-[var(--ink-muted)]">
                Obiettivo
              </dt>
              <dd className="mt-1 text-lg font-medium text-[var(--ink)]">
                {isEcommerce
                  ? "Vendite online / E-commerce"
                  : isAwareness
                    ? "Awareness / Apertura e lancio locale"
                    : isRetargeting
                      ? "Retargeting"
                      : isInStore
                        ? "Traffico in negozio / Drive-to-store"
                        : isBookings
                          ? "Appuntamenti / Prenotazioni"
                          : "Richieste di contatto"}
              </dd>
            </div>
          </dl>

          <div className="mt-5 border-t border-[var(--border)] pt-5">
            <p className="text-xs font-medium text-[var(--ink-muted)]">
              Brief
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink)]">
              {campagna.elevatorPitch?.trim() ||
                "Nessun brief fornito per questa proposta."}
            </p>
          </div>

          {isEcommerce ? (
            <div className="mt-5 rounded-xl border border-[#c6e7c8] bg-[#f0faf1] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[#3D8B57]">
                Target economico campagna
              </p>
              {!economia.haCpaMax ? (
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">
                  CPA Max non disponibile per questa campagna. Dati economici
                  incompleti.
                </p>
              ) : economia.roasDisponibili ? (
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">
                  CPA Max (Break-Even):{" "}
                  <span className="font-medium">{economia.cpa}€</span>
                  {" · "}
                  Break-Even ROAS:{" "}
                  <span className="font-medium">{economia.roasBreakEven}x</span>
                  {" · "}
                  Target ROAS:{" "}
                  <span className="font-medium">{economia.roasTarget}x</span>
                </p>
              ) : (
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">
                  CPA Max (Break-Even):{" "}
                  <span className="font-medium">{economia.cpa}€</span>
                  {" · "}
                  Break-Even / Target ROAS: dati economici incompleti (manca
                  AOV).
                </p>
              )}
            </div>
          ) : isAwareness && economia.impressions > 0 ? (
            <div className="mt-5 rounded-xl border border-[#c6e7c8] bg-[#f0faf1] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[#3D8B57]">
                {etichettaMetricaPrimaria("AWARENESS")}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">
                {etichettaSogliaEconomica("AWARENESS")}:{" "}
                <span className="font-medium">{economia.cpa}€</span>
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">
                STIMA · Impression: ~
                {economia.impressions.toLocaleString("it-IT")}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--ink)]">
                STIMA · Copertura indicativa: ≈{" "}
                {economia.personeUniche.toLocaleString("it-IT")} · stima
                indicativa
                {economia.raggioKm
                  ? ` (raggio ${economia.raggioKm} km)`
                  : ""}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-[var(--ink-muted)]">
                Stima interna basata su budget, CPM di piano e frequenza media
                di riferimento. Non utilizza dati live Meta.
              </p>
            </div>
          ) : isRetargeting && economia.cpa > 0 ? (
            <div className="mt-5 rounded-xl border border-[#c6e7c8] bg-[#f0faf1] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[#3D8B57]">
                {etichettaMetricaPrimaria("RETARGETING")}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">
                {etichettaSogliaEconomica("RETARGETING")}:{" "}
                <span className="font-medium">{economia.cpa}€</span>
              </p>
            </div>
          ) : isInStore && economia.cpa > 0 ? (
            <div className="mt-5 rounded-xl border border-[#c6e7c8] bg-[#f0faf1] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[#3D8B57]">
                {etichettaMetricaPrimaria("IN_STORE")}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">
                Utile per scontrino:{" "}
                <span className="font-medium">{economia.utile}€</span>
                {" · "}
                {etichettaSogliaEconomica("IN_STORE")}:{" "}
                <span className="font-medium">{economia.cpa}€</span>
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">
                È la soglia economica di riferimento sul costo per risultato
                (proxy). Non misura visite reali in negozio.
              </p>
              <p className="mt-2 text-xs leading-relaxed text-[var(--ink-muted)]">
                Non è una previsione del costo che Meta genererà.
              </p>
            </div>
          ) : cplSostenibile > 0 ? (
            <div className="mt-5 rounded-xl border border-[#c6e7c8] bg-[#f0faf1] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[#3D8B57]">
                {isBookings
                  ? "Soglia di Sostenibilità"
                  : "Soglia di Sostenibilità Aziendale"}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">
                {isBookings ? (
                  <>
                    <span className="font-medium">{cplSostenibile}€</span> per
                    prenotazione confermata.
                  </>
                ) : (
                  <>
                    <span className="font-medium">{cplSostenibile}€</span> a
                    contatto (Soglia economica di riferimento calcolata sui dati
                    inseriti).
                  </>
                )}
              </p>
            </div>
          ) : null}
        </section>

        <div className="mt-6">
          <AnteprimaFeedApprovazione
            campagna={campagna}
            approvalToken={approvalCapability}
          />
        </div>

        <div className="mt-8 space-y-3 pb-8">
          {approvata ? (
            <div className="rounded-[var(--radius)] border border-[#c6e7c8] bg-[#f0faf1] px-5 py-4 text-center">
              <p className="text-sm font-medium text-[#3D8B57]">
                ✅ Campagna approvata. Grazie! Il team può procedere al lancio.
              </p>
            </div>
          ) : revisioneInviata ? (
            <div className="rounded-[var(--radius)] border border-[#f5c9b8] bg-[#fff4f0] px-5 py-4 text-center">
              <p className="text-sm font-medium text-[#C26A0A]">
                Richiesta di modifica inviata con successo.
              </p>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">
                Il team riceverà le tue note e tornerà da te con una nuova
                proposta.
              </p>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void approva()}
                disabled={azioneInCorso}
                className="w-full rounded-full bg-[#3D8B57] px-6 py-3.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {azioneInCorso && !mostraModifica
                  ? "Approvazione in corso…"
                  : "✅ Approva e Autorizza il Lancio"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMostraModifica((v) => !v);
                  setErrore(null);
                }}
                disabled={azioneInCorso}
                className="w-full rounded-full border border-[var(--border)] bg-white px-6 py-3.5 text-sm font-medium text-[var(--ink)] transition-colors hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                💬 Richiedi una Modifica
              </button>

              {mostraModifica ? (
                <div className="rounded-[var(--radius)] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void inviaModifica();
                    }}
                  >
                    <label className="block" htmlFor="revision_notes">
                      <span className="mb-1.5 block text-xs font-medium text-[var(--ink-muted)]">
                        Cosa vorresti modificare?
                      </span>
                      <textarea
                        id="revision_notes"
                        name="revision_notes"
                        value={noteModifica}
                        onChange={(e) => setNoteModifica(e.target.value)}
                        rows={4}
                        required
                        placeholder="Es. Preferirei un tono più formale nella Variante A, e un'immagine del laboratorio…"
                        className="w-full rounded-xl border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)] focus:border-[var(--accent)]"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={azioneInCorso || !noteModifica.trim()}
                      className="mt-3 w-full rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {azioneInCorso ? "Invio in corso…" : "Invia richiesta"}
                    </button>
                  </form>
                </div>
              ) : null}
            </>
          )}
          {errore ? (
            <p className="text-center text-sm text-[#C45C5C]">{errore}</p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
