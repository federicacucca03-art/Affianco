"use client";

import type { CreativitaAsset } from "@/lib/creativita";
import { aspectRatioMetaOk } from "@/lib/creativita";
import {
  chipDaEmoji,
  RigaDiagnostica,
} from "@/components/nuova-contatti/StatoChip";

type Props = {
  creativita: CreativitaAsset[];
  haCopy: boolean;
  indiceAnteprima: number;
};

type Voce = {
  label: string;
  emoji: "🟢" | "🟡" | "⚪";
  messaggio: string;
};

export function ControlloFormatoCreativita({
  creativita,
  haCopy,
  indiceAnteprima,
}: Props) {
  const attiva = creativita[indiceAnteprima] ?? creativita[0] ?? null;

  const voci: Voce[] = [];

  if (creativita.length === 0) {
    voci.push(
      {
        label: "Formato",
        emoji: "⚪",
        messaggio: "Da verificare — carica una creatività",
      },
      {
        label: "Dimensioni",
        emoji: "⚪",
        messaggio: "Da verificare",
      },
      {
        label: "Safe area",
        emoji: "⚪",
        messaggio: "Da verificare",
      },
      {
        label: "Anteprima mobile",
        emoji: haCopy ? "🟡" : "⚪",
        messaggio: haCopy
          ? "In attesa della creatività"
          : "Da verificare — copy e immagine",
      },
    );
  } else {
    const immagini = creativita.filter((c) => !c.isVideo);
    const tutteOk =
      immagini.length === 0 ||
      immagini.every((c) => !c.avvisoFormato && !c.formatoOrizzontale);
    const qualcheProblema = creativita.some(
      (c) => c.avvisoFormato || c.formatoOrizzontale,
    );

    voci.push({
      label: "Formato",
      emoji: tutteOk ? "🟢" : qualcheProblema ? "🟡" : "🟢",
      messaggio: tutteOk
        ? "Compatibile (1:1, 4:5 o 9:16)"
        : "Un asset da ottimizzare",
    });

    if (attiva) {
      const ratioOk =
        attiva.isVideo ||
        aspectRatioMetaOk(attiva.width, attiva.height);
      voci.push({
        label: "Dimensioni",
        emoji: ratioOk ? "🟢" : "🟡",
        messaggio: `${attiva.width}×${attiva.height} px`,
      });
    } else {
      voci.push({
        label: "Dimensioni",
        emoji: "⚪",
        messaggio: "Da verificare",
      });
    }

    const safeAreaIncerta = creativita.some(
      (c) => !c.isVideo && (c.avvisoFormato || c.formatoOrizzontale),
    );
    voci.push({
      label: "Safe area",
      emoji: safeAreaIncerta ? "🟡" : attiva ? "🟢" : "⚪",
      messaggio: safeAreaIncerta
        ? "Da verificare su mobile (ritaglio possibile)"
        : attiva
          ? "Nessun alert di ritaglio rilevato"
          : "Da verificare",
    });

    voci.push({
      label: "Anteprima mobile",
      emoji: haCopy && creativita.length > 0 ? "🟢" : "🟡",
      messaggio:
        haCopy && creativita.length > 0
          ? "Pronta — controlla il mockup a destra"
          : haCopy
            ? "Carica almeno un asset"
            : "Completa il copy al Passo 3",
    });
  }

  return (
    <div className="aff-panel-white p-5">
      <p className="text-[13px] font-medium text-[var(--primary)]">
        Controllo formato
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-muted)]">
        Verifica aspect ratio e compatibilità feed — nessun blocco automatico.
      </p>
      <ul className="mt-4 overflow-hidden rounded-[16px] bg-white px-4">
        {voci.map((voce) => (
          <RigaDiagnostica
            key={voce.label}
            voce={voce.label}
            kind={chipDaEmoji(voce.emoji)}
            spiegazione={voce.messaggio}
          />
        ))}
      </ul>
    </div>
  );
}
