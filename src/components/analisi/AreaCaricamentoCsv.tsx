"use client";

import { useRef, useState } from "react";
import { FileUp } from "lucide-react";

type Props = {
  nomeFile: string | null;
  onCarica: (file: File) => void;
};

export function AreaCaricamentoCsv({ nomeFile, onCarica }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [trascinando, setTrascinando] = useState(false);

  function gestisciFile(file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) return;
    onCarica(file);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setTrascinando(true);
      }}
      onDragLeave={() => setTrascinando(false)}
      onDrop={(e) => {
        e.preventDefault();
        setTrascinando(false);
        gestisciFile(e.dataTransfer.files[0]);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-[var(--radius)] border-2 border-dashed px-6 py-10 text-center transition-colors ${
        trascinando
          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
          : "border-[var(--border)] bg-[var(--surface-hover)] hover:border-[var(--accent-muted)]"
      }`}
    >
      <FileUp
        className="h-8 w-8 text-[var(--accent)]"
        strokeWidth={1.5}
        aria-hidden
      />
      <p className="mt-3 max-w-sm text-sm font-medium text-[var(--ink)]">
        {nomeFile
          ? nomeFile
          : "Trascina qui l'export CSV di Ads Manager per aggiornare i dati"}
      </p>
      {!nomeFile ? (
        <p className="mt-1 text-xs text-[var(--ink-muted)]">
          Oppure clicca per selezionare un file .csv
        </p>
      ) : (
        <p className="mt-1 text-xs text-[var(--ink-muted)]">
          File caricato. Puoi sostituirlo trascinandone un altro.
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          gestisciFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
