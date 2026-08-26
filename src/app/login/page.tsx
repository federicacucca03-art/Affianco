import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-full items-center justify-center bg-[var(--background)] px-4 py-12">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--ink-muted)]">Caricamento…</p>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
