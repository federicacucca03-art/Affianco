/**
 * Import deterministico di export CSV Meta Ads Manager.
 * Converge sul form /risultati: niente aggregazione, niente AI.
 *
 * Click: se coesistono Clicks e Link clicks / Clic sul link,
 * si usa il link click (funnel verso destinazione).
 */

import { parseScreenshotCount } from "@/lib/funnel-metrics";

export const META_CSV_MAX_BYTES = 2 * 1024 * 1024;

export type MetaCsvMappedRow = {
  spend: number | null;
  results: number | null;
  costPerResult: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  frequency: number | null;
  roas: number | null;
  clicks: number | null;
  impressions: number | null;
  campaignName: string | null;
  adSetName: string | null;
  adName: string | null;
  recognizedCount: number;
  isSummary: boolean;
};

export type MetaCsvKpiForm = {
  spend: string;
  results: string;
  costPerResult: string;
  ctr: string;
  cpm: string;
  cpc: string;
  frequency: string;
  roas: string;
  clicks: string;
  impressions: string;
};

export type MetaCsvParseResult =
  | {
      ok: true;
      rows: MetaCsvMappedRow[];
      dataRows: MetaCsvMappedRow[];
      needsSelection: boolean;
      autoRow: MetaCsvMappedRow | null;
    }
  | { ok: false; error: string };

function normalizzaHeader(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const HEADER_RESULTS = ["risultati", "results"];
const HEADER_SPEND = [
  "importo speso",
  "importo speso (eur)",
  "amount spent",
  "amount spent (eur)",
];
const HEADER_COST = ["costo per risultato", "cost per result"];
const HEADER_IMPRESSIONS = ["impression", "impressions"];
/** Priorità: link click prima di clicks generici. */
const HEADER_CLICKS_PRIORITY = [
  "clic sul link",
  "click sul link",
  "link clicks",
  "clicks",
  "clic",
];
const HEADER_CTR = [
  "ctr",
  "ctr (percentuale di clic sul link)",
  "ctr (link click-through rate)",
];
const HEADER_CPC = [
  "cpc",
  "cpc (costo per clic sul link)",
  "cpc (cost per link click)",
];
const HEADER_CPM = ["cpm", "cpm (costo per 1.000 impression)", "cpm (cost per 1,000 impressions)"];
const HEADER_FREQUENCY = ["frequenza", "frequency"];
const HEADER_ROAS = ["roas", "purchase roas", "website purchase roas"];
const HEADER_CAMPAIGN = ["nome della campagna", "campaign name"];
const HEADER_ADSET = [
  "nome del gruppo di inserzioni",
  "ad set name",
];
const HEADER_AD = ["nome dell'inserzione", "ad name"];

function indiceHeaderEsatto(headers: string[], aliases: string[]): number {
  const aliased = aliases.map(normalizzaHeader);
  return headers.findIndex((h) => aliased.includes(h));
}

function indiceClick(headers: string[]): number {
  for (const alias of HEADER_CLICKS_PRIORITY) {
    const idx = indiceHeaderEsatto(headers, [alias]);
    if (idx >= 0) return idx;
  }
  return -1;
}

function primaRiga(text: string): string {
  const n = text.replace(/^\uFEFF/, "");
  const cut = n.search(/\r\n|\n|\r/);
  return cut < 0 ? n : n.slice(0, cut);
}

export function detectCsvDelimiter(text: string): "," | ";" | "\t" {
  const header = primaRiga(text);
  let comma = 0;
  let semi = 0;
  let tab = 0;
  let inQuote = false;
  for (let i = 0; i < header.length; i += 1) {
    const c = header[i];
    if (c === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (inQuote) continue;
    if (c === ",") comma += 1;
    else if (c === ";") semi += 1;
    else if (c === "\t") tab += 1;
  }
  if (tab > comma && tab > semi) return "\t";
  if (semi > comma) return ";";
  return ",";
}

/** Parser CSV con quote, delimiter e newline. Non usa split(","). */
export function parseCsvRows(text: string, delimiter?: "," | ";" | "\t"): string[][] {
  const delim = delimiter ?? detectCsvDelimiter(text);
  const source = text.replace(/^\uFEFF/, "");
  const righe: string[][] = [];
  let riga: string[] = [];
  let campo = "";
  let inQuote = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];
    if (char === '"') {
      if (inQuote && next === '"') {
        campo += '"';
        i += 1;
      } else {
        inQuote = !inQuote;
      }
      continue;
    }
    if (!inQuote && char === delim) {
      riga.push(campo);
      campo = "";
      continue;
    }
    if (!inQuote && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") i += 1;
      riga.push(campo);
      if (riga.some((c) => c.trim() !== "")) righe.push(riga);
      riga = [];
      campo = "";
      continue;
    }
    campo += char;
  }
  if (campo.length > 0 || riga.length > 0) {
    riga.push(campo);
    if (riga.some((c) => c.trim() !== "")) righe.push(riga);
  }
  return righe;
}

export function isMetaCsvSummaryLabel(raw: string | null | undefined): boolean {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return false;
  if (/^totali?$/.test(s) || s === "total") return true;
  if (/^risultati di \d+/.test(s)) return true;
  if (/^results from \d+/.test(s)) return true;
  return false;
}

function cella(row: string[], idx: number): string {
  if (idx < 0) return "";
  return (row[idx] ?? "").trim();
}

function pulisciSimboli(raw: string): string {
  return raw
    .replace(/€/g, "")
    .replace(/%/g, "")
    .replace(/\s/g, "")
    .replace(/\u00a0/g, "")
    .trim();
}

/**
 * Decimali / migliaia in modo deterministico.
 * percent: 2,397% → 2.397 (la % forza il separatore decimale).
 * decimal: 435,52 → 435.52; 43.758 / 1.049 → migliaia.
 * count: interi; 100.5 → null.
 */
export function parseMetaCsvNumber(
  raw: string | null | undefined,
  kind: "count" | "decimal" | "percent",
): number | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  if (kind === "count") return parseScreenshotCount(trimmed);

  const hasPercent = trimmed.includes("%");
  const cleaned = pulisciSimboli(trimmed);
  if (!cleaned || cleaned.startsWith("-")) return null;
  if (/[eEkKmMbB]/.test(cleaned)) return null;

  const mode: "decimal" | "percent" = hasPercent || kind === "percent" ? "percent" : "decimal";
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized: string;

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalIsComma = lastComma > lastDot;
    normalized = decimalIsComma
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, "");
  } else if (lastComma >= 0) {
    const frac = cleaned.slice(lastComma + 1);
    if (mode === "percent" || frac.length <= 2) {
      normalized = cleaned.replace(",", ".");
    } else if (frac.length === 3) {
      normalized = cleaned.replace(/,/g, "");
    } else {
      return null;
    }
  } else if (lastDot >= 0) {
    const frac = cleaned.slice(lastDot + 1);
    if (mode === "percent" || frac.length <= 2) {
      normalized = cleaned;
    } else if (frac.length === 3) {
      normalized = cleaned.replace(/\./g, "");
    } else {
      return null;
    }
  } else {
    normalized = cleaned;
  }

  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function contaRiconosciuti(row: Omit<MetaCsvMappedRow, "recognizedCount" | "isSummary">): number {
  const keys = [
    row.spend,
    row.results,
    row.costPerResult,
    row.ctr,
    row.cpc,
    row.cpm,
    row.frequency,
    row.roas,
    row.clicks,
    row.impressions,
  ];
  return keys.filter((v) => v != null).length;
}

export function mapMetaCsvRow(
  headers: string[],
  cells: string[],
): MetaCsvMappedRow {
  const h = headers.map(normalizzaHeader);
  const idx = {
    results: indiceHeaderEsatto(h, HEADER_RESULTS),
    spend: indiceHeaderEsatto(h, HEADER_SPEND),
    cost: indiceHeaderEsatto(h, HEADER_COST),
    impressions: indiceHeaderEsatto(h, HEADER_IMPRESSIONS),
    clicks: indiceClick(h),
    ctr: indiceHeaderEsatto(h, HEADER_CTR),
    cpc: indiceHeaderEsatto(h, HEADER_CPC),
    cpm: indiceHeaderEsatto(h, HEADER_CPM),
    frequency: indiceHeaderEsatto(h, HEADER_FREQUENCY),
    roas: indiceHeaderEsatto(h, HEADER_ROAS),
    campaign: indiceHeaderEsatto(h, HEADER_CAMPAIGN),
    adSet: indiceHeaderEsatto(h, HEADER_ADSET),
    ad: indiceHeaderEsatto(h, HEADER_AD),
  };

  const campaignName = cella(cells, idx.campaign) || null;
  const adSetName = cella(cells, idx.adSet) || null;
  const adName = cella(cells, idx.ad) || null;
  const mapped = {
    spend: parseMetaCsvNumber(cella(cells, idx.spend), "decimal"),
    results: parseMetaCsvNumber(cella(cells, idx.results), "count"),
    costPerResult: parseMetaCsvNumber(cella(cells, idx.cost), "decimal"),
    ctr: parseMetaCsvNumber(cella(cells, idx.ctr), "percent"),
    cpc: parseMetaCsvNumber(cella(cells, idx.cpc), "decimal"),
    cpm: parseMetaCsvNumber(cella(cells, idx.cpm), "decimal"),
    frequency: parseMetaCsvNumber(cella(cells, idx.frequency), "decimal"),
    roas: parseMetaCsvNumber(cella(cells, idx.roas), "decimal"),
    clicks: parseMetaCsvNumber(cella(cells, idx.clicks), "count"),
    impressions: parseMetaCsvNumber(cella(cells, idx.impressions), "count"),
    campaignName,
    adSetName,
    adName,
  };
  const isSummary = isMetaCsvSummaryLabel(campaignName) || isMetaCsvSummaryLabel(adSetName) || isMetaCsvSummaryLabel(adName);
  return {
    ...mapped,
    recognizedCount: contaRiconosciuti(mapped),
    isSummary,
  };
}

export function headersHannoMetricheMeta(headers: string[]): boolean {
  const h = headers.map(normalizzaHeader);
  return (
    indiceHeaderEsatto(h, HEADER_SPEND) >= 0 ||
    indiceHeaderEsatto(h, HEADER_RESULTS) >= 0 ||
    indiceHeaderEsatto(h, HEADER_IMPRESSIONS) >= 0 ||
    indiceClick(h) >= 0 ||
    indiceHeaderEsatto(h, HEADER_CTR) >= 0 ||
    indiceHeaderEsatto(h, HEADER_CPC) >= 0 ||
    indiceHeaderEsatto(h, HEADER_CPM) >= 0 ||
    indiceHeaderEsatto(h, HEADER_COST) >= 0 ||
    indiceHeaderEsatto(h, HEADER_FREQUENCY) >= 0 ||
    indiceHeaderEsatto(h, HEADER_ROAS) >= 0
  );
}

export function parseAdsManagerCsv(text: string): MetaCsvParseResult {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (!trimmed) {
    return { ok: false, error: "Il CSV non contiene dati." };
  }
  let rows: string[][];
  try {
    rows = parseCsvRows(trimmed);
  } catch {
    return { ok: false, error: "Non riesco a leggere questo CSV." };
  }
  if (rows.length === 0) {
    return { ok: false, error: "Il CSV non contiene dati." };
  }
  if (rows.length === 1) {
    return {
      ok: false,
      error: "Il CSV non contiene dati.",
    };
  }
  const headers = rows[0] ?? [];
  if (!headersHannoMetricheMeta(headers)) {
    return {
      ok: false,
      error: "Non ho trovato metriche Ads Manager compatibili nel file.",
    };
  }

  const mapped = rows.slice(1).map((cells) => mapMetaCsvRow(headers, cells));
  if (mapped.length === 0) {
    return { ok: false, error: "Il CSV non contiene dati." };
  }
  const dataRows = mapped.filter((r) => !r.isSummary);
  const selectable = dataRows.length > 0 ? dataRows : mapped;
  const needsSelection = selectable.length !== 1;
  return {
    ok: true,
    rows: mapped,
    dataRows: selectable,
    needsSelection,
    autoRow: !needsSelection ? (selectable[0] ?? null) : null,
  };
}

function strNum(n: number | null): string {
  if (n == null) return "";
  return String(n);
}

export function kpiFormDaRigaMeta(row: MetaCsvMappedRow): MetaCsvKpiForm {
  return {
    spend: strNum(row.spend),
    results: strNum(row.results),
    costPerResult: strNum(row.costPerResult),
    ctr: strNum(row.ctr),
    cpm: strNum(row.cpm),
    cpc: strNum(row.cpc),
    frequency: strNum(row.frequency),
    roas: strNum(row.roas),
    clicks: strNum(row.clicks),
    impressions: strNum(row.impressions),
  };
}

export function validaFileCsvMeta(file: File): string | null {
  const nome = file.name.toLowerCase();
  if (!nome.endsWith(".csv")) {
    return "Carica un file .csv esportato da Ads Manager.";
  }
  const mime = (file.type || "").toLowerCase();
  const mimeOk =
    mime === "" ||
    mime === "text/csv" ||
    mime === "application/csv" ||
    mime === "text/plain" ||
    mime === "application/vnd.ms-excel";
  if (!mimeOk) {
    return "Carica un file .csv esportato da Ads Manager.";
  }
  if (file.size === 0) {
    return "Il CSV non contiene dati.";
  }
  if (file.size > META_CSV_MAX_BYTES) {
    return "Il file è troppo grande. Esporta un CSV più piccolo da Ads Manager.";
  }
  return null;
}

export function etichettaRigaMetaCsv(row: MetaCsvMappedRow): string {
  const parti = [row.campaignName, row.adSetName, row.adName].filter(
    (p): p is string => Boolean(p && p.trim()),
  );
  return parti.join(" · ") || "Riga senza nome";
}
