import { Suspense } from "react";
import { DashboardHome } from "@/components/dashboard/DashboardHome";

export default function HomePage() {
  return (
    <Suspense fallback={<p className="mt-16 text-sm text-[var(--ink-muted)]">Caricamento…</p>}>
      <DashboardHome />
    </Suspense>
  );
}
