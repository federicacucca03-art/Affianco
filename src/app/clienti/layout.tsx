import { AppShell } from "@/components/AppShell";

export default function ClientiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
