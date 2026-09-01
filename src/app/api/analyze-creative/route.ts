import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { requireRouteUserId } from "@/lib/api-auth";
import {
  parseCreativeVisionAnalysis,
  parseDataUrlImmagine,
  VISION_UNKNOWN,
} from "@/lib/analyze-creative";
import { anthropicModelId } from "@/lib/anthropic-config";
import {
  anthropicConfigMissingResponse,
  anthropicErrorResponse,
} from "@/lib/anthropic-errori";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

const SYSTEM_PROMPT = `Analizza l'immagine di una creatività pubblicitaria.
Rispondi SOLO con JSON valido, senza markdown, senza testo extra.

Schema esatto:
{
  "relevance": "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN",
  "relevanceReason": string | null,
  "visibleText": string[]
}

Regole:
- Osserva solo ciò che è realmente visibile.
- Confronta il visual con offerta, brief e settore forniti.
- HIGH: chiaramente coerente. MEDIUM: correlato ma generico. LOW: mismatch evidente. UNKNOWN: non interpretabile o incerto.
- relevanceReason: al massimo una frase, basata su elementi visibili. null se UNKNOWN.
- Vietato: performance, CTR, CPL, estetica, ranking, inferire oggetti o testo non visibili.
- visibleText: solo testo chiaramente leggibile. Non completare frasi tagliate. Se non leggi testo, [].
- Lingua di relevanceReason: italiano.`;

export async function POST(request: Request) {
  const userId = await requireRouteUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON non valido" }, { status: 400 });
  }

  const parsedImage = parseDataUrlImmagine(body.image);
  if (!parsedImage.ok) {
    return NextResponse.json(
      { error: parsedImage.error },
      { status: parsedImage.status },
    );
  }

  const offerta = String(body.offerta ?? "").trim();
  const brief = String(body.brief ?? "").trim();
  const settore = String(body.settore ?? "").trim();

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return anthropicConfigMissingResponse();
  }

  const userText = `Contesto campagna:
- Settore: ${settore || "non specificato"}
- Offerta: ${offerta || "non specificata"}
- Brief: ${brief || "non specificato"}

Restituisci il JSON dello schema.`;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: anthropicModelId(),
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: parsedImage.mime as
                  | "image/jpeg"
                  | "image/png"
                  | "image/webp",
                data: parsedImage.base64,
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
      return NextResponse.json(VISION_UNKNOWN);
    }

    return NextResponse.json(parseCreativeVisionAnalysis(testo));
  } catch (err) {
    return anthropicErrorResponse(err);
  }
}
