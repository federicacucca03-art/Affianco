"use client";

import type {
  PreLancioAzioneRapida,
  PreLancioDiagnosi,
  PreLancioSeverita,
} from "@/lib/pre-lancio-check";

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

function stileCard(severita: PreLancioSeverita): string {
  switch (severita) {
    case "ok":
      return "border-[#c6e7c8] bg-[#f0faf1]";
    case "consiglio":
      return "border-[#f5e0a8] bg-[#fff9e8]";
    case "errore":
      return "border-[#f5c9b8] bg-[#fff4f0]";
    default:
      return "border-[var(--border)] bg-[var(--surface-hover)]";
  }
}

function emojiSeverita(severita: PreLancioSeverita): string {
  switch (severita) {
    case "ok":
      return "🟢";
    case "consiglio":
      return "🟡";
    case "errore":
      return "🔴";
    default:
      return "ℹ️";
  }
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
    <li
      className={`rounded-xl border px-4 py-3.5 ${stileCard(severita)}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-[var(--ink)]">{titolo}</p>
            <span className="text-xs font-medium text-[var(--ink-muted)]">
              {emojiSeverita(severita)} {etichettaSeverita(severita)}
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink)]">
            {motivazione}
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
            className="shrink-0 rounded-full border border-[var(--ink)]/15 bg-white px-3.5 py-2 text-xs font-medium text-[var(--ink)] shadow-sm transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
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
  const badgeTone =
    diagnosi.tone === "green"
      ? "bg-[#E8F5EE] text-[#3D8B57]"
      : diagnosi.tone === "yellow"
        ? "bg-[#FFF6E5] text-[#9A6700]"
        : "bg-[#FFF0F0] text-[#C45C5C]";

  const emoji =
    diagnosi.tone === "green" ? "🟢" : diagnosi.tone === "yellow" ? "🟡" : "🟠";

  return (
    <>
      <div
        className={`mt-5 inline-flex items-center rounded-full px-4 py-2 text-sm font-medium ${badgeTone}`}
      >
        {emoji} Prontezza Campagna: {diagnosi.score}% — {diagnosi.label}
      </div>

      {diagnosi.stimaAppuntamenti ? (
        <div className="mt-4 rounded-xl border border-[#c6e7c8] bg-[#f0faf1] px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[#3D8B57]">
            Stima Appuntamenti Settimanali
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">
            📅 Stima indicativa: ~
            <span className="font-medium">
              {diagnosi.stimaAppuntamenti.appuntamenti}
            </span>{" "}
            clienti a settimana in struttura con il budget impostato.
          </p>
        </div>
      ) : null}

      {diagnosi.stimaOrdini ? (
        <div className="mt-4 rounded-xl border border-[#c6e7c8] bg-[#f0faf1] px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[#3D8B57]">
            Stima Conversioni &amp; Ordini
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">
            📦 Stima indicativa: ~
            <span className="font-medium">
              {diagnosi.stimaOrdini.ordiniMensili}
            </span>{" "}
            acquisti/mese (modello semplificato budget ÷ CPA).
          </p>
        </div>
      ) : null}

      {diagnosi.stimaCoperturaRetargeting ? (
        <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] px-4 py-4">
          <p className="text-sm leading-relaxed text-[var(--ink-muted)]">
            ℹ️ Copertura retargeting: configurazione a pubblico caldo — verifica
            pixel e audience in Meta prima del lancio.
          </p>
        </div>
      ) : null}

      <ul className="mt-5 space-y-3">
        {diagnosi.checks.map((check) => {
          const bordo =
            check.level === "warning"
              ? "border-[#f5c9b8] bg-[#fff4f0]"
              : check.level === "tip"
                ? "border-[#f0e0a8] bg-[#fffaf0]"
                : "border-[#c6e7c8] bg-[#f0faf1]";
          return (
            <li
              key={check.id}
              className={`rounded-xl border px-4 py-3 text-sm leading-relaxed text-[var(--ink)] ${bordo}`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="min-w-0 flex-1">{check.messaggio}</p>
                {check.azione && onAzioneRapida ? (
                  <button
                    type="button"
                    onClick={() => onAzioneRapida(check.azione!.tipo)}
                    className="shrink-0 rounded-full border border-[var(--ink)]/15 bg-white px-3.5 py-2 text-xs font-medium text-[var(--ink)] shadow-sm transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    {check.azione.etichetta}
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

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
    <div className="mt-5 rounded-xl border border-[#c6d8f0] bg-[#f3f7fc] px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
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
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-[var(--ink-muted)]">STIMA · Bacino</dt>
            <dd className="font-medium">
              ~
              {Math.abs(
                diagnosi.saturazione.popolazioneUnica,
              ).toLocaleString("it-IT")}{" "}
              persone
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-[var(--ink-muted)]">STIMA · Impressions/giorno</dt>
            <dd className="font-medium">
              ~
              {Math.abs(
                diagnosi.saturazione.impressionsGiornaliere,
              ).toLocaleString("it-IT")}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
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

  return (
    <section className="rounded-[var(--radius)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
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
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
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
        <div className="mt-5 flex flex-wrap gap-3">
          <span className="rounded-full border border-[#c6e7c8] bg-[#f0faf1] px-3 py-1.5 text-sm text-[var(--ink)]">
            <span className="font-medium">{diagnosi.riepilogo.ok}</span>{" "}
            controlli OK
          </span>
          <span className="rounded-full border border-[#f5e0a8] bg-[#fff9e8] px-3 py-1.5 text-sm text-[var(--ink)]">
            <span className="font-medium">{diagnosi.riepilogo.consigli}</span>{" "}
            consigli
          </span>
          <span className="rounded-full border border-[#f5c9b8] bg-[#fff4f0] px-3 py-1.5 text-sm text-[var(--ink)]">
            <span className="font-medium">{diagnosi.riepilogo.errori}</span>{" "}
            {diagnosi.riepilogo.errori === 1
              ? "elemento da correggere"
              : "elementi da correggere"}
          </span>
        </div>
      ) : null}

      {operativo ? (
        <>
          <ul className="mt-5 space-y-3">
            {diagnosi.checks.map((check) => {
              const severita = check.severita ?? "consiglio";
              if (severita === "info") {
                return (
                  <li
                    key={check.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] px-4 py-3 text-sm leading-relaxed text-[var(--ink-muted)]"
                  >
                    ℹ️ {check.titolo ?? check.messaggio}
                    {check.motivazione ? (
                      <span className="mt-1 block text-[var(--ink)]">
                        {check.motivazione}
                      </span>
                    ) : null}
                  </li>
                );
              }
              return (
                <CardControlloOperativo
                  key={check.id}
                  titolo={check.titolo ?? check.id}
                  severita={severita}
                  motivazione={check.motivazione ?? check.messaggio}
                  azione={check.azione}
                  onAzione={onAzioneRapida}
                />
              );
            })}
          </ul>

          {diagnosi.saturazione ? (
            <BoxStimaSaturazione diagnosi={diagnosi} />
          ) : null}

          {diagnosi.stimaModelloAwareness &&
          diagnosi.stimaModelloAwareness.impressions > 0 ? (
            <div className="mt-5 rounded-xl border border-[#c6d8f0] bg-[#f3f7fc] px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
                STIMA DEL MODELLO
              </p>
              <dl className="mt-3 space-y-1.5 text-sm text-[var(--ink)]">
                <div className="flex items-baseline justify-between gap-3">
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
                <div className="flex items-baseline justify-between gap-3">
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
            <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">
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
