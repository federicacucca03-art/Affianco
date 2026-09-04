"use client";

import { useState, type FormEvent } from "react";
import { Download, PenLine } from "lucide-react";
import { AllyFeatureCard } from "@/components/shell/AllyFeatureCard";
import { AllyPanel } from "@/components/shell/AllyPanel";
import { trovaOCreaCliente } from "@/lib/campagne-db";
import { saveClient } from "@/utils/clientStorage";
import {
  logErroreSupabaseDev,
  messaggioErroreSupabase,
} from "@/lib/supabase-errori";

type Props = {
  onCreated: (client: { id: string; name: string }) => void;
  className?: string;
  /** Skip outer panel when already inside Home setup panel. */
  embedded?: boolean;
};

/** Compact first-client form — creates DB + local memory without campaign logic. */
export function FirstClientForm({
  onCreated,
  className = "",
  embedded = false,
}: Props) {
  const [nome, setNome] = useState("");
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = nome.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setErrore(null);
    try {
      const row = await trovaOCreaCliente({ name: trimmed });
      saveClient({
        id: row.id,
        nome: row.name,
        settore: "",
        citta: "",
      });
      onCreated({ id: row.id, name: row.name });
      setNome("");
    } catch (err) {
      logErroreSupabaseDev("first_client_form", err);
      setErrore(
        messaggioErroreSupabase(err, "generico") ||
          "Impossibile salvare il cliente.",
      );
    } finally {
      setBusy(false);
    }
  }

  const form = (
    <form onSubmit={(e) => void submit(e)} className="space-y-3">
      <div>
        <label htmlFor="ally-first-client-name" className="aff-label">
          Nome cliente
        </label>
        <input
          id="ally-first-client-name"
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="aff-input mt-1.5"
          placeholder="Es. Studio Rossi"
          autoComplete="organization"
          required
          disabled={busy}
        />
      </div>
      {errore ? (
        <p className="text-sm aff-text-danger" role="alert">
          {errore}
        </p>
      ) : null}
      <button
        type="submit"
        className="aff-btn-primary"
        disabled={busy || !nome.trim()}
      >
        {busy ? "Salvataggio…" : "Aggiungi il primo cliente"}
      </button>
    </form>
  );

  if (embedded) {
    return <div className={`text-left ${className}`.trim()}>{form}</div>;
  }

  return (
    <AllyPanel variant="compact" className={`text-left ${className}`.trim()}>
      {form}
    </AllyPanel>
  );
}

type StartPathProps = {
  onMeta: () => void;
  onNative: () => void;
};

/** Same AllyFeatureCard + tones as /campagne objective cards. */
export function StartPathCards({ onMeta, onNative }: StartPathProps) {
  return (
    <div className="mx-auto grid w-full max-w-[820px] grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
      <AllyFeatureCard
        tone={4}
        icon={Download}
        title="Importa campagne da Meta"
        body="Porta in Ally le campagne che stai già gestendo."
        onClick={onMeta}
      />
      <AllyFeatureCard
        tone={3}
        icon={PenLine}
        title="Pianifica una nuova campagna"
        body="Costruisci una nuova campagna partendo dall'obiettivo del cliente."
        onClick={onNative}
      />
    </div>
  );
}
