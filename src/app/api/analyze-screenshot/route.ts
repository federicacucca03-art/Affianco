import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { mockScreenshotAnalysis } from "@/lib/mock-screenshot-analysis";
import type {
  AnalyzeScreenshotBody,
  ScreenshotAnalysisResult,
} from "@/types/screenshot-analysis";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `Sei un Senior Meta Media Buyer. Analizza lo screenshot di Meta Ads Manager / Business Suite.
Estrai con precisione i dati numerici visibili e confrontali con la soglia CPL/CPA sostenibile fornita nel contesto.

Rispondi SOLO con JSON valido, senza markdown, senza testo fuori dal JSON.
Schema esatto:
{
  "spesaTotale": number,
  "risultati": number,
  "tipoRisultato": string,
  "costoPerRisultato": number,
  "ctr": number,
  "frequenza": number,
  "cpm": number,
  "roas": number | null,
  "faseApprendimento": "in_corso" | "completata" | "limitata",
  "verdetto": "ottimo" | "in_target" | "fuori_target" | "dati_insufficienti",
  "spiegazioneSostenibilita": string,
  "azioniConsigliate": string[]
}

Regole verdetto:
- ottimo: costo per risultato <= 85% della soglia targetCpl
- in_target: costo per risultato <= targetCpl
- fuori_target: costo per risultato > targetCpl
- dati_insufficienti: meno di 3 risultati o spesa < 25€

azioniConsigliate: esattamente 3 azioni pratiche e operative da fare subito su Meta Ads, in italiano.`;

function estraiMediaType(base64: string): "image/jpeg" | "image/png" | "image/webp" {
  if (base64.startsWith("/9j/")) return "image/jpeg";
  if (base64.startsWith("iVBOR")) return "image/png";
  return "image/webp";
}

function pulisciBase64(image: string): string {
  const match = image.match(/^data:image\/[\w+.-]+;base64,(.+)$/i);
  return (match?.[1] ?? image).trim();
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
    ctr: Number(raw.ctr) || fallback.ctr,
    frequenza: Number(raw.frequenza) || fallback.frequenza,
    cpm: Number(raw.cpm) || fallback.cpm,
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
    return NextResponse.json({
      ...fallback,
      _mock: true,
      _motivo: "ANTHROPIC_API_KEY non configurata — dati demo",
    });
  }

  const base64 = pulisciBase64(imageRaw);
  const mediaType = estraiMediaType(base64);

  const userText = `Contesto campagna:
- Obiettivo: ${contesto.obiettivo}
- Settore: ${contesto.settore || "non specificato"}
- CPL/CPA massimo sostenibile (soglia Passo 2): ${contesto.targetCpl}€
- Giorni attiva: ${contesto.giorniAttiva}
- Cliente: ${contesto.nomeCliente || "non specificato"}

Analizza lo screenshot allegato ed estrai le metriche in JSON come da schema.`;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1200,
      temperature: 0.2,
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
      return NextResponse.json({
        ...fallback,
        _mock: true,
        _motivo: "Risposta Vision vuota — dati demo",
      });
    }

    const analisi = estraiJsonAnalisi(testo, fallback);
    return NextResponse.json(analisi);
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Errore analisi screenshot";
    return NextResponse.json({
      ...fallback,
      _mock: true,
      _motivo: msg,
    });
  }
}
