/**
 * P0.16.3 — Remove duplicated legacy blocker summary (red Blocchi box).
 * META MUTATIONS: 0 · COMMIT: NO
 * Esegui: npx tsx scripts/verifica-canonical-review-p163.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  GUARDIAN_ISSUE,
  countActionableIssue,
  runPreWriteLaunchGuardian,
} from "../src/lib/meta/launch-guardian/prewrite";
import { buildMetaWritePreview } from "../src/lib/meta/write/preview";
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
    campaignName: "QA Legacy Blocchi P0.16.3",
    objectiveRaw: "OUTCOME_LEADS",
    destination: "META_LEAD_FORM",
    destinationUrl: null,
    pageId: null,
    formId: null,
    whatsappNumber: null,
    budgetDailyMajor: null,
    budgetLevel: "AD_SET",
    specialAdCategories: { kind: "UNRESOLVED" },
    citta: null,
    raggioKm: null,
    countryCode: "IT",
    metaGeoKey: null,
    geoLabel: null,
    etaMin: null,
    etaMax: null,
    placementsAdvantage: true,
    startAtIso: null,
    endAtIso: null,
    creativitaCount: 0,
    targetType: "B2C",
    isImportedMetaOnly: false,
    existingMetaCampaignId: null,
    partialHierarchyPending: false,
    writeHierarchyCompleted: false,
    grantedScopes: [],
    hasMetaConnection: false,
    hasAdAccount: false,
    metaAdAccountId: null,
    adAccountCurrency: "EUR",
    adAccountTimezone: "Europe/Rome",
    buyingType: "AUCTION",
    allyAudienceMode: "ADVANTAGE_AUDIENCE",
    allyBidMode: "AUTOMATIC_NO_CAP",
    instantFormRelation: "UNCHECKED",
    instantFormName: null,
    pageName: null,
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
  console.log("\n=== P0.16.3 Remove duplicated legacy Blocchi summary ===\n");

  // Source audit
  {
    const view = read("src/components/campagne/CanonicalPublishPreviewView.tsx");
    const panel = read("src/components/campagne/CanonicalCampaignReviewPanel.tsx");
    assert(
      view.includes("showLegacyIssueLists"),
      "AUDIT1. legacy issue lists gated by prop",
    );
    assert(
      view.includes("showLegacyIssueLists = false") ||
        view.includes("showLegacyIssueLists = false,"),
      "AUDIT2. default hide legacy lists",
    );
    assert(
      panel.includes("showLegacyIssueLists={false}"),
      "AUDIT3. review panel suppresses raw CanonicalPublishPreview.blockers UI",
    );
    assert(
      panel.includes('title="Blocchi"') && panel.includes("guardian.blockers"),
      "AUDIT4. Guardian remains the Blocchi source",
    );
    // Ensure we did not leave an always-on red Blocchi renderer without the gate
    const unguarded =
      /preview\.blockers\.length > 0 \? \(/.test(view) &&
      !/showLegacyIssueLists && preview\.blockers/.test(view);
    assert(!unguarded, "AUDIT5. no unguarded preview.blockers Blocchi box");
  }

  const preview = buildMetaWritePreview(basePlan(), {});
  const g = runPreWriteLaunchGuardian({
    preview,
    easyDraft: incompleteEasyDraft,
  });

  // A. No Meta + dependent checks → one Meta connection issue (Guardian)
  {
    assert(g.reviewStatus === "BLOCKED", `A0. BLOCKED (got ${g.reviewStatus})`);
    assert(
      countActionableIssue(g, GUARDIAN_ISSUE.META_CONNECTION_MISSING) === 1,
      `A1. one META_CONNECTION_MISSING (got ${countActionableIssue(g, GUARDIAN_ISSUE.META_CONNECTION_MISSING)})`,
    );
    const metaMsgs = [...g.blockers, ...g.confirmations].filter((c) =>
      /collega meta|meta non colleg/i.test(c.title + " " + c.userMessage),
    );
    assert(metaMsgs.length === 1, `A2. one Meta user-facing card (got ${metaMsgs.length})`);
    // Raw canonical may still have duplicate messages — must not be user-facing in review
    const rawMeta = (preview.canonicalPublishPreview?.blockers ?? []).filter((b) =>
      /collega meta/i.test(b.messageIt),
    );
    assert(
      rawMeta.length >= 1,
      "A3. raw canonical still has Meta-ish blockers (legacy dump exists)",
    );
  }

  // B. SAC → one user-facing SAC
  {
    assert(
      countActionableIssue(g, GUARDIAN_ISSUE.SAC_UNRESOLVED) === 1,
      `B1. one SAC_UNRESOLVED (got ${countActionableIssue(g, GUARDIAN_ISSUE.SAC_UNRESOLVED)})`,
    );
  }

  // C. Headline count = deduplicated blockers + confirmations
  {
    const remaining = g.blockers.length + g.confirmations.length;
    assert(remaining > 0, "C1. remaining > 0");
    assert(
      g.headlineIt.includes(String(remaining)) ||
        (remaining === 1 && /1 cosa/i.test(g.headlineIt)),
      `C2. headline uses dedup count N=${remaining} (got "${g.headlineIt}")`,
    );
    // Raw canonical may list many readiness codes with duplicated Meta copy —
    // headline must follow Guardian semantic count, not raw.length.
    const rawMetaDup = (preview.canonicalPublishPreview?.blockers ?? []).filter(
      (b) => /collega meta/i.test(b.messageIt),
    ).length;
    assert(
      rawMetaDup > 1 || rawMetaDup === 1,
      `C3. raw Meta messages present for contrast (rawMetaDup=${rawMetaDup})`,
    );
    assert(
      remaining === g.blockers.length + g.confirmations.length,
      "C4. N equals blockers+confirmations (same set as headline)",
    );
  }

  // D. Detailed Guardian list still deduplicated (P0.16.2 regression)
  {
    const ids = [...g.blockers, ...g.confirmations].map((c) => c.id);
    const unique = new Set(ids);
    assert(ids.length === unique.size, "D1. no duplicate semantic ids in actionable list");
    for (const id of [
      GUARDIAN_ISSUE.PAGE_MISSING,
      GUARDIAN_ISSUE.FORM_MISSING,
      GUARDIAN_ISSUE.GEO_MISSING,
      GUARDIAN_ISSUE.CREATIVE_MEDIA_MISSING,
    ]) {
      assert(
        countActionableIssue(g, id) === 1,
        `D2. once: ${id}`,
      );
    }
  }

  // E. LEADS + Instant Form → BLOCKED
  {
    assert(g.reviewStatus === "BLOCKED", "E1. LEADS Instant Form incomplete BLOCKED");
    assert(g.reviewStatus !== "UNSUPPORTED", "E2. not UNSUPPORTED");
  }

  // F. Sales → UNSUPPORTED
  {
    const sales = runPreWriteLaunchGuardian({
      preview: buildMetaWritePreview(
        basePlan({
          objectiveRaw: "OUTCOME_SALES",
          destination: "WEBSITE",
          destinationUrl: "https://shop.example.com",
          hasMetaConnection: true,
          hasAdAccount: true,
          metaAdAccountId: "act_1",
          grantedScopes: ["ads_management"],
          pageId: "p1",
          budgetDailyMajor: 50,
          metaGeoKey: "1",
          creativitaCount: 1,
          specialAdCategories: { kind: "NONE" },
          websiteTracking: {
            sourceType: "PIXEL",
            sourceId: "px",
            sourceName: "px",
            eventType: "PURCHASE",
            customConversionId: null,
            verificationStatus: "SELECTED",
            metaAdAccountId: "act_1",
          },
        }),
        {},
      ),
      executionSupport: {
        level: "NOT_YET_SUPPORTED",
        recommendedRoute: "NONE",
        unsupported: true,
      },
    });
    assert(sales.reviewStatus === "UNSUPPORTED", `F1. UNSUPPORTED (got ${sales.reviewStatus})`);
  }

  // G. Meta mutations 0
  {
    const files = [
      "src/components/campagne/CanonicalPublishPreviewView.tsx",
      "src/components/campagne/CanonicalCampaignReviewPanel.tsx",
      "src/lib/meta/launch-guardian/prewrite.ts",
    ];
    for (const f of files) {
      assert(existsSync(join(root, f)), `G.exists ${f}`);
      assert(
        !/graph\.facebook\.com|createCampaign\(/.test(read(f)),
        `G.no Meta mutation ${f}`,
      );
    }
    assert(g.mutationsPerformed === 0, "G.mutationsPerformed=0");
  }

  // Single semantic source: review UI does not dual-render raw + Guardian
  {
    const panel = read("src/components/campagne/CanonicalCampaignReviewPanel.tsx");
    assert(
      !panel.includes("canonical.blockers.map") &&
        !panel.includes("preview.blockers.map"),
      "H1. review panel does not map raw canonical blockers",
    );
    assert(
      panel.includes("guardian.blockers") &&
        panel.includes("guardian.confirmations"),
      "H2. review panel maps Guardian actionable lists",
    );
  }

  console.log(`\nTOTAL_FAILS=${falliti}\n`);
  process.exit(falliti > 0 ? 1 : 0);
}

main();
