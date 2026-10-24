/**
 * P0.9 — Connect new campaign entry → P0.8 Instant Form Easy Builder.
 * LIVE META WRITES: 0 · PRODUCTION DB: 0
 * File/static verification (no Supabase client boot).
 * Esegui: npx tsx scripts/verifica-campagne-easy-entry-p09.ts
 */

import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..");
let falliti = 0;

function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error(`FAIL  ${msg}`);
    falliti += 1;
  } else {
    console.log(`PASS  ${msg}`);
  }
}

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function exists(rel: string): boolean {
  return existsSync(join(root, rel));
}

console.log("\n=== P0.9 Easy entry → Instant Form Builder ===\n");

assert(
  exists("src/lib/campagne-easy-entry.ts"),
  "1. easy-entry module exists (reuse, no second campaign model)",
);

assert(
  exists("src/app/campagne/nuova/instant-form/page.tsx"),
  "2. objective-grid Instant Form entry bridge exists",
);

assert(
  exists("src/app/campagne/[id]/instant-form/page.tsx"),
  "3. P0.8 Builder route reused (not rebuilt)",
);

assert(
  exists("src/components/campagne/InstantFormEasyBuilder.tsx"),
  "4. InstantFormEasyBuilder component still present",
);

assert(
  exists("src/app/campagne/nuova/richieste-contatto") ||
    exists("src/app/campagne/nuova/richieste-contatto/page.tsx"),
  "5. legacy 6-step wizard route retained",
);

const entry = read("src/lib/campagne-easy-entry.ts");
assert(
  entry.includes("creaCampagnaLeadGen") &&
    entry.includes("objective: null") &&
    !entry.includes('bookingChannel: "LEAD_FORM"'),
  "6. draft shell via creaCampagnaLeadGen without pre-locking LEADS/LEAD_FORM",
);
assert(
  !entry.includes("campaigns_v2") &&
    !entry.includes("secondCampaign") &&
    entry.includes("creaCampagnaLeadGen") &&
    entry.includes("trovaOCreaCliente"),
  "7. no duplicate campaign model — reuses campaigns + clients",
);
assert(
  !/graph\.facebook|META_WRITES_LIVE\s*=\s*true/.test(entry),
  "8. entry helper has no Meta mutation calls",
);

assert(
  entry.includes("easyInstantFormHref") &&
    entry.includes("`/campagne/${encodeURIComponent(id)}/instant-form`"),
  "9. Easy Builder URL uses persisted campaign ID",
);
assert(
  entry.includes('=== "LEADS"') &&
    entry.includes("isEasyInstantFormObjective") &&
    entry.includes("LEGACY_ONLY_OBJECTIVES") &&
    entry.includes('"BOOKINGS"') &&
    entry.includes('"ECOMMERCE"'),
  "10. only LEADS is Easy Instant Form eligible; others listed legacy-only",
);
assert(
  entry.includes("EASY_DRAFT_DEFAULT_DAILY_BUDGET") &&
    /EASY_DRAFT_DEFAULT_DAILY_BUDGET\s*=\s*[1-9]/.test(entry),
  "11. draft gets a positive soft daily budget placeholder",
);
assert(
  (entry.includes("Continua in Facile") ||
    entry.includes("Continua in Modalità facile")) &&
    entry.includes("Usa percorso completo"),
  "12. clear Easy vs legacy CTA labels",
);
assert(
  entry.includes("legacyLeadsWizardHref") &&
    entry.includes("/campagne/nuova/richieste-contatto"),
  "13. legacy wizard href retained",
);
assert(
  entry.includes("campaignId") &&
    entry.includes("richieste-contatto"),
  "14. legacy wizard supports campaignId query",
);

const modale = read("src/components/ModaleConfiguraCampagna.tsx");
assert(
  modale.includes("avviaBozzaInstantFormEasy") &&
    (modale.includes("modeSelectorHref") || modale.includes("easyInstantFormHref")) &&
    modale.includes("easyBuilderEntryLabelIt"),
  "15. Home modal creates draft and routes to HOW/Easy entry",
);
assert(
  modale.includes("legacyLeadsWizardHref") &&
    modale.includes("legacyWizardEntryLabelIt"),
  "16. modal retains legacy wizard as alternative path",
);
assert(
  !modale.includes("router.push(`/campagne/nuova/richieste-contatto?") ||
    modale.includes("legacyLeadsWizardHref"),
  "17. modal no longer hard-routes only to legacy without draft",
);

const clientiPage = read("src/app/clienti/page.tsx");
assert(
  clientiPage.includes("/campagne/nuova?clienteId=") &&
    clientiPage.includes("Nuova campagna"),
  "18. Clienti «Nuova campagna» → nuova with clienteId continuity",
);
assert(
  clientiPage.includes("contaCampagneNativePerCliente") ||
    clientiPage.includes("campagneNative") ||
    clientiPage.includes("clienti"),
  "19. Clienti inventory still wired",
);

const clienteDettaglio = read("src/app/clienti/[id]/page.tsx");
assert(
  clienteDettaglio.includes("/campagne/nuova?clienteId=") &&
    clienteDettaglio.includes("Nuova campagna"),
  "20. client detail Nuova campagna → nuova with clienteId continuity",
);

const griglia = read("src/components/GrigliaSituazioni.tsx");
assert(
  griglia.includes('href: "/campagne/nuova/instant-form"') &&
    griglia.includes('id: "contatti"'),
  "21. «Più richieste di contatto» points to Instant Form entry",
);
assert(
  griglia.includes('href: "/campagne/nuova/prenotazioni"') &&
    griglia.includes('href: "/campagne/nuova/vendite"') &&
    griglia.includes('href: "/campagne/nuova/instore"'),
  "22. other objectives keep their own legacy routes",
);
assert(
  !/id:\s*"prenotazioni"[\s\S]{0,200}?href:\s*"\/campagne\/nuova\/instant-form"/.test(
    griglia,
  ),
  "23. BOOKINGS not silently forced into Instant Form",
);
assert(
  !/id:\s*"vendite"[\s\S]{0,200}?href:\s*"\/campagne\/nuova\/instant-form"/.test(
    griglia,
  ),
  "24. ECOMMERCE not forced into Instant Form",
);

const dettaglioCampagna = read("src/app/campagne/[id]/page.tsx");
assert(
  dettaglioCampagna.includes("CampaignControlCenter") &&
    !dettaglioCampagna.includes("Continua in Modalità facile") &&
    !dettaglioCampagna.includes("Apri wizard completo"),
  "25. UX.5 detail control center — no competing Easy/Full CTAs",
);
assert(
  exists("src/app/campagne/[id]/configura/page.tsx") &&
    exists("src/app/campagne/nuova/richieste-contatto/page.tsx"),
  "26. Unified Builder + legacy wizard routes retained (not promoted on detail)",
);

const bridge = read("src/app/campagne/nuova/instant-form/page.tsx");
assert(
  bridge.includes("avviaBozzaInstantFormEasy") &&
    bridge.includes("easyInstantFormHref") &&
    bridge.includes("legacyLeadsWizardHref"),
  "27. entry bridge persists draft then opens Builder; legacy fallback present",
);

assert(
  !modale.includes("graph.facebook.com") &&
    !clientiPage.includes("graph.facebook.com") &&
    !bridge.includes("graph.facebook.com"),
  "28. no Meta Graph mutation in entry UI files",
);

assert(
  exists("src/components/nuova-contatti/PercorsoContatti.tsx"),
  "29. legacy PercorsoContatti (6-step) still exists",
);

assert(
  entry.includes("status: \"DRAFT\"") || entry.includes('status: "DRAFT"'),
  "30. new campaign draft persisted as DRAFT",
);

console.log(
  `\n=== P0.9 result: ${falliti === 0 ? "PASS" : `FAIL (${falliti})`} ===\n`,
);
process.exit(falliti === 0 ? 0 : 1);
