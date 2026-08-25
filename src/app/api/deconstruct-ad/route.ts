import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { mockDeconstructAd } from "@/lib/mock-deconstruct-ad";
import type {
  DeconstructAdBody,
  DeconstructAdResult,
  CopioneAdattato,
} from "@/types/deconstruct-ad";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `Sei un Creative Strategist & Direct Response Copywriter per Meta Ads.
Analizza lo screenshot di un'inserzione pubblicitaria e adatta le leve al cliente indicato nel contesto.

Rispondi SOLO con JSON valido, senza markdown, senza testo fuori dal JSON.
Schema esatto:
{
  "hookVisivo": string,
  "angoloPsicologico": string,
  "strutturaCopy": string,
  "copioneAdattato": {
    "titoloVisual": string,
    "scriptVideo": string,
    "istruzioniPerCliente": string
  }
}

Regole:
- hookVisivo: cosa cattura l'attenzione nei primi 3 secondi o nell'immagine statica.
- angoloPsicologico: leva usata (es. Prova Sociale, Urgenza, Paura di sbagliare, Confronto).
- strutturaCopy: organizzazione problema → soluzione → CTA.
- copioneAdattato: adatta al nome azienda, settore e offerta del cliente; scriptVideo in 3 blocchi (Gancio 0-3s, Sviluppo, CTA); istruzioniPerCliente pratiche per registrazione smartphone.
- Lingua: italiano.`;

function estraiMediaType(base64: string): "image/jpeg" | "image/png" | "image/webp" {
  if (base64.startsWith("/9j/")) return "image/jpeg";
  if (base64.startsWith("iVBOR")) return "image/png";
  return "image/webp";
}

function pulisciBase64(image: string): string {
  const match = image.match(/^data:image\/[\w+.-]+;base64,(.+)$/i);
  return (match?.[1] ?? image).trim();
}

function normalizzaCopione(
  raw: Partial<CopioneAdattato> | undefined,
  fallback: CopioneAdattato,
): CopioneAdattato {
  return {
    titoloVisual:
      String(raw?.titoloVisual ?? "").trim() || fallback.titoloVisual,
    scriptVideo:
      String(raw?.scriptVideo ?? "").trim() || fallback.scriptVideo,
    istruzioniPerCliente:
      String(raw?.istruzioniPerCliente ?? "").trim() ||
      fallback.istruzioniPerCliente,
  };
}

function normalizzaRisultato(
  raw: Partial<DeconstructAdResult>,
  fallback: DeconstructAdResult,
): DeconstructAdResult {
  return {
    hookVisivo: String(raw.hookVisivo ?? "").trim() || fallback.hookVisivo,
    angoloPsicologico:
      String(raw.angoloPsicologico ?? "").trim() || fallback.angoloPsicologico,
    strutturaCopy:
      String(raw.strutturaCopy ?? "").trim() || fallback.strutturaCopy,
    copioneAdattato: normalizzaCopione(raw.copioneAdattato, fallback.copioneAdattato),
  };
}

function estraiJson(
  testo: string,
  fallback: DeconstructAdResult,
): DeconstructAdResult {
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
  ) as Partial<DeconstructAdResult>;
  return normalizzaRisultato(parsed, fallback);
}

export async function POST(request: Request) {
  let body: DeconstructAdBody;
  try {
    body = (await request.json()) as DeconstructAdBody;
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
    nomeAzienda: String(body.nomeAzienda ?? "").trim(),
    settore: String(body.settore ?? "").trim(),
    offerta: String(body.offerta ?? "").trim(),
    targetCpl: Math.max(Number(body.targetCpl) || 45, 1),
  };

  const fallback = mockDeconstructAd({ image: imageRaw, ...contesto });
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

  const userText = `Contesto cliente da adattare:
- Nome azienda: ${contesto.nomeAzienda || "non specificato"}
- Settore: ${contesto.settore || "non specificato"}
- Offerta / gancio: ${contesto.offerta || "non specificata"}
- CPL/CPA massimo sostenibile: ${contesto.targetCpl}€

Analizza l'inserzione nello screenshot e restituisci il JSON con copione adattato per QUESTO cliente.`;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1400,
      temperature: 0.35,
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

    return NextResponse.json(estraiJson(testo, fallback));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Errore deconstruct ad";
    return NextResponse.json({
      ...fallback,
      _mock: true,
      _motivo: msg,
    });
  }
}
