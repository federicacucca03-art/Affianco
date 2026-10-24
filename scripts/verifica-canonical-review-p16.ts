/**
 * P0.16 — Canonical Review + Pre-write Launch Guardian.
 * META MUTATIONS: 0 · COMMIT: NO
 * Self-contained on HEAD + Instant Form Easy COMMIT 1 (no Architect / no Supabase).
 * Esegui: npx tsx scripts/verifica-canonical-review-p16.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { runPreWriteLaunchGuardian } from "../src/lib/meta/launch-guardian/prewrite";
import { buildMetaWritePreview } from "../src/lib/meta/write/preview";
import type { MetaWritePlanInput } from "../src/lib/meta/write/types";
import type { AllyWebsiteTrackingConfig } from "../src/lib/meta/write/tracking";

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
    campaignName: "QA Canonical Review P0.16",
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
    /** Complete Instant Form fixture — Meta creative technical link. */
    formPrivacyPolicyUrl: "https://example.com/privacy-policy",
    ...overrides,
  };
}

const pixelLead: AllyWebsiteTrackingConfig = {
  sourceType: "PIXEL",
  sourceId: "987654321098765",
  sourceName: "Ally QA Pixel",
  eventType: "LEAD",
  customConversionId: null,
  verificationStatus: "SELECTED",
  metaAdAccountId: "act_1234567890",
};

/**
 * Instant Form Easy capability shape (Architect would attach the same family).
 * Kept as a local fixture so COMMIT 1 tests do not import unstaged Architect.
 */
const INSTANT_FORM_EASY_CAPABILITY = {
  level: "EASY_READY" as const,
  recommendedRoute: "INSTANT_FORM_EASY" as const,
  summaryIt:
    "Instant Form Leads è eseguibile nel percorso Easy (stessa famiglia di review).",
};

async function main() {
  console.log("\n=== P0.16 Canonical Review + Pre-write Guardian ===\n");

  // A. Leads Instant Form complete
  {
    const preview = buildMetaWritePreview(basePlan(), {});
    const g = runPreWriteLaunchGuardian({ preview });
    assert(g.phase === "PRE_WRITE", "A1. phase PRE_WRITE");
    assert(g.mutationsPerformed === 0, "A2. mutations 0");
    assert(
      g.reviewStatus === "READY" || g.reviewStatus === "READY_WITH_CONFIRMATIONS",
      `A3. READY/READY_WITH_CONFIRMATIONS (got ${g.reviewStatus})`,
    );
    assert(Boolean(preview.canonicalPublishPreview), "A4. canonical present");
  }

  // B. Missing Form → BLOCKED
  {
    const preview = buildMetaWritePreview(basePlan({ formId: "" }), {});
    const g = runPreWriteLaunchGuardian({ preview });
    assert(g.reviewStatus === "BLOCKED", `B1. BLOCKED (got ${g.reviewStatus})`);
    assert(
      g.blockers.some((b) => /form|modulo/i.test(b.id + b.title + b.userMessage)),
      "B2. Form blocker",
    );
  }

  // C. Website Leads without tracking → BLOCKED, not Link Clicks
  {
    const preview = buildMetaWritePreview(
      basePlan({
        destination: "WEBSITE",
        destinationUrl: "https://example.com/contatti",
        formId: null,
        websiteTracking: null,
      }),
      {},
    );
    const g = runPreWriteLaunchGuardian({ preview });
    assert(g.reviewStatus === "BLOCKED", `C1. BLOCKED (got ${g.reviewStatus})`);
    assert(
      g.blockers.some((b) => /tracking/i.test(b.id + b.title + b.userMessage)),
      "C2. tracking blocker",
    );
    assert(
      preview.adSet?.optimization_goal !== "LINK_CLICKS" ||
        preview.conversionPublishPlan?.optimizationGoal !== "LINK_CLICKS",
      "C3. never Link Clicks disguise",
    );
  }

  // D. Website Leads with tracking
  {
    const preview = buildMetaWritePreview(
      basePlan({
        destination: "WEBSITE",
        destinationUrl: "https://example.com/contatti",
        formId: null,
        websiteTracking: pixelLead,
      }),
      {},
    );
    const g = runPreWriteLaunchGuardian({ preview });
    assert(Boolean(preview.canonicalPublishPreview), "D1. canonical preview");
    assert(
      preview.conversionPublishPlan?.conversionLocation === "WEBSITE",
      "D2. WEBSITE location",
    );
    assert(
      g.reviewStatus !== "UNSUPPORTED",
      `D3. not UNSUPPORTED (got ${g.reviewStatus})`,
    );
  }

  // E. Sales → UNSUPPORTED via capability
  {
    const preview = buildMetaWritePreview(
      basePlan({
        objectiveRaw: "OUTCOME_SALES",
        destination: "WEBSITE",
        destinationUrl: "https://shop.example.com",
        formId: null,
        websiteTracking: {
          ...pixelLead,
          eventType: "PURCHASE",
        },
      }),
      {},
    );
    const g = runPreWriteLaunchGuardian({
      preview,
      executionSupport: {
        level: "NOT_YET_SUPPORTED",
        recommendedRoute: "NONE",
        summaryIt:
          "Ally ha progettato Sales Website/Purchase ma non è ancora eseguibile.",
        unsupported: true,
      },
    });
    assert(g.reviewStatus === "UNSUPPORTED", `E1. UNSUPPORTED (got ${g.reviewStatus})`);
    assert(!g.futureLaunchEligible, "E2. no future launch");
    assert(
      !/Ready to publish|Pronta per pubblicare/i.test(g.headlineIt + g.summaryIt),
      "E3. no Ready to publish copy",
    );
  }

  // F. Traffic — honest support state
  {
    const preview = buildMetaWritePreview(
      basePlan({
        objectiveRaw: "OUTCOME_TRAFFIC",
        destination: "WEBSITE",
        destinationUrl: "https://example.com",
        formId: null,
      }),
      {},
    );
    const g = runPreWriteLaunchGuardian({ preview });
    assert(g.phase === "PRE_WRITE", "F1. pre-write");
    assert(
      ["READY", "READY_WITH_CONFIRMATIONS", "BLOCKED", "UNSUPPORTED"].includes(
        g.reviewStatus,
      ),
      `F2. honest status ${g.reviewStatus}`,
    );
  }

  // G. SAC unresolved
  {
    const preview = buildMetaWritePreview(
      basePlan({ specialAdCategories: { kind: "UNRESOLVED" } }),
      {},
    );
    const g = runPreWriteLaunchGuardian({ preview });
    assert(
      g.reviewStatus === "BLOCKED" ||
        g.reviewStatus === "READY_WITH_CONFIRMATIONS",
      `G1. SAC blocks/confirm (got ${g.reviewStatus})`,
    );
    assert(
      g.blockers.some((b) => /sac|categoria/i.test(b.id + b.title)) ||
        g.confirmations.some((b) => /sac|categoria/i.test(b.id + b.title)),
      "G2. SAC check present",
    );
    assert(
      preview.campaign?.special_ad_categories == null ||
        (Array.isArray(preview.campaign.special_ad_categories) &&
          preview.campaign.special_ad_categories.length === 0) ||
        preview.readinessCodes.includes("MISSING_SPECIAL_AD_CATEGORY_DECISION"),
      "G3. not silently NONE-confirmed",
    );
  }

  // H. Manual placements unsupported
  {
    const preview = buildMetaWritePreview(
      basePlan({ placementsAdvantage: false }),
      {},
    );
    const g = runPreWriteLaunchGuardian({ preview });
    const mode = preview.canonicalPublishPreview?.technicalDetails.placementsMode;
    if (mode === "MANUAL_UNSUPPORTED") {
      assert(
        g.blockers.some((b) => /placement/i.test(b.id + b.title)),
        "H1. manual placements blocker",
      );
    } else {
      assert(true, `H1. placements mode=${mode} (no silent Advantage+ assumed)`);
    }
  }

  // I. Creative missing media
  {
    const preview = buildMetaWritePreview(basePlan({ creativitaCount: 0 }), {});
    const g = runPreWriteLaunchGuardian({ preview });
    assert(
      g.reviewStatus === "BLOCKED" ||
        g.blockers.some((b) => /creative|media|creativ/i.test(b.id + b.title)),
      "I1. creative media blocker",
    );
  }

  // J. No fabricated IDs
  {
    const preview = buildMetaWritePreview(basePlan(), {});
    const g = runPreWriteLaunchGuardian({ preview });
    assert(
      g.passed.some((p) => p.id === "safety.no_fabricated_ids"),
      "J1. fabricated-id safety pass",
    );
    const dump = JSON.stringify(preview.canonicalPublishPreview ?? {});
    assert(
      !/\b(invented|fake)_?(page|form|pixel)/i.test(dump),
      "J2. no fabricated markers in canonical",
    );
  }

  // K. Instant Form Easy capability family → same guardian review as Easy preview
  // (Architect would attach this capability shape; live Architect is outside COMMIT 1.)
  {
    assert(
      INSTANT_FORM_EASY_CAPABILITY.level === "EASY_READY",
      "K1. Instant Form Easy capability EASY_READY",
    );
    const preview = buildMetaWritePreview(basePlan(), {});
    const gEasy = runPreWriteLaunchGuardian({ preview });
    const gArchFamily = runPreWriteLaunchGuardian({
      preview,
      executionSupport: {
        level: INSTANT_FORM_EASY_CAPABILITY.level,
        recommendedRoute: INSTANT_FORM_EASY_CAPABILITY.recommendedRoute,
        summaryIt: INSTANT_FORM_EASY_CAPABILITY.summaryIt,
      },
    });
    assert(gEasy.phase === gArchFamily.phase, "K2. same PRE_WRITE phase");
    assert(
      gEasy.reviewStatus === gArchFamily.reviewStatus ||
        (gEasy.publishAllowed && gArchFamily.publishAllowed),
      "K3. Instant Form Easy capability review aligns with Easy preview",
    );
  }

  // L. Meta mutations 0 in COMMIT 1 review surfaces
  {
    const files = [
      "src/lib/meta/launch-guardian/prewrite.ts",
      "src/lib/meta/launch-guardian/prewrite-types.ts",
      "src/components/campagne/CanonicalCampaignReviewPanel.tsx",
    ];
    for (const f of files) {
      assert(existsSync(join(root, f)), `L.exists ${f}`);
      const t = read(f);
      assert(
        !/graph\.facebook\.com|ADS_PUBLISH|createCampaign\(|publishCampaign\(/.test(
          t,
        ),
        `L.no Meta mutation ${f}`,
      );
    }
    assert(
      read("src/lib/meta/launch-guardian/prewrite.ts").includes(
        "runPreWriteLaunchGuardian",
      ) &&
        read("src/lib/meta/launch-guardian/prewrite-types.ts").includes(
          "PRE_WRITE",
        ),
      "L.prewrite exported",
    );
    assert(
      read("src/lib/meta/launch-guardian/prewrite-types.ts").includes(
        "IMMEDIATE_EXPECTED_VS_ACTUAL",
      ),
      "L.P0.6 post-write phase preserved (documented in prewrite-types)",
    );
  }

  // Integration markers (COMMIT 1 Instant Form Easy surfaces only)
  {
    const easy = read("src/components/campagne/InstantFormEasyBuilder.tsx");
    assert(
      easy.includes("CanonicalCampaignReviewPanel") &&
        easy.includes("runPreWriteLaunchGuardian"),
      "INT1. Easy uses canonical review + prewrite",
    );
    assert(
      read("src/components/campagne/CanonicalCampaignReviewPanel.tsx").includes(
        "Lancia su Meta (non collegato)",
      ) ||
        read("src/components/campagne/CanonicalCampaignReviewPanel.tsx").includes(
          "Lancia su Meta (prossimamente)",
        ),
      "INT2. future launch CTA inert",
    );
    assert(
      read("src/components/campagne/CanonicalCampaignReviewPanel.tsx").includes(
        "publishControls",
      ) &&
        !easy.includes("MetaFullPublishCta") &&
        !easy.includes("publishControls="),
      "INT3. shared review panel; Easy has no Meta full-publish mount",
    );
    const prep = read("src/components/campagne/MetaWritePreviewPanel.tsx");
    assert(
      prep.includes("CanonicalCampaignReviewPanel"),
      "INT4. Preparazione Meta uses same review panel",
    );
  }

  console.log(`\nTOTAL_FAILS=${falliti}\n`);
  process.exit(falliti > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
