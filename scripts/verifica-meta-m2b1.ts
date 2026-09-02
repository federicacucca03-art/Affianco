/**
 * M2B.1 / M2B.1A — Meta token crypto + server-only boundary.
 * Esegui: npx tsx --conditions=react-server scripts/verifica-meta-m2b1.ts
 *
 * --conditions=react-server risolve `server-only` a empty.js (come il bundler RSC).
 * Senza quella condition, import "server-only" lancia in Node: è il confine reale.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { MetaError } from "@/lib/meta/errors";
import { decryptMetaToken, encryptMetaToken } from "@/lib/meta/token-crypto";
import { assertMetaConnectionHasScope } from "@/lib/meta/scopes";

let falliti = 0;

function assert(cond: unknown, msg: string): boolean {
  if (!cond) {
    falliti += 1;
    console.error(`FAIL  ${msg}`);
    return false;
  }
  console.log(`PASS  ${msg}`);
  return true;
}

const FAKE_TOKEN = "E2E_FAKE_META_TOKEN_DO_NOT_LOG";
const TEST_KEY_HEX = randomBytes(32).toString("hex");
process.env.META_TOKEN_ENCRYPTION_KEY = TEST_KEY_HEX;

const root = join(import.meta.dirname, "..");
const srcRoot = join(root, "src");

const FORBIDDEN_PROD = [
  "src/lib/meta/token-crypto.ts",
  "src/lib/meta/config.ts",
  "src/lib/meta/connections.ts",
  "src/lib/supabase-admin.ts",
];

function walkFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".git") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkFiles(full, acc);
    else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(name)) acc.push(full);
  }
  return acc;
}

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function resolveImport(fromFile: string, spec: string): string | null {
  if (spec.startsWith("@/")) {
    return resolveSrcPath(join(srcRoot, spec.slice(2)));
  }
  if (spec.startsWith("./") || spec.startsWith("../")) {
    return resolveSrcPath(resolve(dirname(fromFile), spec));
  }
  return null;
}

function resolveSrcPath(withoutExt: string): string | null {
  const candidates = [
    withoutExt,
    `${withoutExt}.ts`,
    `${withoutExt}.tsx`,
    `${withoutExt}.js`,
    `${withoutExt}.jsx`,
    join(withoutExt, "index.ts"),
    join(withoutExt, "index.tsx"),
  ];
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

function importSpecs(source: string): string[] {
  const specs: string[] = [];
  const re =
    /(?:import\s*\(\s*|import\s+(?:type\s+)?(?:[^"'()]+)\s+from\s+|import\s+|export\s+(?:type\s+)?\*\s+from\s+|export\s+\{[^}]*\}\s+from\s+|require\s*\(\s*)['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    specs.push(m[1] ?? "");
  }
  return specs.filter(Boolean);
}

function clientReachableForbidden(): string[] {
  const files = walkFiles(srcRoot);
  const clientEntry = files.filter((file) =>
    readFileSync(file, "utf8").includes('"use client"'),
  );
  const forbiddenAbs = new Set(FORBIDDEN_PROD.map((rel) => join(root, rel)));
  const hits: string[] = [];
  const seen = new Set<string>();
  const queue = [...clientEntry];

  while (queue.length) {
    const file = queue.pop();
    if (!file || seen.has(file)) continue;
    seen.add(file);
    if (forbiddenAbs.has(file)) {
      hits.push(file.slice(root.length + 1));
      continue;
    }
    let text = "";
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const spec of importSpecs(text)) {
      const resolved = resolveImport(file, spec);
      if (resolved) queue.push(resolved);
    }
  }
  return hits;
}

function envReaders(name: string): string[] {
  const needle = `process.env.${name}`;
  const quoted = `"${name}"`;
  const quoted2 = `'${name}'`;
  const hits: string[] = [];
  for (const file of walkFiles(srcRoot)) {
    const text = readFileSync(file, "utf8");
    if (text.includes(needle) || text.includes(quoted) || text.includes(quoted2)) {
      hits.push(file.slice(root.length + 1));
    }
  }
  return hits;
}

function hasServerOnlyGuard(rel: string): boolean {
  const src = read(rel);
  return (
    src.includes('import "server-only"') || src.includes("import 'server-only'")
  );
}

console.log("\n=== M2B.1 A encrypt/decrypt roundtrip ===");
const cifrato = encryptMetaToken(FAKE_TOKEN);
assert(cifrato.startsWith("v1."), "A payload versionato");
assert(!cifrato.includes(FAKE_TOKEN), "A ciphertext senza plaintext");
assert(decryptMetaToken(cifrato) === FAKE_TOKEN, "A roundtrip");

console.log("\n=== M2B.1 B IV casuale ===");
const a = encryptMetaToken(FAKE_TOKEN);
const b = encryptMetaToken(FAKE_TOKEN);
assert(a !== b, "B ciphertext diversi");
assert(
  decryptMetaToken(a) === FAKE_TOKEN && decryptMetaToken(b) === FAKE_TOKEN,
  "B entrambi decifrano",
);

console.log("\n=== M2B.1 C chiave invalida ===");
const prevKey = process.env.META_TOKEN_ENCRYPTION_KEY;
process.env.META_TOKEN_ENCRYPTION_KEY = "not-a-32-byte-key";
let cCode = "";
try {
  encryptMetaToken(FAKE_TOKEN);
} catch (error) {
  cCode = error instanceof MetaError ? error.code : "OTHER";
}
assert(cCode === "META_TOKEN_ENCRYPTION_FAILED", "C chiave corta rifiutata");
process.env.META_TOKEN_ENCRYPTION_KEY = "";
cCode = "";
try {
  encryptMetaToken(FAKE_TOKEN);
} catch (error) {
  cCode = error instanceof MetaError ? error.code : "OTHER";
}
assert(cCode === "META_TOKEN_ENCRYPTION_FAILED", "C chiave assente rifiutata");
process.env.META_TOKEN_ENCRYPTION_KEY = prevKey;

console.log("\n=== M2B.1 D ciphertext manomesso ===");
const sano = encryptMetaToken(FAKE_TOKEN);
const parts = sano.split(".");
const manomesso = `${parts[0]}.${parts[1]}.${parts[2]!.replace(/.$/, "A")}.${parts[3]}`;
let dCode = "";
try {
  decryptMetaToken(manomesso);
} catch (error) {
  dCode = error instanceof MetaError ? error.code : "OTHER";
}
assert(dCode === "META_TOKEN_DECRYPTION_FAILED", "D tag/ciphertext invalido");

console.log("\n=== M2B.1 E nessun token negli errori ===");
let serializzato = "";
try {
  decryptMetaToken(manomesso);
} catch (error) {
  serializzato = `${String(error)}\n${JSON.stringify(error)}\n${error instanceof Error ? error.stack ?? "" : ""}`;
}
assert(!serializzato.includes(FAKE_TOKEN), "E token assente da Error/JSON/stack");
assert(!serializzato.includes(TEST_KEY_HEX), "E chiave assente da Error/JSON/stack");

console.log("\n=== M2B.1 F payload malformato ===");
for (const bad of ["", "not-a-payload", "v1.a.b", "v2.x.y.z", "v1...."]) {
  let fCode = "";
  try {
    decryptMetaToken(bad);
  } catch (error) {
    fCode = error instanceof MetaError ? error.code : "OTHER";
  }
  assert(fCode === "META_TOKEN_DECRYPTION_FAILED", `F rifiuta ${JSON.stringify(bad)}`);
}

console.log("\n=== M2B.1 G chiave sbagliata non decifra ===");
const withKeyA = encryptMetaToken(FAKE_TOKEN);
process.env.META_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("hex");
let gCode = "";
let gPlain = "";
try {
  gPlain = decryptMetaToken(withKeyA);
} catch (error) {
  gCode = error instanceof MetaError ? error.code : "OTHER";
}
assert(gPlain !== FAKE_TOKEN, "G plaintext non restituito");
assert(gCode === "META_TOKEN_DECRYPTION_FAILED", "G META_TOKEN_DECRYPTION_FAILED");
process.env.META_TOKEN_ENCRYPTION_KEY = prevKey;

console.log("\n=== M2B.1A static server-only boundary ===");
assert(hasServerOnlyGuard("src/lib/meta/token-crypto.ts"), "token-crypto import server-only");
assert(hasServerOnlyGuard("src/lib/meta/config.ts"), "config import server-only");
assert(hasServerOnlyGuard("src/lib/meta/connections.ts"), "connections import server-only");
assert(hasServerOnlyGuard("src/lib/supabase-admin.ts"), "supabase-admin import server-only");

const clientHits = clientReachableForbidden();
assert(
  clientHits.length === 0,
  clientHits.length
    ? `client raggiunge: ${clientHits.join(", ")}`
    : "nessun percorso use client → crypto/config/connections/admin",
);

const allSrc = walkFiles(srcRoot)
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");
assert(!/NEXT_PUBLIC_META_/.test(allSrc), "niente NEXT_PUBLIC_META_*");

const secretFiles = envReaders("META_APP_SECRET");
const keyFiles = envReaders("META_TOKEN_ENCRYPTION_KEY");
assert(
  secretFiles.every((f) => hasServerOnlyGuard(f)),
  `META_APP_SECRET solo in server-only (${secretFiles.join(", ") || "nessuno"})`,
);
assert(
  keyFiles.every((f) => hasServerOnlyGuard(f)),
  `META_TOKEN_ENCRYPTION_KEY solo in server-only (${keyFiles.join(", ") || "nessuno"})`,
);

const configSrc = read("src/lib/meta/config.ts");
assert(!configSrc.includes("appSecret"), "MetaServerConfig senza secret");
assert(
  configSrc.includes("Configurazione Meta incompleta."),
  "errore config senza valori env",
);

assert(!existsSync(join(root, "src/app/api/meta")), "assente /api/meta/*");

console.log("\n=== M2B.1 column grants / unique ===");
const sql = read("supabase/migrations/20260902_meta_connections.sql");
assert(sql.includes("grant select ("), "GRANT SELECT per colonne esplicite");
assert(!sql.includes("grant select on table public.meta_connections"), "niente GRANT SELECT tabella intera");
assert(!sql.includes("access_token_encrypted") || sql.includes("grant select (\n  id"), "ciphertext non in GRANT authenticated");
const grantBlock = sql.slice(sql.indexOf("grant select ("));
const grantEnd = grantBlock.indexOf("to authenticated");
const grantCols = grantBlock.slice(0, grantEnd);
assert(!grantCols.includes("access_token_encrypted"), "access_token_encrypted assente dal GRANT authenticated");
assert(sql.includes("constraint meta_connections_user_unique unique (user_id)"), "UNIQUE(user_id) una riga per utente");
assert(sql.includes("references auth.users (id) on delete cascade"), "FK auth.users");
assert(sql.includes("user_id is immutable"), "user_id immutabile");
assert(sql.includes("meta_connections writes are server-only"), "write JWT bloccati");

console.log("\n=== M2B.1 scopes / errori ===");
let pCode = "";
try {
  assertMetaConnectionHasScope({ scopes: ["pages_show_list"] }, "ads_read");
} catch (error) {
  pCode = error instanceof MetaError ? error.code : "OTHER";
}
assert(pCode === "META_PERMISSION_MISSING", "scope ads_read non assunto");

const srcFiles = walkFiles(join(srcRoot, "lib", "meta"));
const loggingHits = srcFiles.filter((file) =>
  /console\.(log|info|debug|error|warn)\(/.test(readFileSync(file, "utf8")),
);
assert(loggingHits.length === 0, "nessun console.* nei moduli meta");

if (falliti > 0) {
  console.error(`\nM2B.1 FALLITO: ${falliti} assert`);
  process.exit(1);
}
console.log("\nM2B.1 OK");
