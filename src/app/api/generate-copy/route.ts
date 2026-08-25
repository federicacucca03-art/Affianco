import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import {
  cittaPrepLocale,
  pulisciNomeAttivitaPubblico,
  sanificaCopyDaMetadati,
} from "@/lib/copy-pubblico";

export const runtime = "nodejs";

type GenerateCopyBody = {
  route?: string;
  clientName?: string;
  sector?: string;
  city?: string;
  offer?: string;
  brief?: string;
  clientType?: string;
};

type GenerateCopyResult = {
  headline: string;
  varianteA: string;
  varianteB: string;
  varianteC: string;
};

const SYSTEM_PROMPT = `Sei un copywriter senior specializzato in Meta Ads (Facebook/Instagram) per il mercato italiano.
Scrivi in italiano naturale, persuasivo e concreto: reward chiaro, riduzione del rischio, beneficio tangibile, CTA esplicita. Niente fuffa da agenzia.

REGOLE OBBLIGATORIE:
1. Rispondi SOLO con JSON valido, senza markdown, senza commenti, senza testo fuori dal JSON.
2. Schema esatto (i valori sono SOLO il copy finale da pubblicare, mai etichette o istruzioni):
{
  "headline": "…",
  "varianteA": "…",
  "varianteB": "…",
  "varianteC": "…"
}
3. Lingua: italiano naturale e grammaticalmente corretto (frasi complete, niente spezzature). Tono commerciale ma non spam.
4. Headline: massimo 5 parole d'impatto (es. "Sorriso Perfetto Senza Ferretti ✨"). Max 45 caratteri. NON inserire mai l'intero brief né il nome campagna. Niente hashtag, massimo 1 emoji.
5. NOME ATTIVITÀ vs NOME CAMPAGNA (CRITICO):
   - Usa ESCLUSIVAMENTE il nome attività/cliente fornito (es. "Studio Dentistico Dr. Rossi").
   - VIETATO usare o citare il nome campagna interno (es. "Studio Dentistico Rossi - Lead Gen - Agosto 2026").
   - VIETATO inserire nel copy: Lead Gen, Lead Generation, Retargeting, Awareness, Advantage+, CPL, CPA, Broad, Lookalike, date di campagna, tag interni.
6. CITTÀ (CRITICO):
   - Se la città è indicata (es. Milano), scrivi sempre "a Milano" (o locuzione naturale equivalente).
   - Se la città NON è indicata, scrivi "nella tua zona" — MAI "a la tua zona", MAI segnaposto tipo [Città]/XXX.
7. COPY PURO — VIETATO nei valori JSON qualsiasi prefisso da prompt, ad esempio:
   "Hook immediato:", "Variante:", "Variante A:", "Testo:", "Offerta:", "Angolo:", "Copy:", "CTA:".
   Ogni stringa deve essere solo testo annuncio pronto per Meta.
8. Tre angoli (solo strategia interna — non scriverli nel testo):
   - varianteA = Beneficio Diretto & Promo: apri sul beneficio concreto + promo (es. scansione 3D + promo allineatori). Offerta nelle prime 120 battute.
   - varianteB = Autorevolezza & Garanzia: tecnologia/metodo, rassicurazione, facilità (es. niente ferretti visibili, tasso zero).
   - varianteC = Empatico & Risoluzione Problema: disagio emotivo + soluzione comoda.
9. CTA finale chiara in ogni variante. Lead-gen locale: es. "Prenota il tuo check-up gratuito in clinica a Milano." (adatta a offerta/città; se città assente usa "nella tua zona").
10. Ogni variante: 2–4 frasi fluide. Adatta la CTA alla rotta (solo come strategia — non scrivere i nomi rotta nel copy):
   - vendite-online → «Acquista ora»; instore → «Ottieni indicazioni»; retargeting → «Completa l'ordine»;
   - lead-gen → prenota/richiedi; prenotazioni → prenota/WhatsApp; apertura → «Scopri di più».
11. Non inventare prezzi/sconti se non nell'offerta. Niente lorem ipsum.`;

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
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY non configurata" },
      { status: 500 },
    );
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

  const userPrompt = `Genera headline + 3 varianti copy per Meta Ads (testo per il PUBBLICO).

Rotta attiva (solo per te, NON inserirla nel copy): ${etichettaRotta(route)} (slug: ${route})
Nome attività da citare (UNICO nome brand consentito): ${clientName || "non specificato"}
Settore: ${sector || "non specificato"}
Città inserita dall'utente: ${city || "(vuota)"}
Locuzione città obbligatoria nei testi: "${cittaPrep}"
Offerta principale (PROMO — nelle prime 120 battute della varianteA): ${offer || "non specificata"}
Brief / prodotto hero (estrai benefici; NON copiare il brief in headline): ${brief || "non specificato"}
Tipo cliente: ${clientType}

VINCOLI FINALI:
- Nei valori JSON solo copy pubblicabile: niente "Hook immediato:", "Variante:", "Testo:", "Offerta:".
- Usa sempre la locuzione "${cittaPrep}" (es. "a Milano" oppure "nella tua zona").
- Headline ≤ 5 parole / 45 caratteri.
- varianteA Beneficio & Promo; varianteB Autorevolezza & Garanzia; varianteC Empatico.
- CTA finale chiara (es. "Prenota il tuo check-up gratuito in clinica ${cittaPrep}." se coerente).
Restituisci solo il JSON richiesto.`;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1200,
      temperature: 0.7,
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
        { error: "Risposta AI vuota" },
        { status: 502 },
      );
    }

    const result = estraiJson(testo, clientName);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Errore generazione copy";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
