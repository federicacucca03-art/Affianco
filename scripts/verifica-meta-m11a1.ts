/**
 * M11A.1 — Meta write foundation + dry-run preview regression.
 * Esegui: npx tsx scripts/verifica-meta-m11a1.ts
 *
 * MARKETING API CREATE CALLS: 0
 * META WRITES: 0
 */
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "test-anon-key";
process.env.META_GRAPH_API_VERSION ||= "v21.0";
process.env.META_APP_ID ||= "test-app";
process.env.META_APP_SECRET ||= "test-secret";
process.env.META_LOGIN_CONFIG_ID ||= "test-config";
process.env.META_REDIRECT_URI ||= "https://example.com/callback";
process.env.META_TOKEN_ENCRYPTION_KEY ||=
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { majorCurrencyToMetaMinorUnits } from "../src/lib/meta/write/budget";
import {
  assertPreviewFingerprintMatch,
  buildMetaWritePreview,
  connectionHasAdsManagement,
} from "../src/lib/meta/write/preview";
import { fingerprintPayload } from "../src/lib/meta/write/fingerprint";
import { isAllyNativeWriteEligible } from "../src/lib/meta/write/eligibility";
import { translateWriteTargeting } from "../src/lib/meta/write/targeting";
import type { MetaWritePlanInput } from "../src/lib/meta/write/types";
import { META_WRITE_SAFE_STATUS } from "../src/lib/meta/write/types";

let falliti = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    falliti += 1;
    console.error(`FAIL  ${msg}`);
  } else {
    console.log(`PASS  ${msg}`);
  }
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function basePlan(
  overrides: Partial<MetaWritePlanInput> = {},
): MetaWritePlanInput {
  return {
    allyCampaignId: "11111111-1111-4111-8111-111111111111",
    clientId: "22222222-2222-4222-8222-222222222222",
    campaignName: "Aurora Contatti QA",
    objectiveRaw: "LEADS",
    destination: "META_LEAD_FORM",
    destinationUrl: null,
    pageId: "page-1",
    formId: "form-1",
    whatsappNumber: null,
    budgetDailyMajor: 25,
    budgetLevel: "AD_SET",
    specialAdCategories: { kind: "NONE" },
    citta: null,
    raggioKm: null,
    countryCode: "IT",
    metaGeoKey: null,
    etaMin: 25,
    etaMax: 55,
    placementsAdvantage: true,
    startAtIso: "2026-10-01T09:00:00.000Z",
    endAtIso: null,
    creativitaCount: 0,
    targetType: "B2B",
    isImportedMetaOnly: false,
    grantedScopes: ["ads_read"],
    hasMetaConnection: true,
    hasAdAccount: true,
    adAccountCurrency: "EUR",
    adAccountTimezone: "Europe/Rome",
    buyingType: "AUCTION",
    ...overrides,
  };
}

console.log("\n=== M11A.1 META WRITE FOUNDATION ===\n");

// Graph version centralized
{
  const cfgSrc = read("src/lib/meta/config.ts");
  assert(
    cfgSrc.includes("META_GRAPH_API_VERSION"),
    "GRAPH VERSION SOURCE: env META_GRAPH_API_VERSION",
  );
  assert(
    !read("src/lib/meta/write/preview.ts").includes("graph.facebook.com/v"),
    "write builders no hardcoded Graph version",
  );
  assert(
    read("src/app/api/meta/write-preview/route.ts").includes(
      "getMetaServerConfig",
    ),
    "GRAPH VERSION CENTRALIZED via getMetaServerConfig",
  );
}

// No Marketing API creates
{
  const writeDir = join(process.cwd(), "src/lib/meta/write");
  const files = readdirSync(writeDir).filter((f) => f.endsWith(".ts"));
  let createHits = 0;
  for (const f of files) {
    const src = read(`src/lib/meta/write/${f}`);
    if (
      /act_.*\/campaigns|\/adsets|\/adcreatives|\/ads|\/adimages|\/advideos/.test(
        src,
      ) &&
      /method:\s*["']POST["']/.test(src)
    ) {
      createHits += 1;
    }
    if (/fetch\(.*campaigns/.test(src) && /POST/.test(src)) createHits += 1;
  }
  const route = read("src/app/api/meta/write-preview/route.ts");
  assert(!/\/campaigns/.test(route) || !/method:\s*["']POST["']/.test(route), "preview route no create POST");
  assert(createHits === 0, `META MARKETING CREATE CALLS: ${createHits}`);
  assert(route.includes("writeEnabled: false"), "writeEnabled false");
  assert(route.includes("metaWrites: 0"), "metaWrites 0");
}

// Migration safety
{
  const mig = read(
    "supabase/migrations/20260920_meta_write_operations_m11a1.sql",
  );
  assert(mig.includes("meta_write_operations"), "migration table");
  assert(mig.includes("enable row level security"), "RLS enabled");
  assert(mig.includes("meta_write_operations_select_own"), "select own policy");
  assert(mig.includes("server-only"), "server-only writes");
  assert(!/^\s*drop table\b/im.test(mig), "no DROP TABLE statement");
  assert(!/^\s*delete from\b/im.test(mig), "no DELETE FROM statement");
  assert(mig.includes("idempotency_key"), "idempotency key");
  assert(mig.includes("payload_fingerprint"), "fingerprint column");
  assert(!/access_token/i.test(mig), "no token in migration");
}

// CASE A — ads_management missing
{
  const p = buildMetaWritePreview(basePlan({ grantedScopes: ["ads_read"] }));
  assert(!p.adsManagementPresent, "CASE A ads_management MISSING");
  assert(
    p.readinessCodes.includes("MISSING_META_PERMISSION"),
    "CASE A MISSING_META_PERMISSION",
  );
  assert(p.canPreview === true, "CASE A preview available");
  assert(p.canWrite === false, "CASE A write blocked");
}

// CASE B — objective missing
{
  const p = buildMetaWritePreview(basePlan({ objectiveRaw: null }));
  assert(
    p.readinessCodes.includes("MISSING_OBJECTIVE"),
    "CASE B MISSING_OBJECTIVE",
  );
}

// CASE C — special ad category unresolved
{
  const p = buildMetaWritePreview(
    basePlan({ specialAdCategories: { kind: "UNRESOLVED" } }),
  );
  assert(
    p.readinessCodes.includes("MISSING_SPECIAL_AD_CATEGORY_DECISION"),
    "CASE C special category blocked",
  );
}

// CASE D/E — budget units
{
  const d = majorCurrencyToMetaMinorUnits(25, "EUR");
  assert(d.ok && d.minor === 2500, `CASE D €25 → ${d.ok ? d.minor : d.reason}`);
  const e = majorCurrencyToMetaMinorUnits(25.5, "EUR");
  assert(e.ok && e.minor === 2550, `CASE E €25.50 → ${e.ok ? e.minor : e.reason}`);
  const z = majorCurrencyToMetaMinorUnits(0, "EUR");
  assert(!z.ok, "budget zero rejected");
  const n = majorCurrencyToMetaMinorUnits(-1, "EUR");
  assert(!n.ok, "budget negative rejected");
}

// CASE F — campaign-level budget
{
  const p = buildMetaWritePreview(
    basePlan({ budgetLevel: "CAMPAIGN", budgetDailyMajor: 25 }),
  );
  assert(p.campaign?.daily_budget === 2500, "CASE F campaign budget 2500");
  assert(p.adSet?.daily_budget == null, "CASE F no Ad Set budget");
}

// CASE G — Ad Set-level budget
{
  const p = buildMetaWritePreview(
    basePlan({ budgetLevel: "AD_SET", budgetDailyMajor: 25 }),
  );
  assert(p.adSet?.daily_budget === 2500, "CASE G Ad Set budget 2500");
  assert(p.campaign?.daily_budget == null, "CASE G no Campaign budget");
}

// CASE H — Meta Form + no Page
{
  const p = buildMetaWritePreview(
    basePlan({
      destination: "META_LEAD_FORM",
      pageId: null,
      formId: "form-1",
    }),
  );
  assert(p.readinessCodes.includes("MISSING_PAGE"), "CASE H MISSING_PAGE");
}

// CASE I — Page but no Form
{
  const p = buildMetaWritePreview(
    basePlan({
      destination: "META_LEAD_FORM",
      pageId: "page-1",
      formId: null,
    }),
  );
  assert(p.readinessCodes.includes("MISSING_FORM"), "CASE I MISSING_FORM");
}

// CASE J — Website leads + tracking
{
  const p = buildMetaWritePreview(
    basePlan({
      destination: "WEBSITE",
      destinationUrl: "https://example.com/contatti",
      pageId: null,
      formId: null,
      objectiveRaw: "LEADS",
    }),
  );
  assert(
    p.readinessCodes.includes("MISSING_TRACKING_CONFIG"),
    "CASE J MISSING_TRACKING_CONFIG",
  );
}

// CASE K — B2B does not become interest targeting
{
  const t = translateWriteTargeting({
    countryCode: "IT",
    citta: null,
    raggioKm: null,
    metaGeoKey: null,
    etaMin: 25,
    etaMax: 55,
    targetType: "B2B",
  });
  assert(t.ok, "CASE K targeting ok");
  if (t.ok) {
    const s = JSON.stringify(t.targeting);
    assert(!/B2B|interest/i.test(s), "CASE K no B2B interest targeting");
    assert(
      t.notes.some((n) => /B2B\/B2C/i.test(n)),
      "CASE K note about Ally label",
    );
  }
}

// CASE L — city without Meta key blocked
{
  const t = translateWriteTargeting({
    countryCode: null,
    citta: "Milano",
    raggioKm: 20,
    metaGeoKey: null,
    etaMin: 25,
    etaMax: 55,
    targetType: null,
  });
  assert(!t.ok && t.reason === "MISSING_GEO_RESOLUTION", "CASE L geo blocked");
}

// CASE M — creative missing; Campaign+Ad Set preview still representable
{
  const p = buildMetaWritePreview(basePlan({ creativitaCount: 0 }));
  assert(p.creative.enabled === false, "CASE M creative disabled");
  assert(p.ad.enabled === false, "CASE M ad disabled");
  assert(p.campaign != null && p.adSet != null, "CASE M campaign+adset preview");
  assert(
    p.readinessCodes.includes("MISSING_CREATIVE_ASSET"),
    "CASE M MISSING_CREATIVE_ASSET",
  );
}

// CASE N — stale preview
{
  const a = buildMetaWritePreview(basePlan({ budgetDailyMajor: 25 }));
  const b = buildMetaWritePreview(
    basePlan({ budgetDailyMajor: 30 }),
    { previousFingerprint: a.fingerprint },
  );
  assert(b.readinessCodes.includes("STALE_PREVIEW"), "CASE N STALE_PREVIEW");
  const match = assertPreviewFingerprintMatch(a.fingerprint, b.fingerprint);
  assert(!match.ok, "CASE N fingerprint mismatch fail-closed");
}

// CASE O — same payload → same fingerprint
{
  const a = buildMetaWritePreview(basePlan());
  const b = buildMetaWritePreview(basePlan());
  assert(a.fingerprint === b.fingerprint, "CASE O same fingerprint");
  assert(a.idempotencyKey === b.idempotencyKey, "CASE O same idempotency");
}

// CASE P — Technon imported not eligible
{
  assert(
    !isAllyNativeWriteEligible({ isImportedMetaOnly: true }),
    "CASE P Technon-like not eligible",
  );
  const p = buildMetaWritePreview(
    basePlan({
      isImportedMetaOnly: true,
      campaignName: "[B2B Lead Gen] 3M VHB - Test 100€",
    }),
  );
  assert(
    p.readinessCodes.includes("IMPORTED_META_NOT_ELIGIBLE"),
    "CASE P IMPORTED_META_NOT_ELIGIBLE",
  );
  assert(!p.canPreview, "CASE P no preview for imported");
}

// CASE Q — PAUSED only
{
  const p = buildMetaWritePreview(basePlan());
  assert(p.campaign?.status === "PAUSED", "CASE Q campaign PAUSED");
  assert(p.adSet?.status === "PAUSED", "CASE Q adset PAUSED");
  assert(p.campaign?.status === META_WRITE_SAFE_STATUS, "CASE Q safe status");
  assert(p.canWrite === false, "CASE Q canWrite false");
  assert(!connectionHasAdsManagement(["ads_read"]), "ads_management gate");
}

// PREVIEW COMPLETENESS — CASE A: resolved fields + blockers still render
{
  const p = buildMetaWritePreview(
    basePlan({
      specialAdCategories: { kind: "UNRESOLVED" },
      destination: "UNRESOLVED",
      citta: "Roma",
      metaGeoKey: null,
      grantedScopes: ["ads_read"],
    }),
  );
  assert(p.campaign != null, "PREVIEW A campaign payload present");
  assert(p.adSet != null, "PREVIEW A adset payload present");
  assert(p.summaryIt.campaignLines.length > 0, "PREVIEW A campaign lines");
  assert(p.summaryIt.adSetLines.length > 0, "PREVIEW A adset lines");
  assert(
    p.summaryIt.campaignLines.some((l) => l.includes("Aurora Contatti QA")),
    "PREVIEW A resolved name visible",
  );
  assert(
    p.summaryIt.missingLines.length > 0,
    "PREVIEW A blockers still listed",
  );
  assert(p.canWrite === false, "PREVIEW A write blocked");
}

// PREVIEW COMPLETENESS — CASE B: Roma known, Meta geo key missing
{
  const p = buildMetaWritePreview(
    basePlan({
      citta: "Roma",
      metaGeoKey: null,
      countryCode: null,
      specialAdCategories: { kind: "NONE" },
    }),
  );
  assert(
    p.summaryIt.adSetLines.some((l) => /Zona pianificata:\s*Roma/.test(l)),
    "PREVIEW B Roma visible",
  );
  assert(
    p.summaryIt.adSetLines.some((l) =>
      /Zona Meta:.*da risolvere/i.test(l),
    ),
    "PREVIEW B Meta key unresolved",
  );
  assert(
    p.readinessCodes.includes("MISSING_GEO_RESOLUTION"),
    "PREVIEW B write blocked on geo",
  );
  assert(p.canWrite === false, "PREVIEW B canWrite false");
}

// PREVIEW COMPLETENESS — CASE C: ads_management absent
{
  const p = buildMetaWritePreview(
    basePlan({
      grantedScopes: ["ads_read"],
      specialAdCategories: { kind: "UNRESOLVED" },
    }),
  );
  assert(p.canPreview === true, "PREVIEW C preview visible");
  assert(p.summaryIt.campaignLines.length > 0, "PREVIEW C campaign lines");
  assert(p.canWrite === false, "PREVIEW C write disabled");
  assert(
    p.blockersIt.some((b) =>
      /permesso per creare campagne su Meta/i.test(b),
    ),
    "PREVIEW C human permission copy",
  );
  assert(
    p.blockersIt.some((b) => /ads_management/.test(b)),
    "PREVIEW C technical ads_management kept",
  );
}

// PREVIEW COMPLETENESS — CASE D: special category unresolved
{
  const p = buildMetaWritePreview(
    basePlan({ specialAdCategories: { kind: "UNRESOLVED" } }),
  );
  assert(
    p.summaryIt.campaignLines.some((l) =>
      /Categoria speciale Meta:\s*Da confermare/.test(l),
    ),
    "PREVIEW D category Da confermare",
  );
  assert(
    p.campaign?.special_ad_categories === null,
    "PREVIEW D no silent []",
  );
  assert(
    !p.summaryIt.campaignLines.some((l) => /Special Ad Categor/i.test(l)),
    "PREVIEW D no English Special Ad Category label",
  );
}

// PREVIEW COMPLETENESS — CASE E: PAUSED + Non attiva
{
  const p = buildMetaWritePreview(basePlan());
  assert(p.campaign?.status === "PAUSED", "PREVIEW E campaign PAUSED");
  assert(p.adSet?.status === "PAUSED", "PREVIEW E adset PAUSED");
  assert(
    p.summaryIt.campaignLines.some((l) => /Stato su Meta:\s*Non attiva/.test(l)),
    "PREVIEW E Non attiva primary",
  );
  assert(
    !p.summaryIt.campaignLines.some((l) => /\bACTIVE\b/.test(l)),
    "PREVIEW E no ACTIVE",
  );
  assert(
    !p.summaryIt.campaignLines.some((l) => /Bozza Meta/i.test(l)),
    "PREVIEW E no Bozza Meta",
  );
}

// PREVIEW COMPLETENESS — CASE F: budget 20 EUR/day human + minor units
{
  const p = buildMetaWritePreview(
    basePlan({
      budgetDailyMajor: 20,
      budgetLevel: "AD_SET",
      specialAdCategories: { kind: "NONE" },
      grantedScopes: ["ads_read", "ads_management"],
      citta: null,
      countryCode: "IT",
      metaGeoKey: null,
    }),
  );
  assert(
    p.summaryIt.adSetLines.some((l) => /Budget:\s*20 €\/giorno/.test(l)),
    "PREVIEW F human 20 €/giorno",
  );
  assert(p.adSet?.daily_budget === 2000, "PREVIEW F payload 2000 minor");
  assert(
    !p.summaryIt.adSetLines.some((l) => /Budget:\s*2000\b/.test(l)),
    "PREVIEW F UI not raw 2000",
  );
}

// UI copy / panel present
{
  const ui = read("src/components/campagne/MetaWritePreviewPanel.tsx");
  assert(ui.includes("Verifica configurazione Meta"), "preview CTA");
  assert(ui.includes("Crea su Meta"), "create label present");
  assert(ui.includes("disabled"), "create disabled");
  assert(/non\s+attivo/i.test(ui), "non attivo copy");
  assert(ui.includes("Categoria speciale Meta"), "category label IT");
  assert(
    ui.includes("Manca il permesso per creare campagne su Meta"),
    "permission human copy",
  );
  assert(!/Bozza Meta|Pubblica su Meta/.test(ui), "no Bozza Meta / Pubblica");
  const page = read("src/app/campagne/[id]/page.tsx");
  assert(page.includes("MetaWritePreviewPanel"), "wired on Ally detail");
  const previewSrc = read("src/lib/meta/write/preview.ts");
  assert(
    !previewSrc.includes("structuralBlock"),
    "no structuralBlock emptying preview",
  );
  assert(
    previewSrc.includes("BLOCKED FOR WRITE ≠ EMPTY PREVIEW") ||
      previewSrc.includes("BLOCKED FOR WRITE"),
    "partial preview invariant documented",
  );
}

// Fingerprint stability helper
{
  const x = fingerprintPayload({ a: 1, b: { z: 2, y: 3 } });
  const y = fingerprintPayload({ b: { y: 3, z: 2 }, a: 1 });
  assert(x === y, "canonical key order fingerprint");
}

if (falliti > 0) {
  console.error(`\n=== M11A.1 FAIL (${falliti}) ===\n`);
  process.exit(1);
}
console.log("\n=== M11A.1 PASS ===\n");
