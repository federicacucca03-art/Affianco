import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { mockScreenshotAnalysis } from "@/lib/mock-screenshot-analysis";
import type {
  AnalyzeScreenshotBody,
  ScreenshotAnalysisResult,
} from "@/types/screenshot-analysis";
import { anthropicModelId } from "@/lib/anthropic-config";
import { normalizzaCtrDaApi } from "@/lib/control-room";
import { parseScreenshotCount } from "@/lib/funnel-metrics";
import {
  anthropicConfigMissingResponse,
  anthropicErrorResponse,
} from "@/lib/anthropic-errori";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `Sei un Senior Meta Media Buyer. Analizza lo screenshot di Meta Ads Manager / Business Suite.
Estrai SOLO i dati numerici visibili. Non decidere lo stato economico di Affianco: health, diagnosi e azioni finali sono calcolati dal runtime.

Rispondi SOLO con JSON valido, senza markdown, senza testo fuori dal JSON.
Schema esatto (backward compatible):
{
  "spesaTotale": number,
  "risultati": number,
  "tipoRisultato": string,
  "costoPerRisultato": number,
  "ctr": number (percentuale numerica: 1.2 = 1.2%, NON 0.012),
  "frequenza": number,
  "cpm": number,
  "cpc": number | null (solo se visibile nello screenshot; non inventare),
  "clicks": number | null (solo se visibile; intero >= 0; non inventare),
  "impressions": number | null (solo se visibile; intero >= 0; non inventare),
  "roas": number | null,
  "faseApprendimento": "in_corso" | "completata" | "limitata",
  "verdetto": "ottimo" | "in_target" | "fuori_target" | "dati_insufficienti",
  "spiegazioneSostenibilita": string,
  "azioniConsigliate": string[]
}

verdetto e azioniConsigliate restano nello schema per compatibilità: Affianco li ignora per health e next action.

Se obiettivo è AWARENESS:
- il confronto rilevante è il CPM, non il CPL
- non interpretare i risultati come lead o acquisti
- non scrivere "CPL" nella spiegazione

cpc: includilo SOLO se visibile. Se non è visibile, usa null. Non calcolare CPC da altri KPI.

clicks e impressions: estraili SOLO se chiaramente visibili nello screenshot.
Label ammesse (italiano/inglese): Click, Clicks, Clic, Clic sul link, Link clicks; Impression, Impressions.
Se lo screenshot mostra una di queste label, usa quel valore. Non distinguere ora clicks vs link_clicks: prendi la metrica click visibile.
NON ricostruire clicks o impressions da CTR, CPC, CPM o spesa.
Esempio: CTR 1% e Impressions 10000 visibili, Click non visibile → clicks = null. NON calcolare 100.
Se non visibili, usa null. Non inventare. Non arrotondare decimali: se il conteggio non è intero, usa null.
Non calcolare CTR/CPC/CPM: Affianco li deriva a runtime dai conteggi.`;

function estraiMediaType(base64: string): "image/jpeg" | "image/png" | "image/webp" {
  if (base64.startsWith("/9j/")) return "image/jpeg";
  if (base64.startsWith("iVBOR")) return "image/png";
  return "image/webp";
}

function pulisciBase64(image: string): string {
  const match = image.match(/^data:image\/[\w+.-]+;base64,(.+)$/i);
  return (match?.[1] ?? image).trim();
}

/** CPC solo se numerico e visibile. Non inventato da fallback. */
function cpcVisibile(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizzaAnalisi(
  raw: Partial<ScreenshotAnalysisResult>,
  fallback: ScreenshotAnalysisResult,
): ScreenshotAnalysisResult {
  const azioni = Array.isArray(raw.azioniConsigliate)
    ? raw.azioniConsigliate.filter((a) => typeof a === "string").slice(0, 3)
    : fallback.azioniConsigliate;

  while (azioni.length < 3) {
    azioni.push(fallback.azioniConsigliate[azioni.length] ?? "Monitora i prossimi 48h.");
  }

  const fase = raw.faseApprendimento;
  const faseOk =
    fase === "in_corso" || fase === "completata" || fase === "limitata"
      ? fase
      : fallback.faseApprendimento;

  const verd = raw.verdetto;
  const verdOk =
    verd === "ottimo" ||
    verd === "in_target" ||
    verd === "fuori_target" ||
    verd === "dati_insufficienti"
      ? verd
      : fallback.verdetto;

  return {
    spesaTotale: Number(raw.spesaTotale) || fallback.spesaTotale,
    risultati: Number(raw.risultati) || fallback.risultati,
    tipoRisultato: String(raw.tipoRisultato ?? fallback.tipoRisultato),
    costoPerRisultato:
      Number(raw.costoPerRisultato) || fallback.costoPerRisultato,
    ctr: normalizzaCtrDaApi(Number(raw.ctr) || fallback.ctr) ?? fallback.ctr,
    frequenza: Number(raw.frequenza) || fallback.frequenza,
    cpm: Number(raw.cpm) || fallback.cpm,
    cpc: cpcVisibile(raw.cpc),
    clicks: parseScreenshotCount(raw.clicks),
    impressions: parseScreenshotCount(raw.impressions),
    roas:
      raw.roas === null || raw.roas === undefined
        ? fallback.roas
        : Number(raw.roas) || null,
    faseApprendimento: faseOk,
    verdetto: verdOk,
    spiegazioneSostenibilita:
      String(raw.spiegazioneSostenibilita ?? "").trim() ||
      fallback.spiegazioneSostenibilita,
    azioniConsigliate: azioni,
  };
}

function estraiJsonAnalisi(
  testo: string,
  fallback: ScreenshotAnalysisResult,
): ScreenshotAnalysisResult {
  const pulito = testo
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const inizio = pulito.indexOf("{");
  const fine = pulito.lastIndexOf("}");
  if (inizio < 0 || fine <= inizio) {
    throw new Error("Risposta AI senza JSON");
  }
  const parsed = JSON.parse(
    pulito.slice(inizio, fine + 1),
  ) as Partial<ScreenshotAnalysisResult>;
  return normalizzaAnalisi(parsed, fallback);
}

export async function POST(request: Request) {
  let body: AnalyzeScreenshotBody;
  try {
    body = (await request.json()) as AnalyzeScreenshotBody;
  } catch {
    return NextResponse.json({ error: "Body JSON non valido" }, { status: 400 });
  }

  const imageRaw = String(body.image ?? "").trim();
  if (!imageRaw) {
    return NextResponse.json(
      { error: "Immagine mancante (base64)" },
      { status: 400 },
    );
  }

  const contesto = {
    targetCpl: Number(body.targetCpl) || 45,
    obiettivo: String(body.obiettivo ?? "LEADS").trim() || "LEADS",
    settore: String(body.settore ?? "").trim(),
    giorniAttiva: Math.max(Number(body.giorniAttiva) || 5, 1),
    nomeCampagna: String(body.nomeCampagna ?? "").trim(),
    nomeCliente: String(body.nomeCliente ?? "").trim(),
  };

  const fallback = mockScreenshotAnalysis({
    image: imageRaw,
    ...contesto,
  });

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return anthropicConfigMissingResponse();
  }

  const base64 = pulisciBase64(imageRaw);
  const mediaType = estraiMediaType(base64);

  const sogliaRiga =
    contesto.obiettivo.toUpperCase() === "AWARENESS"
      ? `- CPM di riferimento (piano): ${contesto.targetCpl}€`
      : `- Costo massimo sostenibile (CPL/CPA): ${contesto.targetCpl}€`;

  const userText = `Contesto campagna:
- Obiettivo: ${contesto.obiettivo}
- Settore: ${contesto.settore || "non specificato"}
${sogliaRiga}
- Giorni attiva: ${contesto.giorniAttiva}
- Cliente: ${contesto.nomeCliente || "non specificato"}

Analizza lo screenshot allegato ed estrai le metriche in JSON come da schema.`;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: anthropicModelId(),
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64,
              },
            },
            { type: "text", text: userText },
          ],
        },
      ],
    });

    const testo = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n")
      .trim();

    if (!testo) {
      return NextResponse.json(
        {
          error: "Non siamo riusciti a generare il contenuto. Riprova.",
          code: "PROVIDER",
        },
        { status: 502 },
      );
    }

    const analisi = estraiJsonAnalisi(testo, fallback);
    return NextResponse.json(analisi);
  } catch (err) {
    return anthropicErrorResponse(err);
  }
}
