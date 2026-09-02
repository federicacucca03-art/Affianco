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
import {
  avvisiConteggiFunnel,
  conteggiFormDaScreenshot,
  deriveFunnelMetrics,
  parseOptionalNonNegativeInteger,
  parseScreenshotCount,
} from "@/lib/funnel-metrics";
import { mockScreenshotAnalysis } from "@/lib/mock-screenshot-analysis";
import {
  isMetaCsvSummaryLabel,
  kpiFormDaRigaMeta,
  parseAdsManagerCsv,
  parseMetaCsvNumber,
  parseCsvRows,
} from "@/lib/meta-csv";

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
  const {
    stessaGiornataLocale,
    mappaCampaignCheckDaRow,
    payloadNuovoCampaignCheck,
  } = await import("@/lib/campaign-checks-db");

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
      clicks: null,
      impressions: null,
      conversionRate: null,
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

  const migrationP0 = legge(
    "supabase/migrations/20260901_campaign_checks_clicks_impressions.sql",
  );
  const migrationP0Ok =
    assert(
      migrationP0.includes("add column if not exists clicks integer"),
      "migration clicks integer",
    ) &&
    assert(
      migrationP0.includes("add column if not exists impressions integer"),
      "migration impressions integer",
    ) &&
    assert(!/clicks integer not null/i.test(migrationP0), "clicks nullable") &&
    assert(
      !/impressions integer not null/i.test(migrationP0),
      "impressions nullable",
    ) &&
    assert(
      !/add column if not exists clicks integer\s+default/i.test(migrationP0),
      "clicks senza default SQL",
    ) &&
    assert(
      !/add column if not exists impressions integer\s+default/i.test(
        migrationP0,
      ),
      "impressions senza default SQL",
    ) &&
    assert(!/check \(clicks/i.test(migrationP0), "nessun CHECK clicks") &&
    assert(
      !legge("supabase/migrations/20260831_campaign_checks.sql").includes("clicks"),
      "migration 20260831 invariata (no clicks)",
    );

  function rowCheck(
    extra: Record<string, unknown> = {},
  ): Parameters<typeof mappaCampaignCheckDaRow>[0] {
    return {
      id: "id-1",
      campaign_id: "c1",
      user_id: "u1",
      created_at: "2026-09-01T10:00:00.000Z",
      days_active: 7,
      spend: 200,
      results_count: 2,
      primary_cost: 100,
      ctr: 1.2,
      cpm: 10,
      cpc: 1,
      frequency: 1.5,
      roas: null,
      health_status: "GREEN",
      signal: "sotto_soglia",
      actions: [],
      note: null,
      objective: "LEADS",
      threshold: 80,
      threshold_mode: "BREAK_EVEN",
      source: "MANUAL",
      ...extra,
    };
  }

  const mappedLegacy = mappaCampaignCheckDaRow(rowCheck());
  const mappedCounts = mappaCampaignCheckDaRow(
    rowCheck({ clicks: 100, impressions: 10_000 }),
  );
  const mappedZero = mappaCampaignCheckDaRow(
    rowCheck({ clicks: 0, impressions: 1000 }),
  );
  const mappedLarge = mappaCampaignCheckDaRow(
    rowCheck({ clicks: 250_000, impressions: 8_000_000 }),
  );

  const payloadZero = payloadNuovoCampaignCheck(
    {
      campaignId: "c1",
      daysActive: 7,
      spend: 200,
      resultsCount: 2,
      primaryCost: 100,
      ctr: null,
      cpm: null,
      cpc: null,
      frequency: null,
      roas: null,
      clicks: 0,
      impressions: 1000,
      healthStatus: "GREEN",
      signal: null,
      actions: [],
      note: null,
      objective: "LEADS",
      threshold: 80,
      thresholdMode: "BREAK_EVEN",
      source: "MANUAL",
    },
    "u1",
  );
  const payloadOmitted = payloadNuovoCampaignCheck(
    {
      campaignId: "c1",
      daysActive: 7,
      spend: 200,
      resultsCount: 2,
      primaryCost: 100,
      ctr: null,
      cpm: null,
      cpc: null,
      frequency: null,
      roas: null,
      healthStatus: "GREEN",
      signal: null,
      actions: [],
      note: null,
      objective: "LEADS",
      threshold: 80,
      thresholdMode: "BREAK_EVEN",
      source: "MANUAL",
    },
    "u1",
  );

  const caseA03 =
    assert(mappedLegacy != null, "CASE A map legacy") &&
    assert(mappedLegacy?.clicks === null, "CASE A clicks null") &&
    assert(mappedLegacy?.impressions === null, "CASE A impressions null");
  const caseB03 =
    assert(mappedCounts?.clicks === 100, "CASE B clicks 100") &&
    assert(mappedCounts?.impressions === 10_000, "CASE B impressions 10000");
  const caseC03 =
    assert(payloadZero.clicks === 0, "CASE C insert clicks 0 preserved") &&
    assert(payloadZero.impressions === 1000, "CASE C insert impressions 1000") &&
    assert(mappedZero?.clicks === 0, "CASE C map clicks 0 not null");
  const caseD03 =
    assert(payloadOmitted.clicks === null, "CASE D omitted clicks → null") &&
    assert(
      payloadOmitted.impressions === null,
      "CASE D omitted impressions → null",
    );
  const caseE03 =
    assert(mappedLarge?.clicks === 250_000, "CASE E clicks integer") &&
    assert(
      mappedLarge?.impressions === 8_000_000,
      "CASE E impressions integer no string",
    ) &&
    assert(typeof mappedLarge?.clicks === "number", "CASE E clicks is number") &&
    assert(
      typeof mappedLarge?.impressions === "number",
      "CASE E impressions is number",
    );

  const m03aOk =
    migrationP0Ok &&
    caseA03 &&
    caseB03 &&
    caseC03 &&
    caseD03 &&
    caseE03 &&
    assert(checksDb.includes("clicks: input.clicks ?? null"), "insert persiste clicks") &&
    assert(
      checksDb.includes("impressions: input.impressions ?? null"),
      "insert persiste impressions",
    ) &&
    assert(checksDb.includes('.select("*")'), "select * include nuove colonne");

  const funnelLib = legge("src/lib/funnel-metrics.ts");
  const risultati = legge("src/app/risultati/page.tsx");
  const controlRoomSrc = legge("src/lib/control-room.ts");
  const campagnaPage = legge("src/app/campagne/[id]/page.tsx");
  const pannello = legge("src/components/campagne/PannelloDiagnosiPerformance.tsx");
  const screenshotRoute = legge("src/app/api/analyze-screenshot/route.ts");
  const screenshotType = legge("src/types/screenshot-analysis.ts");

  const caseA03b = deriveFunnelMetrics({
    spend: null,
    results: null,
    clicks: null,
    impressions: null,
    manualCtr: 1.4,
    manualCpc: 2,
    manualCpm: 18,
  });
  const caseB03b = deriveFunnelMetrics({
    spend: 200,
    results: null,
    clicks: 100,
    impressions: 10_000,
    manualCtr: null,
    manualCpc: null,
    manualCpm: null,
  });
  const caseC03b = deriveFunnelMetrics({
    spend: 200,
    results: 0,
    clicks: 0,
    impressions: 10_000,
    manualCtr: null,
    manualCpc: null,
    manualCpm: null,
  });
  const caseD03b = deriveFunnelMetrics({
    spend: 200,
    results: null,
    clicks: 100,
    impressions: null,
    manualCtr: 1.4,
    manualCpc: null,
    manualCpm: 18,
  });
  const caseE03b = deriveFunnelMetrics({
    spend: 200,
    results: null,
    clicks: 100,
    impressions: 10_000,
    manualCtr: 4,
    manualCpc: 5,
    manualCpm: 50,
  });
  const caseF03b = deriveFunnelMetrics({
    spend: null,
    results: 10,
    clicks: 100,
    impressions: null,
    manualCtr: null,
    manualCpc: null,
    manualCpm: null,
  });
  const parseEmpty = parseOptionalNonNegativeInteger("");
  const parseZero = parseOptionalNonNegativeInteger("0");
  const parseDecimal = parseOptionalNonNegativeInteger("1.5");
  const warnOver = avvisiConteggiFunnel(110, 100);

  const persistEmpty = payloadNuovoCampaignCheck(
    {
      campaignId: "c1",
      daysActive: 7,
      spend: 200,
      resultsCount: 2,
      primaryCost: 100,
      ctr: caseA03b.ctr,
      cpm: caseA03b.cpm,
      cpc: caseA03b.cpc,
      frequency: null,
      roas: null,
      clicks: parseEmpty.ok ? parseEmpty.value : 0,
      impressions: parseEmpty.ok ? parseEmpty.value : 0,
      healthStatus: "GREEN",
      signal: null,
      actions: [],
      note: null,
      objective: "LEADS",
      threshold: 80,
      thresholdMode: "BREAK_EVEN",
      source: "MANUAL",
    },
    "u1",
  );
  const persistZero = payloadNuovoCampaignCheck(
    {
      campaignId: "c1",
      daysActive: 7,
      spend: 200,
      resultsCount: 2,
      primaryCost: 100,
      ctr: caseC03b.ctr,
      cpm: caseC03b.cpm,
      cpc: caseC03b.cpc,
      frequency: null,
      roas: null,
      clicks: parseZero.ok ? parseZero.value : null,
      impressions: 10_000,
      healthStatus: "GREEN",
      signal: null,
      actions: [],
      note: null,
      objective: "LEADS",
      threshold: 80,
      thresholdMode: "BREAK_EVEN",
      source: "MANUAL",
    },
    "u1",
  );
  const persistCanonical = payloadNuovoCampaignCheck(
    {
      campaignId: "c1",
      daysActive: 7,
      spend: 200,
      resultsCount: 2,
      primaryCost: 100,
      ctr: caseE03b.ctr,
      cpm: caseE03b.cpm,
      cpc: caseE03b.cpc,
      frequency: null,
      roas: null,
      clicks: 100,
      impressions: 10_000,
      healthStatus: "GREEN",
      signal: null,
      actions: [],
      note: null,
      objective: "LEADS",
      threshold: 80,
      thresholdMode: "BREAK_EVEN",
      source: "MANUAL",
    },
    "u1",
  );

  const healthAwBase = calcolaHealthStatus(20, 12.5, "efficiency", {
    daysActive: 10,
    resultsCount: 5,
  });
  const healthAwWithCounts = calcolaHealthStatus(20, 12.5, "efficiency", {
    daysActive: 10,
    resultsCount: 5,
  });
  const kpisAw = kpis({
    spend: 200,
    cpm: 20,
    ctr: 1,
    cpc: 2,
    clicks: 100,
    impressions: 10_000,
    conversionRate: 10,
    results: 5,
  });
  const diagAw = diagnosticaDeterministica(
    kpisAw,
    healthAwWithCounts,
    buildEconomicContext(
      {
        id: "aw",
        nomeCliente: "Aw",
        iniziali: "AW",
        stato: "Attiva",
        giudizio: "Ancora presto",
        objective: "AWARENESS",
        nomeCampagna: "Aw",
        estimatedCpm: 12.5,
      } as Campagna,
      kpisAw,
      12.5,
      "AWARENESS",
    ),
  );

  const mixedOld = deriveFunnelMetrics({
    spend: 200,
    results: 10,
    clicks: null,
    impressions: null,
    manualCtr: 1.4,
    manualCpc: 2,
    manualCpm: 18,
  });
  const mixedNew = deriveFunnelMetrics({
    spend: 200,
    results: 10,
    clicks: 100,
    impressions: 10_000,
    manualCtr: null,
    manualCpc: null,
    manualCpm: null,
  });
  const mixedMapOld = mappaCampaignCheckDaRow(rowCheck());
  const mixedMapNew = mappaCampaignCheckDaRow(
    rowCheck({ clicks: 100, impressions: 10_000, ctr: 1, cpc: 2, cpm: 20 }),
  );

  const caseA03bOk =
    assert(caseA03b.ctr === 1.4, "M0.3B CASE A CTR manual") &&
    assert(caseA03b.cpc === 2, "M0.3B CASE A CPC manual") &&
    assert(caseA03b.cpm === 18, "M0.3B CASE A CPM manual") &&
    assert(caseA03b.sources.ctr === "manual", "M0.3B CASE A source manual");
  const caseB03bOk =
    assert(caseB03b.ctr === 1, "M0.3B CASE B CTR 1") &&
    assert(caseB03b.cpc === 2, "M0.3B CASE B CPC 2") &&
    assert(caseB03b.cpm === 20, "M0.3B CASE B CPM 20") &&
    assert(caseB03b.sources.ctr === "derived", "M0.3B CASE B derived");
  const caseC03bOk =
    assert(caseC03b.ctr === 0, "M0.3B CASE C CTR 0") &&
    assert(caseC03b.cpc === null, "M0.3B CASE C CPC null") &&
    assert(caseC03b.cpm === 20, "M0.3B CASE C CPM 20") &&
    assert(caseC03b.conversionRate === null, "M0.3B CASE C CR null");
  const caseD03bOk =
    assert(caseD03b.cpc === 2, "M0.3B CASE D CPC derived") &&
    assert(caseD03b.ctr === 1.4, "M0.3B CASE D CTR fallback") &&
    assert(caseD03b.cpm === 18, "M0.3B CASE D CPM fallback");
  const caseE03bOk =
    assert(caseE03b.ctr === 1, "M0.3B CASE E canonical CTR") &&
    assert(caseE03b.cpc === 2, "M0.3B CASE E canonical CPC") &&
    assert(caseE03b.cpm === 20, "M0.3B CASE E canonical CPM") &&
    assert(caseE03b.mismatches.length === 3, "M0.3B CASE E 3 mismatch") &&
    assert(
      caseE03b.mismatches.some((m) => m.message.includes("CTR ricalcolato")),
      "M0.3B CASE E CTR warning copy",
    );
  const caseF03bOk = assert(
    caseF03b.conversionRate === 10,
    "M0.3B CASE F CR 10",
  );
  const caseG03bOk =
    assert(parseEmpty.ok && parseEmpty.value === null, "M0.3B CASE G empty → null") &&
    assert(persistEmpty.clicks === null, "M0.3B CASE G persist clicks null") &&
    assert(
      persistEmpty.impressions === null,
      "M0.3B CASE G persist impressions null",
    );
  const caseH03bOk =
    assert(parseZero.ok && parseZero.value === 0, "M0.3B CASE H parse 0") &&
    assert(persistZero.clicks === 0, "M0.3B CASE H persist 0");
  const caseI03bOk = assert(
    !parseDecimal.ok,
    "M0.3B CASE I decimal clicks fail",
  );
  const caseJ03bOk =
    assert(warnOver.length > 0, "M0.3B CASE J warning clicks > impressions") &&
    assert(
      parseOptionalNonNegativeInteger("110").ok &&
        parseOptionalNonNegativeInteger("100").ok,
      "M0.3B CASE J save still valid integers",
    );
  const caseK03bOk =
    assert(
      healthAwBase.status === healthAwWithCounts.status,
      "M0.3B CASE K health invariato",
    ) &&
    assert(healthAwWithCounts.mode === "efficiency", "M0.3B CASE K CPM mode") &&
    assert(
      !diagAw.evidence.some((e) =>
        e.toLowerCase().includes("click → risultato"),
      ),
      "M0.3B CASE K AWARENESS no CR in diagnosis evidence",
    );
  const caseL03bOk =
    assert(mixedOld.ctr === 1.4, "M0.3B CASE L legacy CTR fallback") &&
    assert(mixedNew.ctr === 1, "M0.3B CASE L new derived CTR") &&
    assert(mixedMapOld?.clicks === null, "M0.3B CASE L old map clicks null") &&
    assert(mixedMapNew?.clicks === 100, "M0.3B CASE L new map clicks") &&
    assert(mixedMapOld != null && mixedMapNew != null, "M0.3B CASE L no crash");

  const persistCanonicalOk =
    assert(persistCanonical.ctr === 1, "M0.3B persist canonical CTR") &&
    assert(persistCanonical.cpc === 2, "M0.3B persist canonical CPC") &&
    assert(persistCanonical.cpm === 20, "M0.3B persist canonical CPM") &&
    assert(
      !funnelLib.includes("conversion_rate"),
      "M0.3B CR non ha colonna DB",
    );

  const m03bUiOk =
    assert(risultati.includes("Metriche di funnel"), "UI sezione funnel") &&
    assert(risultati.includes("Facoltative"), "funnel microcopy secondaria") &&
    assert(risultati.includes("campiBloccoRisultato"), "gerarchia blocco risultato") &&
    assert(
      risultati.includes("campiBloccoDiagnostica"),
      "gerarchia blocco diagnostica",
    ) &&
    assert(
      risultati.includes("Calcolato automaticamente"),
      "UX derived read-only",
    ) &&
    assert(risultati.includes("kpiForm.clicks"), "UI stato clicks") &&
    assert(risultati.includes("kpiForm.impressions"), "UI stato impressions") &&
    assert(
      !risultati.includes('["clicks"'),
      "clicks non nei KPI principali",
    ) &&
    assert(
      screenshotRoute.includes("parseScreenshotCount"),
      "M0.3C API normalizza clicks/impressions",
    ) &&
    assert(
      controlRoomSrc.includes("conversionRate: number | null"),
      "ControlRoomKpis.conversionRate",
    ) &&
    assert(
      funnelLib.includes("export function deriveFunnelMetrics"),
      "helper canonico unico",
    ) &&
    assert(
      !controlRoomSrc.includes("clicks / impressions"),
      "formule non duplicate in control-room",
    );

  const m03bOk =
    caseA03bOk &&
    caseB03bOk &&
    caseC03bOk &&
    caseD03bOk &&
    caseE03bOk &&
    caseF03bOk &&
    caseG03bOk &&
    caseH03bOk &&
    caseI03bOk &&
    caseJ03bOk &&
    caseK03bOk &&
    caseL03bOk &&
    persistCanonicalOk &&
    m03bUiOk;

  const mockLegacy = mockScreenshotAnalysis({
    image: "x",
    obiettivo: "LEADS",
    targetCpl: 45,
    giorniAttiva: 5,
  });
  const formLegacy = conteggiFormDaScreenshot({});
  const formB = conteggiFormDaScreenshot({ clicks: 100, impressions: 10_000 });
  const derivedB = deriveFunnelMetrics({
    spend: 200,
    results: 10,
    clicks: parseScreenshotCount(100),
    impressions: parseScreenshotCount(10_000),
    manualCtr: null,
    manualCpc: null,
    manualCpm: null,
  });
  const derivedC = deriveFunnelMetrics({
    spend: 200,
    results: 10,
    clicks: 100,
    impressions: 10_000,
    manualCtr: 4,
    manualCpc: null,
    manualCpm: null,
  });
  const derivedD = deriveFunnelMetrics({
    spend: 200,
    results: null,
    clicks: 100,
    impressions: null,
    manualCtr: 1.4,
    manualCpc: null,
    manualCpm: 18,
  });
  const derivedE = deriveFunnelMetrics({
    spend: 200,
    results: null,
    clicks: null,
    impressions: 10_000,
    manualCtr: 1.4,
    manualCpc: 2,
    manualCpm: null,
  });
  const derivedG = deriveFunnelMetrics({
    spend: 200,
    results: 0,
    clicks: 0,
    impressions: 10_000,
    manualCtr: null,
    manualCpc: null,
    manualCpm: null,
  });
  const derivedI0 = deriveFunnelMetrics({
    spend: 200,
    results: 10,
    clicks: 100,
    impressions: 10_000,
    manualCtr: 1.4,
    manualCpc: null,
    manualCpm: null,
  });
  const derivedI1 = deriveFunnelMetrics({
    spend: 200,
    results: 10,
    clicks: 200,
    impressions: 10_000,
    manualCtr: 1.4,
    manualCpc: null,
    manualCpm: null,
  });
  const payloadScreenshot = payloadNuovoCampaignCheck(
    {
      campaignId: "c1",
      daysActive: 7,
      spend: 200,
      resultsCount: 10,
      primaryCost: 20,
      ctr: derivedB.ctr,
      cpm: derivedB.cpm,
      cpc: derivedB.cpc,
      frequency: null,
      roas: null,
      clicks: 100,
      impressions: 10_000,
      healthStatus: "GREEN",
      signal: null,
      actions: [],
      note: null,
      objective: "LEADS",
      threshold: 80,
      thresholdMode: "BREAK_EVEN",
      source: "SCREENSHOT",
    },
    "u1",
  );
  const healthAwShot = calcolaHealthStatus(20, 12.5, "efficiency", {
    daysActive: 10,
    resultsCount: 5,
  });

  const caseA03cOk =
    assert(formLegacy.clicks === "", "M0.3C CASE A form clicks empty") &&
    assert(formLegacy.impressions === "", "M0.3C CASE A form impressions empty") &&
    assert(!formLegacy.apriFunnel, "M0.3C CASE A no auto-open") &&
    assert(mockLegacy.clicks === null, "M0.3C CASE A mock clicks null") &&
    assert(mockLegacy.impressions === null, "M0.3C CASE A mock impressions null") &&
    assert(parseScreenshotCount(undefined) === null, "M0.3C CASE A missing → null");
  const caseB03cOk =
    assert(formB.clicks === "100", "M0.3C CASE B form clicks") &&
    assert(formB.impressions === "10000", "M0.3C CASE B form impressions") &&
    assert(formB.apriFunnel, "M0.3C CASE B auto-open funnel") &&
    assert(derivedB.ctr === 1, "M0.3C CASE B CTR 1") &&
    assert(derivedB.cpc === 2, "M0.3C CASE B CPC 2") &&
    assert(derivedB.cpm === 20, "M0.3C CASE B CPM 20");
  const caseC03cOk =
    assert(derivedC.ctr === 1, "M0.3C CASE C canonical CTR") &&
    assert(derivedC.mismatches.some((m) => m.metric === "ctr"), "M0.3C CASE C mismatch");
  const caseD03cOk =
    assert(derivedD.cpc === 2, "M0.3C CASE D CPC derived") &&
    assert(derivedD.ctr === 1.4, "M0.3C CASE D CTR fallback") &&
    assert(derivedD.cpm === 18, "M0.3C CASE D CPM fallback");
  const caseE03cOk =
    assert(derivedE.cpm === 20, "M0.3C CASE E CPM derived") &&
    assert(derivedE.ctr === 1.4, "M0.3C CASE E CTR fallback") &&
    assert(derivedE.cpc === 2, "M0.3C CASE E CPC fallback");
  const caseF03cOk =
    assert(parseScreenshotCount(100.5) === null, "M0.3C CASE F 100.5 number") &&
    assert(parseScreenshotCount("100.5") === null, "M0.3C CASE F 100.5 string") &&
    assert(parseScreenshotCount("1.000") === 1000, "M0.3C thousands 1.000") &&
    assert(parseScreenshotCount("1,000") === 1000, "M0.3C thousands 1,000") &&
    assert(parseScreenshotCount("10.000") === 10_000, "M0.3C thousands 10.000") &&
    assert(parseScreenshotCount("10,000") === 10_000, "M0.3C thousands 10,000") &&
    assert(parseScreenshotCount("1K") === null, "M0.3C no 1K abbreviation");
  const caseG03cOk =
    assert(parseScreenshotCount(0) === 0, "M0.3C CASE G zero preserved") &&
    assert(derivedG.ctr === 0, "M0.3C CASE G CTR 0") &&
    assert(derivedG.cpc === null, "M0.3C CASE G CPC null") &&
    assert(conteggiFormDaScreenshot({ clicks: 0, impressions: 10_000 }).clicks === "0", "M0.3C CASE G form 0");
  const caseH03cOk =
    assert(healthAwShot.mode === "efficiency", "M0.3C CASE H CPM primary") &&
    assert(healthAwShot.status === healthAwBase.status, "M0.3C CASE H health unchanged");
  const caseI03cOk =
    assert(derivedI0.ctr === 1, "M0.3C CASE I before edit CTR 1") &&
    assert(derivedI1.ctr === 2, "M0.3C CASE I after edit CTR 2") &&
    assert(derivedI1.cpc === 1, "M0.3C CASE I after edit CPC 1");
  const caseJ03cOk =
    assert(payloadScreenshot.source === "SCREENSHOT", "M0.3C CASE J payload SCREENSHOT") &&
    assert(risultati.includes('"SCREENSHOT"'), "M0.3C CASE J UI source SCREENSHOT");

  const m03cOk =
    caseA03cOk &&
    caseB03cOk &&
    caseC03cOk &&
    caseD03cOk &&
    caseE03cOk &&
    caseF03cOk &&
    caseG03cOk &&
    caseH03cOk &&
    caseI03cOk &&
    caseJ03cOk &&
    assert(
      screenshotRoute.includes("NON ricostruire clicks"),
      "prompt: AI non deriva raw counts",
    ) &&
    assert(
      !screenshotRoute.includes("deriveFunnelMetrics"),
      "API non duplica deriveFunnelMetrics",
    ) &&
    assert(screenshotType.includes("clicks?:"), "contract clicks optional") &&
    assert(screenshotType.includes("impressions?:"), "contract impressions optional") &&
    assert(risultati.includes("conteggiFormDaScreenshot"), "UI idrata funnel da screenshot") &&
    assert(risultati.includes("funnelAperto"), "UI auto-open funnel") &&
    assert(risultati.includes("Trovati nello screenshot"), "feedback extraction");

  const csvIt = `Nome della campagna,Risultati,Importo speso (EUR),Costo per risultato,Impression,Clic sul link,CTR (percentuale di clic sul link),CPC (costo per clic sul link),CPM (costo per 1.000 impression),Frequenza
Aurora Lead,10,"200,00","20,00","10.000",100,"1,00%","2,00","20,00","1,40"`;
  const parsedIt = parseAdsManagerCsv(csvIt);
  const rowIt = parsedIt.ok ? parsedIt.autoRow : null;
  const csvEn = `Campaign name,Results,Amount spent (EUR),Cost per result,Impressions,Link clicks,CTR (link click-through rate),CPC (cost per link click),CPM,Frequency
Aurora Lead,10,200.00,20.00,"10,000",100,1.00%,2.00,20.00,1.40`;
  const parsedEn = parseAdsManagerCsv(csvEn);
  const rowEn = parsedEn.ok ? parsedEn.autoRow : null;
  const csvPartial = `Risultati,Importo speso,Impression,Reach,LPV
10,200,10000,50000,12`;
  const parsedPartial = parseAdsManagerCsv(csvPartial);
  const rowPartial = parsedPartial.ok ? parsedPartial.autoRow : null;
  const csvBothClicks = `Impressions,Clicks,Link clicks,Importo speso
10000,200,100,200`;
  const parsedBoth = parseAdsManagerCsv(csvBothClicks);
  const rowBoth = parsedBoth.ok ? parsedBoth.autoRow : null;
  const csvConflict = `Importo speso,Clic sul link,Impression,CTR
200,100,10000,4%`;
  const parsedConflict = parseAdsManagerCsv(csvConflict);
  const rowConflict = parsedConflict.ok ? parsedConflict.autoRow : null;
  const derivedConflict = rowConflict
    ? deriveFunnelMetrics({
        spend: rowConflict.spend,
        results: null,
        clicks: rowConflict.clicks,
        impressions: rowConflict.impressions,
        manualCtr: rowConflict.ctr,
        manualCpc: rowConflict.cpc,
        manualCpm: rowConflict.cpm,
      })
    : null;
  const csvMulti = `Nome della campagna,Importo speso,Risultati
Alpha,100,5
Beta,200,8`;
  const parsedMulti = parseAdsManagerCsv(csvMulti);
  const csvSummary = `Nome della campagna,Importo speso,Risultati
Aurora,200,10
Risultati di 1 gruppo di inserzioni,200,10`;
  const parsedSummary = parseAdsManagerCsv(csvSummary);
  const csvRatios = `CTR,CPC,CPM
4,5,50`;
  const parsedRatios = parseAdsManagerCsv(csvRatios);
  const rowRatios = parsedRatios.ok ? parsedRatios.autoRow : null;
  const derivedRatios = rowRatios
    ? deriveFunnelMetrics({
        spend: null,
        results: null,
        clicks: rowRatios.clicks,
        impressions: rowRatios.impressions,
        manualCtr: rowRatios.ctr,
        manualCpc: rowRatios.cpc,
        manualCpm: rowRatios.cpm,
      })
    : null;
  const formIt = rowIt ? kpiFormDaRigaMeta(rowIt) : null;
  const payloadCsv = payloadNuovoCampaignCheck(
    {
      campaignId: "c1",
      daysActive: 7,
      spend: 200,
      resultsCount: 10,
      primaryCost: 20,
      ctr: 1,
      cpm: 20,
      cpc: 2,
      frequency: null,
      roas: null,
      clicks: 100,
      impressions: 10_000,
      healthStatus: "GREEN",
      signal: null,
      actions: [],
      note: null,
      objective: "LEADS",
      threshold: 80,
      thresholdMode: "BREAK_EVEN",
      source: "CSV",
    },
    "u1",
  );

  const caseACsvOk =
    assert(parsedIt.ok, "M0.3C.1 CASE A parse IT") &&
    assert(rowIt?.results === 10, "M0.3C.1 CASE A results") &&
    assert(rowIt?.spend === 200, "M0.3C.1 CASE A spend") &&
    assert(rowIt?.impressions === 10_000, "M0.3C.1 CASE A impressions") &&
    assert(rowIt?.clicks === 100, "M0.3C.1 CASE A clicks") &&
    assert(formIt?.clicks === "100", "M0.3C.1 CASE A form clicks");
  const caseBCsvOk =
    assert(parsedEn.ok, "M0.3C.1 CASE B parse EN") &&
    assert(rowEn?.clicks === 100, "M0.3C.1 CASE B link clicks") &&
    assert(rowEn?.impressions === 10_000, "M0.3C.1 CASE B impressions");
  const caseCCsvOk =
    assert(rowPartial?.clicks == null, "M0.3C.1 CASE C clicks null") &&
    assert(rowPartial?.impressions === 10_000, "M0.3C.1 CASE C impressions") &&
    assert(rowPartial?.spend === 200, "M0.3C.1 CASE C spend");
  const caseDCsvOk = assert(
    rowPartial != null && rowPartial.recognizedCount >= 3,
    "M0.3C.1 CASE D unknown columns ignored",
  );
  const caseECsvOk =
    assert(derivedConflict?.ctr === 1, "M0.3C.1 CASE E canonical CTR") &&
    assert(
      (derivedConflict?.mismatches.length ?? 0) > 0,
      "M0.3C.1 CASE E mismatch",
    );
  const caseFCsvOk =
    assert(parseMetaCsvNumber("435,52", "decimal") === 435.52, "M0.3C.1 CASE F 435,52") &&
    assert(parseMetaCsvNumber("43.758", "count") === 43_758, "M0.3C.1 CASE F 43.758") &&
    assert(parseMetaCsvNumber("1.049", "count") === 1049, "M0.3C.1 CASE F 1.049") &&
    assert(parseMetaCsvNumber("2,397%", "percent") === 2.397, "M0.3C.1 CASE F 2,397%") &&
    assert(parseMetaCsvNumber("€ 435,52", "decimal") === 435.52, "M0.3C.1 CASE F euro");
  const caseGCsvOk =
    assert(parseMetaCsvNumber("435.52", "decimal") === 435.52, "M0.3C.1 CASE G 435.52") &&
    assert(parseMetaCsvNumber("43,758", "count") === 43_758, "M0.3C.1 CASE G 43,758") &&
    assert(parseMetaCsvNumber("1,049", "count") === 1049, "M0.3C.1 CASE G 1,049") &&
    assert(parseMetaCsvNumber("2.397%", "percent") === 2.397, "M0.3C.1 CASE G 2.397%");
  const caseHCsvOk =
    assert(parsedMulti.ok && parsedMulti.needsSelection, "M0.3C.1 CASE H selector") &&
    assert(parsedMulti.ok && parsedMulti.autoRow === null, "M0.3C.1 CASE H no auto aggregate") &&
    assert(parsedMulti.ok && parsedMulti.dataRows.length === 2, "M0.3C.1 CASE H two rows");
  const caseICsvOk =
    assert(isMetaCsvSummaryLabel("Risultati di 1 gruppo di inserzioni"), "M0.3C.1 CASE I summary label") &&
    assert(parsedSummary.ok && parsedSummary.autoRow?.campaignName === "Aurora", "M0.3C.1 CASE I data row") &&
    assert(parsedSummary.ok && !parsedSummary.needsSelection, "M0.3C.1 CASE I no double count");
  const caseJCsvOk = assert(
    !parseAdsManagerCsv("ciao mondo").ok,
    "M0.3C.1 CASE J unreadable/no metrics",
  );
  const caseKCsvOk =
    assert(rowRatios?.clicks == null, "M0.3C.1 CASE K no invented clicks") &&
    assert(derivedRatios?.ctr === 4, "M0.3C.1 CASE K CTR fallback") &&
    assert(derivedRatios?.cpc === 5, "M0.3C.1 CASE K CPC fallback");
  const caseLCsvOk =
    assert(payloadCsv.source === "CSV", "M0.3C.1 CASE L payload CSV") &&
    assert(risultati.includes('importOrigin === "csv"'), "M0.3C.1 CASE L UI source CSV");
  const caseMCsvOk =
    assert(risultati.includes("applicaKpiDaScreenshot"), "M0.3C.1 CASE M screenshot hydration") &&
    assert(risultati.includes("/api/analyze-screenshot"), "M0.3C.1 CASE M screenshot API") &&
    assert(risultati.includes("Importa da Ads Manager"), "M0.3C.1 import tab");
  const editedFromCsv = deriveFunnelMetrics({
    spend: 200,
    results: 10,
    clicks: 200,
    impressions: 10_000,
    manualCtr: 1,
    manualCpc: 2,
    manualCpm: 20,
  });
  const caseNCsvOk =
    assert(editedFromCsv.ctr === 2, "M0.3C.1 CASE N recalc CTR") &&
    assert(editedFromCsv.cpc === 1, "M0.3C.1 CASE N recalc CPC") &&
    assert(rowBoth?.clicks === 100, "M0.3C.1 link click priority over clicks");

  const csvFreqIt = `Frequenza,Clic sul link
"2,488795",1049`;
  const parsedFreqIt = parseAdsManagerCsv(csvFreqIt);
  const rowFreqIt = parsedFreqIt.ok ? parsedFreqIt.autoRow : null;
  const csvFreqEn = `Frequency,Link clicks
2.488795,1049`;
  const parsedFreqEn = parseAdsManagerCsv(csvFreqEn);
  const rowFreqEn = parsedFreqEn.ok ? parsedFreqEn.autoRow : null;
  const csvFreqShort = `Frequenza
"2,49"`;
  const parsedFreqShort = parseAdsManagerCsv(csvFreqShort);
  const rowFreqShort = parsedFreqShort.ok ? parsedFreqShort.autoRow : null;
  const csvRealFreq = `Importo speso (EUR),Risultati,Clic sul link,Impression,Frequenza
"435,52",64,1049,"43.758","2,488795"`;
  const parsedRealFreq = parseAdsManagerCsv(csvRealFreq);
  const rowRealFreq = parsedRealFreq.ok ? parsedRealFreq.autoRow : null;
  const formRealFreq = rowRealFreq ? kpiFormDaRigaMeta(rowRealFreq) : null;

  const caseFreqAOk =
    assert(rowFreqIt?.frequency === 2.488795, "M0.3C.1 FREQ CASE A 2,488795") &&
    assert(
      rowFreqIt != null && kpiFormDaRigaMeta(rowFreqIt).frequency === "2.488795",
      "M0.3C.1 FREQ CASE A form",
    );
  const caseFreqBOk = assert(
    rowFreqEn?.frequency === 2.488795,
    "M0.3C.1 FREQ CASE B 2.488795",
  );
  const caseFreqCOk = assert(
    rowFreqShort?.frequency === 2.49,
    "M0.3C.1 FREQ CASE C 2,49",
  );
  const caseFreqDOk = assert(
    rowPartial?.frequency == null,
    "M0.3C.1 FREQ CASE D missing → null",
  );
  const caseFreqEOk =
    assert(rowRealFreq?.spend === 435.52, "M0.3C.1 FREQ CASE E spend") &&
    assert(rowRealFreq?.results === 64, "M0.3C.1 FREQ CASE E results") &&
    assert(rowRealFreq?.clicks === 1049, "M0.3C.1 FREQ CASE E clicks") &&
    assert(rowRealFreq?.impressions === 43_758, "M0.3C.1 FREQ CASE E impressions") &&
    assert(rowRealFreq?.frequency === 2.488795, "M0.3C.1 FREQ CASE E frequency") &&
    assert(formRealFreq?.frequency === "2.488795", "M0.3C.1 FREQ CASE E form");

  const m03c1Ok =
    caseACsvOk &&
    caseBCsvOk &&
    caseCCsvOk &&
    caseDCsvOk &&
    caseECsvOk &&
    caseFCsvOk &&
    caseGCsvOk &&
    caseHCsvOk &&
    caseICsvOk &&
    caseJCsvOk &&
    caseKCsvOk &&
    caseLCsvOk &&
    caseMCsvOk &&
    caseNCsvOk &&
    caseFreqAOk &&
    caseFreqBOk &&
    caseFreqCOk &&
    caseFreqDOk &&
    caseFreqEOk &&
    assert(parseCsvRows('"a,b",c').length === 1, "CSV quoted comma") &&
    assert(
      legge("src/lib/meta-csv.ts").includes("HEADER_CLICKS_PRIORITY"),
      "click priority documented",
    ) &&
    assert(!risultati.includes("parseMetaCsvReport"), "no analyzer aggregate import");

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
  sezione("M0.3A CLICKS IMPRESSIONS SCHEMA", m03aOk);
  sezione("M0.3B FUNNEL DERIVATION", m03bOk);
  sezione("M0.3C SCREENSHOT COUNTS", m03cOk);
  sezione("M0.3C.1 META CSV IMPORT", m03c1Ok);
  console.log(`M0.3C.1 CASE A: ${caseACsvOk ? "PASS" : "FAIL"}`);
  console.log(`M0.3C.1 CASE B: ${caseBCsvOk ? "PASS" : "FAIL"}`);
  console.log(`M0.3C.1 CASE C: ${caseCCsvOk ? "PASS" : "FAIL"}`);
  console.log(`M0.3C.1 CASE D: ${caseDCsvOk ? "PASS" : "FAIL"}`);
  console.log(`M0.3C.1 CASE E: ${caseECsvOk ? "PASS" : "FAIL"}`);
  console.log(`M0.3C.1 CASE F: ${caseFCsvOk ? "PASS" : "FAIL"}`);
  console.log(`M0.3C.1 CASE G: ${caseGCsvOk ? "PASS" : "FAIL"}`);
  console.log(`M0.3C.1 CASE H: ${caseHCsvOk ? "PASS" : "FAIL"}`);
  console.log(`M0.3C.1 CASE I: ${caseICsvOk ? "PASS" : "FAIL"}`);
  console.log(`M0.3C.1 CASE J: ${caseJCsvOk ? "PASS" : "FAIL"}`);
  console.log(`M0.3C.1 CASE K: ${caseKCsvOk ? "PASS" : "FAIL"}`);
  console.log(`M0.3C.1 CASE L: ${caseLCsvOk ? "PASS" : "FAIL"}`);
  console.log(`M0.3C.1 CASE M: ${caseMCsvOk ? "PASS" : "FAIL"}`);
  console.log(`M0.3C.1 CASE N: ${caseNCsvOk ? "PASS" : "FAIL"}`);
  console.log(`M0.3C CASE A: ${caseA03cOk ? "PASS" : "FAIL"}`);
  console.log(`M0.3C CASE B: ${caseB03cOk ? "PASS" : "FAIL"}`);
  console.log(`M0.3C CASE C: ${caseC03cOk ? "PASS" : "FAIL"}`);
  console.log(`M0.3C CASE D: ${caseD03cOk ? "PASS" : "FAIL"}`);
  console.log(`M0.3C CASE E: ${caseE03cOk ? "PASS" : "FAIL"}`);
  console.log(`M0.3C CASE F: ${caseF03cOk ? "PASS" : "FAIL"}`);
  console.log(`M0.3C CASE G: ${caseG03cOk ? "PASS" : "FAIL"}`);
  console.log(`M0.3C CASE H: ${caseH03cOk ? "PASS" : "FAIL"}`);
  console.log(`M0.3C CASE I: ${caseI03cOk ? "PASS" : "FAIL"}`);
  console.log(`M0.3C CASE J: ${caseJ03cOk ? "PASS" : "FAIL"}`);
  console.log(`M0.3B CASE A: ${caseA03bOk ? "PASS" : "FAIL"}`);
  console.log(`M0.3B CASE B: ${caseB03bOk ? "PASS" : "FAIL"}`);
  console.log(`M0.3B CASE C: ${caseC03bOk ? "PASS" : "FAIL"}`);
  console.log(`M0.3B CASE D: ${caseD03bOk ? "PASS" : "FAIL"}`);
  console.log(`M0.3B CASE E: ${caseE03bOk ? "PASS" : "FAIL"}`);
  console.log(`M0.3B CASE F: ${caseF03bOk ? "PASS" : "FAIL"}`);
  console.log(`M0.3B CASE G: ${caseG03bOk ? "PASS" : "FAIL"}`);
  console.log(`M0.3B CASE H: ${caseH03bOk ? "PASS" : "FAIL"}`);
  console.log(`M0.3B CASE I: ${caseI03bOk ? "PASS" : "FAIL"}`);
  console.log(`M0.3B CASE J: ${caseJ03bOk ? "PASS" : "FAIL"}`);
  console.log(`M0.3B CASE K: ${caseK03bOk ? "PASS" : "FAIL"}`);
  console.log(`M0.3B CASE L: ${caseL03bOk ? "PASS" : "FAIL"}`);
  console.log(`M0.3A CASE A: ${caseA03 ? "PASS" : "FAIL"}`);
  console.log(`M0.3A CASE B: ${caseB03 ? "PASS" : "FAIL"}`);
  console.log(`M0.3A CASE C: ${caseC03 ? "PASS" : "FAIL"}`);
  console.log(`M0.3A CASE D: ${caseD03 ? "PASS" : "FAIL"}`);
  console.log(`M0.3A CASE E: ${caseE03 ? "PASS" : "FAIL"}`);
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
