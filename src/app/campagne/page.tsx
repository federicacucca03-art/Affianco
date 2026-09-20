"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Link2, Plus } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  applyMetaImportStart,
  readBearerToken,
  startMetaImportFlow,
} from "@/lib/meta-import-client";
import { ListaCampagne } from "@/components/ListaCampagne";

/**
 * Campagne = inventory / management.
 * Creation lives at /campagne/nuova (Nuova campagna).
 */
export default function CampagnePage() {
  const router = useRouter();
  const { session } = useAuth();
  const [importBusy, setImportBusy] = useState(false);

  async function onImportMeta() {
    if (importBusy) return;
    setImportBusy(true);
    try {
      const token =
        session?.access_token?.trim() || (await readBearerToken()) || "";
      if (!token) return;
      const result = await startMetaImportFlow(null, token);
      applyMetaImportStart(result, (href) => router.push(href));
    } finally {
      setImportBusy(false);
    }
  }

  return (
    <main className="aff-page">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="aff-page-title sm:text-[24px]">Campagne</h1>
          <p className="aff-page-subtitle mt-1.5 max-w-2xl sm:text-[15px]">
            Gestisci tutte le campagne dei tuoi clienti, create in Ally o
            importate da Meta.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/campagne/nuova"
            className="aff-btn-primary inline-flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Nuova campagna
          </Link>
          <button
            type="button"
            className="aff-btn-secondary inline-flex items-center gap-1.5"
            onClick={() => void onImportMeta()}
            disabled={importBusy}
          >
            <Link2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            {importBusy ? "Preparazione…" : "Importa da Meta"}
          </button>
        </div>
      </header>

      <section className="mt-6 sm:mt-8">
        <ListaCampagne
          onImportMeta={() => void onImportMeta()}
          importBusy={importBusy}
        />
      </section>
    </main>
  );
}
