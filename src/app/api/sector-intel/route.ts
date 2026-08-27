import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { MACRO_CATEGORIE } from "@/data/settoriPresets";
import {
  isSettoreIntelPayload,
  risolviSettoreIntel,
  type SettoreIntel,
} from "@/lib/sector-intel";
import { anthropicModelId } from "@/lib/anthropic-config";
import {
  anthropicConfigMissingResponse,
  anthropicErrorResponse,
} from "@/lib/anthropic-errori";

export const runtime = "nodejs";

type Body = {
  niche?: string;
};

export type SectorIntelApiResult = {
  aovDefault: number;
  margineDefault: number;
  benchmarkCPL: { min: number; max: number };
  ganciConsigliati: string[];
  formatoVisualConsigliato: string;
  policyAlert: string;
};

const SYSTEM_PROMPT = `Sei un analista media buyer senior sul mercato italiano (Meta Ads).
Rispondi SOLO con JSON valido, senza markdown.

Schema esatto:
{
  "aovDefault": 120,
  "margineDefault": 50,
  "benchmarkCPL": { "min": 10, "max": 40 },
  "ganciConsigliati": ["gancio 1", "gancio 2", "gancio 3"],
  "formatoVisualConsigliato": "descrizione formato e stile visivo per il Passo 4",
  "policyAlert": "nota policy Meta, oppure stringa vuota"
}

Regole:
- aovDefault = scontrino / AOV tipico Italia in euro.
- margineDefault = margine lordo % stimato (10–80).
- ganciConsigliati: esattamente 3 offerte front-end concrete, in italiano, senza gergo da agenzia.
- benchmarkCPL: range realistico asta Meta Italia (lead o contatto equivalente).
- formatoVisualConsigliato: una frase su formato (1:1, 4:5, 9:16) e stile visivo.
- policyAlert: solo se rilevante (salute, housing, credito, integratori, dimagrimento, alcol). Altrimenti "".
- Non inventare brand. Nessun testo fuori dal JSON.`;

function range(raw: unknown, fallbackMin: number, fallbackMax: number) {
  const o = (raw ?? {}) as { min?: unknown; max?: unknown; optimal?: unknown };
  const min = Number(o.min);
  const max = Number(o.max);
  return {
    min: Number.isFinite(min) && min > 0 ? min : fallbackMin,
    max: Number.isFinite(max) && max > 0 ? max : fallbackMax,
  };
}

function normalizzaIntel(parsed: Record<string, unknown>, niche: string): SettoreIntel {
  const ganciRaw = Array.isArray(parsed.ganciConsigliati)
    ? parsed.ganciConsigliati
    : Array.isArray(parsed.typicalOffers)
      ? parsed.typicalOffers
      : [];
  const ganci = ganciRaw.map((o) => String(o).trim()).filter(Boolean);
  while (ganci.length < 3) {
    ganci.push(`Prima consulenza / prova per ${niche}`);
  }
  const cpl = range(parsed.benchmarkCPL, 12, 40);
  const cpa = range(parsed.benchmarkCPA, cpl.min * 1.4, cpl.max * 1.6);
  const macroRaw = String(parsed.macroCategoria ?? parsed.macro ?? "");
  const macro = MACRO_CATEGORIE.includes(macroRaw as (typeof MACRO_CATEGORIE)[number])
    ? (macroRaw as (typeof MACRO_CATEGORIE)[number])
    : "Servizi Locali/Artigiani";
  const id =
    String(parsed.id || parsed.key || niche)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "nicchia-custom";
  const aov =
    Number(parsed.aovDefault ?? parsed.defaultAov) || 80;
  const margine =
    Number(parsed.margineDefault ?? parsed.defaultMargin) || 50;
  const formato =
    String(
      parsed.formatoVisualConsigliato ??
        (parsed.creativeGuidelines as { tip?: string } | undefined)?.tip ??
        "",
    ).trim() ||
    "1:1 o 4:5 — foto reale dell'attività, testo minimo in overlay.";
  const policy = String(
    parsed.policyAlert ??
      (Array.isArray(parsed.policyWarnings)
        ? parsed.policyWarnings.join(" ")
        : ""),
  ).trim();

  return {
    id,
    nome: String(parsed.nome ?? parsed.label ?? niche).trim() || niche,
    macroCategoria: macro,
    aliases: [niche],
    aovDefault: Math.max(1, aov),
    margineDefault: Math.min(80, Math.max(10, margine)),
    benchmarkCPL: cpl,
    benchmarkCPA: cpa,
    ganciConsigliati: [ganci[0], ganci[1], ganci[2]],
    formatoVisualConsigliato: formato,
    policyAlert: policy,
    raggioKmConsigliato: Math.max(5, Number(parsed.raggioKmConsigliato) || 15),
    budgetGiornalieroMin: Math.max(
      8,
      Number(parsed.budgetGiornalieroMin) || 18,
    ),
    source: "ai",
  };
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Body JSON non valido" }, { status: 400 });
  }

  const niche = String(body.niche ?? "").trim();
  if (niche.length < 3) {
    return NextResponse.json(
      { error: "Nicchia troppo corta" },
      { status: 400 },
    );
  }

  const locale = risolviSettoreIntel(niche);
  if (locale) {
    return NextResponse.json(locale);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return anthropicConfigMissingResponse();
  }

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: anthropicModelId(),
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Nicchia libera digitata dall'utente: "${niche}".
Stima AOV, margine, 3 ganci, CPL Meta Italia, formato visivo e policy.
JSON only.`,
        },
      ],
    });

    const testo = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n")
      .trim();
    const inizio = testo.indexOf("{");
    const fine = testo.lastIndexOf("}");
    if (inizio < 0 || fine <= inizio) {
      return NextResponse.json(
        {
          error: "Non siamo riusciti a generare il contenuto. Riprova.",
          code: "PROVIDER",
        },
        { status: 502 },
      );
    }
    const parsed = JSON.parse(testo.slice(inizio, fine + 1)) as Record<
      string,
      unknown
    >;
    const intel = normalizzaIntel(parsed, niche);
    if (!isSettoreIntelPayload(intel)) {
      return NextResponse.json(
        {
          error: "Non siamo riusciti a generare il contenuto. Riprova.",
          code: "PROVIDER",
        },
        { status: 502 },
      );
    }
    return NextResponse.json(intel);
  } catch (err) {
    return anthropicErrorResponse(err);
  }
}
