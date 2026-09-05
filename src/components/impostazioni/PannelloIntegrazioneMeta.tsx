"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  applyMetaImportStart,
  readBearerToken,
  startMetaImportFlow,
} from "@/lib/meta-import-client";

/**
 * Settings Meta entry — import-first, zero-client safe.
 * Auto-provisions a canonical client before OAuth when needed.
 */
export function PannelloIntegrazioneMeta() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function onCollegaMeta() {
    if (busy) return;
    setBusy(true);
    setErrore(null);
    try {
      const token = await readBearerToken();
      if (!token) {
        setErrore("Sessione assente. Accedi di nuovo.");
        return;
      }
      const result = await startMetaImportFlow(null, token);
      applyMetaImportStart(result, (href) => router.push(href));
    } catch (e) {
      setErrore(
        e instanceof Error
          ? e.message
          : "Impossibile avviare il collegamento Meta.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="aff-panel-white mt-8 overflow-hidden">
      <div className="border-b border-[var(--border-soft)] px-5 py-4 sm:px-6">
        <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
          Importa campagne da Meta
        </h2>
        <p className="mt-1 aff-muted">
          Collega Meta e scegli l&apos;account pubblicitario da cui vuoi
          importare le campagne.
        </p>
      </div>
      <div className="px-5 py-5 sm:px-6">
        {errore ? (
          <p className="mb-4 text-sm aff-text-danger" role="alert">
            {errore}
          </p>
        ) : null}
        <button
          type="button"
          className="aff-btn-primary"
          disabled={busy}
          onClick={() => void onCollegaMeta()}
        >
          {busy ? "Apertura…" : "Collega Meta"}
        </button>
        <p className="mt-4 text-sm text-[var(--ink-muted)]">
          Oppure{" "}
          <Link
            href="/home"
            className="font-medium text-[var(--primary)] hover:opacity-80"
          >
            torna a Home
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
