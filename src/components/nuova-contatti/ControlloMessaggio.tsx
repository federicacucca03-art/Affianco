"use client";

import type { ControlloMessaggioRisultato } from "@/lib/controllo-messaggio";

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

function RigaControllo({
  label,
  emoji,
  messaggio,
}: {
  label: string;
  emoji: string;
  messaggio: string;
}) {
  return (
    <li className="flex items-start justify-between gap-3 text-xs leading-relaxed">
      <span className="text-[var(--ink-muted)]">{label}</span>
      <span className="min-w-0 text-right text-[var(--ink)]">
        <span className="mr-1.5" aria-hidden>
          {emoji}
        </span>
        {messaggio}
      </span>
    </li>
  );
}

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
    <div className="mt-4 rounded-xl border border-[#c6d8f0] bg-[#f8fafc] p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
        {titolo}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--ink-muted)]">
        {sottotitolo}
      </p>
      <ul className="mt-3 space-y-2.5 border-t border-[#c6d8f0] pt-3">
        {risultato.voci.map((voce) => (
          <RigaControllo
            key={voce.id}
            label={voce.label}
            emoji={voce.emoji}
            messaggio={voce.messaggio}
          />
        ))}
      </ul>
      {risultato.notaLunghezza ? (
        <p className="mt-3 border-t border-[#c6d8f0] pt-3 text-xs leading-relaxed text-[var(--ink-muted)]">
          {risultato.notaLunghezza}
        </p>
      ) : null}
    </div>
  );
}
