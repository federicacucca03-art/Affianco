/**
 * M9.3D — Creative semantic fit verification.
 * Deterministic — no live Anthropic / network image calls.
 * Esegui: npx tsx scripts/verifica-ally-creative-semantic-m93d.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseCreativeVisionAnalysis,
  type CreativeVisionAnalysis,
} from "../src/lib/analyze-creative";
import {
  appendCreativeSemanticFitToDiagnosi,
  calculateLaunchReadinessWithSemantic,
  creativeSemanticContextFingerprint,
  creativeSemanticFitToReadiness,
  creativeSemanticNoteForAlly,
  currentPrincipalSemanticSnapshot,
  deriveCreativeSemanticFit,
  emptyCreativeSemanticFit,
  extractPrincipalSemanticSnapshot,
  fitToSnapshot,
  isIndustrialProductSettore,
  isSemanticSnapshotCurrent,
  labelSemanticFitIt,
  recommendationForMismatch,
  resolveCurrentCreativeSemanticFit,
  snapshotToFit,
  type CreativeSemanticFit,
} from "../src/lib/creative-semantic-fit";
import { calculateLaunchReadiness } from "../src/lib/launch-readiness";
import type { PreLancioDiagnosi } from "../src/lib/pre-lancio-check";
import { matchCanonicalSettore } from "../src/lib/settore-canonico";

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

function vision(partial: Partial<CreativeVisionAnalysis>): CreativeVisionAnalysis {
  return {
    relevance: "UNKNOWN",
    relevanceReason: null,
    visibleText: [],
    ...partial,
  };
}

function baseLr(extra?: Partial<Parameters<typeof calculateLaunchReadiness>[0]>) {
  return {
    fotoCaricata: true,
    clienteHaApprovato: true,
    paginaFacebookId: "123",
    moduloContattiId: "456",
    haCopySelezionato: true,
    haTitoloAnnuncio: true,
    objective: "LEADS" as const,
    ...extra,
  };
}

const ROOT = process.cwd();
function src(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function main() {
  console.log("\nM9.3D — Creative semantic fit\n");

  test("A. no creative → NOT_AVAILABLE", () => {
    const fit = deriveCreativeSemanticFit(null, { hasCreative: false });
    assert(fit.status === "NOT_AVAILABLE", fit.status);
    const lr = calculateLaunchReadinessWithSemantic(
      baseLr({ fotoCaricata: false, clienteHaApprovato: false }),
      fit,
    );
    assert(!lr.items.find((i) => i.id === "creativita")?.ok, "creative missing");
    assert(lr.warnings.length === 0, "no semantic warnings without creative");
  });

  test("B. vision unavailable → INSUFFICIENT_EVIDENCE", () => {
    const fit = deriveCreativeSemanticFit(null, { hasCreative: true });
    assert(fit.status === "INSUFFICIENT_EVIDENCE", fit.status);
    const adapted = creativeSemanticFitToReadiness(fit);
    assert(adapted.semanticPenaltyPoints === 0, "no penalty");
    assert(adapted.warnings.length === 0, "no mismatch warning");
  });

  test("C. Technon + dental → CLEAR_MISMATCH HIGH", () => {
    const analysis = vision({
      relevance: "LOW",
      relevanceReason:
        "Campagna industriale Technon vs contesto odontoiatrico visibile.",
      semanticStatus: "CLEAR_MISMATCH",
      confidence: "HIGH",
      creativeSummary: "Poltrona dentistica e paziente in studio.",
      campaignContextSummary:
        "Distribuzione tecnica industriale, nastri e adesivi.",
      evidence: ["ambiente clinico dentale", "settore distribuzione tecnica"],
    });
    const fit = deriveCreativeSemanticFit(analysis, { hasCreative: true });
    assert(fit.status === "CLEAR_MISMATCH", fit.status);
    assert(fit.confidence === "HIGH", fit.confidence);
  });

  test("D. Technon + industrial → MATCH", () => {
    const fit = deriveCreativeSemanticFit(
      vision({
        relevance: "HIGH",
        semanticStatus: "MATCH",
        confidence: "HIGH",
        relevanceReason: "Applicazione nastro industriale su superficie metallica.",
        creativeSummary: "Nastro adesivo tecnico in fabbrica.",
        campaignContextSummary: "Distribuzione tecnica industriale.",
      }),
      { hasCreative: true },
    );
    assert(fit.status === "MATCH", fit.status);
    assert(creativeSemanticFitToReadiness(fit).warnings.length === 0, "no warn");
  });

  test("E. Technon + generic office → not CLEAR_MISMATCH", () => {
    const fit = deriveCreativeSemanticFit(
      vision({
        relevance: "MEDIUM",
        semanticStatus: "POSSIBLE_MISMATCH",
        confidence: "MEDIUM",
        relevanceReason: "Riunione generica in ufficio, poco specifica.",
      }),
      { hasCreative: true },
    );
    assert(fit.status !== "CLEAR_MISMATCH", fit.status);
    assert(
      fit.status === "POSSIBLE_MISMATCH" ||
        fit.status === "INSUFFICIENT_EVIDENCE",
      fit.status,
    );
  });

  test("F. Dental + clinical dental → MATCH", () => {
    const fit = deriveCreativeSemanticFit(
      vision({
        relevance: "HIGH",
        semanticStatus: "MATCH",
        confidence: "HIGH",
        relevanceReason: "Studio dentistico e impianto.",
      }),
      { hasCreative: true },
    );
    assert(fit.status === "MATCH", fit.status);
  });

  test("G. Dental + industrial → CLEAR_MISMATCH", () => {
    const fit = deriveCreativeSemanticFit(
      vision({
        relevance: "LOW",
        semanticStatus: "CLEAR_MISMATCH",
        confidence: "HIGH",
        relevanceReason: "Macchinari e nastri industriali vs studio dentistico.",
      }),
      { hasCreative: true },
    );
    assert(fit.status === "CLEAR_MISMATCH", fit.status);
  });

  test("H. possible mismatch → no launch block", () => {
    const fit: CreativeSemanticFit = {
      status: "POSSIBLE_MISMATCH",
      confidence: "MEDIUM",
      creativeSummary: null,
      campaignContextSummary: null,
      reason: "Visual generico.",
      evidence: [],
    };
    const lr = calculateLaunchReadinessWithSemantic(baseLr(), fit);
    assert(lr.isReady, "still ready");
    assert(lr.semanticPenaltyPoints === 0, "no penalty");
    assert(lr.warnings.length === 1, "soft warning");
    assert(
      lr.warnings[0]?.title.includes("Verifica che la creatività"),
      lr.warnings[0]?.title,
    );
  });

  test("I. clear mismatch → readiness warning, no hard block, no score mutation", () => {
    const fit: CreativeSemanticFit = {
      status: "CLEAR_MISMATCH",
      confidence: "HIGH",
      creativeSummary: "Contesto odontoiatrico.",
      campaignContextSummary: "Distribuzione tecnica industriale.",
      reason:
        "La campagna riguarda distribuzione tecnica industriale, mentre l'immagine sembra mostrare un contesto odontoiatrico.",
      evidence: ["dental chair"],
    };
    const base = calculateLaunchReadiness(baseLr());
    const lr = calculateLaunchReadinessWithSemantic(baseLr(), fit);
    assert(lr.isReady, "isReady must stay true when technical items ok");
    assert(
      lr.items.find((i) => i.id === "creativita")?.ok === true,
      "creative still present",
    );
    assert(lr.semanticPenaltyPoints === 0, "warning-only MVP");
    assert(lr.percentuale === base.percentuale, "canonical % untouched");
    assert(lr.isReady === base.isReady, "isReady from canonical engine");
    assert(
      lr.warnings[0]?.title ===
        "La creatività sembra poco coerente con questa campagna.",
      lr.warnings[0]?.title,
    );
    assert(lr.warnings[0]?.cta === "Controlla creatività", "cta");
  });

  test("I2. CLEAR + MEDIUM demoted → no clear consequence", () => {
    const fit = deriveCreativeSemanticFit(
      vision({
        semanticStatus: "CLEAR_MISMATCH",
        confidence: "MEDIUM",
        relevance: "LOW",
        relevanceReason: "Dubbio.",
      }),
      { hasCreative: true },
    );
    assert(fit.status === "POSSIBLE_MISMATCH", fit.status);
    const lr = calculateLaunchReadinessWithSemantic(baseLr(), fit);
    assert(lr.isReady, "ready");
    assert(lr.semanticPenaltyPoints === 0, "0");
    assert(
      lr.warnings[0]?.id === "creative-semantic-possible-mismatch",
      lr.warnings[0]?.id,
    );
  });

  test("J. analysis failure → existing readiness still works", () => {
    const fit = deriveCreativeSemanticFit(null, { hasCreative: true });
    const lr = calculateLaunchReadinessWithSemantic(baseLr(), fit);
    const base = calculateLaunchReadiness(baseLr());
    assert(lr.isReady === base.isReady, "same ready");
    assert(lr.completati === base.completati, "same counts");
    assert(lr.semanticPenaltyPoints === 0, "failure ≠ mismatch");
  });

  test("K. creative unchanged → same fingerprint (no repeat key)", () => {
    const a = creativeSemanticContextFingerprint({
      assetId: "asset-1",
      storagePath: "uid/asset-1.jpg",
      settore: "Distribuzione tecnica industriale",
      offerta: "Nastri 3M VHB",
      brief: "Distributore tecnico",
      nomeCliente: "Technon",
      objective: "LEADS",
    });
    const b = creativeSemanticContextFingerprint({
      assetId: "asset-1",
      storagePath: "uid/asset-1.jpg",
      settore: "Distribuzione tecnica industriale",
      offerta: "Nastri 3M VHB",
      brief: "Distributore tecnico",
      nomeCliente: "Technon",
      objective: "LEADS",
    });
    assert(a === b, "stable fingerprint");
  });

  test("L. creative replaced → fingerprint changes", () => {
    const a = creativeSemanticContextFingerprint({
      assetId: "old",
      storagePath: "u/old.jpg",
      settore: "x",
      offerta: "y",
      brief: "z",
    });
    const b = creativeSemanticContextFingerprint({
      assetId: "new",
      storagePath: "u/new.jpg",
      settore: "x",
      offerta: "y",
      brief: "z",
    });
    assert(a !== b, "asset id invalidates");
  });

  test("M. sector/offer change → fingerprint stale", () => {
    const a = creativeSemanticContextFingerprint({
      assetId: "1",
      storagePath: "p",
      settore: "Distribuzione tecnica industriale",
      offerta: "Nastri",
      brief: "B2B",
      nomeCliente: "Technon",
    });
    const b = creativeSemanticContextFingerprint({
      assetId: "1",
      storagePath: "p",
      settore: "Studio dentistico",
      offerta: "Nastri",
      brief: "B2B",
      nomeCliente: "Technon",
    });
    assert(a !== b, "sector invalidates");
    const snap = fitToSnapshot(
      {
        status: "MATCH",
        confidence: "HIGH",
        creativeSummary: "ok",
        campaignContextSummary: "ok",
        reason: null,
        evidence: [],
      },
      a,
    );
    assert(snap?.fingerprint === a, "snap fp");
    assert(
      !isSemanticSnapshotCurrent(snap, {
        assetId: "1",
        storagePath: "p",
        settore: "Studio dentistico",
        offerta: "Nastri",
        brief: "B2B",
        nomeCliente: "Technon",
      }),
      "stale ignored",
    );
  });

  test("N. M9.3C sector aliases still map", () => {
    const m = matchCanonicalSettore("Distribuzione tecnica industriale");
    assert(m.matched, "matched");
    assert(m.id === "distribuzione-tecnica", m.id);
    assert(m.preset?.id === "distribuzione-tecnica", m.preset?.id ?? "?");
  });

  test("CLEAR without HIGH demotes to POSSIBLE", () => {
    const fit = deriveCreativeSemanticFit(
      vision({
        semanticStatus: "CLEAR_MISMATCH",
        confidence: "MEDIUM",
        relevance: "LOW",
        relevanceReason: "Forse mismatch.",
      }),
      { hasCreative: true },
    );
    assert(fit.status === "POSSIBLE_MISMATCH", fit.status);
  });

  test("legacy LOW without HIGH → POSSIBLE (precision)", () => {
    const fit = deriveCreativeSemanticFit(
      vision({
        relevance: "LOW",
        relevanceReason: "Non sembra allineato.",
      }),
      { hasCreative: true },
    );
    assert(fit.status === "POSSIBLE_MISMATCH", fit.status);
  });

  test("parse structured semanticStatus from model JSON", () => {
    const parsed = parseCreativeVisionAnalysis(
      JSON.stringify({
        semanticStatus: "CLEAR_MISMATCH",
        confidence: "HIGH",
        relevance: "LOW",
        relevanceReason: "Dentale vs industriale.",
        creativeSummary: "Studio dentistico",
        campaignContextSummary: "Technon industriale",
        evidence: ["poltrona dentistica"],
        visibleText: [],
      }),
    );
    assert(parsed.semanticStatus === "CLEAR_MISMATCH", String(parsed.semanticStatus ?? ""));
    assert(parsed.confidence === "HIGH", String(parsed.confidence ?? ""));
    const fit = deriveCreativeSemanticFit(parsed, { hasCreative: true });
    assert(fit.status === "CLEAR_MISMATCH", fit.status);
  });

  test("persistence snapshot round-trip + Ally note only if current", () => {
    const fit: CreativeSemanticFit = {
      status: "CLEAR_MISMATCH",
      confidence: "HIGH",
      creativeSummary: "Contesto odontoiatrico",
      campaignContextSummary: "Industriale",
      reason: "Mismatch evidente",
      evidence: ["dental"],
    };
    const fp = creativeSemanticContextFingerprint({
      assetId: "1",
      storagePath: "u/1.jpg",
      settore: "Distribuzione tecnica industriale",
      offerta: "Nastri",
      brief: "B2B",
      nomeCliente: "Technon",
    });
    const snap = fitToSnapshot(fit, fp);
    assert(snap, "snap");
    const back = snapshotToFit(snap!);
    assert(back?.status === "CLEAR_MISMATCH", String(back?.status ?? ""));
    const creativita = [
      {
        id: "1",
        ruolo: "principale",
        storagePath: "u/1.jpg",
        semanticFit: snap,
      },
    ];
    const current = currentPrincipalSemanticSnapshot({
      creativita,
      settore: "Distribuzione tecnica industriale",
      offerta: "Nastri",
      brief: "B2B",
      nomeCliente: "Technon",
    });
    assert(current?.fingerprint === fp, "current");
    const note = creativeSemanticNoteForAlly(current);
    assert(Boolean(note && note.includes("Mismatch")), note ?? "null");
    const stale = currentPrincipalSemanticSnapshot({
      creativita,
      settore: "Studio dentistico",
      offerta: "Nastri",
      brief: "B2B",
      nomeCliente: "Technon",
    });
    assert(stale === null, "stale blocked");
    assert(
      creativeSemanticNoteForAlly(extractPrincipalSemanticSnapshot(creativita), {
        current: false,
      }) === null,
      "explicit stale block",
    );
  });

  test("labels / recommendation Italian, no raw enums to users", () => {
    assert(labelSemanticFitIt("MATCH") === "Coerente", "match");
    assert(labelSemanticFitIt("CLEAR_MISMATCH") === "Da verificare", "clear");
    assert(
      recommendationForMismatch("Distribuzione tecnica industriale").includes(
        "industriale",
      ),
      "rec",
    );
    const empty = emptyCreativeSemanticFit();
    assert(empty.status === "NOT_AVAILABLE", empty.status);
    const card = src("src/components/nuova-contatti/LaunchReadinessCard.tsx");
    assert(card.includes("configurazione tecnica"), "UI split");
    assert(card.includes("non blocca il lancio tecnico"), "coherence note");
    assert(!card.includes("CLEAR_MISMATCH"), "no raw enum in card");
  });

  test("architecture: thin adapter; warning-only; no keystroke AI; no migration", () => {
    const fitSrc = src("src/lib/creative-semantic-fit.ts");
    const route = src("src/app/api/analyze-creative/route.ts");
    const studio = src("src/components/nuova-contatti/StudioCreativo.tsx");
    assert(fitSrc.includes("creativeSemanticFitToReadiness"), "adapter");
    assert(fitSrc.includes("calculateLaunchReadiness(input)"), "reuses canonical");
    assert(!fitSrc.includes("CLEAR_MISMATCH_READINESS_PENALTY"), "no magic −8");
    assert(fitSrc.includes("semanticPenaltyPoints: 0"), "warning-only");
    assert(
      route.includes("istruzioni precedenti") || route.includes("prompt injection"),
      "safety",
    );
    assert(route.includes("etnia") || route.includes("orientamento"), "privacy");
    assert(route.includes("requireRouteUserId"), "auth");
    assert(studio.includes("creativeSemanticContextFingerprint"), "fingerprint");
    assert(studio.includes("storagePath"), "stable creative id");
    assert(studio.includes("onSemanticFitChange"), "callback");
    assert(
      studio.includes("no AI on every keystroke") ||
        studio.includes("Context edits invalidate"),
      "no keystroke AI",
    );
  });

  test("malformed AI semantic enum → safe fallback", () => {
    const parsed = parseCreativeVisionAnalysis(
      JSON.stringify({
        semanticStatus: "TOTALLY_WRONG",
        confidence: "ULTRA",
        relevance: "HIGH",
        relevanceReason: "ok",
        visibleText: [],
      }),
    );
    assert(parsed.relevance === "HIGH", "legacy relevance ok");
    assert(
      parsed.semanticStatus === "MATCH" ||
        parsed.semanticStatus === "INSUFFICIENT_EVIDENCE",
      String(parsed.semanticStatus),
    );
    const bad = parseCreativeVisionAnalysis("{not json");
    assert(bad.relevance === "UNKNOWN", "unknown");
    assert(bad.semanticStatus === "INSUFFICIENT_EVIDENCE", "safe");
  });

  test("M7A untouched by M9.3D + server-only pre-exists", () => {
    const cron = src("src/lib/meta/meta-sync-cron.ts");
    assert(cron.includes('import "server-only"'), "server-only present");
    const m93dFiles = [
      "src/lib/creative-semantic-fit.ts",
      "src/components/nuova-contatti/StudioCreativo.tsx",
      "src/lib/ally-copilot/load-context.ts",
    ];
    for (const f of m93dFiles) {
      assert(!src(f).includes("meta-sync-cron"), `no m7 import in ${f}`);
    }
  });

  test("INSUFFICIENT from UNKNOWN relevance", () => {
    const fit = deriveCreativeSemanticFit(
      vision({ relevance: "UNKNOWN", semanticStatus: "INSUFFICIENT_EVIDENCE" }),
      { hasCreative: true },
    );
    assert(fit.status === "INSUFFICIENT_EVIDENCE", fit.status);
  });

  test("M9.3D.2 Pre-lancio: semantic warning additive; Creatività OK; score unchanged", () => {
    const fit: CreativeSemanticFit = {
      status: "CLEAR_MISMATCH",
      confidence: "HIGH",
      creativeSummary: "Auto sportiva / contesto automotive.",
      campaignContextSummary: "Distribuzione tecnica industriale.",
      reason:
        "La campagna riguarda distribuzione tecnica industriale, mentre l'immagine sembra mostrare un contesto automotive.",
      evidence: ["sports car"],
    };
    const base: PreLancioDiagnosi = {
      score: 61,
      label: "Campagna migliorabile",
      tone: "yellow",
      saturazione: null,
      stimaAppuntamenti: null,
      stimaOrdini: null,
      stimaCoperturaRetargeting: false,
      checks: [
        {
          id: "creativita",
          level: "ok",
          titolo: "Creatività",
          severita: "ok",
          messaggio: "Creatività OK",
          motivazione: "Immagine caricata.",
        },
        {
          id: "formato",
          level: "tip",
          titolo: "Formato creativo",
          severita: "consiglio",
          messaggio: "Formato orizzontale",
          motivazione: "Preferisci 4:5.",
        },
      ],
      layoutOperativo: true,
      riepilogo: { ok: 1, consigli: 1, errori: 0 },
      haErroriBloccanti: false,
    };
    const out = appendCreativeSemanticFitToDiagnosi(base, fit);
    assert(out.score === 61, `score ${out.score}`);
    assert(out.haErroriBloccanti === false, "no hard block");
    assert(
      out.checks.find((c) => c.id === "creativita")?.severita === "ok",
      "Creatività still OK",
    );
    const sem = out.checks.find((c) =>
      c.id.includes("creative-semantic-clear-mismatch"),
    );
    assert(Boolean(sem), "semantic check present");
    assert(sem?.severita === "consiglio", "warning not error");
    assert(
      sem?.titolo?.includes("Coerenza creatività"),
      sem?.titolo ?? "missing title",
    );
    assert(
      (sem?.motivazione ?? "").includes("poco coerente"),
      sem?.motivazione ?? "",
    );
    assert(
      out.checks.some((c) => c.id === "formato"),
      "format tip preserved",
    );
    assert(out.riepilogo?.consigli === 2, "extra consiglio counted");
  });

  test("M9.3D.2 Pre-lancio MATCH → no semantic tip", () => {
    const fit: CreativeSemanticFit = {
      status: "MATCH",
      confidence: "HIGH",
      creativeSummary: "Nastro adesivo industriale.",
      campaignContextSummary: "Distribuzione tecnica industriale.",
      reason: null,
      evidence: ["tape"],
    };
    const base: PreLancioDiagnosi = {
      score: 61,
      label: "ok",
      tone: "yellow",
      saturazione: null,
      stimaAppuntamenti: null,
      stimaOrdini: null,
      stimaCoperturaRetargeting: false,
      checks: [
        {
          id: "creativita",
          level: "ok",
          titolo: "Creatività",
          severita: "ok",
          messaggio: "OK",
        },
      ],
      riepilogo: { ok: 1, consigli: 0, errori: 0 },
      haErroriBloccanti: false,
    };
    const out = appendCreativeSemanticFitToDiagnosi(base, fit);
    assert(out.checks.length === 1, "no extra");
    assert(out.score === 61, "score");
  });

  test("M9.3D.2 resolve prefers current snap; session fallback without snap", () => {
    const fit: CreativeSemanticFit = {
      status: "CLEAR_MISMATCH",
      confidence: "HIGH",
      creativeSummary: "Porsche.",
      campaignContextSummary: "Distribuzione tecnica industriale.",
      reason: "Mismatch.",
      evidence: ["car"],
    };
    const fp = creativeSemanticContextFingerprint({
      assetId: "a1",
      storagePath: "u/a1.jpg",
      settore: "Distribuzione tecnica industriale",
      offerta: "Nastri 3M",
      brief: "B2B",
      nomeCliente: "Technon",
      objective: "LEADS",
    });
    const snap = fitToSnapshot(fit, fp);
    const fromSnap = resolveCurrentCreativeSemanticFit({
      creativita: [
        {
          id: "a1",
          ruolo: "principale",
          storagePath: "u/a1.jpg",
          semanticFit: snap,
        },
      ],
      settore: "Distribuzione tecnica industriale",
      offerta: "Nastri 3M",
      brief: "B2B",
      nomeCliente: "Technon",
      objective: "LEADS",
      sessionFit: null,
    });
    assert(fromSnap?.status === "CLEAR_MISMATCH", String(fromSnap?.status));

    const fromSession = resolveCurrentCreativeSemanticFit({
      creativita: [
        { id: "a1", ruolo: "principale", storagePath: "u/a1.jpg" },
      ],
      settore: "Distribuzione tecnica industriale",
      offerta: "Nastri 3M",
      brief: "B2B",
      nomeCliente: "Technon",
      objective: "LEADS",
      sessionFit: fit,
    });
    assert(fromSession?.status === "CLEAR_MISMATCH", "session fallback");

    const stale = resolveCurrentCreativeSemanticFit({
      creativita: [
        {
          id: "a1",
          ruolo: "principale",
          storagePath: "u/a1.jpg",
          semanticFit: snap,
        },
      ],
      settore: "Studio dentistico",
      offerta: "Nastri 3M",
      brief: "B2B",
      nomeCliente: "Technon",
      objective: "LEADS",
      sessionFit: fit,
    });
    assert(stale === null, "stale snap blocks; no weak session override");
  });

  test("M9.3D.2 industrial tip helper + Studio dedupe wiring", () => {
    assert(
      isIndustrialProductSettore("Distribuzione tecnica industriale"),
      "technon sector",
    );
    assert(!isIndustrialProductSettore("Pizzeria"), "local food stays local");
    const studio = src("src/components/nuova-contatti/StudioCreativo.tsx");
    assert(
      studio.includes("guidanceP1bSenzaDuplicati"),
      "filters P1B relevance dup",
    );
    assert(
      studio.includes("creative-semantic-suggestion"),
      "separate suggestion",
    );
    const drop = src("src/components/nuova-contatti/DropzoneCreativita.tsx");
    assert(drop.includes("isIndustrialProductSettore"), "industrial tip");
    assert(drop.includes("tipIndustriale"), "branch");
    const percorso = src("src/components/nuova-contatti/PercorsoContatti.tsx");
    assert(
      percorso.includes("appendCreativeSemanticFitToDiagnosi"),
      "step 5 wiring",
    );
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log("M9.3D creative semantic checks ok.");
}

main();
