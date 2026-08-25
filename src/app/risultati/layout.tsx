import { AppShell } from "@/components/AppShell";

export default function RisultatiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
