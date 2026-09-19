/**
 * M10F.2 — Session UI continuity (sessionStorage) regression tests.
 * Pure parse/storage logic. No live AI, no Meta writes.
 */

import {
  ALLY_SESSION_UI_VERSION,
  DEFAULT_ASK_ALLY_SESSION,
  DEFAULT_RESULTS_UI_SESSION,
  askAllySessionKey,
  clearAllySessionUiForUser,
  idsToRecord,
  parseAskAllySession,
  parseResultsUiSession,
  readAskAllySession,
  readResultsUiSession,
  recordToIds,
  resultsUiSessionKey,
  writeAskAllySession,
  writeResultsUiSession,
  type AskAllySessionState,
  type ResultsUiSessionState,
} from "../src/lib/ally-session-ui";
import { ALLY_COPILOT_MAX_HISTORY_TURNS } from "../src/lib/ally-copilot/types";
import fs from "node:fs";
import path from "node:path";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}: ${e instanceof Error ? e.message : e}`);
    failed++;
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

/** Minimal in-memory sessionStorage for Node. */
function installMockSessionStorage(): {
  store: Map<string, string>;
  restore: () => void;
} {
  const store = new Map<string, string>();
  const mock = {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    get length() {
      return store.size;
    },
  };
  const g = globalThis as unknown as {
    window?: unknown;
    sessionStorage?: typeof mock;
  };
  const prevWindow = g.window;
  const prevSs = g.sessionStorage;
  g.window = g.window ?? {};
  g.sessionStorage = mock;
  return {
    store,
    restore: () => {
      if (prevWindow === undefined) delete g.window;
      else g.window = prevWindow;
      if (prevSs === undefined) delete g.sessionStorage;
      else g.sessionStorage = prevSs;
    },
  };
}

console.log("\nM10F.2 — Session UI persistence\n");

test("CASE A: diagnosis evidence open survives remount parse", () => {
  const written: ResultsUiSessionState = {
    ...DEFAULT_RESULTS_UI_SESSION,
    hierarchyOpen: true,
    diagnosisEvidenceOpen: true,
    measurementDetailsOpen: true,
    adSetExpandedIds: ["as_1"],
  };
  const parsed = parseResultsUiSession(written);
  assert(parsed, "parse ok");
  assert(parsed.diagnosisEvidenceOpen === true, "diagnosis open");
  assert(parsed.measurementDetailsOpen === true, "measurement open");
  assert(parsed.hierarchyOpen === true, "hierarchy open");
  assert(parsed.adSetExpandedIds.includes("as_1"), "ad set expanded");
});

test("CASE B: Ask Ally conversation restored; no loading field", () => {
  const written: AskAllySessionState = {
    version: ALLY_SESSION_UI_VERSION,
    history: [
      { role: "user", content: "Come sta andando?" },
      { role: "assistant", content: "Misurazione ancora ambigua." },
    ],
    latest: {
      answer: "Misurazione ancora ambigua.",
      confidence: "LOW",
      evidence: ["CTR 2.87%"],
      hypotheses: ["Ipotesi non provata"],
      missingInformation: ["Eventi non affidabili"],
      suggestedNextQuestions: ["Cosa controllare?"],
      recommendedActionHref: null,
      fromAi: true,
    },
    draft: "",
    error: null,
  };
  const parsed = parseAskAllySession(written);
  assert(parsed, "parse ok");
  assert(parsed.history.length === 2, "history restored");
  assert(parsed.latest?.answer.includes("Misurazione"), "answer restored");
  assert(!("loading" in (parsed as object)), "no loading in session shape");
});

test("CASE C: unsent draft restored", () => {
  const parsed = parseAskAllySession({
    ...DEFAULT_ASK_ALLY_SESSION,
    draft: "Perché il CTR è basso?",
  });
  assert(parsed?.draft === "Perché il CTR è basso?", "draft");
});

test("CASE D: cross-campaign keys do not collide", () => {
  const user = "user-a";
  const keyA = resultsUiSessionKey(user, "campaign-a");
  const keyB = resultsUiSessionKey(user, "campaign-b");
  const askA = askAllySessionKey(user, "campaign-a", "META");
  const askB = askAllySessionKey(user, "campaign-b", "META");
  assert(keyA !== keyB, "results keys differ");
  assert(askA !== askB, "ask-ally keys differ");
  assert(keyA.includes("campaign-a"), "scoped to campaign a");
  assert(!keyB.includes("campaign-a"), "b not a");
});

test("CASE E: malformed sessionStorage falls back safely", () => {
  assert(parseResultsUiSession(null) === null, "null");
  assert(parseResultsUiSession("nope") === null, "string");
  assert(parseResultsUiSession({ version: 99 }) === null, "bad version");
  assert(
    parseResultsUiSession({
      version: 1,
      hierarchyOpen: "yes",
    }) === null,
    "bad types",
  );
  assert(parseAskAllySession({ version: 1 }) === null, "ask incomplete");
  assert(parseAskAllySession(JSON.parse('"x"')) === null, "json string");
});

test("CASE F: session UI state does not include canonical campaign payload keys", () => {
  const ui = {
    ...DEFAULT_RESULTS_UI_SESSION,
    hierarchyOpen: true,
  };
  const ask: AskAllySessionState = {
    ...DEFAULT_ASK_ALLY_SESSION,
    history: [{ role: "user", content: "ciao" }],
    latest: {
      answer: "ok",
      confidence: "LOW",
      evidence: [],
      hypotheses: [],
      missingInformation: [],
      suggestedNextQuestions: [],
      recommendedActionHref: null,
      fromAi: false,
    },
  };
  const uiJson = JSON.stringify(ui);
  const askJson = JSON.stringify(ask);
  for (const forbidden of [
    "trackingHealth",
    "deepDiagnosis",
    "insights",
    "metaAccessToken",
    "professionalLines",
    "adSets",
    "spend",
    "impressions",
  ]) {
    assert(!uiJson.includes(forbidden), `results-ui free of ${forbidden}`);
    assert(!askJson.includes(forbidden), `ask-ally free of ${forbidden}`);
  }
});

test("CASE G: restore contract — loading must not be persisted", () => {
  const raw = {
    version: 1,
    history: [],
    latest: null,
    draft: "",
    error: null,
    loading: true,
  };
  const parsed = parseAskAllySession(raw);
  assert(parsed, "still parses");
  assert(!("loading" in parsed), "loading stripped from typed state");
});

test("user + campaign scoping in key format", () => {
  const k = resultsUiSessionKey("u1", "c1");
  assert(k.includes("user:u1"), "user scoped");
  assert(k.includes("campaign:c1"), "campaign scoped");
  assert(k.startsWith("ally:session:v1:"), "versioned prefix");
  assert(!k.includes("Technon"), "no campaign name");
});

test("idsToRecord / recordToIds roundtrip", () => {
  const ids = ["a", "b"];
  assert(JSON.stringify(recordToIds(idsToRecord(ids)).sort()) === '["a","b"]', "roundtrip");
});

test("history capped to max turns on parse", () => {
  const history = Array.from({ length: 20 }, (_, i) => ({
    role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
    content: `turn ${i}`,
  }));
  const parsed = parseAskAllySession({
    ...DEFAULT_ASK_ALLY_SESSION,
    history,
  });
  assert(parsed, "ok");
  assert(
    parsed.history.length <= ALLY_COPILOT_MAX_HISTORY_TURNS,
    `capped to ${ALLY_COPILOT_MAX_HISTORY_TURNS}`,
  );
});

test("read/write roundtrip via mock sessionStorage", () => {
  const mock = installMockSessionStorage();
  try {
    writeResultsUiSession("u", "c", {
      ...DEFAULT_RESULTS_UI_SESSION,
      diagnosisEvidenceOpen: true,
    });
    const r = readResultsUiSession("u", "c");
    assert(r.diagnosisEvidenceOpen === true, "write/read results");

    writeAskAllySession("u", "c", "META", {
      ...DEFAULT_ASK_ALLY_SESSION,
      draft: "bozza",
      history: [{ role: "user", content: "q" }],
    });
    const a = readAskAllySession("u", "c", "META");
    assert(a.draft === "bozza", "draft");
    assert(a.history.length === 1, "history");

    // Cross-campaign isolation
    const other = readAskAllySession("u", "c-other", "META");
    assert(other.history.length === 0, "no leak to other campaign");
    assert(other.draft === "", "no draft leak");

    clearAllySessionUiForUser("u");
    assert(readResultsUiSession("u", "c").diagnosisEvidenceOpen === false, "cleared");
    assert(readAskAllySession("u", "c", "META").draft === "", "ask cleared");
  } finally {
    mock.restore();
  }
});

test("components wire session helpers (structural)", () => {
  const panel = read("src/components/risultati/MetaHierarchyPanel.tsx");
  assert(panel.includes("readResultsUiSession"), "hierarchy reads session");
  assert(panel.includes("writeResultsUiSession"), "hierarchy writes session");
  assert(panel.includes("diagnosisEvidenceOpen"), "diagnosis disclosure");
  assert(panel.includes("measurementDetailsOpen"), "measurement disclosure");
  assert(!panel.includes("localStorage"), "no localStorage in hierarchy");

  const ask = read("src/components/campagne/ChiediAdAllyPanel.tsx");
  assert(ask.includes("readAskAllySession"), "ask reads");
  assert(ask.includes("writeAskAllySession"), "ask writes");
  assert(ask.includes("setLoading(false)"), "loading false on restore");
  assert(!ask.includes("localStorage"), "no localStorage in ask");

  const auth = read("src/components/auth/AuthProvider.tsx");
  assert(auth.includes("clearAllySessionUiForUser"), "logout cleanup");
});

test("storage module never stores canonical payloads", () => {
  const src = read("src/lib/ally-session-ui/storage.ts");
  assert(src.includes("sessionStorage"), "uses sessionStorage");
  assert(!src.includes("localStorage"), "not localStorage");
  assert(!src.includes("deepDiagnosis"), "no diagnosis cache");
  assert(!src.includes("trackingHealth"), "no tracking cache");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
