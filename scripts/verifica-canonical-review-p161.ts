/**
 * P0.16.1 — Review reachable with incomplete Easy configuration.
 * META MUTATIONS: 0 · COMMIT: NO
 * Esegui: npx tsx scripts/verifica-canonical-review-p161.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { runPreWriteLaunchGuardian } from "../src/lib/meta/launch-guardian/prewrite";
import {
  canContinueBuilderStep,
  canLaunchFromBuilderReview,
  canOpenBuilderReview,
  emptyInstantFormBuilderDraft,
  evaluateBuilderStep,
} from "../src/lib/meta/write/instant-form-builder";
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
    campaignName: "QA Review Access P0.16.1",
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

async function main() {
  console.log("\n=== P0.16.1 Review access with incomplete Easy config ===\n");

  // Gate classification audit (static)
  {
    const logic = read("src/lib/meta/write/instant-form-builder.ts");
    assert(logic.includes("canOpenBuilderReview"), "AUDIT1. canOpenBuilderReview");
    assert(
      logic.includes("canContinueBuilderStep") &&
        logic.includes("canLaunchFromBuilderReview"),
      "AUDIT2. continue vs launch helpers",
    );
    const empty = emptyInstantFormBuilderDraft({
      objectiveChoice: "GENERATE_LEADS",
      conversionChoice: "INSTANT_FORM",
    });
    assert(
      !canContinueBuilderStep({ stepId: "identita", draft: empty }),
      "AUDIT3. Page still HARD_NAVIGATION_GATE for Continua",
    );
    assert(canOpenBuilderReview(empty) === true, "AUDIT4. review always openable");
  }

  // A. Instant Form + no Meta / no Page → review reachable + Page blocker
  {
    const draft = emptyInstantFormBuilderDraft({
      objectiveChoice: "GENERATE_LEADS",
      conversionChoice: "INSTANT_FORM",
    });
    assert(canOpenBuilderReview(draft), "A1. review reachable");
    assert(
      !evaluateBuilderStep({ stepId: "identita", draft }).canContinue,
      "A2. Continua still blocked on Identità",
    );
    const g = runPreWriteLaunchGuardian({
      preview: null,
      easyDraft: {
        pageId: "",
        formId: "",
        specialKind: "UNRESOLVED",
        creativitaCount: 0,
        primaryText: "",
        headline: "",
        budgetDailyMajor: null,
        metaGeoKey: null,
        objectiveChoice: "GENERATE_LEADS",
        conversionChoice: "INSTANT_FORM",
        metaConnected: false,
      },
    });
    assert(g.reviewStatus === "BLOCKED", `A3. BLOCKED (got ${g.reviewStatus})`);
    assert(
      g.blockers.some(
        (b) =>
          b.editTarget === "identita" &&
          /pagina|page/i.test(b.id + b.title + b.userMessage),
      ),
      "A4. Page blocker → Identità",
    );
    assert(
      g.blockers.some((b) => /meta|conness/i.test(b.id + b.title + b.userMessage)),
      "A5. Meta connection blocker present",
    );
    assert(!g.futureLaunchEligible, "A6. no launch");
  }

  // B. Page present + Form missing
  {
    const draft = emptyInstantFormBuilderDraft({
      objectiveChoice: "GENERATE_LEADS",
      conversionChoice: "INSTANT_FORM",
      pageId: "page-1",
      pageName: "Pagina QA",
      formId: "",
      specialKind: "NONE",
      budgetDailyMajor: 20,
      metaGeoKey: "2421836",
      creativitaCount: 1,
      primaryText: "Ciao",
      headline: "Offerta",
    });
    assert(canOpenBuilderReview(draft), "B1. review reachable");
    const g = runPreWriteLaunchGuardian({
      preview: buildMetaWritePreview(basePlan({ formId: "" }), {}),
      easyDraft: {
        pageId: draft.pageId,
        formId: draft.formId,
        specialKind: draft.specialKind,
        creativitaCount: 1,
        primaryText: draft.primaryText,
        headline: draft.headline,
        budgetDailyMajor: draft.budgetDailyMajor,
        metaGeoKey: draft.metaGeoKey,
        objectiveChoice: draft.objectiveChoice,
        conversionChoice: draft.conversionChoice,
        metaConnected: true,
      },
    });
    assert(g.reviewStatus === "BLOCKED", `B2. BLOCKED (got ${g.reviewStatus})`);
    assert(
      g.blockers.some(
        (b) =>
          b.editTarget === "modulo" &&
          /form|modulo/i.test(b.id + b.title + b.userMessage),
      ),
      "B3. Form blocker → Modulo",
    );
  }

  // C. Page + Form + SAC unresolved
  {
    const g = runPreWriteLaunchGuardian({
      preview: buildMetaWritePreview(
        basePlan({ specialAdCategories: { kind: "UNRESOLVED" } }),
        {},
      ),
      easyDraft: {
        pageId: "page-1",
        formId: "form-1",
        specialKind: "UNRESOLVED",
        creativitaCount: 1,
        primaryText: "Ciao",
        headline: "Offerta",
        budgetDailyMajor: 20,
        metaGeoKey: "2421836",
        objectiveChoice: "GENERATE_LEADS",
        conversionChoice: "INSTANT_FORM",
        metaConnected: true,
      },
    });
    assert(canOpenBuilderReview(), "C1. review reachable");
    assert(
      g.reviewStatus === "BLOCKED" ||
        g.reviewStatus === "READY_WITH_CONFIRMATIONS",
      `C2. SAC confirmation/blocker (got ${g.reviewStatus})`,
    );
    assert(
      g.blockers.some((b) => /sac|categoria/i.test(b.id + b.title)) ||
        g.confirmations.some((b) => /sac|categoria/i.test(b.id + b.title)),
      "C3. SAC check present",
    );
    assert(!g.futureLaunchEligible, "C4. no launch");
  }

  // D. Missing creative media
  {
    const g = runPreWriteLaunchGuardian({
      preview: buildMetaWritePreview(basePlan({ creativitaCount: 0 }), {}),
      easyDraft: {
        pageId: "page-1",
        formId: "form-1",
        specialKind: "NONE",
        creativitaCount: 0,
        primaryText: "Ciao",
        headline: "Offerta",
        budgetDailyMajor: 20,
        metaGeoKey: "2421836",
        objectiveChoice: "GENERATE_LEADS",
        conversionChoice: "INSTANT_FORM",
        metaConnected: true,
      },
    });
    assert(g.reviewStatus === "BLOCKED", `D1. BLOCKED (got ${g.reviewStatus})`);
    assert(
      g.blockers.some(
        (b) =>
          b.editTarget === "annuncio" &&
          /creative|media|creativ|immagine/i.test(b.id + b.title + b.userMessage),
      ),
      "D2. creative → Annuncio",
    );
  }

  // E. Fully complete Instant Form
  {
    const preview = buildMetaWritePreview(basePlan(), {});
    const g = runPreWriteLaunchGuardian({
      preview,
      easyDraft: {
        pageId: "page-1",
        formId: "form-1",
        specialKind: "NONE",
        creativitaCount: 1,
        primaryText: "Ciao",
        headline: "Offerta",
        budgetDailyMajor: 20,
        metaGeoKey: "2421836",
        objectiveChoice: "GENERATE_LEADS",
        conversionChoice: "INSTANT_FORM",
        metaConnected: true,
      },
    });
    assert(
      g.reviewStatus === "READY" || g.reviewStatus === "READY_WITH_CONFIRMATIONS",
      `E1. READY/READY_WITH_CONFIRMATIONS (got ${g.reviewStatus})`,
    );
    assert(
      canLaunchFromBuilderReview({
        futureLaunchEligible: g.futureLaunchEligible,
        reviewStatus: g.reviewStatus,
      }) ===
        (g.reviewStatus === "READY" && g.futureLaunchEligible),
      "E2. canLaunch matches Guardian READY",
    );
  }

  // F. Sales unsupported
  {
    const g = runPreWriteLaunchGuardian({
      preview: null,
      executionSupport: {
        level: "NOT_YET_SUPPORTED",
        recommendedRoute: "NONE",
        unsupported: true,
        summaryIt: "Sales non ancora eseguibile",
      },
      easyDraft: {
        objectiveChoice: "SELL_ONLINE",
        conversionChoice: null,
        pageId: "page-1",
        formId: "",
        specialKind: "NONE",
        creativitaCount: 1,
        primaryText: "x",
        headline: "y",
        budgetDailyMajor: 50,
        metaGeoKey: "2421836",
        metaConnected: true,
      },
    });
    assert(canOpenBuilderReview(), "F1. review reachable");
    assert(g.reviewStatus === "UNSUPPORTED", `F2. UNSUPPORTED (got ${g.reviewStatus})`);
    assert(!g.futureLaunchEligible, "F3. no fake launch");
  }

  // G. Meta mutations 0 + UI markers
  {
    const ui = read("src/components/campagne/InstantFormEasyBuilder.tsx");
    assert(
      ui.includes("openCampaignReview") &&
        ui.includes("Rivedi stato campagna"),
      "G1. review CTA present",
    );
    assert(
      ui.includes("canOpenBuilderReview") &&
        ui.includes("Continua disabilitato"),
      "G2. Continua gate retained with inline copy",
    );
    const files = [
      "src/components/campagne/InstantFormEasyBuilder.tsx",
      "src/lib/meta/launch-guardian/prewrite.ts",
      "src/lib/meta/write/instant-form-builder.ts",
    ];
    for (const f of files) {
      assert(existsSync(join(root, f)), `G.exists ${f}`);
      assert(
        !/graph\.facebook\.com|createCampaign\(|publishCampaign\(/.test(read(f)),
        `G.no Meta mutation ${f}`,
      );
    }
  }

  // Distinctions
  {
    const incomplete = emptyInstantFormBuilderDraft({
      objectiveChoice: "GENERATE_LEADS",
      conversionChoice: "INSTANT_FORM",
    });
    assert(
      canContinueBuilderStep({ stepId: "identita", draft: incomplete }) ===
        false,
      "H1. CAN_CONTINUE_STEP false without Page",
    );
    assert(canOpenBuilderReview(incomplete) === true, "H2. CAN_OPEN_REVIEW true");
    assert(
      canLaunchFromBuilderReview({
        futureLaunchEligible: false,
        reviewStatus: "BLOCKED",
      }) === false,
      "H3. CAN_LAUNCH false when BLOCKED",
    );
  }

  console.log(`\nTOTAL_FAILS=${falliti}\n`);
  process.exit(falliti > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
