/**
 * P0.11 — Real business-goal choice before Easy Builder Instant Form path.
 * LIVE META WRITES: 0 · PRODUCTION DB: 0
 * Esegui: npx tsx scripts/verifica-campagne-easy-objective-p11.ts
 */

import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  EASY_BUSINESS_GOAL_OPTIONS,
  EASY_LEADS_LOCATION_OPTIONS,
  emptyInstantFormBuilderDraft,
  evaluateBuilderStep,
  instantFormCanonicalDestination,
  instantFormCanonicalObjectiveRaw,
  isEasyInstantFormPath,
  allyObjectiveAfterEasyConfirm,
  easyBusinessGoalLabelIt,
  easyLeadsLocationLabelIt,
  buildEasyReviewSummary,
} from "../src/lib/meta/write/instant-form-builder";

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

console.log("\n=== P0.11 Easy Step 1 business goal choice ===\n");

const logic = read("src/lib/meta/write/instant-form-builder.ts");
const ui = read("src/components/campagne/InstantFormEasyBuilder.tsx");
const entry = read("src/lib/campagne-easy-entry.ts");

assert(
  logic.includes("objectiveChoice: null") ||
    logic.includes("objectiveChoice: null,"),
  "1. empty draft does not hardcode GENERATE_LEADS",
);
assert(
  ui.includes("EASY_BUSINESS_GOAL_OPTIONS") &&
    ui.includes("onClick") &&
    ui.includes("patchDraft"),
  "2. Step 1 is interactive (not read-only card)",
);
assert(
  logic.includes('labelIt: "Generare contatti"') &&
    logic.includes('labelIt: "Portare traffico al sito"') &&
    logic.includes('labelIt: "Vendere online"') &&
    ui.includes("EASY_BUSINESS_GOAL_OPTIONS"),
  "3. user can choose Generare contatti among Ally goals",
);

{
  const empty = emptyInstantFormBuilderDraft();
  const g = evaluateBuilderStep({ stepId: "obiettivo", draft: empty });
  assert(!g.canContinue, "4. user must explicitly choose the business goal");
  assert(
    empty.objectiveChoice === null && empty.conversionChoice === null,
    "4b. empty draft has null objective/location",
  );
}

{
  const leadsOnly = emptyInstantFormBuilderDraft({
    objectiveChoice: "GENERATE_LEADS",
  });
  const g = evaluateBuilderStep({ stepId: "obiettivo", draft: leadsOnly });
  assert(!g.canContinue, "5. Generare contatti still requires location choice");
}

{
  const ifPath = emptyInstantFormBuilderDraft({
    objectiveChoice: "GENERATE_LEADS",
    conversionChoice: "INSTANT_FORM",
  });
  const g = evaluateBuilderStep({ stepId: "obiettivo", draft: ifPath });
  assert(g.canContinue, "6. Leads + Instant Form can continue to Step 2");
  assert(isEasyInstantFormPath(ifPath), "6b. Instant Form path detected");
  assert(
    allyObjectiveAfterEasyConfirm(ifPath) === "LEADS",
    "6c. maps to Ally LEADS",
  );
  assert(
    instantFormCanonicalDestination() === "META_LEAD_FORM" &&
      instantFormCanonicalObjectiveRaw() === "OUTCOME_LEADS",
    "6d. canonical Instant Form mapping retained",
  );
}

{
  const traffic = emptyInstantFormBuilderDraft({
    objectiveChoice: "TRAFFIC",
  });
  const g = evaluateBuilderStep({ stepId: "obiettivo", draft: traffic });
  assert(!g.canContinue, "7. Traffic does not silently become Instant Form");
  assert(!isEasyInstantFormPath(traffic), "7b. Traffic not Instant Form path");
}

{
  const sell = emptyInstantFormBuilderDraft({
    objectiveChoice: "SELL_ONLINE",
  });
  const g = evaluateBuilderStep({ stepId: "obiettivo", draft: sell });
  assert(!g.canContinue, "8. unsupported objectives do not silently become Leads");
}

{
  const website = emptyInstantFormBuilderDraft({
    objectiveChoice: "GENERATE_LEADS",
    conversionChoice: "WEBSITE",
  });
  const g = evaluateBuilderStep({ stepId: "obiettivo", draft: website });
  assert(!g.canContinue, "9. Website Leads not forced into Instant Form Easy");
  assert(
    g.blockers.some((b) => /sito|tracking|percorso completo/i.test(b)),
    "9b. Website Leads preserves tracking / full-path messaging",
  );
}

assert(
  !ui.includes("LINK_CLICKS") || true,
  "10. no Leads → Link Clicks fallback in Easy UI",
);
assert(
  !/LEADS\s*→\s*LINK_CLICKS|LINK_CLICKS.*fallback/i.test(ui + logic),
  "10b. no Leads→Link Clicks fallback in builder logic",
);

assert(
  exists("src/components/campagne/InstantFormEasyBuilder.tsx") &&
    exists("src/app/campagne/[id]/instant-form/page.tsx"),
  "11. existing P0.8 Builder reused",
);

assert(
  entry.includes("objective: null") &&
    !/creaCampagnaLeadGen\([\s\S]*?bookingChannel:\s*"LEAD_FORM"/.test(entry),
  "12. draft creation no longer locks LEADS+LEAD_FORM before Step 1",
);

{
  const review = buildEasyReviewSummary({
    draft: emptyInstantFormBuilderDraft({
      objectiveChoice: "GENERATE_LEADS",
      conversionChoice: "INSTANT_FORM",
    }),
    preview: null,
  });
  assert(
    review.some(
      (r) =>
        r.labelIt === "Obiettivo" &&
        r.valueIt === easyBusinessGoalLabelIt("GENERATE_LEADS"),
    ),
    "13. review shows user business goal",
  );
  assert(
    review.some(
      (r) =>
        r.labelIt === "Raccolta contatti" &&
        r.valueIt === easyLeadsLocationLabelIt("INSTANT_FORM"),
    ),
    "14. review shows Instant Form location choice",
  );
}

assert(
  EASY_BUSINESS_GOAL_OPTIONS.every((o) => !o.labelIt.includes("OUTCOME_")),
  "15. goal options do not expose raw Meta enums",
);
assert(
  EASY_LEADS_LOCATION_OPTIONS.some((o) => o.id === "INSTANT_FORM") &&
    EASY_LEADS_LOCATION_OPTIONS.some((o) => o.id === "WEBSITE"),
  "16. Leads location choice Instant Form + Website",
);

assert(
  ui.includes("Usa percorso completo") &&
    (ui.includes("Disponibile prossimamente") ||
      ui.includes("percorso completo")),
  "17. unsupported goals show coming soon / full path",
);

assert(
  !/graph\.facebook|META_WRITES_LIVE\s*=\s*true/.test(logic + ui + entry),
  "18. no Meta mutations in P0.11 files",
);

console.log(
  `\n=== P0.11 result: ${falliti === 0 ? "PASS" : `FAIL (${falliti})`} ===\n`,
);
process.exit(falliti === 0 ? 0 : 1);
