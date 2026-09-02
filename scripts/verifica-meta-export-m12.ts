/**
 * M1.2A+B — Meta bulk export hardening.
 * Esegui: npx tsx scripts/verifica-meta-export-m12.ts
 */
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "test-anon-key";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { generaCodiceImportMeta } from "@/data/meta-import-tsv";
import {
  COPY_STATO_EXPORT,
  LABEL_CTA_EXPORT_META,
  ctaExportAbilitata,
  profiloExportMeta,
  raggioExportKm,
  testoStatoExport,
  urlDestinazioneExportValido,
  valutaExportMeta,
  vociPreExport,
} from "@/lib/meta-export-readiness";
import type { ConfigurazioneContatti } from "@/types/campagne";

let falliti = 0;

function assert(cond: unknown, msg: string): boolean {
  if (!cond) {
    falliti += 1;
    console.error(`FAIL  ${msg}`);
    return false;
  }
  console.log(`PASS  ${msg}`);
  return true;
}

const COPY = "Copy annuncio locale con offerta chiara.";
const PAGE = "102938475610293";
const FORM = "238512345678901";

function base(extra: Partial<ConfigurazioneContatti> = {}): ConfigurazioneContatti {
  return {
    nomeCliente: "Studio Aurora",
    nomeCampagna: "Aurora - Test Export",
    budgetGiornaliero: 25,
    cboAttivo: true,
    raggioKm: 15,
    etaMin: 25,
    etaMax: 50,
    genere: "Tutti",
    targetingBroad: true,
    posizionamentiAdvantage: true,
    varianteA: COPY,
    varianteB: "",
    varianteC: "",
    titoloAnnuncio: "Headline test",
    scontrinoMedio: 100,
    tassoConversionePercent: 10,
    ...extra,
  };
}

function righeDati(csv: string): string[] {
  return csv
    .replace(/^\uFEFF/, "")
    .trim()
    .split("\n")
    .slice(1)
    .filter(Boolean);
}

console.log("\n=== M1.2A CASE A LEADS_FORM valid ===");
const leadsOk = valutaExportMeta({
  config: base(),
  pageId: PAGE,
  formId: FORM,
  objective: "LEADS",
});
const csvLeads = generaCodiceImportMeta(base(), "Roma", PAGE, FORM, "LEADS");
assert(leadsOk.profile === "LEADS_FORM", "A profile");
assert(leadsOk.status !== "NOT_EXPORTABLE", "A exportable");
assert(csvLeads.includes("Outcome Leads"), "A Outcome Leads");
assert(csvLeads.includes("LEAD_GENERATION"), "A LEAD_GENERATION");
assert(csvLeads.includes("PAUSED"), "A PAUSED");

console.log("\n=== M1.2A CASE B missing form ===");
const leadsNoForm = valutaExportMeta({
  config: base(),
  pageId: PAGE,
  formId: "",
  objective: "LEADS",
});
assert(leadsNoForm.status === "NOT_EXPORTABLE", "B NOT_EXPORTABLE");
assert(!generaCodiceImportMeta(base(), "Roma", PAGE, "", "LEADS").trim(), "B no CSV");

console.log("\n=== M1.2A CASE C budget 0 ===");
const noBudget = valutaExportMeta({
  config: base({ budgetGiornaliero: 0 }),
  pageId: PAGE,
  formId: FORM,
  objective: "LEADS",
});
assert(noBudget.status === "NOT_EXPORTABLE", "C NOT_EXPORTABLE");
const csvBudget0 = generaCodiceImportMeta(
  base({ budgetGiornaliero: 0 }),
  "Roma",
  PAGE,
  FORM,
  "LEADS",
);
assert(!csvBudget0.trim(), "C no CSV");
assert(!csvBudget0.includes(",20,"), "C no silent 20");

console.log("\n=== M1.2A CASE D BOOKINGS_WEBSITE valid ===");
const bookWeb = valutaExportMeta({
  config: base(),
  pageId: PAGE,
  objective: "BOOKINGS",
  bookingChannel: "BOOKING_LINK",
  destinationUrl: "https://prenota.studio.it/agenda",
});
const csvBookWeb = generaCodiceImportMeta(
  base(),
  "Roma",
  PAGE,
  "",
  "BOOKINGS",
  "BOOKING_LINK",
  undefined,
  "https://prenota.studio.it/agenda",
);
assert(bookWeb.profile === "BOOKINGS_WEBSITE", "D profile");
assert(bookWeb.status !== "NOT_EXPORTABLE", "D exportable");
assert(csvBookWeb.includes("BOOK_NOW"), "D CTA");

console.log("\n=== M1.2A CASE E BOOKINGS_WEBSITE missing URL ===");
const bookNoUrl = valutaExportMeta({
  config: base(),
  pageId: PAGE,
  objective: "BOOKINGS",
  bookingChannel: "BOOKING_LINK",
});
assert(bookNoUrl.status === "NOT_EXPORTABLE", "E NOT_EXPORTABLE");

console.log("\n=== M1.2A CASE F BOOKINGS_WHATSAPP ===");
const csvWa = generaCodiceImportMeta(
  base(),
  "Roma",
  PAGE,
  "",
  "BOOKINGS",
  "WHATSAPP",
  undefined,
  undefined,
  "+39 333 1234567",
);
assert(csvWa.includes("SEND_WHATSAPP_MESSAGE"), "F WA CTA");
assert(!csvWa.toLowerCase().includes("google.com"), "F no google");
assert(csvWa.includes("wa.me"), "F wa.me");

console.log("\n=== M1.2A CASE G ECOMMERCE valid ===");
const ecom = valutaExportMeta({
  config: base(),
  pageId: PAGE,
  objective: "ECOMMERCE",
  destinationUrl: "https://shop.aurora.it",
});
const csvEcom = generaCodiceImportMeta(
  base(),
  "Italia",
  PAGE,
  "",
  "ECOMMERCE",
  undefined,
  undefined,
  "https://shop.aurora.it",
);
assert(ecom.status === "READY_WITH_MISSING_META_DETAILS", "G missing-meta pixel");
assert(ecom.warnings.some((w) => w.toLowerCase().includes("pixel")), "G pixel warning");
assert(csvEcom.includes("PURCHASE"), "G PURCHASE");

console.log("\n=== M1.2A CASE H ECOMMERCE missing URL ===");
assert(
  valutaExportMeta({
    config: base(),
    pageId: PAGE,
    objective: "ECOMMERCE",
  }).status === "NOT_EXPORTABLE",
  "H NOT_EXPORTABLE",
);

console.log("\n=== M1.2A CASE I INSTORE missing dest ===");
const instoreNo = valutaExportMeta({
  config: base(),
  pageId: PAGE,
  objective: "IN_STORE",
});
assert(instoreNo.status === "NOT_EXPORTABLE", "I NOT_EXPORTABLE");
assert(
  !generaCodiceImportMeta(base(), "Roma", PAGE, "", "IN_STORE").includes("google.com"),
  "I no google",
);

console.log("\n=== M1.2A CASE J RETARGETING no audience ===");
const ret = valutaExportMeta({
  config: base(),
  pageId: PAGE,
  objective: "RETARGETING",
  destinationUrl: "https://shop.aurora.it/checkout",
});
const csvRet = generaCodiceImportMeta(
  base(),
  "Roma",
  PAGE,
  "",
  "RETARGETING",
  undefined,
  undefined,
  "https://shop.aurora.it/checkout",
);
assert(ret.profile === "RETARGETING", "J profile");
assert(ret.status !== "READY", "J not false READY");
assert(ret.warnings.some((w) => w.toLowerCase().includes("ads manager")), "J warning");
assert(!csvRet.includes("Custom Audience"), "J no Custom Audience claim");
assert(
  csvRet.includes("Retargeting · audience da selezionare"),
  "J ad set naming",
);

console.log("\n=== M1.2A CASE K AWARENESS no URL ===");
assert(
  profiloExportMeta("AWARENESS", undefined, "") === "AWARENESS_REACH",
  "K REACH profile",
);
const csvAw = generaCodiceImportMeta(base(), "Roma", PAGE, "", "AWARENESS");
assert(csvAw.includes("REACH"), "K REACH goal");
assert(valutaExportMeta({
  config: base(),
  pageId: PAGE,
  objective: "AWARENESS",
}).status !== "NOT_EXPORTABLE", "K exportable");

console.log("\n=== M1.2A CASE L AWARENESS URL ===");
assert(
  profiloExportMeta("AWARENESS", undefined, "https://evento.aurora.it") ===
    "AWARENESS_LINK",
  "L LINK profile",
);
const csvAwLink = generaCodiceImportMeta(
  base(),
  "Roma",
  PAGE,
  "",
  "AWARENESS",
  undefined,
  undefined,
  "https://evento.aurora.it",
);
assert(csvAwLink.includes("LINK_CLICKS"), "L LINK_CLICKS");

console.log("\n=== M1.2A CASE M 3 variants ===");
const csv3 = generaCodiceImportMeta(
  base({ varianteA: "A1", varianteB: "B1", varianteC: "C1" }),
  "Roma",
  PAGE,
  FORM,
  "LEADS",
);
const dati3 = righeDati(csv3);
assert(dati3.length === 3, "M 3 ads");
assert(
  new Set(dati3.map((r) => r.split(",")[0])).size === 1,
  "M 1 campaign name",
);
assert(
  new Set(dati3.map((r) => r.split(",")[7])).size === 1,
  "M 1 ad set name",
);

console.log("\n=== M1.2A CASE N PAUSED ===");
assert(
  dati3.every((r) => r.includes("PAUSED") && !r.includes("ACTIVE")),
  "N all data rows PAUSED",
);
assert(
  (csv3.match(/PAUSED/g) ?? []).length === 9,
  "N 3 PAUSED per ad × 3 ads",
);

console.log("\n=== M1.2A CASE O no google.com ===");
const srcGen = readFileSync(
  join(process.cwd(), "src/data/meta-import-tsv.ts"),
  "utf8",
);
assert(!srcGen.includes("www.google.com"), "O generator source");
assert(
  ![csvLeads, csvBookWeb, csvWa, csvEcom, csvRet, csvAw, csvAwLink, csv3].some(
    (c) => c.toLowerCase().includes("google.com"),
  ),
  "O generated CSVs",
);

const headerCols = csvLeads.replace(/^\uFEFF/, "").split("\n")[0]?.split(",") ?? [];
assert(headerCols.length === 48, `column count 48 (got ${headerCols.length})`);
assert(!urlDestinazioneExportValido("https://www.google.com"), "URL reject google.com");
assert(!urlDestinazioneExportValido(""), "URL reject empty");
assert(urlDestinazioneExportValido("https://shop.aurora.it"), "URL accept https");

console.log("\n=== M1.2C+D UX / radius ===");
const asset = [
  {
    id: "c1",
    nomeFile: "hero.jpg",
    width: 1080,
    height: 1350,
    ruolo: "principale" as const,
    avvisoFormato: false,
  },
];
const ready = valutaExportMeta({
  config: base(),
  pageId: PAGE,
  formId: FORM,
  objective: "LEADS",
  creativitaMeta: asset,
});
assert(ready.status === "READY", "CD-A READY");
assert(ctaExportAbilitata(ready.status), "CD-A CTA enabled");
assert(
  testoStatoExport(ready.status) === COPY_STATO_EXPORT.READY,
  "CD-A status copy",
);
assert(
  testoStatoExport(ecom.status) ===
    COPY_STATO_EXPORT.READY_WITH_MISSING_META_DETAILS,
  "CD-B missing-meta copy",
);
assert(ctaExportAbilitata(ecom.status), "CD-B CTA enabled");
assert(
  vociPreExport(ecom).some((v) => v.text.toLowerCase().includes("pixel")),
  "CD-E pixel voice",
);
assert(
  testoStatoExport(leadsNoForm.status) === COPY_STATO_EXPORT.NOT_EXPORTABLE,
  "CD-C status copy",
);
assert(!ctaExportAbilitata(leadsNoForm.status), "CD-C CTA disabled");
assert(
  vociPreExport(leadsNoForm).some((v) => v.text.includes("Lead Form")),
  "CD-D form blocker voice",
);
assert(
  !vociPreExport(ret).some((v) => v.text.includes("Custom Audience")),
  "CD-F no Custom Audience in UX",
);
assert(
  vociPreExport(ready, { haNomeFileCreativita: true }).some((v) =>
    v.text.toLowerCase().includes("creatività"),
  ),
  "CD-G filename-only creative note",
);
const awReachVoci = vociPreExport(
  valutaExportMeta({
    config: base(),
    pageId: PAGE,
    objective: "AWARENESS",
    creativitaMeta: asset,
  }),
);
assert(
  !awReachVoci.some((v) => v.text.toLowerCase().includes("destinazione")),
  "CD-H AWARENESS_REACH no destination item",
);
const awLinkVoci = vociPreExport(
  valutaExportMeta({
    config: base(),
    pageId: PAGE,
    objective: "AWARENESS",
    destinationUrl: "https://evento.aurora.it",
    creativitaMeta: asset,
  }),
  { destinationUrl: "https://evento.aurora.it" },
);
assert(
  awLinkVoci.some((v) => v.text.includes("https://evento.aurora.it")),
  "CD-I AWARENESS_LINK shows URL",
);
assert(
  valutaExportMeta({
    config: base({ raggioKm: 0 }),
    pageId: PAGE,
    formId: FORM,
    objective: "LEADS",
  }).status === "NOT_EXPORTABLE",
  "CD-N radius 0 NOT_EXPORTABLE",
);
assert(raggioExportKm(15) === 15, "CD-N product default 15 serializable");
assert(raggioExportKm(0) == null, "CD-N no silent 20");
assert(!srcGen.includes("raggioKm || 20"), "CD-N no export || 20");
assert(csvLeads.includes("(15 km)"), "CD-N CSV uses 15km");
assert(!LABEL_CTA_EXPORT_META.toLowerCase().includes("pronta"), "CD-K CTA");

const srcUi = [
  readFileSync(join(process.cwd(), "src/components/nuova-contatti/ModaleGuidaImportMeta.tsx"), "utf8"),
  readFileSync(join(process.cwd(), "src/components/nuova-contatti/MetaAdsImportCode.tsx"), "utf8"),
  readFileSync(join(process.cwd(), "src/lib/guidance.ts"), "utf8"),
].join("\n");
assert(!srcUi.includes("30 second"), "CD-J no 30-second");
assert(!srcUi.includes("Esporta Campagna Pronta per Meta"), "CD-K no overclaim CTA");
assert(srcUi.includes("BloccoPreExport"), "CD readiness UI wired");
assert(srcUi.includes(LABEL_CTA_EXPORT_META), "CD CTA label");

if (falliti > 0) {
  console.error(`\n${falliti} asserzioni fallite.`);
  process.exitCode = 1;
} else {
  console.log("\nTutte le asserzioni M1.2A+B sono passate.");
}
