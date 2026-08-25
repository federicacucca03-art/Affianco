import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "Affianco — Gestisci le campagne Meta dei tuoi clienti",
  description:
    "Affianco organizza strategia, sostenibilità economica, approvazione, lancio e monitoraggio delle campagne Meta in un unico flusso per freelance e piccole agenzie.",
};

export default function Home() {
  return <LandingPage />;
}
