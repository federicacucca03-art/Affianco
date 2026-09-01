/**
 * Verifica Results V3 — Weekly Control Room.
 * Esegui: npx tsx scripts/verifica-results-v3.ts
 *
 * Env dummy PRIMA di qualsiasi import che tocca supabase-js.
 */
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  azioniConsigliate,
  buildEconomicContext,
  calcolaHealthStatus,
  diagnosticaDeterministica,
  etichettaCompleteness,
  etichettaMetricaPrimaria,
  etichettaSogliaEconomica,
  etichettaTrend,
  getPrimaryOutcome,
  HEALTH_GREEN_MAX_RATIO,
  primaryMetricTypeDaObjective,
  thresholdModeDaHealth,
  trendVsPrecedente,
  type ControlRoomKpis,
} from "@/lib/control-room";
import type { Campagna } from "@/types/campagne";

const ROOT = process.cwd();

let falliti = 0;
const report: string[] = [];

function assert(cond: unknown, msg: string): boolean {
  if (!cond) {
    falliti += 1;
    console.error(`FAIL  ${msg}`);
    report.push(`FAIL  ${msg}`);
    return false;
  }
  console.log(`PASS  ${msg}`);
  report.push(`PASS  ${msg}`);
  return true;
}

function legge(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function sezione(nome: string, ok: boolean) {
  console.log(`\n=== ${nome}: ${ok ? "PASS" : "FAIL"} ===`);
}

async function main() {
  const { stessaGiornataLocale } = await import("@/lib/campaign-checks-db");

  const THRESHOLD = 113;

  function kpis(partial: Partial<ControlRoomKpis>): ControlRoomKpis {
    return {
      spend: null,
      results: null,
      costPerResult: null,
      ctr: null,
      cpm: null,
      cpc: null,
      frequency: null,
      roas: null,
      ...partial,
    };
  }

  function run(
    actual: number,
    days: number,
    results: number,
    extra: Partial<ControlRoomKpis> = {},
  ) {
    const kpi = kpis({
      costPerResult: actual,
      results,
      ...extra,
    });
    const health = calcolaHealthStatus(actual, THRESHOLD, "economic", {
      daysActive: days,
      resultsCount: results,
    });
    const economic = buildEconomicContext(
      {
        id: "aurora",
        nomeCliente: "Aurora",
        iniziali: "AU",
        stato: "Attiva",
        giudizio: "Ancora presto",
        objective: "LEADS",
        nomeCampagna: "Aurora Lead",
        maxSustainableCpa: THRESHOLD,
      } as never,
      kpi,
      THRESHOLD,
      "LEADS",
    );
    const diagnosis = diagnosticaDeterministica(kpi, health, economic);
    const actions = azioniConsigliate(diagnosis, health);
    return { health, diagnosis, actions, economic };
  }

  function runM02(opts: {
    actual: number;
    days: number;
    results: number;
    threshold: number;
    objective: Campagna["objective"];
    extra?: Partial<ControlRoomKpis>;
    campagna?: Partial<Campagna>;
  }) {
    const kpi = kpis({
      costPerResult: opts.actual,
      results: opts.results,
      ...opts.extra,
    });
    const campagna = {
      id: "m02",
      nomeCliente: "Test",
      iniziali: "TE",
      stato: "Attiva",
      giudizio: "Ancora presto",
      objective: opts.objective,
      nomeCampagna: "M02",
      maxSustainableCpa: opts.threshold,
      ...opts.campagna,
    } as Campagna;
    const economic = buildEconomicContext(
      campagna,
      kpi,
      opts.threshold,
      opts.objective,
    );
    const health = calcolaHealthStatus(
      economic.actual,
      economic.threshold,
      economic.healthMode,
      {
        daysActive: opts.days,
        resultsCount: opts.results,
      },
    );
    const diagnosis = diagnosticaDeterministica(kpi, health, economic);
    const actions = azioniConsigliate(diagnosis, health);
    return { kpi, health, diagnosis, actions, economic };
  }

  // ---- Semaforo bande ----
  const bandeOk =
    assert(HEALTH_GREEN_MAX_RATIO === 0.8, "GREEN max ratio = 0.80") &&
    assert(
      calcolaHealthStatus(50, THRESHOLD, "economic").status === "GREEN",
      "50€ vs 113€ → GREEN (senza guard giorni/risultati)",
    ) &&
    assert(
      calcolaHealthStatus(100, THRESHOLD, "economic").status === "YELLOW",
      "100€ vs 113€ → YELLOW",
    ) &&
    assert(
      calcolaHealthStatus(200, THRESHOLD, "economic").status === "RED",
      "200€ vs 113€ → RED (senza insufficient guard)",
    );

  // ---- Aurora A/B/C/C2/D ----
  const a = run(50, 7, 4, { spend: 200, ctr: 1.8, cpm: 12, cpc: 0.67, frequency: 1.6 });
  const b = run(100, 7, 2, { spend: 200, ctr: 1.1, cpm: 14, cpc: 1.27, frequency: 2.1 });
  const c = run(200, 7, 1, { spend: 200, ctr: 0.6, cpm: 18, cpc: 3, frequency: 3.8 });
  const c2 = run(200, 7, 2, { spend: 400 });
  const d = run(50, 2, 4);

  const auroraA = assert(a.health.status === "GREEN", "Aurora A → GREEN");
  const auroraB = assert(b.health.status === "YELLOW", "Aurora B → YELLOW");
  const auroraC = assert(
    c.health.status === "INSUFFICIENT",
    "Aurora C (1 risultato) → INSUFFICIENT, non RED",
  );
  const auroraC2 = assert(c2.health.status === "RED", "Aurora C2 (2 risultati, CPL 200) → RED");
  const auroraD = assert(d.health.status === "INSUFFICIENT", "Aurora D (2 giorni) → INSUFFICIENT");

  const insufficientOk =
    assert(c.health.status !== "RED", "C non è RED") &&
    assert(
      c.diagnosis.signal === "dati_insufficienti",
      "C diagnosi = dati_insufficienti",
    ) &&
    assert(
      c.diagnosis.body.includes("insufficienti"),
      "C signal body: dati insufficienti",
    ) &&
    assert(c.actions.length <= 3, "C actions ≤ 3") &&
    assert(d.health.status === "INSUFFICIENT", "D INSUFFICIENT") &&
    assert(
      calcolaHealthStatus(50, THRESHOLD, "economic", {
        daysActive: 7,
        resultsCount: 0,
      }).status === "INSUFFICIENT",
      "results_count = 0 → INSUFFICIENT",
    );

  // ---- M0.2 semantic cases ----
  const outcomeLeads = getPrimaryOutcome(
    "LEADS",
    kpis({ costPerResult: 120, spend: 240, results: 2 }),
    80,
    "economic",
  );
  const primaryOk =
    assert(outcomeLeads.metricType === "CPL", "LEADS → metricType CPL") &&
    assert(
      primaryMetricTypeDaObjective("BOOKINGS") === "CPA_BOOKING",
      "BOOKINGS → CPA_BOOKING",
    ) &&
    assert(
      primaryMetricTypeDaObjective("ECOMMERCE") === "CPA_PURCHASE",
      "ECOMMERCE → CPA_PURCHASE",
    ) &&
    assert(
      primaryMetricTypeDaObjective("IN_STORE") === "COST_PER_RESULT_PROXY",
      "INSTORE → COST_PER_RESULT_PROXY",
    ) &&
    assert(
      primaryMetricTypeDaObjective("RETARGETING") === "CPA_RETARGETING",
      "RETARGETING → CPA_RETARGETING",
    ) &&
    assert(primaryMetricTypeDaObjective("AWARENESS") === "CPM", "AWARENESS → CPM");

  const caseA = runM02({
    actual: 120,
    days: 7,
    results: 3,
    threshold: 80,
    objective: "LEADS",
    extra: { spend: 360 },
  });
  const caseAOk =
    assert(caseA.health.status === "RED", "CASE A health RED") &&
    assert(caseA.diagnosis.confidence === "LOW", "CASE A confidence LOW") &&
    assert(caseA.diagnosis.confidence !== "HIGH", "CASE A never HIGH") &&
    assert(
      caseA.diagnosis.body.includes("non ci sono ancora abbastanza metriche"),
      "CASE A no invented cause",
    ) &&
    assert(
      !/creatività non funziona|audience è sbagliata|landing non converte/i.test(
        caseA.diagnosis.body,
      ),
      "CASE A no assertive cause copy",
    ) &&
    assert(
      caseA.actions[0]?.text.includes("CTR"),
      "CASE A first action = add diagnostic metrics",
    );

  const caseB = runM02({
    actual: 120,
    days: 7,
    results: 4,
    threshold: 80,
    objective: "LEADS",
    extra: {
      spend: 480,
      ctr: 0.7,
      cpc: 40,
      cpm: 14,
      frequency: 1.4,
    },
  });
  const caseBOk =
    assert(caseB.health.status === "RED", "CASE B health RED") &&
    assert(caseB.diagnosis.area === "AD_MESSAGE", "CASE B upstream / ad-message") &&
    assert(caseB.diagnosis.confidence === "MEDIUM", "CASE B MEDIUM") &&
    assert(caseB.diagnosis.confidence !== "HIGH", "CASE B not HIGH") &&
    assert(
      caseB.diagnosis.body.includes("a monte del click"),
      "CASE B possible upstream wording",
    );

  const caseC = runM02({
    actual: 120,
    days: 7,
    results: 4,
    threshold: 80,
    objective: "LEADS",
    extra: {
      spend: 480,
      ctr: 1.5,
      cpc: 5,
      cpm: 12,
      frequency: 1.4,
    },
  });
  const caseCOk =
    assert(caseC.health.status === "RED", "CASE C health RED") &&
    assert(caseC.diagnosis.area === "POST_CLICK", "CASE C post-click") &&
    assert(caseC.diagnosis.confidence === "MEDIUM", "CASE C MEDIUM") &&
    assert(caseC.diagnosis.confidence !== "HIGH", "CASE C not HIGH") &&
    assert(
      !/landing non converte/i.test(`${caseC.diagnosis.body} ${caseC.diagnosis.hint ?? ""}`),
      "CASE C not a definitive landing claim",
    );

  const caseD = run(50, 7, 4, {
    spend: 200,
    ctr: 1.8,
    cpm: 12,
    cpc: 0.67,
    frequency: 3.9,
  });
  const caseDOk =
    assert(caseD.health.status === "GREEN", "CASE D GREEN remains GREEN") &&
    assert(
      caseD.diagnosis.confidence !== "HIGH",
      "CASE D confidence not HIGH",
    ) &&
    assert(
      caseD.actions[0]?.text.includes("entro la soglia"),
      "CASE D no aggressive change action",
    ) &&
    assert(
      !caseD.actions.some((a) =>
        /cambia audience|testa 2|aumenta il budget/i.test(a.text),
      ),
      "CASE D no audience/budget/ads push",
    );

  const caseE = runM02({
    actual: 30,
    days: 7,
    results: 4,
    threshold: 40,
    objective: "ECOMMERCE",
    extra: {
      spend: 120,
      roas: 1.2,
      ctr: 1.5,
      cpc: 2,
      cpm: 10,
      frequency: 1.3,
    },
    campagna: {
      averageOrderValue: 80,
      productMargin: 50,
      maxSustainableCpa: 40,
    },
  });
  const caseEOk =
    assert(caseE.health.status === "GREEN", "CASE E health from CPA (GREEN)") &&
    assert(caseE.diagnosis.area === "ECONOMICS", "CASE E diagnosis ECONOMICS") &&
    assert(
      caseE.diagnosis.body.includes("ROAS è sotto"),
      "CASE E ROAS warning copy",
    ) &&
    assert(
      !/fuori soglia/i.test(caseE.diagnosis.body),
      "CASE E diagnosis does not contradict CPA-in-threshold",
    ) &&
    assert(
      caseE.actions[0]?.text.includes("valore medio ordine"),
      "CASE E next action checks AOV/margin",
    );

  const caseF = runM02({
    actual: 4,
    days: 7,
    results: 40,
    threshold: 12.5,
    objective: "AWARENESS",
    extra: {
      spend: 200,
      cpm: 18,
      ctr: 0.5,
      cpc: 0.2,
      frequency: 1.2,
      costPerResult: 4,
    },
    campagna: { estimatedCpm: 12.5 },
  });
  const caseFOk =
    assert(caseF.economic.metricType === "CPM", "CASE F primary CPM") &&
    assert(caseF.economic.actual === 18, "CASE F health uses CPM not CPL") &&
    assert(caseF.health.status === "RED", "CASE F CPM above plan → RED") &&
    assert(caseF.health.mode === "efficiency", "CASE F efficiency mode") &&
    assert(
      !/CPL/i.test(
        `${caseF.health.explanation} ${caseF.diagnosis.body} ${caseF.economic.metricLabel}`,
      ),
      "CASE F no CPL wording",
    );

  const caseGOk = assert(
    etichettaMetricaPrimaria("IN_STORE") === "Costo per risultato (proxy)",
    "CASE G INSTORE proxy wording",
  );
  const caseHOk =
    assert(
      etichettaMetricaPrimaria("RETARGETING") === "Costo per risultato",
      "CASE H RETARGETING neutral cost-per-result",
    ) &&
    assert(
      !/visita negozio|acquisto|lead/i.test(etichettaMetricaPrimaria("RETARGETING")),
      "CASE H not ecommerce/lead wording",
    );

  const engineSrc = legge("src/lib/control-room.ts");
  const noHighOk = assert(
    !/confidence:\s*"HIGH"/.test(engineSrc),
    "M0.2 engine never assigns HIGH confidence",
  );

  const m02Ok =
    primaryOk &&
    caseAOk &&
    caseBOk &&
    caseCOk &&
    caseDOk &&
    caseEOk &&
    caseFOk &&
    caseGOk &&
    caseHOk &&
    noHighOk;

  // ---- History / trend ----
  const t1 = trendVsPrecedente(100, 80);
  const t2 = trendVsPrecedente(80, 120);
  const t3 = trendVsPrecedente(80, 80);
  const historyOk =
    assert(etichettaTrend(t1) === "Migliorato", "CPL 100 → 80 = Migliorato") &&
    assert(etichettaTrend(t2) === "Peggiorato", "CPL 80 → 120 = Peggiorato") &&
    assert(etichettaTrend(t3) === "Stabile", "CPL 80 → 80 = Stabile");

  const trendOk = historyOk;

  // ---- Awareness / ecommerce ----
  assert(
    calcolaHealthStatus(10, 12.5, "efficiency", {
      daysActive: 7,
      resultsCount: 4,
    }).status === "GREEN",
    "AWARENESS CPM 10 vs 12.5 → GREEN",
  );
  assert(
    thresholdModeDaHealth("efficiency") === "EFFICIENCY",
    "AWARENESS threshold_mode = EFFICIENCY",
  );
  assert(
    calcolaHealthStatus(null, null, "economic", {
      daysActive: 7,
      resultsCount: 4,
    }).status === "INSUFFICIENT",
    "ECOMMERCE senza soglia CPA → INSUFFICIENT",
  );

  // ---- Same day helper ----
  const oggi = new Date();
  assert(
    stessaGiornataLocale(oggi.toISOString(), oggi),
    "stessaGiornataLocale riconosce oggi",
  );
  const ieri = new Date(oggi.getTime() - 36 * 60 * 60 * 1000);
  assert(
    !stessaGiornataLocale(ieri.toISOString(), oggi),
    "stessaGiornataLocale rifiuta ieri",
  );

  // ---- File / architecture ----
  const migration = legge("supabase/migrations/20260831_campaign_checks.sql");
  const rlsOk =
    assert(migration.includes("create table if not exists public.campaign_checks"), "tabella campaign_checks") &&
    assert(migration.includes("GREEN") && migration.includes("INSUFFICIENT"), "CHECK health_status") &&
    assert(migration.includes("MANUAL") && migration.includes("SCREENSHOT"), "CHECK source") &&
    assert(migration.includes("BREAK_EVEN") && migration.includes("EFFICIENCY"), "CHECK threshold_mode") &&
    assert(migration.includes("campaign_checks_campaign_id_idx"), "indice campaign_id") &&
    assert(migration.includes("campaign_checks_user_id_idx"), "indice user_id") &&
    assert(migration.includes("created_at desc"), "indice created_at desc") &&
    assert(migration.includes("revoke all on table public.campaign_checks from anon"), "revoke anon") &&
    assert(migration.includes("user_id = auth.uid()"), "RLS user_id = auth.uid()") &&
    assert(migration.includes("c.user_id = auth.uid()"), "RLS campagna stesso user") &&
    assert(migration.includes("enforce_campaign_checks_user_id"), "anti-spoof trigger");

  const checksDb = legge("src/lib/campaign-checks-db.ts");
  const campaignChecksOk =
    assert(checksDb.includes(".insert("), "insert nuovo check") &&
    assert(!/from\("campaign_checks"\)[\s\S]*\.update\(/.test(checksDb), "nessun update dell'ultimo check") &&
    assert(checksDb.includes("stessaGiornataLocale"), "protezione stesso giorno");

  const risultati = legge("src/app/risultati/page.tsx");
  const campagnaPage = legge("src/app/campagne/[id]/page.tsx");
  const pannello = legge("src/components/campagne/PannelloDiagnosiPerformance.tsx");
  const screenshotRoute = legge("src/app/api/analyze-screenshot/route.ts");
  const screenshotType = legge("src/types/screenshot-analysis.ts");

  const unifiedOk =
    assert(risultati.includes("calcolaHealthStatus"), "/risultati usa control-room") &&
    assert(!risultati.includes("@/lib/analyzer"), "/risultati non importa analyzer") &&
    assert(!campagnaPage.includes("analyzeCampaignData"), "tab campagna non usa analyzeCampaignData") &&
    assert(!campagnaPage.includes("@/lib/analyzer"), "tab campagna non importa analyzer") &&
    assert(pannello.includes("leggiChecksCampagna"), "tab legge campaign_checks") &&
    assert(risultati.includes("Salva controllo"), "CTA Salva controllo");

  const detailOk =
    assert(pannello.includes("Nuovo controllo"), "CTA Nuovo controllo") &&
    assert(pannello.includes("/risultati?campaignId="), "link a /risultati?campaignId=") &&
    assert(risultati.includes("StoricoControlli"), "/risultati mostra storico") &&
    assert(risultati.includes("Nota del media buyer"), "campo nota") &&
    assert(risultati.includes("etichettaConfidenza"), "/risultati mostra confidenza") &&
    assert(pannello.includes("etichettaSegnaleDiagnosi"), "detail mostra diagnosi distinta");

  const overview = legge("src/components/risultati/ControlRoomOverview.tsx");
  const m021Ok =
    assert(overview.includes("copyDiagnosiOverview"), "overview riusa signal persistito") &&
    assert(
      overview.includes("Diagnosi non ancora definita"),
      "overview non inventa diagnosis",
    ) &&
    assert(
      !overview.includes("diagnosticaDeterministica"),
      "overview non ricalcola diagnosis",
    ) &&
    assert(
      !overview.includes("etichettaConfidenza"),
      "overview non inventa confidence sui check salvati",
    ) &&
    assert(overview.includes("Diagnosi"), "overview ha micro-label Diagnosi") &&
    assert(
      campagnaPage.includes("Costo per risultato (proxy)"),
      "INSTORE header = proxy",
    ) &&
    assert(
      !campagnaPage.includes("CPA recupero sostenibile"),
      "RETARGETING header senza CPA recupero",
    ) &&
    assert(
      campagnaPage.includes("Costo per risultato sostenibile"),
      "RETARGETING header neutro",
    ) &&
    assert(campagnaPage.includes("CPM di piano"), "AWARENESS header CPM di piano") &&
    assert(
      campagnaPage.includes("CPL massimo sostenibile"),
      "LEADS header CPL invariato",
    ) &&
    assert(
      campagnaPage.includes("CPA massimo sostenibile"),
      "BOOKINGS header CPA invariato",
    ) &&
    assert(
      campagnaPage.includes("CPA Max (Break-Even)"),
      "ECOMMERCE header CPA invariato",
    ) &&
    assert(etichettaMetricaPrimaria("LEADS") === "CPL", "primary LEADS = CPL") &&
    assert(
      etichettaMetricaPrimaria("BOOKINGS") === "CPA prenotazione",
      "primary BOOKINGS",
    ) &&
    assert(etichettaMetricaPrimaria("ECOMMERCE") === "CPA", "primary ECOMMERCE") &&
    assert(etichettaMetricaPrimaria("AWARENESS") === "CPM", "primary AWARENESS") &&
    assert(
      etichettaCompleteness("MINIMUM") === "Metriche essenziali",
      "completeness MINIMUM copy umana",
    ) &&
    assert(
      etichettaCompleteness("INTERMEDIATE") === "Diagnosi di base disponibile",
      "completeness INTERMEDIATE copy umana",
    );

  const screenshotOk =
    assert(screenshotType.includes("cpc?:"), "schema screenshot ha cpc") &&
    assert(screenshotRoute.includes("cpcVisibile"), "API non inventa CPC") &&
    assert(screenshotRoute.includes("Non decidere lo stato economico"), "prompt: AI non decide health") &&
    assert(screenshotRoute.includes("CPM di riferimento (piano)"), "prompt awareness usa CPM");
    assert(risultati.includes("analisi.cpc"), "UI mappa CPC dallo screenshot");

  const logs = legge("src/lib/campaign-logs.ts");
  assert(
    logs.includes("Controllo performance salvato"),
    "log METRICS_UPDATED sintetico",
  );
  assert(
    risultati.includes("logControlloPerformanceSalvato"),
    "salvataggio check scrive un solo log",
  );

  const wizard = legge("src/components/nuova-contatti/PercorsoContatti.tsx");
  const approval = legge("src/lib/approval-token.ts");
  const approvalPage = legge("src/app/approvazione/[token]/page.tsx");
  assert(wizard.length > 100, "wizard PercorsoContatti invariato come file (presente)");
  assert(approval.includes("urlApprovazioneDaToken"), "approval token helper presente");

  const m022Ok =
    assert(
      approvalPage.includes("etichettaMetricaPrimaria"),
      "approval riusa etichettaMetricaPrimaria",
    ) &&
    assert(
      approvalPage.includes("etichettaSogliaEconomica"),
      "approval riusa etichettaSogliaEconomica",
    ) &&
    assert(
      !approvalPage.includes("CPA Max sostenibile"),
      "approval INSTORE senza CPA Max sostenibile",
    ) &&
    assert(
      !approvalPage.includes("CPA Massima Sostenibile di Recupero"),
      "approval RETARGETING senza CPA recupero",
    ) &&
    assert(
      !approvalPage.includes("Costo Max Sostenibile per Recupero"),
      "approval RETARGETING senza costo recupero",
    ) &&
    assert(
      approvalPage.includes('etichettaMetricaPrimaria("IN_STORE")'),
      "approval INSTORE primary condivisa",
    ) &&
    assert(
      approvalPage.includes('etichettaMetricaPrimaria("RETARGETING")'),
      "approval RETARGETING primary condivisa",
    ) &&
    assert(
      approvalPage.includes('etichettaMetricaPrimaria("AWARENESS")'),
      "approval AWARENESS primary condivisa",
    ) &&
    assert(
      approvalPage.includes("CPA Max (Break-Even)"),
      "approval ECOMMERCE CPA invariato",
    ) &&
    assert(
      approvalPage.includes("contatto (Soglia economica"),
      "approval LEADS soglia contatto invariata",
    ) &&
    assert(
      approvalPage.includes("prenotazione confermata"),
      "approval BOOKINGS prenotazione invariata",
    ) &&
    assert(
      etichettaSogliaEconomica("IN_STORE") ===
        "Costo per risultato sostenibile",
      "soglia INSTORE condivisa",
    ) &&
    assert(
      etichettaSogliaEconomica("RETARGETING") ===
        "Costo per risultato sostenibile",
      "soglia RETARGETING condivisa",
    ) &&
    assert(
      etichettaSogliaEconomica("AWARENESS") === "CPM di piano",
      "soglia AWARENESS CPM di piano",
    ) &&
    assert(
      etichettaSogliaEconomica("LEADS") === "CPL massimo sostenibile",
      "soglia LEADS invariata",
    ) &&
    assert(
      etichettaSogliaEconomica("BOOKINGS") === "CPA massimo sostenibile",
      "soglia BOOKINGS invariata",
    ) &&
    assert(
      etichettaSogliaEconomica("ECOMMERCE") === "CPA Max (Break-Even)",
      "soglia ECOMMERCE invariata",
    );

  sezione("UNIFIED SEMAPHORE", unifiedOk && bandeOk);
  sezione("CAMPAIGN CHECKS", campaignChecksOk);
  sezione("RLS", rlsOk);
  sezione("INSUFFICIENT DATA", insufficientOk);
  console.log(`AURORA A: ${auroraA ? "PASS" : "FAIL"}`);
  console.log(`AURORA B: ${auroraB ? "PASS" : "FAIL"}`);
  console.log(`AURORA C: ${auroraC ? "PASS" : "FAIL"}`);
  console.log(`AURORA C2: ${auroraC2 ? "PASS" : "FAIL"}`);
  console.log(`AURORA D: ${auroraD ? "PASS" : "FAIL"}`);
  sezione("HISTORY", historyOk);
  sezione("TREND", trendOk);
  sezione("CAMPAIGN DETAIL INTEGRATION", detailOk);
  sezione("SCREENSHOT KPI", screenshotOk);
  sezione("M0.2 METRIC SEMANTICS", m02Ok);
  sezione("M0.2.1 UI SEMANTICS", m021Ok);
  sezione("M0.2.2 APPROVAL SEMANTICS", m022Ok);
  console.log(`CASE A: ${caseAOk ? "PASS" : "FAIL"}`);
  console.log(`CASE B: ${caseBOk ? "PASS" : "FAIL"}`);
  console.log(`CASE C: ${caseCOk ? "PASS" : "FAIL"}`);
  console.log(`CASE D: ${caseDOk ? "PASS" : "FAIL"}`);
  console.log(`CASE E: ${caseEOk ? "PASS" : "FAIL"}`);
  console.log(`CASE F: ${caseFOk ? "PASS" : "FAIL"}`);
  console.log(`CASE G: ${caseGOk ? "PASS" : "FAIL"}`);
  console.log(`CASE H: ${caseHOk ? "PASS" : "FAIL"}`);
  console.log(`MIGRATION CREATED: ${migration.includes("campaign_checks") ? "YES" : "NO"}`);

  if (falliti > 0) {
    console.error(`\n${falliti} asserzioni fallite.`);
    process.exitCode = 1;
  } else {
    console.log("\nTutte le asserzioni Results V3 sono passate.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
