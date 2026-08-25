"use client";

import { useEffect, useRef } from "react";

/** Revoca URL blob non più in uso (lista). */
export function useRevocaObjectUrls(urls: string[]) {
  const precedenti = useRef<string[]>([]);

  useEffect(() => {
    const setNuovi = new Set(urls);
    for (const vecchio of precedenti.current) {
      if (vecchio.startsWith("blob:") && !setNuovi.has(vecchio)) {
        URL.revokeObjectURL(vecchio);
      }
    }
    precedenti.current = urls.filter((u) => u.startsWith("blob:"));
  }, [urls]);

  useEffect(() => {
    return () => {
      for (const u of precedenti.current) {
        URL.revokeObjectURL(u);
      }
      precedenti.current = [];
    };
  }, []);
}
