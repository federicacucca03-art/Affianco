"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import type { Cliente, SettoreCliente } from "@/types/clienti";
import { SETTORI } from "@/types/clienti";
import {
  aggiungiCliente,
  leggiClienti,
  salvaBozzaOnboarding,
} from "@/data/clienti-store";
import { nomeCampagnaContatti } from "@/data/defaults-contatti";

const NUOVO = "__nuovo__";

type Props = {
  aperta: boolean;
  onChiudi: () => void;
};

const inputClass =
  "w-full rounded-xl border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)] focus:border-[var(--accent)]";

export function ModaleConfiguraCampagna({ aperta, onChiudi }: Props) {
  const router = useRouter();
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [selezione, setSelezione] = useState("");
  const [nomeCampagna, setNomeCampagna] = useState("");
  const [nomeAttivita, setNomeAttivita] = useState("");
  const [settore, setSettore] = useState<SettoreCliente | "">("");
  const [citta, setCitta] = useState("");

  const modalitaNuovo = selezione === NUOVO;
  const clienteSelezionato = useMemo(
    () => clienti.find((c) => c.id === selezione) ?? null,
    [clienti, selezione],
  );

  useEffect(() => {
    if (!aperta) return;
    setClienti(leggiClienti());
    setSelezione("");
    setNomeCampagna("");
    setNomeAttivita("");
    setSettore("");
    setCitta("");
  }, [aperta]);

  useEffect(() => {
    if (!aperta) return;
    const precedente = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function suTasto(e: KeyboardEvent) {
      if (e.key === "Escape") onChiudi();
    }

    window.addEventListener("keydown", suTasto);
    return () => {
      document.body.style.overflow = precedente;
      window.removeEventListener("keydown", suTasto);
    };
  }, [aperta, onChiudi]);

  useEffect(() => {
    if (clienteSelezionato) {
      setNomeCampagna(nomeCampagnaContatti(clienteSelezionato.nome));
    }
  }, [clienteSelezionato]);

  if (!aperta) return null;

  function vaiAllaCampagna(dati: {
    clienteId: string;
    nomeCliente: string;
    nomeCampagna: string;
    settore: string;
    citta: string;
    sitoWeb?: string;
    note?: string;
    targetType?: Cliente["targetType"];
    targetAge?: Cliente["targetAge"];
  }) {
    salvaBozzaOnboarding(dati);

    const params = new URLSearchParams({
      nomeCliente: dati.nomeCliente,
      settore: dati.settore,
      citta: dati.citta,
      clienteId: dati.clienteId,
    });

    onChiudi();
    router.push(`/campagne/nuova/richieste-contatto?${params.toString()}`);
  }

  function avantiClienteEsistente() {
    if (!clienteSelezionato || !nomeCampagna.trim()) return;
    vaiAllaCampagna({
      clienteId: clienteSelezionato.id,
      nomeCliente: clienteSelezionato.nome,
      nomeCampagna: nomeCampagna.trim(),
      settore: clienteSelezionato.settore,
      citta: clienteSelezionato.citta,
      sitoWeb: clienteSelezionato.sitoWeb,
      note: clienteSelezionato.note,
      targetType: clienteSelezionato.targetType,
      targetAge: clienteSelezionato.targetAge,
    });
  }

  function creaClienteEGenera() {
    if (!nomeAttivita.trim() || !settore || !citta.trim()) return;

    const nuovo = aggiungiCliente({
      nome: nomeAttivita.trim(),
      settore,
      citta: citta.trim(),
    });

    vaiAllaCampagna({
      clienteId: nuovo.id,
      nomeCliente: nuovo.nome,
      nomeCampagna: nomeCampagnaContatti(nuovo.nome),
      settore: nuovo.settore,
      citta: nuovo.citta,
    });
  }

  function tornaAllaSelezione() {
    setSelezione("");
    setNomeAttivita("");
    setSettore("");
    setCitta("");
  }

  const nuovoValido =
    nomeAttivita.trim().length > 0 &&
    settore !== "" &&
    citta.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Chiudi"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onChiudi}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titolo-configura-campagna"
        className="relative z-10 w-full max-w-lg rounded-[var(--radius-lg)] bg-white p-6 shadow-xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="titolo-configura-campagna"
              className="text-lg font-medium text-[var(--ink)]"
            >
              Configura la nuova campagna
            </h2>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              {modalitaNuovo
                ? "Compila il micro brand kit del nuovo cliente."
                : "Scegli un cliente esistente oppure creane uno nuovo."}
            </p>
          </div>
          <button
            type="button"
            onClick={onChiudi}
            aria-label="Chiudi"
            className="rounded-full p-1.5 text-[var(--ink-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="mt-6 space-y-4">
          {!modalitaNuovo ? (
            <>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[var(--ink-muted)]">
                  Cliente
                </span>
                <select
                  value={selezione}
                  onChange={(e) => setSelezione(e.target.value)}
                  className={inputClass}
                >
                  <option value="" disabled>
                    Seleziona un cliente
                  </option>
                  {clienti.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nome}
                    </option>
                  ))}
                  <option value={NUOVO}>+ Aggiungi nuovo cliente...</option>
                </select>
              </label>

              {clienteSelezionato ? (
                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-[var(--ink-muted)]">
                      Nome campagna
                    </span>
                    <input
                      type="text"
                      value={nomeCampagna}
                      onChange={(e) => setNomeCampagna(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={avantiClienteEsistente}
                    disabled={!nomeCampagna.trim()}
                    className="w-full rounded-full bg-[var(--ink)] px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Avanti
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[var(--ink-muted)]">
                  Nome attività / cliente
                </span>
                <input
                  type="text"
                  value={nomeAttivita}
                  onChange={(e) => setNomeAttivita(e.target.value)}
                  placeholder="Es. Idraulico Express"
                  className={inputClass}
                  required
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[var(--ink-muted)]">
                  Settore merceologico
                </span>
                <select
                  value={settore}
                  onChange={(e) =>
                    setSettore(e.target.value as SettoreCliente | "")
                  }
                  className={inputClass}
                  required
                >
                  <option value="" disabled>
                    Seleziona un settore
                  </option>
                  {SETTORI.map((opzione) => (
                    <option key={opzione} value={opzione}>
                      {opzione}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[var(--ink-muted)]">
                  Comune o città della sede
                </span>
                <input
                  type="text"
                  value={citta}
                  onChange={(e) => setCitta(e.target.value)}
                  placeholder="Es. Velletri o Milano"
                  className={inputClass}
                  required
                />
              </label>

              <div className="flex flex-col gap-2.5 sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={creaClienteEGenera}
                  disabled={!nuovoValido}
                  className="flex-1 rounded-full bg-[var(--ink)] px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Crea e genera campagna
                </button>
                <button
                  type="button"
                  onClick={tornaAllaSelezione}
                  className="rounded-full border border-[var(--border)] bg-white px-5 py-3 text-sm font-medium text-[var(--ink)] transition-colors hover:bg-[var(--surface-hover)] sm:min-w-[120px]"
                >
                  Indietro
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
