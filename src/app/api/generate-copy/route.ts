import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import {
  cittaPrepLocale,
  pulisciNomeAttivitaPubblico,
  sanificaCopyDaMetadati,
} from "@/lib/copy-pubblico";
import { anthropicModelId } from "@/lib/anthropic-config";
import {
  anthropicConfigMissingResponse,
  anthropicErrorResponse,
} from "@/lib/anthropic-errori";

export const runtime = "nodejs";

type GenerateCopyBody = {
  route?: string;
  clientName?: string;
  sector?: string;
  city?: string;
  offer?: string;
  brief?: string;
  clientType?: string;
  tone?: string;
  targetAge?: string;
};

type GenerateCopyResult = {
  headline: string;
  varianteA: string;
  varianteB: string;
  varianteC: string;
};

const SYSTEM_PROMPT = `Sei un copywriter senior specializzato in Meta Ads (Facebook/Instagram) per il mercato italiano.
Scrivi in italiano naturale, concreto e pubblicabile. Niente fuffa da agenzia.

SOURCE OF TRUTH (in questo ordine, e SOLO queste):
1. offerta
2. brief
3. settore
4. città
5. target (tipo cliente / fascia età, se forniti)

REGOLE OBBLIGATORIE:
1. Rispondi SOLO con JSON valido, senza markdown, senza commenti, senza testo fuori dal JSON.
2. Schema esatto (i valori sono SOLO il copy finale da pubblicare, mai etichette o istruzioni):
{
  "headline": "…",
  "varianteA": "…",
  "varianteB": "…",
  "varianteC": "…"
}
3. Lingua: italiano naturale e grammaticalmente corretto.
4. Headline: massimo 5 parole d'impatto. Max 45 caratteri. NON inserire mai l'intero brief né il nome campagna. Niente hashtag, massimo 1 emoji.
5. NOME ATTIVITÀ vs NOME CAMPAGNA (CRITICO):
   - Usa ESCLUSIVAMENTE il nome attività/cliente fornito.
   - VIETATO citare nomi campagna interni, tag tecnici o obiettivi Meta nel copy.
6. CITTÀ (CRITICO):
   - Se la città è indicata, scrivi sempre "a [Città]" (forma naturale).
   - Se la città NON è indicata, scrivi "nella tua zona" — MAI segnaposto tipo [Città].
7. COPY PURO — VIETATO nei valori JSON prefissi da prompt ("Hook immediato:", "Variante A:", ecc.).
8. Tre angoli distinti (strategia interna) NEL TONO SCELTO PER TUTTE:
   - varianteA = Beneficio diretto + offerta esplicita nelle prime righe.
   - varianteB = Autorevolezza / metodo / rassicurazione.
   - varianteC = Empatico / problema → soluzione.
   Tutte e tre le varianti devono usare lo STESSO tono di voce indicato dall'utente.
9. CTA finale chiara in ogni variante, coerente con la rotta.
10. Ogni variante: 2–4 frasi fluide.

VINCOLO CONTENUTO (CRITICO):
- Usa esclusivamente informazioni presenti nei dati della campagna.
- NON inventare: servizi, tecnologie, strumenti, prezzi, sconti, gratuità, promozioni, risultati, garanzie, modalità di pagamento.
- Se un'informazione non è nei dati, OMETTILA. Non colmare i vuoti con tropi di settore (es. allineatori, ferretti, scansione 3D, check-up gratuito, tasso zero, "servizi locali").
- Non aggiungere percentuali o vantaggi economici non presenti nei dati.
- Non usare copy precedente o storico: questa richiesta è l'unica fonte.`;

function etichettaRotta(route: string): string {
  switch (route) {
    case "vendite-online":
    case "ecommerce":
    case "vendite":
      return "vendite-online (E-commerce / Sales)";
    case "instore":
    case "negozio":
      return "instore (Traffico in negozio)";
    case "retargeting":
    case "recupero":
      return "retargeting (Recupero carrelli / pubblico caldo)";
    case "apertura":
    case "lancio":
      return "apertura (Inaugurazione / Brand Awareness locale)";
    case "prenotazioni":
      return "prenotazioni (Bookings)";
    case "lead-gen":
    case "richieste-contatto":
    default:
      return "lead-gen (Lead Generation / Contatti)";
  }
}

function etichettaTono(tone: string): string {
  switch (tone) {
    case "autorevole":
      return "Autorevole e professionale: competente, rassicurante, mai aggressivo. Niente urgenza artificiale.";
    case "empatico":
      return "Empatico e risoluzione del problema: ascolto, comprensione, soluzione concreta. Niente hype promozionale.";
    default:
      return "Diretto e promozionale: chiaro e concreto, beneficio in apertura. Niente promesse di risultato né tono aggressivo.";
  }
}

function pulisciHeadlineApi(raw: string): string {
  let t = raw.replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (t.length > 50) {
    const prima = t.split(/[.|;—–]/)[0]?.trim() || t;
    t = prima.length >= 8 && prima.length <= 50 ? prima : t;
  }
  const parole = t.split(/\s+/).filter(Boolean);
  if (parole.length > 5) {
    t = parole.slice(0, 5).join(" ");
  }
  if (t.length > 45) {
    const taglio = t.slice(0, 45);
    const spazio = taglio.lastIndexOf(" ");
    t = spazio >= 20 ? taglio.slice(0, spazio).trimEnd() : taglio.trimEnd();
  }
  return t;
}

function estraiJson(
  testo: string,
  clientName: string,
): GenerateCopyResult {
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
  ) as Partial<GenerateCopyResult>;
  const headline = pulisciHeadlineApi(
    sanificaCopyDaMetadati(String(parsed.headline ?? ""), clientName),
  );
  const varianteA = sanificaCopyDaMetadati(
    String(parsed.varianteA ?? ""),
    clientName,
  );
  const varianteB = sanificaCopyDaMetadati(
    String(parsed.varianteB ?? ""),
    clientName,
  );
  const varianteC = sanificaCopyDaMetadati(
    String(parsed.varianteC ?? ""),
    clientName,
  );
  if (!headline || !varianteA || !varianteB || !varianteC) {
    throw new Error("JSON AI incompleto");
  }
  return {
    headline,
    varianteA,
    varianteB,
    varianteC,
  };
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return anthropicConfigMissingResponse();
  }

  let body: GenerateCopyBody;
  try {
    body = (await request.json()) as GenerateCopyBody;
  } catch {
    return NextResponse.json({ error: "Body JSON non valido" }, { status: 400 });
  }

  const route = String(body.route ?? "lead-gen").trim() || "lead-gen";
  const clientName = pulisciNomeAttivitaPubblico(
    String(body.clientName ?? ""),
  );
  const sector = String(body.sector ?? "").trim();
  const city = String(body.city ?? "").trim();
  const { cittaPrep } = cittaPrepLocale(city);
  const offer = String(body.offer ?? "").trim();
  const brief = String(body.brief ?? "").trim();
  const clientType = String(body.clientType ?? "B2C").trim() || "B2C";
  const tone = String(body.tone ?? "diretto").trim() || "diretto";
  const targetAge = String(body.targetAge ?? "").trim();

  const userPrompt = `Genera headline + 3 varianti copy per Meta Ads (testo per il PUBBLICO).

Rotta attiva (solo per te, NON inserirla nel copy): ${etichettaRotta(route)} (slug: ${route})
Nome attività da citare (UNICO nome brand consentito): ${clientName || "non specificato"}

SOURCE OF TRUTH:
1. Offerta: ${offer || "non specificata"}
2. Brief: ${brief || "non specificato"}
3. Settore: ${sector || "non specificato"}
4. Città inserita dall'utente: ${city || "(vuota)"} — locuzione obbligatoria nei testi: "${cittaPrep}"
5. Target: tipo ${clientType}${targetAge ? `, fascia età ${targetAge}` : ""}

Tono di voce OBBLIGATORIO per headline e TUTTE le varianti A/B/C:
${etichettaTono(tone)}

VINCOLI FINALI:
- Usa esclusivamente offerta, brief, settore, città e target. Nient'altro.
- Non inventare servizi, tecnologie, strumenti, prezzi, sconti, gratuità, promozioni, risultati, garanzie o pagamenti.
- Se un dato manca, omettilo.
- Nei valori JSON solo copy pubblicabile.
- Usa sempre la locuzione "${cittaPrep}".
- Headline ≤ 5 parole / 45 caratteri.
- varianteA Beneficio diretto; varianteB Autorevolezza; varianteC Empatico — tutte nel tono indicato.
Restituisci solo il JSON richiesto.`;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: anthropicModelId(),
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
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

    const result = estraiJson(testo, clientName);
    return NextResponse.json(result);
  } catch (err) {
    return anthropicErrorResponse(err);
  }
}
