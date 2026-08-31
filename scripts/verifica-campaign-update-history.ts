/**
 * Verifica Campaign Update History V1.
 * Esegui: npx tsx scripts/verifica-campaign-update-history.ts
 */
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { readFileSync } from "node:fs";

let falliti = 0;

function assert(cond: unknown, msg: string) {
  if (!cond) {
    falliti += 1;
    console.error(`FAIL  ${msg}`);
  } else {
    console.log(`PASS  ${msg}`);
  }
}

function legge(path: string): string {
  return readFileSync(path, "utf8");
}

async function main() {
  const {
    creaSnapshotConfigurazione,
    diffConfigurazione,
    testoLogAggiornamento,
    deveInvalidareApprovazione,
    haModificaSostanziale,
    firmaSostanziale,
  } = await import("@/lib/campagna-edit");
  const { etichettaEvento, emojiEvento } = await import("@/lib/campaign-logs");

  const creativa = [{ id: "c1", storagePath: "user/c1.jpg" }];
  const base = {
    frontEndOffer: "Prima visita",
    elevatorPitch: "Studio a Roma",
    varianteA: "Copy A",
    varianteB: "Copy B",
    varianteC: "Copy C",
    titoloAnnuncio: "Headline",
    creativita: creativa,
    dailyBudget: 21.6,
    launchBudget: 0,
    citta: "Roma",
    raggioKm: 15,
    etaMin: 25,
    etaMax: 50,
    targetType: "B2C",
    targetAge: "25-50",
    ticket: 1500,
    conversionRate: 15,
    margine: 50,
    objective: "LEADS",
    destinationUrl: "https://esempio.it",
    heroProduct: "",
    bookingChannel: undefined as string | undefined,
    pageId: "",
    formId: "",
    conversionRateSource: "REAL",
    nomeCampagna: "Interno",
  };

  console.log("\n=== UPDATED EVENT ===");
  assert(etichettaEvento("UPDATED") === "Aggiornamento", "label Aggiornamento");
  assert(emojiEvento("UPDATED") === "✏️", "emoji ✏️");
  const logsSrc = legge("src/lib/campaign-logs.ts");
  assert(logsSrc.includes("logCampagnaAggiornata"), "helper logCampagnaAggiornata");
  assert(logsSrc.includes('eventType: "UPDATED"'), "helper usa UPDATED");

  const migrazione = legge(
    "supabase/migrations/20260831_campaign_logs_event_updated.sql",
  );
  assert(migrazione.includes("'UPDATED'"), "migration include UPDATED");
  assert(migrazione.includes("NOTE_ADDED"), "migration mantiene tipi esistenti");
  assert(!/add column/i.test(migrazione), "migration senza colonne nuove");
  assert(!/jsonb/i.test(migrazione), "migration senza jsonb");
  assert(!/user_id/i.test(migrazione), "migration senza user_id");

  console.log("\n=== TEST 1 — DRAFT budget 21,6 → 23 ===");
  const s1 = creaSnapshotConfigurazione(base);
  const s1b = creaSnapshotConfigurazione({ ...base, dailyBudget: 23 });
  const d1 = diffConfigurazione(s1, s1b);
  const t1 = testoLogAggiornamento(d1);
  assert(d1.length === 1, "1 solo campo nel changeset");
  assert(t1.title === "Configurazione modificata", "title singolo cambiamento");
  assert(
    t1.description === "Budget giornaliero: 21,60€ → 23,00€",
    `description budget (got: ${t1.description})`,
  );
  assert(
    !deveInvalidareApprovazione("DRAFT", true),
    "DRAFT non invalida approval",
  );

  console.log("\n=== TEST 2 — NO OP ===");
  const d0 = diffConfigurazione(s1, creaSnapshotConfigurazione(base));
  assert(d0.length === 0, "nessun changeset se identico");
  assert(
    testoLogAggiornamento(d0).description === "",
    "description vuota se no-op (non si scrive il log)",
  );

  console.log("\n=== TEST 3 — APPROVED + Page ID ===");
  const dPage = diffConfigurazione(
    s1,
    creaSnapshotConfigurazione({ ...base, pageId: "PAGE-99" }),
  );
  const tPage = testoLogAggiornamento(dPage, {
    richiestaNuovaApprovazione: false,
  });
  assert(dPage.length === 1, "solo Page ID");
  assert(tPage.description.includes("Page ID aggiunto"), "Page ID aggiunto");
  assert(
    !tPage.description.includes("Richiesta nuova approvazione"),
    "niente invalidazione per Page ID",
  );
  assert(
    !deveInvalidareApprovazione(
      "APPROVED",
      haModificaSostanziale(firmaSostanziale(base), firmaSostanziale(base)),
    ),
    "Page ID non è sostanziale → resta APPROVED",
  );
  assert(
    !firmaSostanziale(base).includes("PAGE"),
    "firma sostanziale ignora Page ID",
  );

  console.log("\n=== TEST 4 — APPROVED + copy ===");
  const dCopy = diffConfigurazione(
    s1,
    creaSnapshotConfigurazione({ ...base, varianteA: "Copy A nuovo" }),
  );
  const tCopy = testoLogAggiornamento(dCopy, {
    richiestaNuovaApprovazione: true,
  });
  assert(dCopy.length === 1, "solo Variante A");
  assert(tCopy.title === "Configurazione modificata", "title 1 cambiamento");
  assert(tCopy.description.includes("Variante A modificata"), "Variante A modificata");
  assert(
    tCopy.description.includes("Richiesta nuova approvazione"),
    "frase invalidazione nello stesso UPDATED",
  );
  assert(
    !tCopy.description.includes("Copy A nuovo"),
    "niente dump copy in description",
  );
  assert(
    !tCopy.description.toLowerCase().includes("token"),
    "approval_token non in description",
  );
  assert(
    deveInvalidareApprovazione("APPROVED", true),
    "APPROVED + sostanziale → invalida",
  );

  console.log("\n=== TEST 5 — MULTI CHANGE ===");
  const dMulti = diffConfigurazione(
    s1,
    creaSnapshotConfigurazione({
      ...base,
      dailyBudget: 23,
      raggioKm: 20,
      varianteA: "Copy A nuovo",
    }),
  );
  const tMulti = testoLogAggiornamento(dMulti);
  assert(dMulti.length === 3, "3 cambiamenti");
  assert(
    tMulti.title === "3 modifiche alla configurazione",
    `title N modifiche (got: ${tMulti.title})`,
  );
  assert(
    tMulti.description.includes("Budget giornaliero: 21,60€ → 23,00€"),
    "budget in description",
  );
  assert(
    tMulti.description.includes("Raggio: 15 km → 20 km"),
    "raggio in description",
  );
  assert(
    tMulti.description.includes("Variante A modificata"),
    "variante A in description",
  );

  console.log("\n=== TEST 6 — REVISION_REQUESTED ===");
  const tRev = testoLogAggiornamento(dCopy, {
    richiestaNuovaApprovazione: false,
  });
  assert(
    !tRev.description.includes("Richiesta nuova approvazione"),
    "REVISION_REQUESTED: niente frase invalidazione",
  );
  assert(
    !deveInvalidareApprovazione("REVISION_REQUESTED", true),
    "status resta REVISION_REQUESTED",
  );
  assert(
    !tRev.description.toLowerCase().includes("revision"),
    "revision_notes non copiate nel log",
  );

  console.log("\n=== TEST 7 — CREATIVE UNTOUCHED ===");
  const dNoCreative = diffConfigurazione(
    s1,
    creaSnapshotConfigurazione({ ...base, dailyBudget: 23 }),
  );
  assert(
    !dNoCreative.some((c) => c.campo === "creativita"),
    "creative invariata assente dal changeset",
  );

  console.log("\n=== TEST 8 — CREATIVE REPLACED ===");
  const dRep = diffConfigurazione(
    s1,
    creaSnapshotConfigurazione({
      ...base,
      creativita: [{ id: "c2", storagePath: "user/c2.jpg" }],
    }),
  );
  assert(dRep.length === 1, "solo creative");
  assert(
    dRep[0].descrizione === "Creatività sostituita",
    `sostituita (got: ${dRep[0]?.descrizione})`,
  );
  const dAdd = diffConfigurazione(
    creaSnapshotConfigurazione({ ...base, creativita: [] }),
    s1,
  );
  assert(dAdd[0]?.descrizione === "Creatività aggiunta", "creatività aggiunta");
  const dDel = diffConfigurazione(
    s1,
    creaSnapshotConfigurazione({ ...base, creativita: [] }),
  );
  assert(dDel[0]?.descrizione === "Creatività rimossa", "creatività rimossa");
  assert(
    !JSON.stringify(dRep).includes("blob:") &&
      !JSON.stringify(dRep).includes("http"),
    "niente blob/signed URL nel diff",
  );

  console.log("\n=== TEST 9 — CANCEL (contratto) ===");
  const wizard = legge("src/components/nuova-contatti/PercorsoContatti.tsx");
  const idxAnnulla = wizard.indexOf("\n                Annulla");
  const chunkAnnulla = wizard.slice(
    Math.max(0, idxAnnulla - 400),
    idxAnnulla + 80,
  );
  assert(
    chunkAnnulla.includes("router.push") &&
      !chunkAnnulla.includes("logCampagnaAggiornata"),
    "Annulla: redirect senza log",
  );

  console.log("\n=== TEST 10 — STESSO ID / COUNT ===");
  assert(
    wizard.includes("salvaCampagnaCompleta") &&
      wizard.includes("campaignId"),
    "edit usa UPDATE stesso campaignId",
  );

  console.log("\n=== SAVE ORDER + NO-OP LOG ===");
  assert(wizard.includes("changesetEdit"), "changeset calcolato in save");
  assert(
    wizard.includes("logCampagnaAggiornata") &&
      wizard.includes("Diario non bloccante"),
    "log dopo successo, non bloccante",
  );
  assert(
    wizard.includes("changesetEdit.length > 0"),
    "nessun UPDATED se changeset vuoto",
  );
  const idxSave = wizard.indexOf("const salvata = await salvaCampagnaCompleta");
  const idxLog = wizard.indexOf("await logCampagnaAggiornata");
  assert(idxSave > 0 && idxLog > idxSave, "log DOPO UPDATE riuscito");

  console.log("\n=== CAMPI LUNGHI / CORTI ===");
  const dBrief = diffConfigurazione(
    s1,
    creaSnapshotConfigurazione({ ...base, elevatorPitch: "Nuovo brief" }),
  );
  assert(dBrief[0]?.descrizione === "Brief modificato", "brief lungo = modificato");
  const dOffAdd = diffConfigurazione(
    creaSnapshotConfigurazione({ ...base, frontEndOffer: "" }),
    s1,
  );
  assert(dOffAdd[0]?.descrizione === "Offerta aggiunta", "offerta aggiunta");
  const dHeadDel = diffConfigurazione(
    s1,
    creaSnapshotConfigurazione({ ...base, titoloAnnuncio: "" }),
  );
  assert(dHeadDel[0]?.descrizione === "Headline rimossa", "headline rimossa");
  const dRate = diffConfigurazione(
    s1,
    creaSnapshotConfigurazione({ ...base, conversionRate: 12 }),
  );
  assert(
    dRate[0]?.descrizione === "Conversion rate: 15% → 12%",
    `conversion rate (got: ${dRate[0]?.descrizione})`,
  );

  const ordineDiverso = creaSnapshotConfigurazione({
    nomeCampagna: base.nomeCampagna,
    pageId: base.pageId,
    dailyBudget: base.dailyBudget,
    varianteA: base.varianteA,
    creativita: base.creativita,
    citta: base.citta,
    raggioKm: base.raggioKm,
    frontEndOffer: base.frontEndOffer,
    elevatorPitch: base.elevatorPitch,
    varianteB: base.varianteB,
    varianteC: base.varianteC,
    titoloAnnuncio: base.titoloAnnuncio,
    launchBudget: base.launchBudget,
    etaMin: base.etaMin,
    etaMax: base.etaMax,
    targetType: base.targetType,
    targetAge: base.targetAge,
    ticket: base.ticket,
    conversionRate: base.conversionRate,
    margine: base.margine,
    objective: base.objective,
    destinationUrl: base.destinationUrl,
    heroProduct: base.heroProduct,
    formId: base.formId,
    conversionRateSource: base.conversionRateSource,
  });
  assert(
    diffConfigurazione(s1, ordineDiverso).length === 0,
    "confronto non dipende dall'ordine delle chiavi input",
  );

  console.log("\n=== REGRESSIONI CONTRATTO ===");
  assert(
    !wizard.includes("regenerate_campaign_approval_token"),
    "wizard non rigenera token",
  );
  assert(
    wizard.includes("completaRevisioneCampagnaSuSupabase") &&
      !wizard.includes("logCampagnaAggiornata(salvata"),
    "revision helper invariato (log solo via helper dedicato)",
  );

  if (falliti > 0) {
    console.error(`\n${falliti} test falliti`);
    process.exit(1);
  }
  console.log("\nTutti i test campaign-update-history sono passati.");
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
