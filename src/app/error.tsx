"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Minimal production-safe error surface (App Router).
 * Never renders stack traces, digests, or raw error payloads to the user.
 */
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[ally-error-boundary]", error?.digest ?? "runtime");
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-[12.5px] font-medium uppercase tracking-[0.06em] text-[var(--primary)]">
        Ally
      </p>
      <h1 className="mt-3 text-[22px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
        Qualcosa non ha funzionato
      </h1>
      <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-[var(--ink-muted)]">
        Non siamo riusciti a caricare questa schermata. Puoi riprovare oppure
        tornare alla Home.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button type="button" className="aff-btn-primary" onClick={unstable_retry}>
          Riprova
        </button>
        <Link href="/home" className="aff-btn-secondary">
          Vai alla Home
        </Link>
      </div>
    </main>
  );
}
