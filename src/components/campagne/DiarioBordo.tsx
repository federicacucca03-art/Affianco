"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import {
  etichettaEvento,
  formatDataOraLog,
  generaTestoStoricoAttivita,
  leggiLogCampagna,
  registraEventoCampagna,
  stileBadgeEvento,
  type CampaignLog,
} from "@/lib/campaign-logs";

type Props = {
  campaignId: string;
  nomeCliente: string;
  nomeCampagna: string;
  /** Incrementa per forzare un reload (es. dopo log esterni). */
  refreshKey?: number;
};

export function DiarioBordo({
  campaignId,
  nomeCliente,
  nomeCampagna,
  refreshKey = 0,
}: Props) {
  const [logs, setLogs] = useState<CampaignLog[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [nota, setNota] = useState("");
  const [salvataggioNota, setSalvataggioNota] = useState(false);
  const [erroreNota, setErroreNota] = useState<string | null>(null);
  const [storicoCopiato, setStoricoCopiato] = useState(false);

  useEffect(() => {
    let attivo = true;
    setCaricamento(true);
    void (async () => {
      try {
        const lista = await leggiLogCampagna(campaignId);
        if (attivo) setLogs(lista);
      } catch {
        if (attivo) setLogs([]);
      } finally {
        if (attivo) setCaricamento(false);
      }
    })();
    return () => {
      attivo = false;
    };
  }, [campaignId, refreshKey]);

  async function aggiungiNota() {
    const testo = nota.trim();
    if (!testo || salvataggioNota) return;
    setSalvataggioNota(true);
    setErroreNota(null);
    try {
      const creato = await registraEventoCampagna({
        campaignId,
        eventType: "NOTE_ADDED",
        title: "Nota media buyer",
        description: testo,
      });
      setLogs((prev) => [creato, ...prev.filter((l) => l.id !== creato.id)]);
      setNota("");
    } catch (e) {
      setErroreNota(
        e instanceof Error
          ? e.message
          : "Non riesco a salvare la nota. Riprova.",
      );
    } finally {
      setSalvataggioNota(false);
    }
  }

  async function copiaStorico() {
    const testo = generaTestoStoricoAttivita({
      nomeCliente,
      nomeCampagna,
      logs,
    });
    try {
      await navigator.clipboard.writeText(testo);
      setStoricoCopiato(true);
      window.setTimeout(() => setStoricoCopiato(false), 1800);
    } catch {
      // Clipboard non disponibile.
    }
  }

  return (
    <section className="aff-panel-white mt-6 mb-8 p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
            Audit trail
          </p>
          <h2 className="mt-1 text-base font-medium text-[var(--ink)]">
            Diario di Bordo &amp; Storico Decisioni
          </h2>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            Cronologia trasparente di creazione, approvazioni, export, diagnosi e
            note operative.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void copiaStorico()}
          className="aff-btn-secondary shrink-0"
        >
          {storicoCopiato ? (
            <>
              <Check className="h-4 w-4" strokeWidth={2} />
              Storico copiato!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" strokeWidth={1.75} />
              Copia Storico Attività
            </>
          )}
        </button>
      </div>

      <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] p-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-[var(--ink-muted)]">
            Nota rapida (media buyer)
          </span>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={2}
            placeholder='Es. "Il cliente ha chiesto di abbassare il budget a 15€/giorno causa ferie"'
            className="aff-input"
          />
        </label>
        {erroreNota ? (
          <p className="mt-2 text-xs text-[#C45C5C]">{erroreNota}</p>
        ) : null}
        <button
          type="button"
          onClick={() => void aggiungiNota()}
          disabled={salvataggioNota || !nota.trim()}
          className="aff-btn-primary mt-3"
        >
          {salvataggioNota ? "Salvataggio…" : "Aggiungi nota al diario"}
        </button>
      </div>

      {caricamento ? (
        <p className="mt-5 text-sm text-[var(--ink-muted)]">
          Caricamento diario…
        </p>
      ) : logs.length === 0 ? (
        <p className="mt-5 text-sm text-[var(--ink-muted)]">
          Nessun evento ancora. Gli eventi automatici (creazione, approvazione,
          export, metriche, diagnosi) e le tue note compariranno qui.
        </p>
      ) : (
        <ol className="relative mt-6 space-y-0 border-l-2 border-[var(--border)] pl-5">
          {logs.map((log) => (
            <li key={log.id} className="relative pb-6 last:pb-0">
              <span
                className="absolute top-1.5 -left-[1.35rem] h-3 w-3 rounded-full border-2 border-[var(--border)] bg-white"
                aria-hidden
              />
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={stileBadgeEvento(log.eventType)}
                >
                  {etichettaEvento(log.eventType)}
                </span>
                <time
                  dateTime={log.createdAt}
                  className="text-xs text-[var(--ink-muted)]"
                >
                  {formatDataOraLog(log.createdAt)}
                </time>
              </div>
              <p className="mt-1.5 text-sm font-medium text-[var(--ink)]">
                {log.title}
              </p>
              {log.description ? (
                <p className="mt-1 text-sm leading-relaxed text-[var(--ink-muted)]">
                  {log.description}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
