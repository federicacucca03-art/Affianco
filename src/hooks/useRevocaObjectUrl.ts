"use client";

import { useEffect, useRef } from "react";

/** Revoca URL blob precedenti quando l'immagine cambia o il componente si smonta. */
export function useRevocaObjectUrl(url: string | null) {
  const precedente = useRef<string | null>(null);

  useEffect(() => {
    const precedenteUrl = precedente.current;
    if (precedenteUrl && precedenteUrl !== url) {
      URL.revokeObjectURL(precedenteUrl);
    }
    precedente.current = url;
  }, [url]);

  useEffect(() => {
    return () => {
      if (precedente.current) {
        URL.revokeObjectURL(precedente.current);
        precedente.current = null;
      }
    };
  }, []);
}
