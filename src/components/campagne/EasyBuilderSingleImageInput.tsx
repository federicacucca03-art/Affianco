"use client";

import { useRef, useState } from "react";
import type { CreativitaAsset } from "@/lib/creativita";
import {
  analizzaFormatoImmagine,
  leggiDimensioniImmagine,
} from "@/lib/creativita";

type Props = {
  asset: CreativitaAsset | null;
  onChange: (asset: CreativitaAsset | null) => void;
  disabled?: boolean;
};

function nuovoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * P0.8 — Single-image Easy Builder input.
 * Reuses Ally creativita validation helpers. No Meta media upload.
 */
export function EasyBuilderSingleImageInput({
  asset,
  onChange,
  disabled = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0 || disabled) return;
    setErrore(null);
    setBusy(true);
    try {
      const file = files[0]!;
      if (!file.type.startsWith("image/")) {
        setErrore("Formato non supportato. Carica un'immagine (JPG, PNG, …).");
        return;
      }
      const { width, height, url } = await leggiDimensioniImmagine(file);
      const { ok, orizzontale } = analizzaFormatoImmagine(width, height);
      if (asset?.url.startsWith("blob:")) {
        URL.revokeObjectURL(asset.url);
      }
      onChange({
        id: nuovoId(),
        url,
        nomeFile: file.name,
        width,
        height,
        ruolo: "principale",
        avvisoFormato: !ok,
        formatoOrizzontale: orizzontale,
        isVideo: false,
      });
    } catch {
      setErrore("Impossibile leggere l'immagine. Riprova con un altro file.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function rimuovi() {
    if (disabled) return;
    if (asset?.url.startsWith("blob:")) {
      URL.revokeObjectURL(asset.url);
    }
    onChange(null);
    setErrore(null);
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled || busy}
        onChange={(e) => void onFiles(e.target.files)}
      />

      {asset ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={asset.url}
            alt={asset.nomeFile}
            className="h-28 w-28 shrink-0 rounded-[10px] border border-[var(--border)] object-cover bg-[var(--surface-soft,#f7f7fa)]"
          />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="truncate text-[13px] font-medium text-[var(--ink)]">
              {asset.nomeFile}
            </p>
            <p className="text-[12px] text-[var(--ink-muted)]">
              {asset.width}×{asset.height}px
              {asset.avvisoFormato
                ? " · formato non ottimale per Feed/Stories (avviso, non blocco)"
                : " · formato ok"}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="aff-btn-secondary"
                disabled={disabled || busy}
                onClick={() => inputRef.current?.click()}
              >
                Sostituisci
              </button>
              <button
                type="button"
                className="aff-btn-tertiary"
                disabled={disabled || busy}
                onClick={rimuovi}
              >
                Rimuovi
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-1 rounded-[12px] border border-dashed border-[var(--border)] bg-[color-mix(in_srgb,var(--accent-soft)_25%,white)] px-4 py-8 text-center transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <span className="text-[14px] font-medium text-[var(--ink)]">
            {busy ? "Lettura immagine…" : "Carica un'immagine"}
          </span>
          <span className="text-[12px] text-[var(--ink-muted)]">
            JPG o PNG · una sola immagine
          </span>
        </button>
      )}

      {errore ? (
        <p className="text-[12px] text-red-700" role="alert">
          {errore}
        </p>
      ) : null}
    </div>
  );
}
