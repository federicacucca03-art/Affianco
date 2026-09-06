/**
 * M9.3A — Ally brief → campaign proposal verification
 * Pure logic + structural. No live Anthropic calls.
 */

import fs from "node:fs";
import path from "node:path";
import { ALLY_BRIEF_SYSTEM_PROMPT } from "../src/lib/ally-brief/prompt";
import { buildAllyBriefAnthropicParams } from "../src/lib/ally-brief/anthropic-request";
import {
  parseAllyBriefProposal,
  buildAllyBriefFallbackProposal,
  assertNoInventedEconomics,
  assertNoInventedMetaIds,
  isMeaningfulAllyBriefProposal,
  repairTruncatedJson,
} from "../src/lib/ally-brief/parse";
import {
  ALLY_BRIEF_MAX_CHARS,
  ALLY_BRIEF_MAX_TOKENS,
  ALLY_BRIEF_FIELD_LABELS,
  ALLY_BRIEF_FAILURE_MESSAGE,
  provenanceLabelIt,
} from "../src/lib/ally-brief/types";
import { proposalToAcceptedPayload } from "../src/lib/ally-brief/session";
import {
  hrefWizardFromAcceptedBrief,
  hydrationFromAcceptedBrief,
} from "../src/lib/ally-brief/apply";

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

function field(
  id: string,
  value: unknown,
  provenance: string,
  confidence = "HIGH",
) {
  return { value, provenance, confidence, note: null };
}

console.log("\nM9.3A — Ally brief to campaign\n");

test("A rich brief → fields extracted (explicit)", () => {
  const raw = JSON.stringify({
    summary: "Studio dentistico a Roma per implantologia.",
    fields: {
      nomeCliente: field("nomeCliente", "Studio dentistico", "EXPLICIT"),
      settore: field("settore", "Dentista", "EXPLICIT"),
      objective: field("objective", "LEADS", "INFERRED", "MEDIUM"),
      frontEndOffer: field("frontEndOffer", "Prima visita gratuita", "EXPLICIT"),
      citta: field("citta", "Roma", "EXPLICIT"),
      raggioKm: field("raggioKm", 15, "EXPLICIT"),
      etaMin: field("etaMin", 35, "EXPLICIT"),
      etaMax: field("etaMax", 65, "EXPLICIT"),
      budgetGiornaliero: field("budgetGiornaliero", 25, "EXPLICIT"),
      maxSustainableCpa: field("maxSustainableCpa", null, "MISSING"),
      pageId: field("pageId", null, "MISSING"),
      formId: field("formId", null, "MISSING"),
      scontrinoMedio: field("scontrinoMedio", null, "MISSING"),
      tassoConversione: field("tassoConversione", null, "MISSING"),
    },
    missing_information: ["Soglia sostenibile"],
    assumptions: ["Obiettivo LEADS da 'nuovi pazienti'"],
  });
  const p = parseAllyBriefProposal(raw, null);
  const byId = Object.fromEntries(p.fields.map((f) => [f.id, f]));
  assert(byId.citta?.value === "Roma", "city");
  assert(byId.citta?.provenance === "EXPLICIT", "city explicit");
  assert(byId.budgetGiornaliero?.value === 25, "budget");
  assert(byId.frontEndOffer?.value === "Prima visita gratuita", "offer");
  assert(byId.raggioKm?.value === 15, "radius");
  assert(byId.etaMin?.value === 35 && byId.etaMax?.value === 65, "age");
});

test("B inferred objective → marked proposed", () => {
  const raw = JSON.stringify({
    summary: "ok",
    fields: {
      objective: field("objective", "LEADS", "INFERRED", "MEDIUM"),
    },
    missing_information: [],
    assumptions: [],
  });
  const p = parseAllyBriefProposal(raw, null);
  const obj = p.fields.find((f) => f.id === "objective");
  assert(obj?.provenance === "INFERRED", String(obj?.provenance));
  assert(provenanceLabelIt("INFERRED") === "Proposto da Ally", "label");
});

test("C explicit budget → from brief", () => {
  const raw = JSON.stringify({
    summary: "ok",
    fields: {
      budgetGiornaliero: field("budgetGiornaliero", 50, "EXPLICIT"),
    },
    missing_information: [],
    assumptions: [],
  });
  const p = parseAllyBriefProposal(raw, null);
  const b = p.fields.find((f) => f.id === "budgetGiornaliero");
  assert(b?.provenance === "EXPLICIT", "explicit");
  assert(provenanceLabelIt("EXPLICIT") === "Dal brief", "label");
});

test("D missing economics → not invented", () => {
  const raw = JSON.stringify({
    summary: "ok",
    fields: {
      scontrinoMedio: field("scontrinoMedio", 1200, "INFERRED", "MEDIUM"),
      tassoConversione: field("tassoConversione", 10, "INFERRED", "MEDIUM"),
      maxSustainableCpa: field("maxSustainableCpa", 42, "INFERRED", "MEDIUM"),
    },
    missing_information: [],
    assumptions: [],
  });
  const p = parseAllyBriefProposal(raw, null);
  assert(assertNoInventedEconomics(p.fields), "no invented economics");
  const ticket = p.fields.find((f) => f.id === "scontrinoMedio");
  const cpa = p.fields.find((f) => f.id === "maxSustainableCpa");
  assert(ticket?.value == null && ticket?.provenance === "MISSING", "ticket");
  assert(cpa?.provenance === "MISSING" || cpa?.note?.includes("formula"), "cpa");
});

test("E existing client context → reused safely", () => {
  const raw = JSON.stringify({
    summary: "ok",
    fields: {
      objective: field("objective", "LEADS", "INFERRED", "MEDIUM"),
      nomeCliente: field("nomeCliente", null, "MISSING"),
      settore: field("settore", null, "MISSING"),
      citta: field("citta", null, "MISSING"),
    },
    missing_information: [],
    assumptions: [],
  });
  const p = parseAllyBriefProposal(raw, {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    nome: "Technon",
    settore: "Servizi B2B",
    citta: "Roma",
    sitoWeb: null,
    note: null,
    targetType: "B2B",
    targetAge: null,
  });
  assert(p.matchedClienteId?.startsWith("aaaa"), "matched");
  assert(
    p.fields.find((f) => f.id === "nomeCliente")?.provenance === "EXISTING",
    "name existing",
  );
  assert(
    p.fields.find((f) => f.id === "citta")?.value === "Roma",
    "city reused",
  );
  assert(provenanceLabelIt("EXISTING") === "Già in Ally", "label");
});

test("F conflict with existing data → no silent overwrite of brief", () => {
  const raw = JSON.stringify({
    summary: "ok",
    fields: {
      citta: field("citta", "Milano", "EXPLICIT"),
      nomeCliente: field("nomeCliente", "Technon", "EXPLICIT"),
    },
    missing_information: [],
    assumptions: [],
  });
  const p = parseAllyBriefProposal(raw, {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    nome: "Technon",
    settore: "B2B",
    citta: "Roma",
    sitoWeb: null,
    note: null,
    targetType: "B2B",
    targetAge: null,
  });
  const citta = p.fields.find((f) => f.id === "citta");
  assert(citta?.value === "Milano", "brief wins");
  assert(citta?.provenance === "EXPLICIT", "stays explicit");
  assert(/conflitto|diverso/i.test(citta?.note ?? ""), String(citta?.note));
});

test("G sparse brief → minimal missing, no invented budget/age", () => {
  const raw = JSON.stringify({
    summary: "Contatti B2B Technon",
    fields: {
      nomeCliente: field("nomeCliente", "Technon", "EXPLICIT"),
      objective: field("objective", "LEADS", "INFERRED", "MEDIUM"),
      targetType: field("targetType", "B2B", "INFERRED", "MEDIUM"),
      budgetGiornaliero: field("budgetGiornaliero", null, "MISSING"),
      etaMin: field("etaMin", null, "MISSING"),
      citta: field("citta", null, "MISSING"),
    },
    missing_information: ["Budget"],
    assumptions: [],
  });
  const p = parseAllyBriefProposal(raw, null);
  assert(p.fields.find((f) => f.id === "budgetGiornaliero")?.value == null, "no budget");
  assert(p.fields.find((f) => f.id === "etaMin")?.value == null, "no age");
});

test("H ECOMMERCE brief → correct objective", () => {
  const raw = JSON.stringify({
    summary: "Ecommerce scarpe",
    fields: {
      objective: field("objective", "ECOMMERCE", "INFERRED", "MEDIUM"),
      budgetGiornaliero: field("budgetGiornaliero", 50, "EXPLICIT"),
      settore: field("settore", "Ecommerce scarpe", "EXPLICIT"),
    },
    missing_information: [],
    assumptions: [],
  });
  const p = parseAllyBriefProposal(raw, null);
  assert(p.fields.find((f) => f.id === "objective")?.value === "ECOMMERCE", "ecom");
});

test("I unsupported / low inference → missing", () => {
  const raw = JSON.stringify({
    summary: "ok",
    fields: {
      objective: field("objective", "LEADS", "INFERRED", "LOW"),
    },
    missing_information: [],
    assumptions: [],
  });
  const p = parseAllyBriefProposal(raw, null);
  const obj = p.fields.find((f) => f.id === "objective");
  assert(obj?.provenance === "MISSING" && obj.value == null, String(obj?.provenance));
});

test("J AI failure → brief preserved in fallback", () => {
  const brief = "Studio dentistico a Roma con budget 25.";
  const p = buildAllyBriefFallbackProposal(brief, null);
  assert(p.fromAi === false, "not ai");
  const pitch = p.fields.find((f) => f.id === "elevatorPitch");
  assert(pitch?.value === brief, "brief kept");
  assert(/riprovare|manualmente/i.test(p.summary), p.summary);
});

test("K manual path still present", () => {
  const ui = read("src/components/CreaCampagnaConCliente.tsx");
  assert(ui.includes("GrigliaSituazioni"), "grid");
  assert(ui.includes("Compila manualmente") || ui.includes("manualmente"), "manual");
  assert(ui.includes("PartiamoDalBrief"), "brief");
});

test("L proposal → no DB write in API", () => {
  const route = read("src/app/api/ally-brief/route.ts");
  assert(route.includes("dbWrites: 0"), "dbWrites");
  assert(!/salvaCampagnaCompleta|insert\(/.test(route), "no insert");
  assert(route.includes("Max 1 AI call") || route.includes("aiCalls"), "ai");
});

test("M accept proposal → wizard populated helpers", () => {
  const raw = JSON.stringify({
    summary: "ok",
    fields: {
      objective: field("objective", "LEADS", "INFERRED", "MEDIUM"),
      nomeCliente: field("nomeCliente", "Aurora", "EXPLICIT"),
      frontEndOffer: field("frontEndOffer", "Visita", "EXPLICIT"),
      budgetGiornaliero: field("budgetGiornaliero", 25, "EXPLICIT"),
      citta: field("citta", "Roma", "EXPLICIT"),
    },
    missing_information: [],
    assumptions: [],
  });
  const proposal = parseAllyBriefProposal(raw, null);
  const accepted = proposalToAcceptedPayload("brief text", proposal);
  assert(accepted != null, "accepted");
  const href = hrefWizardFromAcceptedBrief(accepted!);
  assert(href.includes("richieste-contatto"), href);
  assert(href.includes("fromBrief=1"), href);
  const h = hydrationFromAcceptedBrief(accepted!);
  assert(h.frontEndOffer === "Visita", "offer");
  assert(h.budgetGiornaliero === 25, "budget");
  assert(h.citta === "Roma", "city");
});

test("N page render → 0 AI (structural)", () => {
  const ui = read("src/components/campagne/PartiamoDalBrief.tsx");
  assert(!/useEffect\([\s\S]*fetch\("\/api\/ally-brief"/.test(ui), "no mount fetch");
  assert(ui.includes("Prepara con Ally"), "cta");
});

test("O one brief submit → 1 AI call max (structural)", () => {
  const svc = read("src/lib/ally-brief/service.ts");
  assert(svc.includes("messages.create"), "one create");
  const params = buildAllyBriefAnthropicParams({
    brief: "test",
    existingClient: null,
  });
  assert(params.thinking.type === "disabled", "thinking off");
  assert(!("temperature" in params), "no temperature");
});

test("P no Meta writes", () => {
  const files = [
    "src/app/api/ally-brief/route.ts",
    "src/lib/ally-brief/service.ts",
    "src/lib/ally-brief/parse.ts",
  ];
  for (const f of files) {
    const src = read(f);
    assert(!/ads_management|graph\.facebook|publish/i.test(src), f);
  }
});

test("Q no campaign creation before review", () => {
  const ui = read("src/components/campagne/PartiamoDalBrief.tsx");
  assert(ui.includes("Usa questa configurazione"), "accept cta");
  assert(ui.includes("Ally ha preparato"), "review");
  const apply = read("src/lib/ally-brief/apply.ts");
  assert(!/salvaCampagnaCompleta/.test(apply), "no save");
});

test("Prompt safety + max brief size + labels", () => {
  assert(ALLY_BRIEF_MAX_CHARS === 6000, "max");
  assert(/never invent|VIETATO inventare|NON inventare/i.test(ALLY_BRIEF_SYSTEM_PROMPT), "prompt");
  assert(ALLY_BRIEF_FIELD_LABELS.maxSustainableCpa.includes("Soglia"), "label cpa");
  assert(read("src/components/nuova-contatti/PercorsoContatti.tsx").includes("fromBrief"), "hydrate");
  assert(read("src/components/ModaleConfiguraCampagna.tsx").includes("Partiamo dal brief"), "modal");
});

test("Deterministic CPA when economics explicit", () => {
  const raw = JSON.stringify({
    summary: "ok",
    fields: {
      objective: field("objective", "LEADS", "INFERRED", "MEDIUM"),
      scontrinoMedio: field("scontrinoMedio", 1000, "EXPLICIT"),
      tassoConversione: field("tassoConversione", 10, "EXPLICIT"),
      targetMargin: field("targetMargin", 50, "EXPLICIT"),
      maxSustainableCpa: field("maxSustainableCpa", null, "MISSING"),
    },
    missing_information: [],
    assumptions: [],
  });
  const p = parseAllyBriefProposal(raw, null);
  const cpa = p.fields.find((f) => f.id === "maxSustainableCpa");
  // break-even 100, spend share 50% → 50
  assert(cpa?.value === 50, String(cpa?.value));
  assert(/formula Ally/i.test(cpa?.note ?? ""), String(cpa?.note));
});

test("Meta IDs never invented", () => {
  const raw = JSON.stringify({
    summary: "ok",
    fields: {
      pageId: field("pageId", "123456", "INFERRED", "MEDIUM"),
      formId: field("formId", "abc", "EXPLICIT", "HIGH"),
    },
    missing_information: [],
    assumptions: [],
  });
  const p = parseAllyBriefProposal(raw, null);
  assert(assertNoInventedMetaIds(p.fields), "meta");
});

test("Hydration session kept for remount (no premature clear)", () => {
  const percorso = read("src/components/nuova-contatti/PercorsoContatti.tsx");
  assert(percorso.includes("fromBrief"), "fromBrief gate");
  assert(percorso.includes("readAcceptedAllyBrief"), "reads session");
  assert(
    !/clearAcceptedAllyBrief\(\)/.test(percorso),
    "must not clear proposal on hydrate (Strict Mode safe)",
  );
  assert(
    /Keep session proposal|Strict Mode/i.test(percorso),
    "documents remount safety",
  );
});

test("M9.3A.1 max_tokens raised above production truncation", () => {
  assert(ALLY_BRIEF_MAX_TOKENS >= 4096, String(ALLY_BRIEF_MAX_TOKENS));
  const params = buildAllyBriefAnthropicParams({
    brief: "x",
    existingClient: null,
  });
  assert(params.max_tokens === ALLY_BRIEF_MAX_TOKENS, "params");
});

test("M9.3A.1 exact production brief fields + provenance", () => {
  const raw = JSON.stringify({
    summary: "Studio dentistico a Roma per implantologia.",
    fields: {
      settore: field("settore", "Dentista", "EXPLICIT"),
      citta: field("citta", "Roma", "EXPLICIT"),
      frontEndOffer: field("frontEndOffer", "Prima visita gratuita", "EXPLICIT"),
      budgetGiornaliero: field("budgetGiornaliero", 25, "EXPLICIT"),
      etaMin: field("etaMin", 35, "EXPLICIT"),
      etaMax: field("etaMax", 65, "EXPLICIT"),
      raggioKm: field("raggioKm", 15, "EXPLICIT"),
      objective: field("objective", "LEADS", "INFERRED", "MEDIUM"),
    },
    missing_information: ["Soglia sostenibile"],
    assumptions: ["LEADS da acquisizione pazienti"],
  });
  const p = parseAllyBriefProposal(raw, null);
  assert(isMeaningfulAllyBriefProposal(p), "meaningful");
  const by = Object.fromEntries(p.fields.map((f) => [f.id, f]));
  assert(by.citta?.value === "Roma" && by.citta.provenance === "EXPLICIT", "roma");
  assert(by.budgetGiornaliero?.value === 25 && by.budgetGiornaliero.provenance === "EXPLICIT", "budget");
  assert(by.frontEndOffer?.provenance === "EXPLICIT", "offer");
  assert(by.etaMin?.value === 35 && by.etaMax?.value === 65, "age");
  assert(by.raggioKm?.value === 15, "radius");
  assert(by.objective?.value === "LEADS" && by.objective.provenance === "INFERRED", "leads");
  assert(by.maxSustainableCpa?.provenance === "MISSING", "cpa missing");
  assert(assertNoInventedEconomics(p.fields), "econ");
  assert(assertNoInventedMetaIds(p.fields), "meta");
});

test("M9.3A.1 partial enum failure preserves explicit facts", () => {
  const raw = JSON.stringify({
    summary: "ok",
    fields: {
      settore: field("settore", "UnknownNicheXYZ", "EXPLICIT"),
      citta: field("citta", "Roma", "EXPLICIT"),
      budgetGiornaliero: field("budgetGiornaliero", 25, "EXPLICIT"),
      raggioKm: field("raggioKm", 15, "EXPLICIT"),
      objective: field("objective", "NOT_A_REAL_OBJ", "INFERRED", "MEDIUM"),
    },
    missing_information: [],
    assumptions: [],
  });
  const p = parseAllyBriefProposal(raw, null);
  assert(isMeaningfulAllyBriefProposal(p), "still meaningful");
  assert(p.fields.find((f) => f.id === "citta")?.value === "Roma", "city kept");
  assert(p.fields.find((f) => f.id === "budgetGiornaliero")?.value === 25, "budget kept");
  assert(p.fields.find((f) => f.id === "objective")?.value == null, "bad objective dropped");
});

test("M9.3A.1 truncated JSON repair keeps prior fields, drops incomplete", () => {
  const truncated = `{
  "summary": "Studio dentistico",
  "fields": {
    "citta": {"value":"Roma","provenance":"EXPLICIT","confidence":"HIGH"},
    "budgetGiornaliero": {"value":25,"provenance":"EXPLICIT","confidence":"HIGH"},
    "frontEndOffer": {"value":"Prima visita gratuita","provenance":"EXPLICIT","confidence":"HIGH"},
    "etaMin": {"value":35,"provenance":"EXPLICIT","confidence":"HIGH"},
    "etaMax": {"value":65,"provenance":"EXPLICIT","confidence":"HIGH"},
    "raggioKm": {"value":15,"provenance":"EXPLICIT","confidence":"HIGH"},
    "objective": {"value":"LEADS","provenance":"INFERRED","confidence":"MEDIUM"},
    "marketingAngle": {"value": "Impianti a Roma con`;
  const p = parseAllyBriefProposal(truncated, null);
  assert(isMeaningfulAllyBriefProposal(p), "repaired meaningful");
  assert(p.fields.find((f) => f.id === "citta")?.value === "Roma", "roma");
  assert(p.fields.find((f) => f.id === "budgetGiornaliero")?.value === 25, "25");
  assert(p.fields.find((f) => f.id === "objective")?.value === "LEADS", "leads");
  // Incomplete trailing string must NOT become a fabricated complete value.
  const angle = p.fields.find((f) => f.id === "marketingAngle");
  assert(angle?.value == null && angle?.provenance === "MISSING", "no invented angle");
});

test("M9.3A.1 truncated repair never auto-closes partial strings as facts", () => {
  const midString = `{"summary":"ok","fields":{"citta":{"value":"Rom`;
  // May drop back to {"summary":"ok"} — never invent "Rom" as a city value.
  const repaired = repairTruncatedJson(midString);
  if (repaired) {
    assert(!/"Rom"/.test(repaired), "no closed partial string fact");
    const p = parseAllyBriefProposal(repaired, null);
    assert(p.fields.find((f) => f.id === "citta")?.value == null, "citta not invented");
    assert(!isMeaningfulAllyBriefProposal(p), "summary-only not meaningful");
  } else {
    let threw = false;
    try {
      parseAllyBriefProposal(midString, null);
    } catch {
      threw = true;
    }
    assert(threw, "unrecoverable → parse failure");
  }
});

test("M9.3A.1 unrecoverable malformed JSON fails (no fabricated proposal)", () => {
  let threw = false;
  try {
    parseAllyBriefProposal("not json at all {{{", null);
  } catch {
    threw = true;
  }
  assert(threw, "must throw");
  assert(repairTruncatedJson("{garbage") === null, "garbage null");
  assert(repairTruncatedJson("") === null, "empty null");
  assert(repairTruncatedJson('{"a":') === null, "dangling colon null");
});

test("M9.3A.1 all-MISSING proposal is not meaningful", () => {
  const p = buildAllyBriefFallbackProposal("brief text", null);
  assert(!isMeaningfulAllyBriefProposal(p), "not meaningful");
});

test("M9.3A.1 full failure UX: one error, Riprova, no accept without proposal", () => {
  const ui = read("src/components/campagne/PartiamoDalBrief.tsx");
  assert(ui.includes("ALLY_BRIEF_FAILURE_MESSAGE"), "canonical msg");
  assert(ui.includes("Riprova"), "retry");
  assert(ui.includes("isMeaningfulAllyBriefProposal"), "gate");
  assert(ui.includes("canAccept"), "accept gate");
  const occurrences = (
    ui.match(/Non riesco a preparare la configurazione/g) || []
  ).length;
  assert(occurrences === 0, "no duplicated inline failure strings");
  assert(ALLY_BRIEF_FAILURE_MESSAGE.includes("riprovare"), "msg");
});

test("M9.3A.1 API failure returns ok:false without synthetic proposal", () => {
  const route = read("src/app/api/ally-brief/route.ts");
  assert(route.includes("ok: false"), "failure shape");
  assert(route.includes("ok: true"), "success shape");
  assert(!route.includes("buildAllyBriefFallbackProposal"), "no fake proposal");
  assert(route.includes("no synthetic empty proposal"), "comment");
});

test("M9.3A.1 numeric normalization from euro/km strings", () => {
  const raw = JSON.stringify({
    summary: "ok",
    fields: {
      budgetGiornaliero: field("budgetGiornaliero", "25€", "EXPLICIT"),
      raggioKm: field("raggioKm", "15 km", "EXPLICIT"),
      citta: field("citta", "Roma", "EXPLICIT"),
    },
    missing_information: [],
    assumptions: [],
  });
  const p = parseAllyBriefProposal(raw, null);
  assert(p.fields.find((f) => f.id === "budgetGiornaliero")?.value === 25, "€");
  assert(p.fields.find((f) => f.id === "raggioKm")?.value === 15, "km");
});

console.log(`\nM9.3A result: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
