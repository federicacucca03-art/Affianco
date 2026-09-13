import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "Ally — Sai sempre quale campagna guardare",
  description:
    "Ally è il workspace operativo per freelance e micro-agenzie che gestiscono Meta Ads per clienti. Pianifica, approva, collega Meta e capisci cosa fare dopo.",
};

export default function Home() {
  return <LandingPage />;
}
