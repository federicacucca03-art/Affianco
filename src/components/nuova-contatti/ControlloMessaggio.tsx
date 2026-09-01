"use client";

import type { ControlloMessaggioRisultato } from "@/lib/controllo-messaggio";
import { chipDaEmoji, RigaDiagnostica } from "@/components/nuova-contatti/StatoChip";

type Props = {
  risultato: ControlloMessaggioRisultato;
  /** Copy introduttivo per percorso. */
  variant?:
    | "leads"
    | "bookings"
    | "ecommerce"
    | "instore"
    | "retargeting"
    | "awareness";
};

export function ControlloMessaggio({ risultato, variant = "leads" }: Props) {
  const titolo =
    variant === "ecommerce" ||
    variant === "instore" ||
    variant === "retargeting" ||
    variant === "awareness"
      ? "Controllo del messaggio"
      : "Controllo messaggio";
  const sottotitolo =
    variant === "awareness"
      ? "Verifica che il messaggio spieghi cosa sta aprendo, dove e perché vale la pena scoprirlo — senza promo o urgenza inventate."
      : variant === "retargeting"
      ? "Verifica che l'annuncio dia un motivo per tornare senza promo inventate o tono invasivo."
      : variant === "instore"
      ? "Verifica che l'annuncio dica chiaramente dove trovarti, perché venire e quale azione deve fare l'utente."
      : variant === "ecommerce"
      ? "Verifica che l'annuncio dica chiaramente cosa vendi, perché conviene e cosa deve fare l'utente."
      : variant === "bookings"
        ? "Verifiche su invito a prenotare, CTA, urgenza e facilità — rivedi prima del lancio."
        : "Verifiche automatiche su hook, beneficio, CTA e lunghezza — rivedi e correggi prima del lancio.";

  return (
    <div className="aff-panel-lilac mt-4 p-5">
      <p className="text-[13px] font-medium text-[var(--primary)]">{titolo}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-muted)]">
        {sottotitolo}
      </p>
      <ul className="mt-4 overflow-hidden rounded-[16px] bg-white px-4">
        {risultato.voci.map((voce) => (
          <RigaDiagnostica
            key={voce.id}
            voce={voce.label}
            kind={chipDaEmoji(voce.emoji)}
            spiegazione={voce.messaggio}
          />
        ))}
      </ul>
      {risultato.notaLunghezza ? (
        <p className="mt-3 text-[13px] leading-relaxed text-[var(--ink-muted)]">
          {risultato.notaLunghezza}
        </p>
      ) : null}
    </div>
  );
}
