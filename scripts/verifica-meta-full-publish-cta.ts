/**
 * COMMIT 3 — Instant Form Easy ↔ MetaFullPublishCta integration.
 * LIVE META WRITES: 0 | DB MUTATIONS: 0
 *
 * Core FULL_PUBLISH_PAUSED plan/execute/CTA wiring (no Easy mount) lives in:
 *   scripts/verifica-meta-full-publish-cta-core.ts
 *
 * This file retains Easy Builder mount coverage complementary to p07/p08.
 * Expected FAIL until COMMIT 3 remounts MetaFullPublishCta into Easy Builder.
 *
 * Esegui: npx tsx scripts/verifica-meta-full-publish-cta.ts
 */

import { readFileSync } from "node:fs";
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

console.log("FULL_PUBLISH_PAUSED Easy ↔ Meta CTA integration (COMMIT 3)\n");

// G — Instant Form Easy mounts full-publish CTA via publishControls
{
  const easy = read("src/components/campagne/InstantFormEasyBuilder.tsx");
  const review = read("src/components/campagne/CanonicalCampaignReviewPanel.tsx");
  const cta = read("src/components/campagne/MetaFullPublishCta.tsx");

  assert(
    easy.includes("MetaFullPublishCta") && easy.includes("publishControls"),
    "G Instant Form Easy mounts full publish CTA",
  );
  assert(
    review.includes("publishControls"),
    "G CanonicalCampaignReviewPanel accepts publishControls",
  );
  assert(
    cta.includes("/api/meta/publish-plan") &&
      cta.includes('action: "execute"') &&
      cta.includes("humanConfirmed: true"),
    "G mounted CTA still targets controlled execute path",
  );
}

// H — Easy Builder must not call temporary internal QA create routes
{
  const easy = read("src/components/campagne/InstantFormEasyBuilder.tsx");
  assert(
    !easy.includes("/api/internal/qa/"),
    "H InstantFormEasyBuilder does not call internal QA routes",
  );
  assert(
    !easy.includes("phase1-controlled-write") &&
      !easy.includes("adset-resume-create") &&
      !easy.includes("creative-resume-create") &&
      !easy.includes("ad-resume-create"),
    "H InstantFormEasyBuilder does not reference QA create routes",
  );
}

console.log(
  falliti === 0
    ? "\n=== FULL_PUBLISH Easy↔Meta INTEGRATION: TUTTI I CHECK PASS ===\n"
    : `\n=== FULL_PUBLISH Easy↔Meta INTEGRATION: ${falliti} FAIL (expected until COMMIT 3 mount) ===\n`,
);
process.exit(falliti > 0 ? 1 : 0);
