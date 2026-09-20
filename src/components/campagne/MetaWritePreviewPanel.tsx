"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { MetaWritePreviewResult } from "@/lib/meta/write/types";

type Props = {
  campaignId: string;
};

/**
 * M11A.1 — Dry-run Meta configuration preview.
 * No create. No publish. Status language: Non attiva (PAUSED).
 * BLOCKED FOR WRITE ≠ EMPTY PREVIEW.
 */
export function MetaWritePreviewPanel({ campaignId }: Props) {
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [preview, setPreview] = useState<MetaWritePreviewResult | null>(null);
  const [specialKind, setSpecialKind] = useState<"UNRESOLVED" | "NONE">(
    "UNRESOLVED",
  );

  async function runPreview() {
    if (busy) return;
    setBusy(true);
    setErrore(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token?.trim();
      if (!token) {
        setErrore("Accedi per generare l'anteprima.");
        return;
      }
      const res = await fetch("/api/meta/write-preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          campaignId,
          specialAdCategories:
            specialKind === "NONE"
              ? { kind: "NONE" }
              : { kind: "UNRESOLVED" },
          persist: true,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        preview?: MetaWritePreviewResult;
      };
      if (!res.ok || !json.preview) {
        setErrore(json.error ?? "Anteprima non riuscita.");
        setPreview(null);
        return;
      }
      setPreview(json.preview);
    } catch {
      setErrore("Anteprima non riuscita.");
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 rounded-[12px] border border-[var(--border)] bg-white/70 p-4 sm:p-5">
      <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
        Configurazione Meta
      </h2>
      <p className="mt-1.5 text-[13px] leading-snug text-[var(--ink-muted)]">
        Verifica cosa Ally preparerebbe su Meta. Quando la creazione sarà
        abilitata, campagna e gruppo verranno creati su Meta in stato non
        attivo. Nessuna pubblicazione automatica.
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="text-[12.5px] text-[var(--ink-muted)]">
          Categoria speciale Meta
          <select
            className="ml-2 h-9 rounded-[8px] border border-[var(--border)] bg-white px-2 text-[13px] text-[var(--ink)]"
            value={specialKind}
            onChange={(e) =>
              setSpecialKind(e.target.value === "NONE" ? "NONE" : "UNRESOLVED")
            }
          >
            <option value="UNRESOLVED">Da confermare</option>
            <option value="NONE">Nessuna categoria speciale</option>
          </select>
        </label>
        <button
          type="button"
          className="aff-btn-secondary"
          disabled={busy}
          onClick={() => void runPreview()}
        >
          {busy ? "Preparazione…" : "Verifica configurazione Meta"}
        </button>
        <button
          type="button"
          className="aff-btn-primary opacity-50"
          disabled
          title="Creazione Meta non abilitata in questo milestone"
        >
          Crea su Meta
        </button>
      </div>

      {errore ? (
        <p className="mt-3 text-[13px] text-[var(--danger,#b42318)]">{errore}</p>
      ) : null}

      {preview ? (
        <div className="mt-4 space-y-4 text-[13px] text-[var(--ink)]">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--ink-muted)]">
              Campagna
            </p>
            {preview.summaryIt.campaignLines.length > 0 ? (
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {preview.summaryIt.campaignLines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-[var(--ink-muted)]">
                Anteprima campagna non disponibile.
              </p>
            )}
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--ink-muted)]">
              Gruppo di inserzioni
            </p>
            {preview.summaryIt.adSetLines.length > 0 ? (
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {preview.summaryIt.adSetLines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-[var(--ink-muted)]">
                Anteprima gruppo non disponibile.
              </p>
            )}
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--ink-muted)]">
              Inserzione
            </p>
            <p className="mt-1 text-[var(--ink-muted)]">
              Non inclusa in questo slice — asset/creatività Meta non pronti.
            </p>
          </div>
          {preview.summaryIt.missingLines.length > 0 ? (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--ink-muted)]">
                Da completare
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[var(--ink)]">
                {preview.summaryIt.missingLines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="text-[12px] text-[var(--ink-muted)]">
            {preview.summaryIt.footnote}
          </p>
          {!preview.adsManagementPresent ? (
            <p className="text-[12px] text-[var(--ink-muted)]">
              Manca il permesso per creare campagne su Meta.{" "}
              <span className="font-mono text-[11px]">ads_management</span>{" "}
              assente: puoi verificare la configurazione; la creazione resta
              bloccata.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
