import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/components/auth/AuthProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Affianco — Gestisci le campagne Meta dei tuoi clienti",
  description:
    "Affianco organizza strategia, sostenibilità economica, approvazione, lancio e monitoraggio delle campagne Meta in un unico flusso per freelance e piccole agenzie.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full font-sans font-normal antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
