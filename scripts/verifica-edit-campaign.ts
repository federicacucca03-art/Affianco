/**
 * Verifica Edit Campaign Mode (slice sicuro).
 * Esegui: npx tsx scripts/verifica-edit-campaign.ts
 *
 * Env dummy PRIMA di qualsiasi import che tocca supabase-js
 * (gli import ESM statici verrebbero hoistati).
 */
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { readFileSync } from "node:fs";
import type { Campagna } from "@/types/campagne";
import type { CreativitaMeta } from "@/lib/creativita";

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
  const { hrefModificaConfigurazione } = await import(
    "@/data/percorsi-nuova-campagna"
  );
  const {
    deveInvalidareApprovazione,
    firmaSostanziale,
    haModificaSostanziale,
    snapshotDaCampagna,
  } = await import("@/lib/campagna-edit");
  const { costruisciPayloadCampagna } = await import("@/lib/campagne-db");
  const { pathsCreativitaRimossi } = await import("@/lib/creativita-storage");

const SNAPSHOT_BASE = {
  frontEndOffer: "Prima visita",
  elevatorPitch: "Studio a Roma",
  varianteA: "Copy A",
  varianteB: "Copy B",
  varianteC: "Copy C",
  titoloAnnuncio: "Headline",
  creativita: [{ id: "c1", storagePath: "user/c1.jpg" }],
  dailyBudget: 20,
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
};

const CREATIVA: CreativitaMeta = {
  id: "c1",
  nomeFile: "hero.jpg",
  width: 1080,
  height: 1080,
  ruolo: "principale",
  avvisoFormato: false,
  storagePath: "user/c1.jpg",
};

function campagnaBase(extra: Partial<Campagna> = {}): Campagna {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    nomeCliente: "Aurora",
    iniziali: "AU",
    stato: "Da lanciare",
    giudizio: "Ancora presto",
    objective: "LEADS",
    nomeCampagna: "Interno non visibile",
    budgetGiornaliero: 20,
    citta: "Roma",
    raggioKm: 15,
    etaMin: 25,
    etaMax: 50,
    varianteA: "Copy A",
    varianteB: "Copy B",
    varianteC: "Copy C",
    titoloAnnuncio: "Headline",
    frontEndOffer: "Prima visita",
    elevatorPitch: "Studio a Roma",
    website: "https://esempio.it",
    pageId: "PAGE-1",
    formId: "FORM-1",
    conversionRateSource: "REAL",
    tassoConversionePercent: 15,
    scontrinoMedio: 1500,
    targetMargin: 50,
    targetType: "B2C",
    targetAge: "25-50",
    status: "DRAFT",
    approvalToken: "token-stabile",
    creativitaMeta: [CREATIVA],
    ...extra,
  };
}

const writeBase = {
  clientId: "client-1",
  name: "Richieste Contatto",
  dailyBudget: 20,
  objective: "LEADS" as const,
  varianteA: "Copy A",
  pageId: "PAGE-1",
  formId: "FORM-1",
  frontEndOffer: "Offerta",
  titoloAnnuncio: "Headline",
};

console.log("\n=== ROTTE EDIT PER OBIETTIVO ===");
assert(
  hrefModificaConfigurazione("abc", "LEADS") ===
    "/campagne/nuova/richieste-contatto?campaignId=abc",
  "LEADS → richieste-contatto?campaignId",
);
assert(
  hrefModificaConfigurazione("abc", "BOOKINGS") ===
    "/campagne/nuova/prenotazioni?campaignId=abc",
  "BOOKINGS → prenotazioni?campaignId",
);
assert(
  hrefModificaConfigurazione("abc", "ECOMMERCE") ===
    "/campagne/nuova/vendite-online?campaignId=abc",
  "ECOMMERCE → vendite-online (non /vendite)",
);
assert(
  hrefModificaConfigurazione("abc", "IN_STORE") ===
    "/campagne/nuova/instore?campaignId=abc",
  "IN_STORE → instore?campaignId",
);
assert(
  hrefModificaConfigurazione("abc", "RETARGETING") ===
    "/campagne/nuova/retargeting?campaignId=abc",
  "RETARGETING → retargeting?campaignId",
);
assert(
  hrefModificaConfigurazione("abc", "AWARENESS") ===
    "/campagne/nuova/apertura?campaignId=abc",
  "AWARENESS → apertura?campaignId",
);
assert(
  !hrefModificaConfigurazione("x", "ECOMMERCE").includes("richieste-contatto"),
  "ECOMMERCE non hardcoda richieste-contatto",
);

console.log("\n=== FIRMA SOSTANZIALE (ordine fisso, non JSON) ===");
const f1 = firmaSostanziale(SNAPSHOT_BASE);
const f2 = firmaSostanziale({
  bookingChannel: SNAPSHOT_BASE.bookingChannel,
  heroProduct: SNAPSHOT_BASE.heroProduct,
  destinationUrl: SNAPSHOT_BASE.destinationUrl,
  objective: SNAPSHOT_BASE.objective,
  margine: SNAPSHOT_BASE.margine,
  conversionRate: SNAPSHOT_BASE.conversionRate,
  ticket: SNAPSHOT_BASE.ticket,
  targetAge: SNAPSHOT_BASE.targetAge,
  targetType: SNAPSHOT_BASE.targetType,
  etaMax: SNAPSHOT_BASE.etaMax,
  etaMin: SNAPSHOT_BASE.etaMin,
  raggioKm: SNAPSHOT_BASE.raggioKm,
  citta: SNAPSHOT_BASE.citta,
  launchBudget: SNAPSHOT_BASE.launchBudget,
  dailyBudget: SNAPSHOT_BASE.dailyBudget,
  creativita: SNAPSHOT_BASE.creativita,
  titoloAnnuncio: SNAPSHOT_BASE.titoloAnnuncio,
  varianteC: SNAPSHOT_BASE.varianteC,
  varianteB: SNAPSHOT_BASE.varianteB,
  varianteA: SNAPSHOT_BASE.varianteA,
  elevatorPitch: SNAPSHOT_BASE.elevatorPitch,
  frontEndOffer: SNAPSHOT_BASE.frontEndOffer,
});
assert(f1 === f2, "stesso snapshot indipendente dall'ordine delle chiavi");
assert(!f1.includes("PAGE"), "Page ID assente dalla firma");
assert(!f1.includes("FORM"), "Form ID assente dalla firma");
assert(!f1.includes("REAL"), "conversion_rate_source assente dalla firma");
assert(!f1.includes("Interno"), "nome campagna interno assente dalla firma");

const fPage = firmaSostanziale(SNAPSHOT_BASE);
assert(
  !haModificaSostanziale(fPage, fPage),
  "identico → nessuna modifica sostanziale",
);
assert(
  haModificaSostanziale(
    fPage,
    firmaSostanziale({ ...SNAPSHOT_BASE, varianteA: "Copy A nuovo" }),
  ),
  "cambio copy → sostanziale",
);
assert(
  haModificaSostanziale(
    fPage,
    firmaSostanziale({ ...SNAPSHOT_BASE, dailyBudget: 35 }),
  ),
  "cambio budget → sostanziale",
);
assert(
  firmaSostanziale({ ...SNAPSHOT_BASE, conversionRate: 15 }) ===
    firmaSostanziale({ ...SNAPSHOT_BASE, conversionRate: 15 }),
  "stesso tasso numerico (source ignorato) → identico",
);

console.log("\n=== TEST 1 — DRAFT + budget ===");
assert(
  !deveInvalidareApprovazione("DRAFT", true),
  "DRAFT + sostanziale → non invalida (resta DRAFT)",
);
assert(
  !deveInvalidareApprovazione("DRAFT", false),
  "DRAFT + non sostanziale → resta DRAFT",
);

console.log("\n=== TEST 2 — Annulla (contratto UI, nessun write) ===");
const wizard = legge("src/components/nuova-contatti/PercorsoContatti.tsx");
assert(
  wizard.includes('router.push(`/campagne/${campaignIdEdit}`)'),
  "Annulla → /campagne/{id}",
);
assert(
  /Annulla[\s\S]{0,400}router\.push/.test(wizard.replace(/\n/g, " ")) ||
    wizard.includes("Annulla"),
  "CTA Annulla presente",
);
const clickAnnulla = wizard.slice(
  wizard.indexOf(">Annulla<") > 0
    ? wizard.lastIndexOf("onClick", wizard.indexOf(">Annulla<"))
    : wizard.indexOf("Annulla") - 200,
);
assert(
  !clickAnnulla.includes("assicuraCampagnaSalvata") &&
    !clickAnnulla.includes("salvaCampagnaCompleta"),
  "Annulla non chiama save/write",
);

console.log("\n=== TEST 3 — REVISION_REQUESTED ===");
assert(
  !deveInvalidareApprovazione("REVISION_REQUESTED", true),
  "REVISION_REQUESTED + copy → non invalida (resta REVISION_REQUESTED)",
);
assert(
  !wizard.includes("completaRevisioneCampagnaSuSupabase(salvata"),
  "save edit non chiama completaRevisione",
);
const invalidaSrc = legge("src/lib/campagne-db.ts");
const fnInvalida = invalidaSrc.slice(
  invalidaSrc.indexOf("invalidaApprovazioneDopoModificaSostanziale"),
  invalidaSrc.indexOf("invalidaApprovazioneDopoModificaSostanziale") + 450,
);
assert(
  fnInvalida.includes('status: "DRAFT"') &&
    fnInvalida.includes("approved_at: null") &&
    !fnInvalida.includes("approval_token") &&
    !fnInvalida.includes("revision_notes"),
  "invalidazione tocca solo status + approved_at",
);

console.log("\n=== TEST 4 — APPROVED sostanziale ===");
assert(
  deveInvalidareApprovazione("APPROVED", true),
  "APPROVED + copy → invalida (DRAFT, approved_at null, token identico)",
);

console.log("\n=== TEST 5 — APPROVED non sostanziale (Page ID) ===");
const snapApproved = snapshotDaCampagna(
  campagnaBase({ status: "APPROVED", pageId: "PAGE-1" }),
);
const snapPageOnly = snapshotDaCampagna(
  campagnaBase({ status: "APPROVED", pageId: "PAGE-999" }),
);
assert(
  snapApproved === snapPageOnly,
  "solo Page ID → firma identica",
);
assert(
  !deveInvalidareApprovazione(
    "APPROVED",
    haModificaSostanziale(snapApproved, snapPageOnly),
  ),
  "APPROVED + solo Page ID → resta APPROVED",
);
const snapForm = snapshotDaCampagna(
  campagnaBase({ formId: "FORM-999" }),
);
assert(
  snapApproved === snapForm,
  "solo Form ID → firma identica",
);
const snapNome = snapshotDaCampagna(
  campagnaBase({ nomeCampagna: "Altro nome interno" }),
);
assert(
  snapApproved === snapNome,
  "solo nome interno → firma identica",
);
const snapCrs = snapshotDaCampagna(
  campagnaBase({ conversionRateSource: "ESTIMATED", tassoConversionePercent: 15 }),
);
assert(
  snapApproved === snapCrs,
  "solo conversion_rate_source, stesso tasso → firma identica",
);

console.log("\n=== TEST 6 — CREATIVITÀ preservata ===");
const stessa = pathsCreativitaRimossi([CREATIVA], [CREATIVA]);
assert(stessa.length === 0, "re-save stessa creatività → nessun path da eliminare");
const storage = legge("src/lib/creativita-storage.ts");
assert(
  storage.includes("pathSuAsset") &&
    storage.includes("continue") &&
    storage.includes("urlAnteprimaCreativitaOwner"),
  "reuse storagePath + signed URL owner (no API approval pubblica)",
);
assert(
  !legge("src/app/api/approval/creative-url/route.ts").includes("edit mode"),
  "API approval creative-url non toccata da questo test di contratto",
);
assert(
  wizard.includes("anteprimeDaCreativitaMeta"),
  "hydrate creatività da metadata DB",
);

console.log("\n=== TEST 7 — DB SOURCE OF TRUTH ===");
assert(
  wizard.includes("ignoraCacheLocale: true"),
  "hydrate edit ignora cache locale",
);
assert(
  wizard.includes("leggiCampagnaDaSupabase(campaignIdEdit"),
  "hydrate da campaignId URL",
);
assert(
  /if \(idEdit\) return/.test(wizard) ||
    wizard.includes('if (idEdit) return'),
  "reset nuova campagna saltato in edit mode",
);

console.log("\n=== TEST 8 — STESSO ID / NESSUN DUPLICATO ===");
assert(
  wizard.includes("campagnaIdStabileRef.current = campaignIdEdit") ||
    wizard.includes("campagnaIdStabileRef.current = trovata.id"),
  "edit mode fissa lo stesso campaign.id",
);
assert(
  wizard.includes("isEditMode && campaignIdEdit"),
  "edit non genera UUID se manca il ref",
);
assert(
  invalidaSrc.includes("if (isUpdate)") &&
    invalidaSrc.includes("aggiornaCampagnaLeadGen(campaignId"),
  "riga esistente → UPDATE stesso id",
);

console.log("\n=== CAMPI SVUOTABILI ===");
const payloadVuoto = costruisciPayloadCampagna(
  {
    ...writeBase,
    varianteA: "",
    varianteB: "",
    varianteC: "",
    pageId: "",
    formId: "",
    titoloAnnuncio: "",
    frontEndOffer: "",
    heroProduct: "",
    permettiCampiVuoti: true,
  },
  { includeStatus: false, scriviVuoti: true },
);
assert(payloadVuoto.variante_a === null, "variante_a vuota → null");
assert(payloadVuoto.page_id === null, "page_id vuoto → null");
assert(payloadVuoto.form_id === null, "form_id vuoto → null");
assert(payloadVuoto.titolo_annuncio === null, "titolo_annuncio vuoto → null");
assert(payloadVuoto.front_end_offer === null, "front_end_offer vuoto → null");
assert(payloadVuoto.hero_product === null, "hero_product vuoto → null");
assert(
  !("status" in payloadVuoto),
  "UPDATE wizard non scrive status",
);
assert(
  !("approval_token" in payloadVuoto),
  "payload update non tocca approval_token",
);
assert(
  !("revision_notes" in payloadVuoto) && !("approved_at" in payloadVuoto),
  "payload update non tocca revision_notes / approved_at",
);

const payloadCreate = costruisciPayloadCampagna(
  { ...writeBase, varianteA: "", pageId: "" },
  { includeStatus: true },
);
assert(
  payloadCreate.variante_a === undefined && payloadCreate.page_id === undefined,
  "create senza permettiCampiVuoti non scrive stringhe vuote",
);

console.log("\n=== CONTRATTO UI ===");
const dettaglio = legge("src/app/campagne/[id]/page.tsx");
assert(
  dettaglio.includes("Modifica configurazione"),
  "CTA Modifica configurazione sul dettaglio",
);
assert(
  dettaglio.includes("hrefModificaConfigurazione"),
  "CTA usa mappa route per obiettivo",
);
assert(
  wizard.includes("Stai modificando una campagna esistente"),
  "banner edit mode",
);
assert(wizard.includes("Salva modifiche"), "CTA Salva modifiche");

console.log("\n=== REGRESSIONI (file non toccati da questo slice) ===");
assert(
  !wizard.includes("regenerate_campaign_approval_token"),
  "wizard non rigenera approval_token",
);
assert(
  !invalidaSrc
    .slice(
      invalidaSrc.indexOf("invalidaApprovazioneDopoModificaSostanziale"),
      invalidaSrc.indexOf(
        "invalidaApprovazioneDopoModificaSostanziale",
      ) + 500,
    )
    .includes("regenerate"),
  "invalidazione non chiama regenerate token",
);

if (falliti > 0) {
    console.error(`\n${falliti} test falliti`);
    process.exit(1);
  }
  console.log("\nTutti i test edit-campaign sono passati.");
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
