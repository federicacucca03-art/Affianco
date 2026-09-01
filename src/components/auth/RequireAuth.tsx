"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";

/**
 * Protezione UX delle route app.
 * NON sostituisce RLS / ownership sul database (P3).
 *
 * Usa hard navigation (location.replace): router.replace soft-nav
 * da layout client può restare bloccato su “Reindirizzamento…”.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (user) return;
    const next = pathname && pathname !== "/login" ? pathname : "/home";
    const q = new URLSearchParams({ next });
    window.location.replace(`/login?${q.toString()}`);
  }, [loading, user, pathname]);

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[var(--background)] px-4">
        <p className="text-sm text-[var(--ink-muted)]">Verifica accesso…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[var(--background)] px-4">
        <p className="text-sm text-[var(--ink-muted)]">Reindirizzamento al login…</p>
      </div>
    );
  }

  return <>{children}</>;
}
