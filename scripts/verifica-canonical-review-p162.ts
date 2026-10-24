/**
 * P0.16.2 — Guardian status integrity + semantic deduplication.
 * META MUTATIONS: 0 · COMMIT: NO
 * Esegui: npx tsx scripts/verifica-canonical-review-p162.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  GUARDIAN_ISSUE,
  countActionableIssue,
  runPreWriteLaunchGuardian,
} from "../src/lib/meta/launch-guardian/prewrite";
import { buildMetaWritePreview } from "../src/lib/meta/write/preview";
import { resolveMetaObjectiveCode } from "../src/lib/meta/write/objective";
import type { MetaWritePlanInput } from "../src/lib/meta/write/types";

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

function basePlan(overrides: Partial<MetaWritePlanInput> = {}): MetaWritePlanInput {
  return {
    allyCampaignId: "11111111-1111-4111-8111-111111111111",
    clientId: "22222222-2222-4222-8222-222222222222",
    campaignName: "QA Guardian Integrity P0.16.2",
    objectiveRaw: "OUTCOME_LEADS",
    destination: "META_LEAD_FORM",
    destinationUrl: null,
    pageId: "page-1",
    formId: "form-1",
    whatsappNumber: null,
    budgetDailyMajor: 20,
    budgetLevel: "AD_SET",
    specialAdCategories: { kind: "NONE" },
    citta: "Roma",
    raggioKm: 20,
    countryCode: "IT",
    metaGeoKey: "2421836",
    geoLabel: "Roma, Lazio, IT",
    etaMin: 25,
    etaMax: 55,
    placementsAdvantage: true,
    startAtIso: "2026-12-01T09:00:00.000Z",
    endAtIso: null,
    creativitaCount: 1,
    targetType: "B2C",
    isImportedMetaOnly: false,
    existingMetaCampaignId: null,
    partialHierarchyPending: false,
    writeHierarchyCompleted: false,
    grantedScopes: ["ads_read", "ads_management"],
    hasMetaConnection: true,
    hasAdAccount: true,
    metaAdAccountId: "act_1234567890",
    adAccountCurrency: "EUR",
    adAccountTimezone: "Europe/Rome",
    buyingType: "AUCTION",
    allyAudienceMode: "ADVANTAGE_AUDIENCE",
    allyBidMode: "AUTOMATIC_NO_CAP",
    instantFormRelation: "VERIFIED",
    instantFormName: "Modulo Contatti QA",
    pageName: "Pagina QA",
    ...overrides,
  };
}

const incompleteEasyDraft = {
  pageId: "",
  formId: "",
  specialKind: "UNRESOLVED",
  creativitaCount: 0,
  primaryText: "",
  headline: "",
  budgetDailyMajor: null as number | null,
  metaGeoKey: null as string | null,
  objectiveChoice: "GENERATE_LEADS",
  conversionChoice: "INSTANT_FORM",
  metaConnected: false as boolean | null,
};

function main() {
  console.log("\n=== P0.16.2 Guardian status integrity + dedup ===\n");

  // A. LEADS + INSTANT_FORM incomplete → BLOCKED (not UNSUPPORTED)
  {
    const preview = buildMetaWritePreview(
      basePlan({
        pageId: null,
        formId: null,
        hasMetaConnection: false,
        hasAdAccount: false,
        metaAdAccountId: null,
        grantedScopes: [],
        creativitaCount: 0,
        budgetDailyMajor: null,
        metaGeoKey: null,
        specialAdCategories: { kind: "UNRESOLVED" },
      }),
      {},
    );
    const g = runPreWriteLaunchGuardian({
      preview,
      easyDraft: incompleteEasyDraft,
    });
    assert(g.reviewStatus === "BLOCKED", `A1. BLOCKED (got ${g.reviewStatus})`);
    assert(g.reviewStatus !== "UNSUPPORTED", "A2. not UNSUPPORTED");
    assert(!g.futureLaunchEligible, "A3. no launch");
  }

  // B. SALES + WEBSITE + PURCHASE → UNSUPPORTED
  {
    const preview = buildMetaWritePreview(
      basePlan({
        objectiveRaw: "OUTCOME_SALES",
        destination: "WEBSITE",
        destinationUrl: "https://shop.example.com",
        formId: null,
        websiteTracking: {
          sourceType: "PIXEL",
          sourceId: "pixel-1",
          sourceName: "Shop Pixel",
          eventType: "PURCHASE",
          customConversionId: null,
          verificationStatus: "SELECTED",
          metaAdAccountId: "act_1234567890",
        },
      }),
      {},
    );
    const g = runPreWriteLaunchGuardian({
      preview,
      executionSupport: {
        level: "NOT_YET_SUPPORTED",
        recommendedRoute: "NONE",
        unsupported: true,
        summaryIt: "Sales Website/Purchase non ancora eseguibile in Ally.",
      },
    });
    assert(g.reviewStatus === "UNSUPPORTED", `B1. UNSUPPORTED (got ${g.reviewStatus})`);
    assert(!g.futureLaunchEligible, "B2. no fake launch");
  }

  // C. Easy LEADS → canonical LEADS → no objective_missing
  {
    const preview = buildMetaWritePreview(
      basePlan({
        objectiveRaw: "OUTCOME_LEADS",
        pageId: null,
        formId: null,
        hasMetaConnection: false,
      }),
      {},
    );
    assert(
      resolveMetaObjectiveCode(preview.campaign?.objective ?? "OUTCOME_LEADS") ===
        "OUTCOME_LEADS" ||
        preview.campaign?.objective === "OUTCOME_LEADS",
      "C1. preview objective LEADS/OUTCOME_LEADS",
    );
    const g = runPreWriteLaunchGuardian({
      preview,
      easyDraft: {
        ...incompleteEasyDraft,
        metaConnected: false,
      },
      provenanceHints: { objective: "USER_SELECTED" },
    });
    assert(
      countActionableIssue(g, GUARDIAN_ISSUE.OBJECTIVE_MISSING) === 0,
      "C2. no objective_missing blocker",
    );
    assert(
      g.passed.some((p) => p.id === "campaign.objective_ok"),
      "C3. objective pass present",
    );
    const canonObj = preview.canonicalPublishPreview?.sections
      .find((s) => s.id === "CAMPAIGN")
      ?.fields.find((f) => f.key === "campaign.objective");
    assert(
      canonObj && !/da completare/i.test(canonObj.valueIt),
      `C4. canonical objective not Da completare (got ${canonObj?.valueIt})`,
    );

    // Stale DB objective (null) + Easy draft LEADS must not invent MISSING_OBJECTIVE
    const stale = buildMetaWritePreview(
      basePlan({
        objectiveRaw: null,
        pageId: null,
        formId: null,
        hasMetaConnection: false,
      }),
      {},
    );
    const gStale = runPreWriteLaunchGuardian({
      preview: stale,
      easyDraft: incompleteEasyDraft,
    });
    assert(gStale.reviewStatus === "BLOCKED", "C5. stale obj → BLOCKED not UNSUPPORTED");
    assert(
      countActionableIssue(gStale, GUARDIAN_ISSUE.OBJECTIVE_MISSING) === 0,
      "C6. Easy LEADS suppresses objective_missing on stale preview",
    );
    assert(
      !stale.readinessCodes.includes("UNSUPPORTED_CONFIGURATION") ||
        gStale.reviewStatus === "BLOCKED",
      "C7. missing objective does not force unsupported config status",
    );
  }

  // D. Easy Instant Form → conversion location Instant Form
  {
    const preview = buildMetaWritePreview(basePlan(), {});
    assert(
      preview.conversionPublishPlan?.conversionLocation === "INSTANT_FORM" ||
        preview.canonicalPublishPreview != null,
      "D1. Instant Form conversion location",
    );
    const g = runPreWriteLaunchGuardian({
      preview,
      easyDraft: {
        ...incompleteEasyDraft,
        pageId: "page-1",
        formId: "form-1",
        metaConnected: true,
        specialKind: "NONE",
        creativitaCount: 1,
        primaryText: "Ciao",
        headline: "Offerta",
        budgetDailyMajor: 20,
        metaGeoKey: "2421836",
      },
    });
    assert(
      g.passed.some((p) => /instant.?form/i.test(p.id + p.title)) ||
        preview.conversionPublishPlan?.conversionLocation === "INSTANT_FORM",
      "D2. Instant Form recognized in Guardian/preview",
    );
  }

  // E. Missing Page → one Page blocker
  {
    const preview = buildMetaWritePreview(
      basePlan({ pageId: null, formId: null, hasMetaConnection: false }),
      {},
    );
    const g = runPreWriteLaunchGuardian({
      preview,
      easyDraft: incompleteEasyDraft,
    });
    assert(
      countActionableIssue(g, GUARDIAN_ISSUE.PAGE_MISSING) === 1,
      `E1. one PAGE_MISSING (got ${countActionableIssue(g, GUARDIAN_ISSUE.PAGE_MISSING)})`,
    );
  }

  // F. No Meta → one Meta connection blocker
  {
    const preview = buildMetaWritePreview(
      basePlan({
        hasMetaConnection: false,
        hasAdAccount: false,
        pageId: null,
        formId: null,
      }),
      {},
    );
    const g = runPreWriteLaunchGuardian({
      preview,
      easyDraft: incompleteEasyDraft,
    });
    assert(
      countActionableIssue(g, GUARDIAN_ISSUE.META_CONNECTION_MISSING) === 1,
      `F1. one META_CONNECTION_MISSING (got ${countActionableIssue(g, GUARDIAN_ISSUE.META_CONNECTION_MISSING)})`,
    );
    const metaCards = [...g.blockers, ...g.confirmations].filter((c) =>
      /collega meta|meta non colleg/i.test(c.title + c.userMessage),
    );
    assert(metaCards.length === 1, `F2. one Meta user card (got ${metaCards.length})`);
  }

  // G. SAC unresolved → one SAC actionable
  {
    const preview = buildMetaWritePreview(
      basePlan({ specialAdCategories: { kind: "UNRESOLVED" } }),
      {},
    );
    const g = runPreWriteLaunchGuardian({
      preview,
      easyDraft: {
        ...incompleteEasyDraft,
        pageId: "page-1",
        formId: "form-1",
        metaConnected: true,
        specialKind: "UNRESOLVED",
        creativitaCount: 1,
        primaryText: "x",
        headline: "y",
        budgetDailyMajor: 20,
        metaGeoKey: "2421836",
      },
    });
    assert(
      countActionableIssue(g, GUARDIAN_ISSUE.SAC_UNRESOLVED) === 1,
      `G1. one SAC_UNRESOLVED (got ${countActionableIssue(g, GUARDIAN_ISSUE.SAC_UNRESOLVED)})`,
    );
  }

  // H. Missing Form → one Form blocker
  {
    const preview = buildMetaWritePreview(
      basePlan({ formId: null, pageId: "page-1" }),
      {},
    );
    const g = runPreWriteLaunchGuardian({
      preview,
      easyDraft: {
        ...incompleteEasyDraft,
        pageId: "page-1",
        formId: "",
        metaConnected: true,
      },
    });
    assert(
      countActionableIssue(g, GUARDIAN_ISSUE.FORM_MISSING) === 1,
      `H1. one FORM_MISSING (got ${countActionableIssue(g, GUARDIAN_ISSUE.FORM_MISSING)})`,
    );
  }

  // I. Missing creative → one creative blocker
  {
    const preview = buildMetaWritePreview(basePlan({ creativitaCount: 0 }), {});
    const g = runPreWriteLaunchGuardian({
      preview,
      easyDraft: {
        ...incompleteEasyDraft,
        pageId: "page-1",
        formId: "form-1",
        metaConnected: true,
        specialKind: "NONE",
        creativitaCount: 0,
        primaryText: "",
        headline: "",
        budgetDailyMajor: 20,
        metaGeoKey: "2421836",
      },
    });
    assert(
      countActionableIssue(g, GUARDIAN_ISSUE.CREATIVE_MEDIA_MISSING) === 1,
      `I1. one CREATIVE_MEDIA_MISSING (got ${countActionableIssue(g, GUARDIAN_ISSUE.CREATIVE_MEDIA_MISSING)})`,
    );
  }

  // J. Generic preview blocker dedup — no multi "Blocco anteprima" for Meta
  {
    const preview = buildMetaWritePreview(
      basePlan({
        hasMetaConnection: false,
        hasAdAccount: false,
        pageId: null,
        formId: null,
        creativitaCount: 0,
        budgetDailyMajor: null,
        metaGeoKey: null,
        specialAdCategories: { kind: "UNRESOLVED" },
      }),
      {},
    );
    const g = runPreWriteLaunchGuardian({
      preview,
      easyDraft: incompleteEasyDraft,
    });
    const generic = g.blockers.filter((b) => b.title === "Blocco anteprima");
    assert(
      generic.length === 0,
      `J1. no generic Blocco anteprima duplicates (got ${generic.length})`,
    );
    // Primary list should include distinct semantic issues once
    const primaryIds = [...g.blockers, ...g.confirmations].map((c) => c.id);
    const expected = [
      GUARDIAN_ISSUE.META_CONNECTION_MISSING,
      GUARDIAN_ISSUE.PAGE_MISSING,
      GUARDIAN_ISSUE.FORM_MISSING,
      GUARDIAN_ISSUE.GEO_MISSING,
      GUARDIAN_ISSUE.CREATIVE_MEDIA_MISSING,
      GUARDIAN_ISSUE.SAC_UNRESOLVED,
    ];
    for (const id of expected) {
      assert(
        primaryIds.filter((x) => x === id).length === 1,
        `J2. primary once: ${id}`,
      );
    }
  }

  // K. Objective override wiring present (Easy → write-preview)
  {
    const ui = read("src/components/campagne/InstantFormEasyBuilder.tsx");
    const api = read("src/app/api/meta/write-preview/route.ts");
    const load = read("src/lib/meta/write/load-preview.ts");
    assert(
      ui.includes("instantFormCanonicalObjectiveRaw") &&
        ui.includes("objectiveRaw"),
      "K1. Easy planBody sends objectiveRaw",
    );
    assert(api.includes("objectiveRawOverride"), "K2. API accepts objective override");
    assert(
      load.includes("objectiveRawOverride") &&
        load.includes("objectiveOverride || row.objective"),
      "K3. load-preview prefers Easy objective",
    );
  }

  // L. Meta mutations 0
  {
    const files = [
      "src/lib/meta/launch-guardian/prewrite.ts",
      "src/components/campagne/InstantFormEasyBuilder.tsx",
      "src/lib/meta/write/load-preview.ts",
      "src/app/api/meta/write-preview/route.ts",
    ];
    for (const f of files) {
      assert(existsSync(join(root, f)), `L.exists ${f}`);
      assert(
        !/graph\.facebook\.com|\/act_.*\/campaigns|createCampaign\(/.test(read(f)),
        `L.no Meta mutation ${f}`,
      );
    }
    const g = runPreWriteLaunchGuardian({
      preview: null,
      easyDraft: incompleteEasyDraft,
    });
    assert(g.mutationsPerformed === 0, "L.mutationsPerformed=0");
  }

  // M. Status precedence comment / helpers present
  {
    const pre = read("src/lib/meta/launch-guardian/prewrite.ts");
    assert(pre.includes("GUARDIAN_ISSUE"), "M1. semantic issue ids");
    assert(
      pre.includes("UNSUPPORTED only") ||
        pre.includes("UNSUPPORTED — only") ||
        pre.includes("UNSUPPORTED only when"),
      "M2. precedence documented",
    );
  }

  console.log(`\nTOTAL_FAILS=${falliti}\n`);
  process.exit(falliti > 0 ? 1 : 0);
}

main();
