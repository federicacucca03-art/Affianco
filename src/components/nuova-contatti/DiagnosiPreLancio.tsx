"use client";

import type {
  PreLancioAzioneRapida,
  PreLancioCheckItem,
  PreLancioDiagnosi,
  PreLancioSeverita,
} from "@/lib/pre-lancio-check";
import {
  StatoChip,
  testoSenzaIndicatoreStato,
  type StatoChipKind,
} from "@/components/nuova-contatti/StatoChip";

type Props = {
  diagnosi: PreLancioDiagnosi;
  onAzioneRapida?: (tipo: PreLancioAzioneRapida) => void;
};

function etichettaSeverita(severita: PreLancioSeverita): string {
  switch (severita) {
    case "ok":
      return "OK";
    case "consiglio":
      return "Consiglio";
    case "errore":
      return "Da correggere";
    default:
      return "Info";
  }
}

function sottotitoloSeverita(severita: PreLancioSeverita): string {
  switch (severita) {
    case "ok":
      return "Nessuna azione necessaria";
    case "consiglio":
      return "Puoi procedere, ma Affianco suggerisce una modifica";
    case "errore":
      return "Consigliamo di risolvere questo punto prima del lancio";
    default:
      return "";
  }
}

function chipDaSeverita(severita: PreLancioSeverita): StatoChipKind {
  switch (severita) {
    case "ok":
      return "ok";
    case "consiglio":
      return "watch";
    case "errore":
      return "critico";
    default:
      return "info";
  }
}

function severitaDi(check: PreLancioCheckItem): PreLancioSeverita {
  if (check.severita) return check.severita;
  if (check.level === "ok") return "ok";
  if (check.level === "warning") return "errore";
  if (check.level === "tip") return "consiglio";
  return "info";
}

function CardControlloOperativo({
  titolo,
  severita,
  motivazione,
  azione,
  onAzione,
}: {
  titolo: string;
  severita: PreLancioSeverita;
  motivazione: string;
  azione?: { tipo: PreLancioAzioneRapida; etichetta: string };
  onAzione?: (tipo: PreLancioAzioneRapida) => void;
}) {
  return (
    <li className="aff-panel-white px-4 py-3.5">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-[var(--ink)]">
              {testoSenzaIndicatoreStato(titolo)}
            </p>
            <StatoChip
              kind={chipDaSeverita(severita)}
              label={etichettaSeverita(severita)}
            />
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink)]">
            {testoSenzaIndicatoreStato(motivazione)}
          </p>
          {severita !== "info" ? (
            <p className="mt-1 text-xs text-[var(--ink-muted)]">
              {sottotitoloSeverita(severita)}
            </p>
          ) : null}
        </div>
        {azione && onAzione ? (
          <button
            type="button"
            onClick={() => onAzione(azione.tipo)}
            className="shrink-0 rounded-full bg-white px-3.5 py-2 text-xs font-medium text-[var(--ink)] shadow-[var(--shadow-card)] transition-opacity hover:opacity-90"
          >
            {azione.etichetta}
          </button>
        ) : null}
      </div>
    </li>
  );
}

function LayoutLegacy({
  diagnosi,
  onAzioneRapida,
}: {
  diagnosi: PreLancioDiagnosi;
  onAzioneRapida?: (tipo: PreLancioAzioneRapida) => void;
}) {
  const toneKind =
    diagnosi.tone === "green"
      ? "ok"
      : diagnosi.tone === "yellow"
        ? "watch"
        : "critico";

  const inEvidenza = diagnosi.checks.filter((c) => c.level !== "ok");
  const okChecks = diagnosi.checks.filter((c) => c.level === "ok");

  return (
    <>
      <div className="mt-5">
        <StatoChip
          kind={toneKind}
          label={`Prontezza campagna: ${diagnosi.score}% — ${diagnosi.label}`}
        />
      </div>

      {diagnosi.stimaAppuntamenti ? (
        <div className="aff-panel-white mt-4 px-4 py-4">
          <p className="text-[13px] font-medium text-[var(--primary)]">
            Stima Appuntamenti Settimanali
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">
            Stima indicativa: ~
            <span className="font-medium">
              {diagnosi.stimaAppuntamenti.appuntamenti}
            </span>{" "}
            clienti a settimana in struttura con il budget impostato.
          </p>
        </div>
      ) : null}

      {diagnosi.stimaOrdini ? (
        <div className="aff-panel-white mt-4 px-4 py-4">
          <p className="text-[13px] font-medium text-[var(--primary)]">
            Stima Conversioni &amp; Ordini
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">
            Stima indicativa: ~
            <span className="font-medium">
              {diagnosi.stimaOrdini.ordiniMensili}
            </span>{" "}
            acquisti/mese (modello semplificato budget ÷ CPA).
          </p>
        </div>
      ) : null}

      {diagnosi.stimaCoperturaRetargeting ? (
        <div className="aff-panel-white mt-4 px-4 py-4">
          <div className="flex flex-wrap items-start gap-2">
            <StatoChip kind="info" />
            <p className="min-w-0 flex-1 text-sm leading-relaxed text-[var(--ink-muted)]">
              Copertura retargeting: configurazione a pubblico caldo — verifica
              pixel e audience in Meta prima del lancio.
            </p>
          </div>
        </div>
      ) : null}

      {inEvidenza.length > 0 ? (
        <ul className="mt-5 space-y-3">
          {inEvidenza.map((check) => (
            <li key={check.id} className="aff-panel-white px-4 py-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="flex flex-wrap items-start gap-2">
                  <StatoChip
                    kind={
                      check.level === "warning"
                        ? "critico"
                        : check.level === "tip"
                          ? "watch"
                          : "info"
                    }
                  />
                  <p className="min-w-0 flex-1 text-sm leading-relaxed text-[var(--ink)]">
                    {testoSenzaIndicatoreStato(check.messaggio)}
                  </p>
                </div>
                {check.azione && onAzioneRapida ? (
                  <button
                    type="button"
                    onClick={() => onAzioneRapida(check.azione!.tipo)}
                    className="shrink-0 rounded-full bg-white px-3.5 py-2 text-xs font-medium text-[var(--ink)] shadow-[var(--shadow-card)]"
                  >
                    {check.azione.etichetta}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {okChecks.length > 0 ? (
        <details className="aff-panel-white mt-4 px-4 py-3">
          <summary className="cursor-pointer text-[13px] font-medium text-[var(--ink)]">
            {okChecks.length}{" "}
            {okChecks.length === 1 ? "controllo OK" : "controlli OK"}
          </summary>
          <ul className="mt-2 space-y-2">
            {okChecks.map((check) => (
              <li
                key={check.id}
                className="flex flex-wrap items-start gap-2 text-[13px] leading-relaxed text-[var(--ink-muted)]"
              >
                <StatoChip kind="ok" />
                <span className="min-w-0 flex-1">
                  {testoSenzaIndicatoreStato(check.messaggio)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {diagnosi.saturazione ? (
        <BoxStimaSaturazione diagnosi={diagnosi} />
      ) : null}
    </>
  );
}

function BoxStimaSaturazione({ diagnosi }: { diagnosi: PreLancioDiagnosi }) {
  if (!diagnosi.saturazione) return null;
  const isInstore = diagnosi.objective === "IN_STORE";
  return (
    <div className="aff-panel-white mt-5 px-4 py-4">
      <p className="text-[13px] font-medium text-[var(--primary)]">
        {isInstore
          ? "STIMA · Pressione sul pubblico"
          : "Stima saturazione pubblico"}
      </p>
      <p className="mt-1 text-xs text-[var(--ink-muted)]">
        {isInstore
          ? "Calcolo indicativo basato su raggio, densità media e CPM interno. Non utilizza reach live di Meta."
          : `Modello indicativo (densità locale ~900 ab/km², CPM ${diagnosi.saturazione.cpmUsato}€) — non è un dato certo da Meta.`}
      </p>
      {diagnosi.objective === "AWARENESS" ? (
        <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">
          Stima: ~
          {Math.abs(
            diagnosi.saturazione.impressionsGiornaliere,
          ).toLocaleString("it-IT")}{" "}
          visualizzazioni/giorno · ~
          {Math.abs(
            diagnosi.saturazione.popolazioneUnica,
          ).toLocaleString("it-IT")}{" "}
          residenti nel raggio.
        </p>
      ) : isInstore ? (
        <dl className="mt-3 space-y-1.5 text-sm text-[var(--ink)]">
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-[12rem_1fr] sm:items-baseline">
            <dt className="text-[var(--ink-muted)]">STIMA · Bacino</dt>
            <dd className="font-medium">
              ~
              {Math.abs(
                diagnosi.saturazione.popolazioneUnica,
              ).toLocaleString("it-IT")}{" "}
              persone
            </dd>
          </div>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-[12rem_1fr] sm:items-baseline">
            <dt className="text-[var(--ink-muted)]">STIMA · Impressions/giorno</dt>
            <dd className="font-medium">
              ~
              {Math.abs(
                diagnosi.saturazione.impressionsGiornaliere,
              ).toLocaleString("it-IT")}
            </dd>
          </div>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-[12rem_1fr] sm:items-baseline">
            <dt className="text-[var(--ink-muted)]">STIMA · Giorni al bacino</dt>
            <dd className="font-medium">
              ~{diagnosi.saturazione.giorniSaturazione} giorni
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">
          Stima: il bacino locale potrebbe saturarsi in circa{" "}
          <span className="font-medium">
            {diagnosi.saturazione.giorniSaturazione} giorni
          </span>{" "}
          con budget e raggio attuali (~
          {Math.abs(
            diagnosi.saturazione.popolazioneUnica,
          ).toLocaleString("it-IT")}{" "}
          persone uniche · ~
          {Math.abs(
            diagnosi.saturazione.impressionsGiornaliere,
          ).toLocaleString("it-IT")}{" "}
          impressions/giorno).
        </p>
      )}
    </div>
  );
}

export function DiagnosiPreLancio({ diagnosi, onAzioneRapida }: Props) {
  const operativo = diagnosi.layoutOperativo === true;
  const checks = diagnosi.checks;
  const inEvidenza = checks.filter((c) => {
    const s = severitaDi(c);
    return s === "consiglio" || s === "errore";
  });
  const okChecks = checks.filter((c) => severitaDi(c) === "ok");
  const infoChecks = checks.filter((c) => severitaDi(c) === "info");

  return (
    <section className="aff-panel-white p-5 sm:p-6">
      {operativo ? (
        <header>
          <h2 className="text-base font-medium text-[var(--ink)]">
            Controllo prima di spendere
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--ink-muted)]">
            {diagnosi.objective === "BOOKINGS"
              ? "Affianco controlla che la campagna sia pronta per generare prenotazioni."
              : diagnosi.objective === "ECOMMERCE"
                ? "Verifica che economia, messaggio, destinazione e creatività siano coerenti prima di esportare la campagna."
                : diagnosi.objective === "IN_STORE"
                  ? "Verifica che area, messaggio, destinazione, budget e creatività siano coerenti prima di esportare la campagna."
                  : diagnosi.objective === "RETARGETING"
                    ? "Verifica che messaggio, destinazione, creatività ed economia siano coerenti prima di portare la campagna su Meta."
                    : diagnosi.objective === "AWARENESS"
                      ? "Verifica che messaggio, area, budget e destinazione siano coerenti prima di esportare la campagna."
                : "Affianco ha controllato la campagna prima dell'esportazione su Meta."}
          </p>
        </header>
      ) : (
        <>
          <p className="text-[13px] font-medium text-[var(--primary)]">
            Pre-Flight Check
          </p>
          <h2 className="mt-1 text-base font-medium text-[var(--ink)]">
            Diagnosi Pre-Lancio
          </h2>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            Controllo automatico di sicurezza sui dati inseriti prima
            dell&apos;export Meta.
          </p>
        </>
      )}

      {operativo && diagnosi.riepilogo ? (
        <div className="mt-5 flex flex-wrap gap-2">
          <StatoChip
            kind="ok"
            label={`${diagnosi.riepilogo.ok} controlli OK`}
          />
          <StatoChip
            kind="watch"
            label={`${diagnosi.riepilogo.consigli} consigli`}
          />
          <StatoChip
            kind="critico"
            label={`${diagnosi.riepilogo.errori} ${
              diagnosi.riepilogo.errori === 1
                ? "elemento da correggere"
                : "elementi da correggere"
            }`}
          />
        </div>
      ) : null}

      {operativo ? (
        <>
          {inEvidenza.length > 0 ? (
            <ul className="mt-5 space-y-3">
              {inEvidenza.map((check) => (
                <CardControlloOperativo
                  key={check.id}
                  titolo={check.titolo ?? check.id}
                  severita={severitaDi(check)}
                  motivazione={check.motivazione ?? check.messaggio}
                  azione={check.azione}
                  onAzione={onAzioneRapida}
                />
              ))}
            </ul>
          ) : null}

          {okChecks.length > 0 ? (
            <details className="aff-panel-white mt-4 px-4 py-3">
              <summary className="cursor-pointer text-[13px] font-medium text-[var(--ink)]">
                {okChecks.length}{" "}
                {okChecks.length === 1 ? "controllo OK" : "controlli OK"}
              </summary>
              <ul className="mt-2 space-y-2">
                {okChecks.map((check) => (
                  <li
                    key={check.id}
                    className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--ink-muted)]"
                  >
                    <StatoChip kind="ok" />
                    <span>
                      {testoSenzaIndicatoreStato(
                        check.titolo ?? check.messaggio,
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {infoChecks.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {infoChecks.map((check) => (
                <li
                  key={check.id}
                  className="aff-panel-white px-4 py-3 text-sm leading-relaxed text-[var(--ink-muted)]"
                >
                  <StatoChip kind="info" />
                  <span className="ml-2">
                    {testoSenzaIndicatoreStato(
                      check.titolo ?? check.messaggio,
                    )}
                  </span>
                  {check.motivazione ? (
                    <span className="mt-1 block text-[var(--ink)]">
                      {testoSenzaIndicatoreStato(check.motivazione)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          {diagnosi.saturazione ? (
            <BoxStimaSaturazione diagnosi={diagnosi} />
          ) : null}

          {diagnosi.stimaModelloAwareness &&
          diagnosi.stimaModelloAwareness.impressions > 0 ? (
            <div className="aff-panel-white mt-5 px-4 py-4">
              <p className="text-[13px] font-medium text-[var(--primary)]">
                STIMA DEL MODELLO
              </p>
              <dl className="mt-3 space-y-1.5 text-sm text-[var(--ink)]">
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-[12rem_1fr] sm:items-baseline">
                  <dt className="text-[var(--ink-muted)]">
                    STIMA · Impression
                  </dt>
                  <dd className="font-medium">
                    ~
                    {Math.abs(
                      diagnosi.stimaModelloAwareness.impressions,
                    ).toLocaleString("it-IT")}
                  </dd>
                </div>
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-[12rem_1fr] sm:items-baseline">
                  <dt className="text-[var(--ink-muted)]">
                    STIMA · Copertura indicativa
                  </dt>
                  <dd className="font-medium">
                    ≈{" "}
                    {Math.abs(
                      diagnosi.stimaModelloAwareness.coperturaIndicativa,
                    ).toLocaleString("it-IT")}{" "}
                    persone · stima indicativa
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-xs leading-relaxed text-[var(--ink-muted)]">
                Questi valori derivano da budget, CPM e frequenza media di
                riferimento. Non sono dati live Meta.
              </p>
            </div>
          ) : null}

          {diagnosi.istruzioniMeta ? (
            <div className="aff-panel-white mt-5 px-4 py-4">
              <p className="text-[13px] font-medium text-[var(--ink-muted)]">
                {diagnosi.istruzioniMeta.titolo}
              </p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-[var(--ink)]">
                {diagnosi.istruzioniMeta.voci.map((voce) => (
                  <li key={voce}>{voce}</li>
                ))}
              </ul>
              {diagnosi.istruzioniMeta.notaEvento ? (
                <p className="mt-3 text-sm leading-relaxed text-[var(--ink)]">
                  {diagnosi.istruzioniMeta.notaEvento}
                </p>
              ) : null}
              <p className="mt-3 text-xs leading-relaxed text-[var(--ink-muted)]">
                {diagnosi.istruzioniMeta.microcopy}
              </p>
            </div>
          ) : null}

          {diagnosi.objective === "IN_STORE" ||
          diagnosi.objective === "RETARGETING" ||
          diagnosi.objective === "AWARENESS" ? null : (
          <div className="mt-5 border-t border-[var(--border)] pt-4">
            <p className="text-xs text-[var(--ink-muted)]">
              Indicatore sintetico
            </p>
            <p className="mt-1 text-sm text-[var(--ink)]">
              Prontezza campagna:{" "}
              <span className="font-medium">{diagnosi.score}%</span> —{" "}
              {diagnosi.label}
            </p>
          </div>
          )}
        </>
      ) : (
        <LayoutLegacy diagnosi={diagnosi} onAzioneRapida={onAzioneRapida} />
      )}
    </section>
  );
}
