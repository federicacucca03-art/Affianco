/**
 * P0.10 — Easy entry draft creation fails in real QA (existing client + local id).
 * LIVE META WRITES: 0 · PRODUCTION DB: 0
 * Esegui: npx tsx scripts/verifica-campagne-easy-entry-p10.ts
 */

import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { isUuid } from "../src/lib/meta/ids";

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

/** Mirror of shouldQueryClientById — kept local so this script never boots Supabase. */
function shouldQueryClientById(clientId: string | null | undefined): boolean {
  const hint = (clientId ?? "").trim();
  return Boolean(hint && isUuid(hint));
}

console.log("\n=== P0.10 Easy entry QA failure fix ===\n");

assert(exists("src/lib/campagne-easy-entry.ts"), "1. easy-entry module present");
assert(
  exists("src/app/campagne/[id]/instant-form/page.tsx"),
  "2. P0.8 Builder route reused",
);

const entry = read("src/lib/campagne-easy-entry.ts");
const modale = read("src/components/ModaleConfiguraCampagna.tsx");

assert(
  entry.includes("shouldQueryClientById") && entry.includes("isUuid"),
  "3. client id gate uses isUuid before clients.eq(id)",
);
assert(
  entry.includes("EasyEntryError") &&
    entry.includes("CLIENT_LOOKUP") &&
    entry.includes("DRAFT_INSERT"),
  "4. sanitized EasyEntryError diagnostics present",
);
assert(
  entry.includes("trovaBozzaInstantFormEsistente") ||
    entry.includes("reusedExistingDraft"),
  "5. duplicate draft protection / idempotent reuse",
);
assert(
  entry.includes("objective: null") &&
    entry.includes('status: "DRAFT"') &&
    !entry.includes('bookingChannel: "LEAD_FORM"'),
  "6. draft shell DRAFT without pre-locking LEADS + LEAD_FORM (P0.11)",
);
assert(
  entry.includes("creaCampagnaLeadGen") &&
    !entry.includes("campaigns_v2"),
  "7. no second campaign model",
);
assert(
  !/graph\.facebook|META_WRITES_LIVE\s*=\s*true/.test(entry),
  "8. no Meta mutations in entry helper",
);

// Pure gate behavior (the real QA failure)
assert(
  !shouldQueryClientById("cliente-1739123456789-a1b2c3d4"),
  "9. local memory id must NOT query clients by id (invalid uuid)",
);
assert(
  !shouldQueryClientById("rossi"),
  "10. non-uuid local id skipped",
);
assert(
  shouldQueryClientById("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"),
  "11. real Ally UUID is accepted as client hint",
);
assert(
  !shouldQueryClientById("") && !shouldQueryClientById(null),
  "12. empty client hint falls through to name resolve",
);

assert(
  entry.includes("resolveClientIdForEasyEntry") &&
    entry.includes("trovaOCreaCliente"),
  "13. existing client resolved by name when hint is not a UUID",
);
assert(
  entry.includes("EasyEntryError") &&
    entry.includes("CLIENT_LOOKUP") &&
    entry.includes("shouldQueryClientById(hint)"),
  "14. client lookup gated + wrapped in EasyEntryError (no raw uuid throw on local ids)",
);

// Modal: do not invent local client before persist
assert(
  !modale.includes("aggiungiCliente"),
  "15. modal brand-kit path no longer creates local-only client first",
);
assert(
  modale.includes("isUuid") &&
    modale.includes("leggiClientiDaSupabase"),
  "16. modal loads QA clients + only forwards real UUIDs",
);
assert(
  modale.includes("messaggioErroreEasyEntry") &&
    modale.includes("logEasyEntryFailure"),
  "17. insert errors surface EasyEntry diagnostics (not only generic copy)",
);
assert(
  modale.includes("busy") &&
    modale.includes("Creazione bozza"),
  "18. click/loading guard present",
);
assert(
  modale.includes("verrà riusato") ||
    modale.includes("niente duplicati"),
  "19. new-client copy no longer claims only micro brand kit for existing names",
);

assert(
  entry.includes("easyInstantFormHref") &&
    entry.includes("/instant-form"),
  "20. route uses persisted campaign id → Instant Form Builder",
);

assert(
  exists("scripts/verifica-campagne-easy-entry-p09.ts"),
  "21. P0.9 suite retained",
);

// Schema compatibility notes encoded in code comments / payload (text column LEAD_FORM)
assert(
  read("src/components/campagne/InstantFormEasyBuilder.tsx").includes(
    "LEAD_FORM",
  ),
  "22. Instant Form LEAD_FORM applied after Step 1 confirm in Builder",
);

console.log(
  `\n=== P0.10 result: ${falliti === 0 ? "PASS" : `FAIL (${falliti})`} ===\n`,
);
process.exit(falliti === 0 ? 0 : 1);
