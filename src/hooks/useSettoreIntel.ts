"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  isSettoreIntelPayload,
  risolviSettoreIntel,
  type SettoreIntel,
} from "@/lib/sector-intel";
import { messaggioAiUserFacing } from "@/lib/anthropic-messaggi";

const cache = new Map<string, SettoreIntel>();

function chiaveCache(raw: string): string {
  return raw.toLowerCase().trim();
}

export function useSettoreIntel(settore: string | undefined) {
  const [intel, setIntel] = useState<SettoreIntel | null>(() =>
    risolviSettoreIntel(settore ?? ""),
  );
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const applica = useCallback((prossimo: SettoreIntel | null) => {
    setIntel(prossimo);
  }, []);

  useEffect(() => {
    const q = (settore ?? "").trim();
    const locale = risolviSettoreIntel(q);
    if (locale) {
      abortRef.current?.abort();
      setLoading(false);
      setIntel(locale);
      return;
    }

    if (q.length < 4) {
      setIntel(null);
      setLoading(false);
      return;
    }

    const cached = cache.get(chiaveCache(q));
    if (cached) {
      setIntel(cached);
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/sector-intel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({ niche: q }),
        });
        const data = (await res.json()) as SettoreIntel & { error?: string };
        if (!res.ok || !isSettoreIntelPayload(data)) {
          throw new Error(
            messaggioAiUserFacing(data.error, "Intel non disponibile"),
          );
        }
        const intelAi: SettoreIntel = { ...data, source: data.source ?? "ai" };
        cache.set(chiaveCache(q), intelAi);
        if (!controller.signal.aborted) setIntel(intelAi);
      } catch {
        if (!controller.signal.aborted) {
          // Non bloccare il flusso: restano i benchmark generici.
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 700);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [settore]);

  return { intel, loading, applica };
}
