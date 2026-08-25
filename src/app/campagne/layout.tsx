import { AppShell } from "@/components/AppShell";

export default function CampagneLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
