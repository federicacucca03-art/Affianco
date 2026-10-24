/**
 * P0.17 — Canonical Creative Package foundation.
 * META MUTATIONS: 0 · COMMIT: NO
 * Self-contained: direct staged creative modules (no creative barrel → copy-assist → supabase).
 * copy-assist loaded only after process-local dummy Supabase env (no network/DB).
 * Esegui: npx tsx scripts/verifica-creative-engine-p17.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  buildCanonicalCreativePackage,
  buildCreativePackageFromEasyDraft,
} from "../src/lib/meta/creative/build-package";
import { buildCreativeLaunchPackage } from "../src/lib/meta/creative/launch-package";
import { analyzeCreativeFormatReadiness } from "../src/lib/meta/creative/format-readiness";
import {
  GUARDIAN_ISSUE,
  countActionableIssue,
  runPreWriteLaunchGuardian,
} from "../src/lib/meta/launch-guardian/prewrite";
import type { CreativitaMeta } from "../src/lib/creativita";

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

/** Process-local only — never persist. Allows copy-assist import side-effect. */
function ensureTestOnlySupabaseEnv(): () => void {
  const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prevKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!prevUrl?.trim()) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.invalid";
  }
  if (!prevKey?.trim()) {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-only-placeholder";
  }
  return () => {
    if (prevUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
    if (prevKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = prevKey;
  };
}

const sampleImage: CreativitaMeta = {
  id: "asset-1",
  nomeFile: "qa-square.jpg",
  width: 1080,
  height: 1080,
  ruolo: "principale",
  avvisoFormato: false,
  storagePath: "user/asset-1.jpg",
};

async function main() {
  console.log("\n=== P0.17 Creative & Launch Engine Foundation ===\n");

  // Audit markers
  {
    assert(existsSync(join(root, "src/lib/meta/creative/types.ts")), "AUDIT.types");
    assert(
      existsSync(join(root, "src/lib/meta/creative/build-package.ts")),
      "AUDIT.build",
    );
    assert(
      read("src/components/campagne/EasyBuilderSingleImageInput.tsx").length > 0,
      "AUDIT.P0.8 upload reused",
    );
  }

  // A. Instant Form + image + copy → READY_FOR_REVIEW
  {
    const pkg = buildCreativePackageFromEasyDraft({
      pageId: "page-1",
      pageName: "Pagina QA",
      formId: "form-1",
      formName: "Modulo QA",
      primaryText: "Richiedi un preventivo senza impegno.",
      headline: "Preventivo infissi",
      asset: sampleImage,
      objectiveChoice: "GENERATE_LEADS",
      conversionChoice: "INSTANT_FORM",
      primaryTextProvenance: "USER",
      headlineProvenance: "USER",
    });
    assert(
      pkg.status === "READY_FOR_REVIEW",
      `A1. READY_FOR_REVIEW (got ${pkg.status})`,
    );
    assert(pkg.format === "SINGLE_IMAGE", "A2. SINGLE_IMAGE");
    assert(pkg.destination.type === "META_LEAD_FORM", "A3. Instant Form dest");
    assert(pkg.destination.url == null, "A4. no invented website URL");
  }

  // B. Missing image → BLOCKED Annuncio
  {
    const pkg = buildCreativePackageFromEasyDraft({
      pageId: "page-1",
      formId: "form-1",
      primaryText: "Testo",
      headline: "Titolo",
      asset: null,
      objectiveChoice: "GENERATE_LEADS",
      conversionChoice: "INSTANT_FORM",
    });
    assert(pkg.status === "BLOCKED", `B1. BLOCKED (got ${pkg.status})`);
    assert(
      pkg.blockers.some((b) => b.code === "CREATIVE_MEDIA_MISSING"),
      "B2. media missing",
    );
    const g = runPreWriteLaunchGuardian({
      preview: null,
      easyDraft: {
        pageId: "page-1",
        formId: "form-1",
        primaryText: "Testo",
        headline: "Titolo",
        creativitaCount: 0,
        specialKind: "NONE",
        budgetDailyMajor: 20,
        metaGeoKey: "1",
        objectiveChoice: "GENERATE_LEADS",
        conversionChoice: "INSTANT_FORM",
        metaConnected: true,
      },
      creativePackage: pkg,
    });
    assert(
      countActionableIssue(g, GUARDIAN_ISSUE.CREATIVE_MEDIA_MISSING) === 1,
      "B3. Guardian Annuncio media blocker",
    );
  }

  // C. Missing primary text
  {
    const pkg = buildCreativePackageFromEasyDraft({
      pageId: "page-1",
      formId: "form-1",
      primaryText: "",
      headline: "Titolo",
      asset: sampleImage,
      objectiveChoice: "GENERATE_LEADS",
      conversionChoice: "INSTANT_FORM",
    });
    assert(pkg.status === "BLOCKED", "C1. BLOCKED");
    assert(
      pkg.blockers.some((b) => b.code === "CREATIVE_PRIMARY_TEXT_MISSING"),
      "C2. primary text missing",
    );
  }

  // D. Missing headline
  {
    const pkg = buildCreativePackageFromEasyDraft({
      pageId: "page-1",
      formId: "form-1",
      primaryText: "Testo ok",
      headline: "",
      asset: sampleImage,
      objectiveChoice: "GENERATE_LEADS",
      conversionChoice: "INSTANT_FORM",
    });
    assert(
      pkg.blockers.some((b) => b.code === "CREATIVE_HEADLINE_MISSING"),
      "D1. headline required",
    );
  }

  // E. Website Leads destination preserved
  {
    const pkg = buildCanonicalCreativePackage({
      pageId: "page-1",
      primaryText: "Visita il sito",
      headline: "Scopri di più",
      assets: [sampleImage],
      destinationType: "WEBSITE",
      destinationUrl: "https://example.com/offerta",
    });
    assert(pkg.destination.type === "WEBSITE", "E1. WEBSITE");
    assert(
      pkg.destination.url === "https://example.com/offerta",
      "E2. URL preserved",
    );
  }

  // F. Instant Form — no website URL invented
  {
    const pkg = buildCanonicalCreativePackage({
      pageId: "page-1",
      formId: "form-1",
      primaryText: "x",
      headline: "y",
      assets: [sampleImage],
      destinationType: "META_LEAD_FORM",
      destinationUrl: "https://should-not-stick.example",
    });
    assert(pkg.destination.url == null, "F1. Instant Form strips website URL");
  }

  // G + I. Ally copy assist (dynamic import after process-local dummy env)
  {
    const restore = ensureTestOnlySupabaseEnv();
    try {
      const {
        parseAllyCreativeCopySuggestion,
        fallbackAllyCreativeCopySuggestion,
      } = await import("../src/lib/meta/creative/copy-assist");

      const parsed = parseAllyCreativeCopySuggestion(
        JSON.stringify({
          primaryText: "Proposta Ally chiara.",
          headline: "Titolo Ally",
          description: null,
          angleIt: "Chiarezza",
        }),
      );
      assert(parsed?.provenance === "ALLY", "G1. ALLY provenance");
      assert(parsed?.primaryText.includes("Ally"), "G2. editable proposal text");
      const bad = parseAllyCreativeCopySuggestion(
        JSON.stringify({
          primaryText: "best performing winner +30%",
          headline: "Hype",
        }),
      );
      assert(bad == null, "G3. reject performance claims");

      const s = fallbackAllyCreativeCopySuggestion({
        offerSummary: "impianti",
        brandTone: "professionale",
        geography: "Roma",
        conversionLocation: "INSTANT_FORM",
      });
      assert(s.provenance === "ALLY", "I1. assist provenance ALLY");
      assert(/Roma|impianti/i.test(s.primaryText), "I2. uses offer/geo context");
      const api = read("src/app/api/ally-creative-copy/route.ts");
      assert(api.includes("brandBrainMutated: false"), "I3. no BB mutation");
    } finally {
      restore();
    }
  }

  // H. User override provenance
  {
    const pkg = buildCreativePackageFromEasyDraft({
      pageId: "page-1",
      formId: "form-1",
      primaryText: "Testo utente dopo Ally",
      headline: "Titolo utente",
      asset: sampleImage,
      objectiveChoice: "GENERATE_LEADS",
      conversionChoice: "INSTANT_FORM",
      primaryTextProvenance: "USER",
      headlineProvenance: "USER",
    });
    assert(pkg.copy.primaryTextProvenance === "USER", "H1. user wins");
  }

  // J. Carousel unsupported — no fake single-image conversion
  {
    const pkg = buildCanonicalCreativePackage({
      pageId: "page-1",
      formId: "form-1",
      primaryText: "x",
      headline: "y",
      assets: [sampleImage, { ...sampleImage, id: "a2", ruolo: "variante2" }],
      destinationType: "META_LEAD_FORM",
      requestedFormat: "CAROUSEL",
    });
    assert(pkg.formatSupport === "NOT_YET_SUPPORTED", "J1. NOT_YET_SUPPORTED");
    assert(pkg.status === "UNSUPPORTED", `J2. UNSUPPORTED (got ${pkg.status})`);
    const g = runPreWriteLaunchGuardian({
      preview: null,
      creativePackage: pkg,
      easyDraft: {
        pageId: "page-1",
        formId: "form-1",
        primaryText: "x",
        headline: "y",
        creativitaCount: 2,
        specialKind: "NONE",
        budgetDailyMajor: 20,
        metaGeoKey: "1",
        objectiveChoice: "GENERATE_LEADS",
        conversionChoice: "INSTANT_FORM",
        metaConnected: true,
      },
    });
    assert(g.reviewStatus === "UNSUPPORTED", `J3. Guardian UNSUPPORTED`);
  }

  // K. Square image honest readiness
  {
    const r = analyzeCreativeFormatReadiness({ width: 1080, height: 1080 });
    assert(r.feed1x1 === "AVAILABLE", "K1. 1:1 AVAILABLE");
    assert(
      r.stories9x16 === "SUBOPTIMAL" || r.stories9x16 === "MISSING_FORMAT",
      `K2. stories not silently AVAILABLE (got ${r.stories9x16})`,
    );
  }

  // L. No Page → identity blocker
  {
    const pkg = buildCreativePackageFromEasyDraft({
      pageId: "",
      formId: "form-1",
      primaryText: "x",
      headline: "y",
      asset: sampleImage,
      objectiveChoice: "GENERATE_LEADS",
      conversionChoice: "INSTANT_FORM",
    });
    assert(
      pkg.blockers.some((b) => b.editTarget === "identita"),
      "L1. Page → Identità",
    );
  }

  // M. No fabricated Meta IDs
  {
    const pkg = buildCreativePackageFromEasyDraft({
      pageId: "page-real",
      formId: "form-real",
      primaryText: "x",
      headline: "y",
      asset: sampleImage,
      objectiveChoice: "GENERATE_LEADS",
      conversionChoice: "INSTANT_FORM",
    });
    const dump = JSON.stringify(pkg);
    assert(!/invent|fake_page|demo_form/i.test(dump), "M1. no fabricated IDs");
  }

  // N. Meta mutations 0 + launch package inert
  {
    const pkg = buildCreativePackageFromEasyDraft({
      pageId: "page-1",
      formId: "form-1",
      primaryText: "x",
      headline: "y",
      asset: sampleImage,
      objectiveChoice: "GENERATE_LEADS",
      conversionChoice: "INSTANT_FORM",
    });
    const launch = buildCreativeLaunchPackage(pkg);
    assert(launch.mutationsPerformed === 0, "N1. launch package mutations 0");
    assert(launch.phase === "PRE_WRITE_CREATIVE", "N2. pre-write phase");
    assert(launch.valid === true, "N3. valid when complete");
    const files = [
      "src/lib/meta/creative/build-package.ts",
      "src/lib/meta/creative/launch-package.ts",
      "src/app/api/ally-creative-copy/route.ts",
      "src/components/campagne/InstantFormEasyBuilder.tsx",
    ];
    for (const f of files) {
      assert(existsSync(join(root, f)), `N.exists ${f}`);
      assert(
        !/graph\.facebook\.com|createCampaign\(|\/act_.*\/adcreatives/.test(
          read(f),
        ),
        `N.no Meta write ${f}`,
      );
    }
  }

  // UI wiring
  {
    const ui = read("src/components/campagne/InstantFormEasyBuilder.tsx");
    assert(ui.includes("Prepara copy con Ally"), "UI1. Ally copy assist");
    assert(ui.includes("creativePackage"), "UI2. package wired");
    assert(ui.includes("Stories / Reels"), "UI3. placement preview");
    const panel = read("src/components/campagne/CanonicalCampaignReviewPanel.tsx");
    assert(panel.includes("Creatività · package canonico"), "UI4. review creative");
  }

  console.log(`\nTOTAL_FAILS=${falliti}\n`);
  process.exit(falliti > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
