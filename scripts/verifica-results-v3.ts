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
  etichettaTrend,
  HEALTH_GREEN_MAX_RATIO,
  thresholdModeDaHealth,
  trendVsPrecedente,
  type ControlRoomKpis,
} from "@/lib/control-room";

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
    return { health, diagnosis, actions };
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
    assert(risultati.includes("Control Room"), "titolo Control Room") &&
    assert(risultati.includes("verdetto: _verdetto"), "client ignora verdetto screenshot");

  const screenshotOk =
    assert(screenshotType.includes("cpc?:"), "schema screenshot ha cpc") &&
    assert(screenshotRoute.includes("cpcVisibile"), "API non inventa CPC") &&
    assert(screenshotRoute.includes('"cpc"'), "prompt chiede cpc") &&
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
  assert(wizard.length > 100, "wizard PercorsoContatti invariato come file (presente)");
  assert(approval.includes("urlApprovazioneDaToken"), "approval token helper presente");

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
