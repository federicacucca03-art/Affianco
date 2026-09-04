import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";

export default function NotificheLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}
