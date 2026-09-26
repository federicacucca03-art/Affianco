/**
 * M11A.2 — Normalize Meta Graph errors for write operations.
 * No tokens. No raw Authorization dumps to clients.
 */

import type { MetaWriteErrorCategory } from "@/lib/meta/write/types";

export function normalizeMetaWriteError(input: {
  httpStatus?: number | null;
  graphCode?: number | null;
  graphSubcode?: number | null;
  message?: string | null;
  localCode?: string | null;
}): {
  category: MetaWriteErrorCategory;
  safeMessage: string;
  graphCode: number | null;
} {
  const local = (input.localCode ?? "").toUpperCase();
  if (local === "STALE_PREVIEW") {
    return {
      category: "STALE_PREVIEW",
      safeMessage: "L'anteprima non è più valida. Genera di nuovo l'anteprima.",
      graphCode: null,
    };
  }
  if (local === "DUPLICATE_OPERATION") {
    return {
      category: "DUPLICATE_OPERATION",
      safeMessage: "Operazione già in corso o già completata.",
      graphCode: null,
    };
  }
  if (local === "PARTIAL_HIERARCHY") {
    return {
      category: "PARTIAL_HIERARCHY",
      safeMessage:
        "Campagna creata su Meta, ma il gruppo di inserzioni non è riuscito. Nessuna eliminazione automatica.",
      graphCode: null,
    };
  }

  const code = input.graphCode ?? null;
  if (code === 190) {
    return {
      category: "TOKEN",
      safeMessage: "Sessione Meta scaduta. Ricollega Meta.",
      graphCode: code,
    };
  }
  if (code === 10 || code === 200) {
    return {
      category: "PERMISSION",
      safeMessage:
        "Manca il permesso per creare campagne su Meta (ads_management).",
      graphCode: code,
    };
  }
  if (code === 4 || code === 17 || code === 32 || code === 613 || code === 80004) {
    return {
      category: "RATE_LIMIT",
      safeMessage: "Limite temporaneo Meta. Riprova tra poco.",
      graphCode: code,
    };
  }
  if (code === 1 || code === 2) {
    return {
      category: "NETWORK",
      safeMessage: "Meta non disponibile al momento.",
      graphCode: code,
    };
  }
  if (
    code === 100 ||
    (input.httpStatus != null && input.httpStatus >= 400 && input.httpStatus < 500)
  ) {
    const msg = (input.message ?? "").toLowerCase();
    if (/polic|disapprov|restricted|disabled/.test(msg)) {
      return {
        category: "POLICY",
        safeMessage: "Account o campagna limitati dalle policy Meta.",
        graphCode: code,
      };
    }
    return {
      category: "INVALID_PARAM",
      safeMessage: "Parametri non accettati da Meta. Controlla la configurazione.",
      graphCode: code,
    };
  }
  if (input.httpStatus != null && input.httpStatus >= 500) {
    return {
      category: "NETWORK",
      safeMessage: "Errore di rete verso Meta.",
      graphCode: code,
    };
  }
  return {
    category: "NETWORK",
    safeMessage: "Creazione su Meta non riuscita.",
    graphCode: code,
  };
}
